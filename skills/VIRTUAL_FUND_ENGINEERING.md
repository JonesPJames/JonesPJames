# V$ paper fund — engineering skill gates
Source research:
- https://github.com/artheras/skills (execution-position, risk-assessment, backtest-validation, point-in-time-research, compliance-audit-trail, strategy-generation)
- https://github.com/ml4t/skills (lookahead-safe quant research, walk-forward validation)
- https://github.com/KaigorodovTuskul/portfolio-models-agent-skill (portfolio optimization, risk parity)
These are references to review and adapt, not vendored or installed executable third-party code.

MANDATORY GATES
1. Market universe: USA stocks/ETFs, Europe, Asia, FX, commodity proxies, crypto. Each adapter must explicitly classify DATA_ONLY vs FILL_ELIGIBLE.
2. Point-in-time: quote timestamp, received timestamp, source, exchange, volume, session, currency; no fills before order placement.
3. Fill gate: execution-quality trades/quotes and realistic fees/slippage; bar low and indicative quote never prove an equity fill.
4. Risk: portfolio-wide cash, old order reservations, maximum per-trade and weekly risk, correlated exposure, no leverage.
5. Accounting: one immutable event ID, order/position/cash ledger, fees, realized and unrealized P/L, no double postings.
6. Sheets: retryable idempotent reconciliation with actual evidence, no silent loss.
7. Tests: failing regression test first, unit + SQLite integration + Railway deployment + Google Sheets reconciliation.
8. Monitoring: stale data, missing source, collector heartbeat, trade continuity, alerts and fail-closed trading.
9. No claim of successful full autonomous trading until one verified paper order -> fill -> exit -> sheet ledger roundtrip is observed.
