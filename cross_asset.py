"""Cross-asset signal scanner; indicative prices cannot trigger fills."""
import sqlite3,os,time,json,datetime,logging,math
DB=os.getenv("DB_PATH","/data/market.db")
def score(rows):
 if len(rows)<3:return None
 latest,previous,old=rows[:3]
 if any(x[1]<=0 for x in rows[:3]):return None
 change=(latest[1]/previous[1]-1)*100
 trend=(latest[1]/old[1]-1)*100
 return {"last":latest[1],"last_utc":latest[0],"change_pct":round(change,4),"trend_pct":round(trend,4),"direction":"UP" if trend>0 else "DOWN","quality":"INDICATIVE_ONLY_NO_FILL"}
def run(db):
 db.execute("CREATE TABLE IF NOT EXISTS cross_asset_signals(symbol TEXT PRIMARY KEY,observed_utc TEXT,signal TEXT,source TEXT)")
 symbols=[r[0] for r in db.execute("SELECT DISTINCT symbol FROM global_quotes").fetchall()]
 n=0
 for sym in symbols:
  rows=db.execute("SELECT ts_utc,price FROM global_quotes WHERE symbol=? ORDER BY ts_utc DESC LIMIT 3",(sym,)).fetchall()
  result=score(rows)
  if result is None:continue
  ts=datetime.datetime.fromisoformat(result['last_utc'].replace('Z','+00:00'))
  if (datetime.datetime.now(datetime.timezone.utc)-ts).total_seconds()>3600:continue
  db.execute("INSERT INTO cross_asset_signals VALUES(?,?,?,?) ON CONFLICT(symbol) DO UPDATE SET observed_utc=excluded.observed_utc,signal=excluded.signal,source=excluded.source",(sym,result['last_utc'],json.dumps(result),"global_quotes"))
  n+=1
 db.commit()
 logging.info("CROSS_ASSET_SCAN valid=%s total=%s; NO_EQUITY_FILLS_WITHOUT_TRADE_TAPE",n,len(symbols))
if __name__=="__main__":
 logging.basicConfig(level=logging.INFO,format="%(asctime)s %(levelname)s %(message)s")
 db=sqlite3.connect(DB,timeout=30)
 while True:
  try:run(db)
  except Exception:logging.exception("CROSS_ASSET_SCAN_ERROR")
  time.sleep(300)
