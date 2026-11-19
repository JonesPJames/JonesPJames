"""Global V$ quote scanner. Indicative quotes only; NEVER proves a limit-order fill."""
import json, os, time, logging, datetime, urllib.request, urllib.parse, sqlite3
from concurrent.futures import ThreadPoolExecutor
logging.basicConfig(level=logging.INFO,format="%(asctime)s %(levelname)s %(message)s")
WATCH={
"USA_STOCKS":["NVDA","WMT","TGT","PANW","TSM","ASML","AAPL","MSFT"],
"USA_ETF":["SMH","QQQ","EWY","URNM","EWJ","COPX","EWT","MCHI","KWEB","INDA","VNM","EIDO","EWZ","REMX","FCG","MOO","GLD","SLV","USO","XLE","IWM","TLT","UUP","FXE"],
"EUROPE":["EUNL.DE","NDIA.DE","EXSA.DE","SXR8.DE"],
"ASIA":["000660.KS","005930.KS","2330.TW","7203.T","9984.T","0700.HK"],
"FX":["EURUSD=X","JPYUSD=X","KRWUSD=X"],
"COMMODITY_PROXIES":["PPLT","PALL","LIT","DBA","UNG"]
}
URL="https://query1.finance.yahoo.com/v8/finance/chart/"
def fetch(symbol):
 url=URL+urllib.parse.quote(symbol,safe="")+"?interval=1m&range=1d"
 req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; VSResearch/1.0)","Accept":"application/json"})
 with urllib.request.urlopen(req,timeout=12) as response: data=json.load(response)
 result=data["chart"]["result"]
 if not result:return None
 r=result[0];meta=r["meta"];times=r.get("timestamp") or [];q=(r.get("indicators",{}).get("quote") or [{}])[0]
 closes=q.get("close") or []
 pairs=[(int(t),float(p)) for t,p in zip(times,closes) if p is not None]
 if not pairs:return None
 ts,price=pairs[-1]
 return {"symbol":symbol,"price":price,"quote_utc":datetime.datetime.fromtimestamp(ts,datetime.timezone.utc).isoformat(),"currency":meta.get("currency"),"exchange":meta.get("exchangeName"),"market_state":meta.get("marketState"),"source":url,"quality":"INDICATIVE_BAR_NOT_FILL"}
def scan(db):
 con=sqlite3.connect(db);con.execute("CREATE TABLE IF NOT EXISTS global_quotes(symbol TEXT,ts_utc TEXT,price REAL,currency TEXT,exchange TEXT,market_state TEXT,source TEXT,quality TEXT,received_utc TEXT,PRIMARY KEY(symbol,ts_utc))")
 symbols=list(dict.fromkeys(s for group in WATCH.values() for s in group))
 def one(symbol):
  try:return fetch(symbol)
  except Exception as exc:
   logging.warning("quote unavailable %s: %s",symbol,str(exc)[:120]);return None
 with ThreadPoolExecutor(max_workers=5) as pool:
  for item in pool.map(one,symbols):
   if not item:continue
   con.execute("INSERT OR IGNORE INTO global_quotes VALUES(?,?,?,?,?,?,?,?,?)",(item["symbol"],item["quote_utc"],item["price"],item["currency"],item["exchange"],item["market_state"],item["source"],item["quality"],datetime.datetime.now(datetime.timezone.utc).isoformat()))
   logging.info("GLOBAL_QUOTE %s %s %s %s",item["symbol"],item["price"],item["currency"],item["quote_utc"])
 con.commit();con.close()
if __name__=="__main__":
 while True:
  scan(os.getenv("DB_PATH","/data/market.db"))
  time.sleep(int(os.getenv("GLOBAL_POLL_SECONDS","900")))
