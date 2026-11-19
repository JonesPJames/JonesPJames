"""Paper-only equity/ETF bar execution model. Never describes bars as trade prints."""
import sqlite3,os,time,json,datetime,logging
from decimal import Decimal
DB=os.getenv("DB_PATH","/data/market.db")
def D(v):return Decimal(str(v))
def setup(db):
 db.execute("CREATE TABLE IF NOT EXISTS equity_paper_events(id TEXT PRIMARY KEY,order_id TEXT,event TEXT,payload TEXT,ts_utc TEXT)")
 db.commit()
def cycle(db):
 try: intents=db.execute("SELECT id,symbol,created_utc,limit_price,stop_price,take_price,notional,status FROM cross_asset_intents WHERE status IN ('DATA_ONLY','OPEN')").fetchall()
 except sqlite3.OperationalError:return
 for oid,sym,created,limit,stop,take,nom,status in intents:
  if status=='DATA_ONLY':
   # One-minute indicative close alone cannot establish a limit crossing or bid/ask.
   # Record a deterministic eligibility decision; do not assert an exchange fill.
   q=db.execute("SELECT ts_utc,price,currency,quality FROM global_quotes WHERE symbol=? AND ts_utc>? ORDER BY ts_utc LIMIT 1",(sym,created)).fetchone()
   if not q:continue
   ts,px,currency,quality=q
   if currency!='USD' or quality!='INDICATIVE_BAR_NOT_FILL':continue
   # Fail closed: an indicative close is not executable bid/ask or a trade print.
   # Do not debit portfolio or mark OPEN until an execution-quality adapter exists.
   continue
   # Conservative paper model: an observed close strictly below limit,
   # subsequent to intent creation, can be used only as a modeled entry.
   if D(px)>=D(limit):continue
   spent=sum((D(json.loads(x[0])['debit']) for x in db.execute("SELECT payload FROM equity_paper_events WHERE event='BUY'").fetchall()),D(0))
   if spent+D(nom)*D('1.003')>D('327.73925'):continue
   if D(nom)*(D(limit)-D(stop))/D(limit)+D(nom)*D('.006')>D(10):continue
   qty=D(nom)/D(limit)
   gross=qty*D(limit)
   fee=gross*D('.002')
   payload=dict(order_id=oid,symbol=sym,entry_utc=ts,model='INDICATIVE_CLOSE_PAPER_MODEL',execution_proof=False,limit=limit,entry_price=limit,qty=str(qty),fee=str(fee),debit=str(gross+fee),stop=stop,take=take)
   with db:
    db.execute("INSERT OR IGNORE INTO equity_paper_events VALUES(?,?,?,?,?)",(oid+':BUY',oid,'BUY',json.dumps(payload),ts))
    db.execute("UPDATE cross_asset_intents SET status='OPEN' WHERE id=?",(oid,))
   logging.warning("EQUITY_MODELED_BUY_PENDING_RECONCILIATION %s",json.dumps(payload))
  elif status=='OPEN':
   entry=db.execute("SELECT payload,ts_utc FROM equity_paper_events WHERE id=?",(oid+':BUY',)).fetchone()
   if not entry:continue
   payload,entry_ts=entry;entry_data=json.loads(payload)
   q=db.execute("SELECT ts_utc,price,currency FROM global_quotes WHERE symbol=? AND ts_utc>? ORDER BY ts_utc LIMIT 1",(sym,entry_ts)).fetchone()
   if not q:continue
   ts,px,currency=q
   if currency!='USD' or D(stop)<D(px)<D(take):continue
   qty=D(entry_data['qty']);sell= D(px)*D('.999');proceeds=qty*sell*D('.998')
   data=dict(order_id=oid,symbol=sym,exit_utc=ts,model='INDICATIVE_CLOSE_PAPER_MODEL',execution_proof=False,exit_price=str(sell),qty=str(qty),proceeds=str(proceeds),pnl=str(proceeds-D(entry_data['debit'])),reason='STOP' if D(px)<=D(stop) else 'TAKE')
   with db:
    db.execute("INSERT OR IGNORE INTO equity_paper_events VALUES(?,?,?,?,?)",(oid+':SELL',oid,'SELL',json.dumps(data),ts))
    db.execute("UPDATE cross_asset_intents SET status='CLOSED' WHERE id=?",(oid,))
   logging.warning("EQUITY_MODELED_EXIT_PENDING_RECONCILIATION %s",json.dumps(data))
if __name__=='__main__':
 logging.basicConfig(level=logging.INFO,format='%(asctime)s %(levelname)s %(message)s')
 db=sqlite3.connect(DB,timeout=30)
 setup(db)
 while True:
  try:cycle(db)
  except Exception:logging.exception('EQUITY_PAPER_ERROR')
  time.sleep(60)
