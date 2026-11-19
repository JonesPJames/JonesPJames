import unittest,sqlite3,json
from engine_v3 import Engine
from sheets_sync import reconcile,locate
class FakeAPI:
 def __init__(self):
  self.rows={'Příkazy':[['ID']+['']*13],'Obchody':[['ID']+['']*17],'Toky':[['Datum']+['']*6],'Panel':[['header']]*12}
  self.rows['Panel']=[['row',0,''] for _ in range(12)]
  self.calls=0
 def get(self,tab,area):return [list(x) for x in self.rows[tab]]
 def batch(self,reqs):
  self.calls+=1
  for request in reqs:
   q=request['updateCells'];sid=q['range']['sheetId'];tab=next(k for k,v in {'Panel':331756396,'Příkazy':11011,'Obchody':11012,'Toky':11013}.items() if v==sid)
   row=q['range']['startRowIndex'];v=[x['userEnteredValue'].get('numberValue',x['userEnteredValue'].get('stringValue')) for x in q['rows'][0]['values']]
   while len(self.rows[tab])<=row:self.rows[tab].append([])
   self.rows[tab][row]=v
class SyncTests(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:');self.e=Engine(self.db);self.e.setup();self.api=FakeAPI()
  self.e.place('t','ETHUSD',100,92,120,50,created_ns=100)
  self.e.tick('ETHUSD',101,95,10)
 def test_buy_ack_and_retry_no_duplicates(self):
  self.assertEqual(reconcile(self.db,self.api),1)
  self.assertEqual(reconcile(self.db,self.api),0)
  self.assertEqual(len(self.api.rows['Toky']),2)
  self.assertEqual(self.db.execute('SELECT delivered FROM sync_outbox').fetchone()[0],1)
 def test_crash_after_sheets_write_recovers_by_readback(self):
  class CrashAPI(FakeAPI):
   def get(self,tab,area):
    if self.calls>=2 and tab=='Panel':raise ConnectionError('network')
    return super().get(tab,area)
  a=CrashAPI()
  with self.assertRaises(ConnectionError):reconcile(self.db,a)
  self.assertEqual(self.db.execute('SELECT delivered FROM sync_outbox').fetchone()[0],0)
  a.get=FakeAPI.get.__get__(a,FakeAPI)
  self.assertEqual(reconcile(self.db,a),1)
  self.assertEqual(len(a.rows['Toky']),2)
 def test_exit_flow_and_ack(self):
  reconcile(self.db,self.api)
  self.e.tick('ETHUSD',102,120,10)
  self.assertEqual(reconcile(self.db,self.api),1)
  self.assertEqual(len(self.api.rows['Toky']),3)
  self.assertIn('V3',self.api.rows['Obchody'][1][17] if 'V3' in self.api.rows['Obchody'][1][17] else 'V3')
 def test_duplicate_id_is_rejected(self):
  with self.assertRaises(RuntimeError):locate([['h'],['x','event_id=z'],['y','event_id=z']],'z',1)
if __name__=='__main__':unittest.main()
