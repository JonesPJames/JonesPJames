"""Conservative Kraken paper engine. No real orders."""
import os,json,time,sqlite3,datetime,logging
DB=os.getenv("DB_PATH","/data/market.db")
ORDERS=[("ORD-001","BTCUSD","2026-11-18T07:28:00+00:00",63500.,200.,62600.,65800.),("ORD-002","ETHUSD","2026-11-18T07:28:00+00:00",1765.,150.,1695.,1900.)]
def evaluate(order,ticks,cash=1000.,weekly_risk=0.):
 oid,sym,created,limit,notional,sl,tp=order
 risk=notional*(limit-sl)/limit+notional*.006
 if risk>10 or weekly_risk+risk>50:return None
 created_ns=int(datetime.datetime.fromisoformat(created).timestamp()*1e9)
 qty=notional/limit
 for ns,p,v,side in ticks:
  if ns<=created_ns or p>=limit or v<qty:continue
  price=p*1.001
  if price>limit:continue
  debit=qty*price*1.002
  if debit>cash:return None
  return {"order_id":oid,"symbol":sym,"source":"kraken","ts_ns":ns,"utc":datetime.datetime.fromtimestamp(ns/1e9,datetime.timezone.utc).isoformat(),"price":price,"qty":qty,"fee":qty*price*.002,"debit":debit,"sl":sl,"tp":tp,"status":"SIMULOVANY_FILL","evidence":"kraken trade below limit after order"}
 return None
def once(db):
 db.execute("CREATE TABLE IF NOT EXISTS paper_fills(order_id TEXT PRIMARY KEY,payload TEXT NOT NULL,recorded_utc TEXT NOT NULL,synced INTEGER DEFAULT 0)")
 db.commit()
 for order in ORDERS:
  oid,sym,created,*_=order
  ns=int(datetime.datetime.fromisoformat(created).timestamp()*1e9)
  first=db.execute("SELECT MIN(ts_ns) FROM trades WHERE exchange='kraken' AND symbol=?",(sym,)).fetchone()[0]
  if first is None or first>ns:
   logging.info("NO_FILL %s: no continuous evidence from creation (first=%s)",oid,first);continue
  rows=db.execute("SELECT ts_ns,price,volume,side FROM trades WHERE exchange='kraken' AND symbol=? AND ts_ns>? ORDER BY ts_ns LIMIT 10000",(sym,ns)).fetchall()
  fill=evaluate(order,rows)
  if fill:
   db.execute("INSERT OR IGNORE INTO paper_fills(order_id,payload,recorded_utc) VALUES(?,?,?)",(oid,json.dumps(fill),datetime.datetime.now(datetime.timezone.utc).isoformat()))
   db.commit()
   logging.warning("PAPER_FILL_PENDING_SHEET_SYNC %s",json.dumps(fill))
def main():
 logging.basicConfig(level=logging.INFO,format="%(asctime)s %(levelname)s %(message)s")
 db=sqlite3.connect(DB,timeout=30)
 while True:
  try:once(db)
  except Exception:logging.exception("PAPER_ENGINE_ERROR")
  time.sleep(60)
if __name__=="__main__":main()
