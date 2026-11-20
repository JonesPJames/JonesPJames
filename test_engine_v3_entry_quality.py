import sqlite3
import unittest
from engine_v3 import Engine

class EntryQualityTests(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(":memory:")
        self.db.execute("CREATE TABLE trades(ts_ns INTEGER,symbol TEXT,price TEXT,volume TEXT,exchange TEXT)")
        self.e=Engine(self.db);self.e.setup()

    def test_near_stop_entry_rejected(self):
        self.e.place("BTC","BTCUSD","63500","62600","65800","50",created_ns=1)
        self.e.tick("BTCUSD",2,"62537.5","1")  # 0.1% entry slippage -> 62600.0375
        self.assertEqual(self.e.status("BTC"),"WAITING")
        self.assertEqual(len(self.e.events()),0)

    def test_valid_entry_still_executes(self):
        self.e.place("ETH","ETHUSD","1765","1695","1900","50",created_ns=1)
        self.e.tick("ETHUSD",2,"1762.98","1")
        self.assertEqual(self.e.status("ETH"),"OPEN")

    def test_no_retroactive_fill(self):
        self.e.place("ETH","ETHUSD","1765","1695","1900","50",created_ns=10)
        self.e.tick("ETHUSD",10,"1762.98","1")
        self.assertEqual(self.e.status("ETH"),"WAITING")

if __name__=="__main__":unittest.main()
