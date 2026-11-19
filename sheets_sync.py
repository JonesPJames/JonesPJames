"""Idempotent Google Sheets delivery with read-back and SQLite ACK. Paper only.
Requires GOOGLE_SERVICE_ACCOUNT_JSON and sheet shared with service-account email.
"""
import os,json,time,sqlite3,logging,datetime
from decimal import Decimal
from zoneinfo import ZoneInfo
from engine_v3 import Engine
SHEET=os.getenv('VS_SHEET_ID','1e0A51VQ2Zo0DlaJS4crs7ptbz6jJqh9Fec74KF0A9ik')
IDS={'Panel':331756396,'Příkazy':11011,'Obchody':11012,'Toky':11013}
def stamp(ns):
 return datetime.datetime.fromtimestamp(int(ns)/1e9,ZoneInfo('Europe/Prague')).strftime('%Y-%m-%d %H:%M:%S %Z')
def cell(v):
 return {'userEnteredValue':{'numberValue':float(v)} if isinstance(v,(int,float,Decimal)) else {'stringValue':str(v)}}
def write(sheet,row,values):
 return {'updateCells':{'range':{'sheetId':IDS[sheet],'startRowIndex':row-1,'endRowIndex':row,'startColumnIndex':0,'endColumnIndex':len(values)},'rows':[{'values':[cell(v) for v in values]}],'fields':'userEnteredValue'}}
class GoogleAPI:
 def __init__(self):
  from google.oauth2 import service_account
  from google.auth.transport.requests import AuthorizedSession
  creds=service_account.Credentials.from_service_account_info(json.loads(os.environ['GOOGLE_SERVICE_ACCOUNT_JSON']),scopes=['https://www.googleapis.com/auth/spreadsheets'])
  self.session=AuthorizedSession(creds)
 def get(self,tab,area):
  from urllib.parse import quote
  url='https://sheets.googleapis.com/v4/spreadsheets/'+SHEET+'/values/'+quote("'"+tab+"'!"+area,safe='')
  r=self.session.get(url,timeout=25);r.raise_for_status();return r.json().get('values',[])
 def batch(self,requests):
  url='https://sheets.googleapis.com/v4/spreadsheets/'+SHEET+':batchUpdate'
  r=self.session.post(url,json={'requests':requests},timeout=30);r.raise_for_status()
def locate(rows,event_id,column):
 hits=[i+2 for i,row in enumerate(rows[1:]) if len(row)>column and event_id in str(row[column])]
 if len(hits)>1:raise RuntimeError('duplicate event_id in sheet')
 return hits[0] if hits else None
def reconcile(db,api):
 e=Engine(db);e.setup();done=0
 for event_id,kind,raw in e.outbox():
  payload=json.loads(raw);oid=payload['order_id']
  # Always check all three target tabs before any write.
  orders=api.get('Příkazy','A1:N1000');trades=api.get('Obchody','A1:R1000');flows=api.get('Toky','A1:G1000')
  orow=locate(orders,event_id,13)
  trow=locate(trades,event_id,17)
  frow=locate(flows,event_id,4)
  if kind=='BUY':
   ts=stamp(payload['ts_ns']);debit=-Decimal(payload['cash_delta'])
   if not (orow and trow and frow):
    if orow or trow or frow:raise RuntimeError('partial Sheets write; manual reconciliation required: '+event_id)
    if any(len(r)>0 and r[0]==oid for r in orders[1:]):raise RuntimeError('order id conflict '+oid)
    if any(len(r)>0 and r[0]==oid for r in trades[1:]):raise RuntimeError('trade id conflict '+oid)
    orow=len(orders)+1;trow=len(trades)+1;frow=len(flows)+1
    api.batch([
     write('Příkazy',orow,[oid,'I1U',ts,payload['symbol'],'LIMIT BUY',Decimal(payload['price']),Decimal(payload['qty'])*Decimal(payload['price']),payload['stop'],payload['take'],.002,'OTEVŘEN — SIMULACE',payload['price'],'Kraken '+ts,'event_id='+event_id+'; execution_proof=false']),
     write('Obchody',trow,[oid,'I1U',payload['symbol'],'BUY',ts,'',debit,payload['price'],payload['qty'],payload['stop'],payload['take'],'',.002,.002,'OTEVŘEN — SIMULACE',0,'Kraken tick '+ts,'event_id='+event_id+'; execution_proof=false']),
     write('Toky',frow,[ts,'I1U — HOTOVOST','I1U — OTEVŘENÉ POZICE',debit,event_id,'Simulovaný nákup včetně fee','Kraken; execution_proof=false'])])
  elif kind=='SELL':
   if not (orow and trow):raise RuntimeError('missing original BUY '+oid)
   if not frow:
    ts=stamp(payload['ts_ns']);credit=Decimal(payload['cash_delta'])
    api.batch([write('Toky',len(flows)+1,[ts,'I1U — OTEVŘENÉ POZICE','I1U — HOTOVOST',credit,event_id,'Simulovaný prodej včetně fee','Kraken; execution_proof=false'])])
   # Existing BUY trade row must be updated only after flow is present.
   trades=api.get('Obchody','A1:R1000');trow=next((i+2 for i,r in enumerate(trades[1:]) if r and r[0]==oid),None)
   if not trow:raise RuntimeError('missing trade '+oid)
   old=trades[trow-1];old=old+['']*(18-len(old))
   old[5]=stamp(payload['ts_ns']);old[11]=str(payload['price']);old[14]='UZAVŘEN — SIMULACE';old[15]=str(payload['pnl']);old[17]=str(old[17])+'; event_id='+event_id
   api.batch([write('Obchody',trow,old)])
  else:raise RuntimeError('unknown event '+kind)
  # ACK only after reading the expected event IDs back from the provider.
  orders=api.get('Příkazy','A1:N1000');trades=api.get('Obchody','A1:R1000');flows=api.get('Toky','A1:G1000')
  if kind=='BUY':
   valid=bool(locate(orders,event_id,13) and locate(trades,event_id,17) and locate(flows,event_id,4))
  else:
   valid=bool(locate(flows,event_id,4) and locate(trades,event_id,17))
  if not valid:raise RuntimeError('Sheets read-back failed '+event_id)
  with db:
   db.execute('UPDATE sync_outbox SET delivered=1 WHERE event_id=? AND delivered=0',(event_id,))
  logging.info('SHEETS_ACK %s',event_id);done+=1
 return done
def main():
 logging.basicConfig(level=logging.INFO)
 db=sqlite3.connect(os.getenv('DB_PATH','/data/market.db'),timeout=30);db.execute('PRAGMA journal_mode=WAL')
 if not os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON'):
  logging.error('SHEETS_SYNC_DISABLED: GOOGLE_SERVICE_ACCOUNT_JSON missing; outbox preserved');return
 api=GoogleAPI()
 while True:
  try:reconcile(db,api)
  except Exception:logging.exception('SHEETS_SYNC_RETRY')
  time.sleep(60)
if __name__=='__main__':main()
