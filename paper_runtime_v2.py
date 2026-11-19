import os,time,sqlite3,json,datetime,logging
from decimal import Decimal
import importlib.util
_gate_spec=importlib.util.spec_from_file_location('quant_position_gate','/app/vendor/artheras/execution-position/position_gate.py')
_gate_mod=importlib.util.module_from_spec(_gate_spec)
_gate_spec.loader.exec_module(_gate_mod)
DB=os.getenv("DB_PATH","/data/market.db")
def dec(x):return Decimal(str(x))
def setup(db):
 db.execute("CREATE TABLE IF NOT EXISTS v2_orders(id TEXT PRIMARY KEY,symbol TEXT,created_ns INTEGER,limit_price TEXT,notional TEXT,stop TEXT,take TEXT,status TEXT DEFAULT 'WAITING')")
 db.execute("CREATE TABLE IF NOT EXISTS v2_events(id TEXT PRIMARY KEY,order_id TEXT,event TEXT,payload TEXT,ts_ns INTEGER)")
 db.commit()
def cycle(db):
 for oid,sym,created,limit,nom,stop,take,status in db.execute("SELECT * FROM v2_orders WHERE status='WAITING'").fetchall():
  lim,nom,sl,tp=map(dec,(limit,nom,stop,take))
  if not sl<lim<tp or nom*(lim-sl)/lim+nom*dec('.006')>10:continue
  gate=_gate_mod.run_gate({'order':{'symbol':sym,'side':'buy','price':float(lim),'stop_price':float(sl),'execution':'paper','sizing':{'method':'fixed_weight','weight':float(nom/dec('1000'))}},'portfolio':{'equity':1000,'cash':327.73925,'positions':{}},'limits':{'max_position_weight':0.20,'max_gross_exposure':1.0},'market':{}})
  if gate.get('verdict')=='FAIL' or any(x.get('severity')=='fail' for x in gate.get('flags',[])):
   logging.warning('SKILL_POSITION_GATE_REJECT %s %s',oid,gate);continue
  qty=nom/lim
  rows=db.execute("SELECT ts_ns,price,volume,side FROM trades WHERE exchange='kraken' AND symbol=? AND ts_ns>? ORDER BY ts_ns LIMIT 10000",(sym,created)).fetchall()
  for ts,price,volume,side in rows:
   p=dec(price)
   if p>=lim or dec(volume)<qty or p*dec('1.001')>lim:continue
   cost=qty*p*dec('1.001')*dec('1.002')
   spent=sum((dec(json.loads(x[0])['cost']) for x in db.execute("SELECT payload FROM v2_events WHERE event='BUY'").fetchall()),dec(0))
   if cost+spent>dec('327.73925'):break
   data=dict(order_id=oid,symbol=sym,ts_ns=ts,price=str(p*dec('1.001')),quantity=str(qty),cost=str(cost),fee=str(qty*p*dec('1.001')*dec('.002')),stop=str(sl),take=str(tp),source='kraken',status='SIMULOVANY_FILL')
   with db:
    db.execute("INSERT OR IGNORE INTO v2_events VALUES(?,?,?,?,?)",(oid+':BUY',oid,'BUY',json.dumps(data),ts))
    db.execute("UPDATE v2_orders SET status='OPEN' WHERE id=?",(oid,))
   logging.warning("V2_PAPER_BUY_NEEDS_SHEETS_SYNC %s",json.dumps(data));break
def exits(db):
 for oid,sym,created,limit,nom,stop,take,status in db.execute("SELECT * FROM v2_orders WHERE status='OPEN'").fetchall():
  row=db.execute("SELECT payload,ts_ns FROM v2_events WHERE id=?",(oid+':BUY',)).fetchone()
  if not row:continue
  entry=json.loads(row[0]);start=row[1];qty=dec(entry['quantity'])
  ticks=db.execute("SELECT ts_ns,price,volume FROM trades WHERE exchange='kraken' AND symbol=? AND ts_ns>? ORDER BY ts_ns LIMIT 10000",(sym,start)).fetchall()
  for ts,price,vol in ticks:
   p=dec(price)
   if dec(vol)<qty or (p>dec(stop) and p<dec(take)):continue
   exit_price=p*dec('.999')
   proceeds=qty*exit_price*dec('.998')
   pnl=proceeds-dec(entry['cost'])
   data=dict(order_id=oid,symbol=sym,ts_ns=ts,price=str(exit_price),quantity=str(qty),proceeds=str(proceeds),pnl=str(pnl),fee=str(qty*exit_price*dec('.002')),reason='STOP' if p<=dec(stop) else 'TAKE',source='kraken',status='SIMULOVANY_EXIT')
   with db:
    db.execute("INSERT OR IGNORE INTO v2_events VALUES(?,?,?,?,?)",(oid+':SELL',oid,'SELL',json.dumps(data),ts))
    db.execute("UPDATE v2_orders SET status='CLOSED' WHERE id=?",(oid,))
   logging.warning("V2_PAPER_EXIT_NEEDS_SHEETS_SYNC %s",json.dumps(data))
   break
def main():
 logging.basicConfig(level=logging.INFO,format='%(asctime)s %(levelname)s %(message)s')
 db=sqlite3.connect(DB,timeout=30);db.execute("PRAGMA journal_mode=WAL");setup(db)
 now=time.time_ns()
 for oid,sym,limit,sl,tp in [('LIVE-BTC-001','BTCUSD','63500','62600','65800'),('LIVE-ETH-001','ETHUSD','1765','1695','1900')]:
  db.execute("INSERT OR IGNORE INTO v2_orders(id,symbol,created_ns,limit_price,notional,stop,take) VALUES(?,?,?,?,?,?,?)",(oid,sym,now,limit,'100',sl,tp))
 db.commit()
 while True:
  try:cycle(db);exits(db)
  except Exception:logging.exception("V2_ENGINE_ERROR")
  time.sleep(15)
if __name__=='__main__':main()
