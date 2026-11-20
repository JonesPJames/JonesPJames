"""Forward-only event-sourced paper trading engine. No real-money orders."""
import os,time,sqlite3,json,datetime,logging
from decimal import Decimal
D=lambda x:Decimal(str(x))
FEE=D('.002');SLIP=D('.001');INITIAL=D('1000');LEGACY_RESERVED=D('672.26075')
class Engine:
 def __init__(self,db):self.db=db
 def setup(self):
  self.db.execute('PRAGMA busy_timeout=30000')
  self.db.execute('CREATE TABLE IF NOT EXISTS v3_orders(id TEXT PRIMARY KEY,symbol TEXT,created_ns INTEGER,lim TEXT,stop TEXT,take TEXT,notional TEXT,status TEXT)')
  self.db.execute('CREATE TABLE IF NOT EXISTS ledger_events(id TEXT PRIMARY KEY,order_id TEXT,kind TEXT,ts_ns INTEGER,payload TEXT,quality TEXT)')
  self.db.execute('CREATE TABLE IF NOT EXISTS sync_outbox(event_id TEXT PRIMARY KEY,created_ns INTEGER,delivered INTEGER DEFAULT 0)')
  self.db.execute('CREATE TABLE IF NOT EXISTS v3_cursor(key TEXT PRIMARY KEY,ts_ns INTEGER)')
  self.db.commit()
 def place(self,oid,symbol,limit,stop,take,notional,created_ns=None):
  limit,stop,take,notional=map(D,(limit,stop,take,notional))
  if not 0<stop<limit<take or notional<=0:raise ValueError('invalid order')
  with self.db:self.db.execute('INSERT OR IGNORE INTO v3_orders VALUES(?,?,?,?,?,?,?,?)',(oid,symbol,created_ns if created_ns is not None else time.time_ns(),str(limit),str(stop),str(take),str(notional),'WAITING'))
 def status(self,oid):
  r=self.db.execute('SELECT status FROM v3_orders WHERE id=?',(oid,)).fetchone();return r[0] if r else None
 def events(self):return [(k,oid,json.loads(p)) for k,oid,p in self.db.execute('SELECT kind,order_id,payload FROM ledger_events')]
 def cash(self):return INITIAL-LEGACY_RESERVED+sum((D(p['cash_delta']) for _,_,p in self.events()),D(0))
 def reserved(self):return sum((D(r[0])*(1+FEE+SLIP) for r in self.db.execute("SELECT notional FROM v3_orders WHERE status='WAITING'")),D(0))
 def weekly_loss(self,ts_ns):
  dt=datetime.datetime.fromtimestamp(ts_ns/1e9,datetime.timezone.utc)
  monday=(dt-datetime.timedelta(days=dt.weekday())).date()
  return -sum((min(D(0),D(p['pnl'])) for k,_,p in self.events() if k=='SELL' and monday<=datetime.datetime.fromtimestamp(int(p['ts_ns'])/1e9,datetime.timezone.utc).date()<monday+datetime.timedelta(days=7)),D(0))
 def tick(self,symbol,ts_ns,price,volume):
  price,volume=D(price),D(volume)
  if price<=0 or volume<=0:return False
  changed=False
  rows=self.db.execute('SELECT id,created_ns,lim,stop,take,notional,status FROM v3_orders WHERE symbol=? ORDER BY created_ns,id',(symbol,)).fetchall()
  for oid,created,lim,stop,take,nom,status in rows:
   if ts_ns<=created:continue
   lim,stop,take,nom=map(D,(lim,stop,take,nom))
   if status=='WAITING':
    entry=price*(1+SLIP);qty=nom/lim
    if entry>lim or entry<=stop or qty>volume:continue
    # Reject entries whose stop is inside the simulated spread/slippage noise.
    # Existing open positions are unaffected; only new entries are screened.
    if (entry-stop)/entry<D('.002'):continue
    if (take-entry)/(entry-stop)<D('1.5'):continue
    debit=qty*entry*(1+FEE)
    risk=qty*(entry-stop)+debit*FEE+qty*entry*SLIP
    if risk>D(10) or self.weekly_loss(ts_ns)+risk>D(50):continue
    if debit>self.cash()-self.reserved()+nom*(1+FEE+SLIP):continue
    payload={'order_id':oid,'symbol':symbol,'ts_ns':ts_ns,'price':str(entry),'qty':str(qty),'cash_delta':str(-debit),'stop':str(stop),'take':str(take),'fee':str(qty*entry*FEE),'source':'kraken','execution_proof':False,'quality':'TICK_BASED_PAPER_SIMULATION'}
    with self.db:
     cur=self.db.execute('INSERT OR IGNORE INTO ledger_events VALUES(?,?,?,?,?,?)',(oid+':BUY',oid,'BUY',ts_ns,json.dumps(payload),'TICK_BASED_PAPER_SIMULATION'))
     if cur.rowcount:
      self.db.execute("UPDATE v3_orders SET status='OPEN' WHERE id=? AND status='WAITING'",(oid,))
      self.db.execute('INSERT OR IGNORE INTO sync_outbox(event_id,created_ns) VALUES(?,?)',(oid+':BUY',time.time_ns()))
      changed=True
   elif status=='OPEN':
    r=self.db.execute('SELECT payload,ts_ns FROM ledger_events WHERE id=?',(oid+':BUY',)).fetchone()
    if not r or ts_ns<=r[1] or stop<price<take:continue
    buy=json.loads(r[0]);qty=D(buy['qty'])
    if volume<qty:continue
    exit_px=price*(1-SLIP);credit=qty*exit_px*(1-FEE);pnl=credit+D(buy['cash_delta'])
    payload={'order_id':oid,'symbol':symbol,'ts_ns':ts_ns,'price':str(exit_px),'qty':str(qty),'cash_delta':str(credit),'pnl':str(pnl),'fee':str(qty*exit_px*FEE),'reason':'STOP' if price<=stop else 'TAKE','source':'kraken','execution_proof':False,'quality':'TICK_BASED_PAPER_SIMULATION'}
    with self.db:
     cur=self.db.execute('INSERT OR IGNORE INTO ledger_events VALUES(?,?,?,?,?,?)',(oid+':SELL',oid,'SELL',ts_ns,json.dumps(payload),'TICK_BASED_PAPER_SIMULATION'))
     if cur.rowcount:
      self.db.execute("UPDATE v3_orders SET status='CLOSED' WHERE id=? AND status='OPEN'",(oid,))
      self.db.execute('INSERT OR IGNORE INTO sync_outbox(event_id,created_ns) VALUES(?,?)',(oid+':SELL',time.time_ns()))
      changed=True
  return changed
 def process(self):
  cursor=self.db.execute("SELECT ts_ns FROM v3_cursor WHERE key='kraken'").fetchone()
  last=cursor[0] if cursor else 0
  rows=self.db.execute('SELECT ts_ns,symbol,price,volume FROM trades WHERE exchange=? AND ts_ns>? ORDER BY ts_ns LIMIT 100000',('kraken',last)).fetchall()
  for ts,sym,price,vol in rows:
   self.tick(sym,ts,price,vol)
   with self.db:self.db.execute("INSERT INTO v3_cursor VALUES('kraken',?) ON CONFLICT(key) DO UPDATE SET ts_ns=excluded.ts_ns",(ts,))
 def outbox(self):return self.db.execute('SELECT e.id,e.kind,e.payload FROM ledger_events e JOIN sync_outbox s ON s.event_id=e.id WHERE s.delivered=0 ORDER BY e.ts_ns,e.id').fetchall()
def main():
 logging.basicConfig(level=logging.INFO,format='%(asctime)s %(levelname)s %(message)s')
 db=sqlite3.connect(os.getenv('DB_PATH','/data/market.db'),timeout=30)
 db.execute('PRAGMA journal_mode=WAL');e=Engine(db);e.setup()
 now=time.time_ns()
 for oid,sym,lim,sl,tp in [('V3-BTC-001','BTCUSD','63500','62600','65800'),('V3-ETH-001','ETHUSD','1765','1695','1900')]:
  e.place(oid,sym,lim,sl,tp,50,created_ns=now)
 while True:
  try:
   e.process()
   logging.info('V3_HEARTBEAT cash=%s reserved=%s unsynced=%d',e.cash(),e.reserved(),len(e.outbox()))
   for event_id,kind,payload in e.outbox():logging.warning('V3_LEDGER_EVENT_NEEDS_SHEETS_SYNC %s',json.dumps({'event_id':event_id,'kind':kind,'payload':json.loads(payload)}))
  except Exception:logging.exception('V3_CYCLE_ERROR')
  time.sleep(60)
if __name__=='__main__':main()
