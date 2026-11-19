import os,json,time,sqlite3,urllib.request,datetime,logging
logging.basicConfig(level=logging.INFO,format="%(asctime)s %(levelname)s %(message)s")
DB=os.environ.get("DB_PATH","/data/market.db")
SYMBOLS={"BTCUSD":"XBTUSD","ETHUSD":"ETHUSD"}
def get(url):
 req=urllib.request.Request(url,headers={"User-Agent":"vs-paper-market-data/1.0"})
 with urllib.request.urlopen(req,timeout=15) as response:return json.load(response)
def setup():
 os.makedirs(os.path.dirname(os.path.abspath(DB)),exist_ok=True)
 con=sqlite3.connect(DB)
 con.execute("CREATE TABLE IF NOT EXISTS trades(exchange TEXT,symbol TEXT,ts_ns INTEGER,price REAL,volume REAL,side TEXT,PRIMARY KEY(exchange,symbol,ts_ns,price,volume,side))")
 con.execute("CREATE TABLE IF NOT EXISTS cursors(symbol TEXT PRIMARY KEY,since TEXT)")
 con.commit();return con
def collect(con,symbol,pair):
 row=con.execute("SELECT since FROM cursors WHERE symbol=?",(symbol,)).fetchone()
 url="https://api.kraken.com/0/public/Trades?pair="+pair+("&since="+row[0] if row else "")
 data=get(url)
 if data.get("error"):raise RuntimeError(data["error"])
 result=data["result"];key=next(k for k in result if k!="last")
 n=0
 for t in result[key]:
  price,volume,ts,side=t[:4]
  ts_ns=int(float(ts)*1e9)
  con.execute("INSERT OR IGNORE INTO trades VALUES(?,?,?,?,?,?)",("kraken",symbol,ts_ns,float(price),float(volume),side))
  n+=1
 con.execute("INSERT INTO cursors(symbol,since) VALUES(?,?) ON CONFLICT(symbol) DO UPDATE SET since=excluded.since",(symbol,str(result["last"])))
 con.commit()
 logging.info("symbol=%s fetched=%s cursor=%s",symbol,n,result["last"])
def main():
 con=setup()
 while True:
  for symbol,pair in SYMBOLS.items():
   try:collect(con,symbol,pair)
   except Exception:logging.exception("collection failed %s",symbol)
  time.sleep(int(os.getenv("POLL_SECONDS","60")))
if __name__=="__main__":main()
