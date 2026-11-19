import unittest,sqlite3
from engine_v3 import Engine
class LedgerTests(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:');self.e=Engine(self.db);self.e.setup()
 def test_stop_breach_rejected(self):
  self.e.place('a','BTCUSD',100,92,120,100,created_ns=100)
  self.assertFalse(self.e.tick('BTCUSD',101,80,10))
  self.assertEqual(self.e.status('a'),'WAITING')
 def test_no_historical_fill(self):
  self.e.place('a','BTCUSD',100,92,120,100,created_ns=100)
  self.assertFalse(self.e.tick('BTCUSD',100,95,10))
 def test_idempotent_buy_exit_and_outbox(self):
  self.e.place('a','BTCUSD',100,92,120,100,created_ns=100)
  self.assertTrue(self.e.tick('BTCUSD',101,95,10))
  self.assertFalse(self.e.tick('BTCUSD',101,95,10))
  self.assertTrue(self.e.tick('BTCUSD',102,120,10))
  self.assertFalse(self.e.tick('BTCUSD',102,120,10))
  self.assertEqual(self.db.execute('SELECT count(*) FROM ledger_events').fetchone()[0],2)
  self.assertEqual(len(self.e.outbox()),2)
  self.assertEqual(self.e.status('a'),'CLOSED')
 def test_trade_risk_limit(self):
  self.e.place('a','BTCUSD',100,92,120,300,created_ns=100)
  self.assertFalse(self.e.tick('BTCUSD',101,95,10))
 def test_cash_reserved_by_other_orders(self):
  for oid in 'abcd':self.e.place(oid,'BTCUSD',100,92,120,100,created_ns=100)
  self.assertFalse(self.e.tick('BTCUSD',101,95,10))
 def test_ledger_cash_changes(self):
  self.e.place('a','BTCUSD',100,92,120,50,created_ns=100)
  before=self.e.cash()
  self.assertTrue(self.e.tick('BTCUSD',101,95,10))
  self.assertLess(self.e.cash(),before)
  self.assertTrue(self.e.tick('BTCUSD',102,120,10))
  self.assertGreater(self.e.cash(),before)
if __name__=='__main__':unittest.main()
