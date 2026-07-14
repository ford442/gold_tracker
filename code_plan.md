# Code Plan — GoldTrackr OMS Vision

This document frames GoldTrackr's evolution from a monitoring dashboard toward a **personal-scale order-management system (OMS)** for tokenized gold and crypto. It is a *forward-looking vision*, not a description of the current build — the current build is documented in [README.md](README.md) and [AGENTS.md](AGENTS.md).

> **Scope note.** The goal is a robust *personal* gold/crypto terminal with real dry-run-first execution — **not** an HFT or regulated multi-tenant trading venue. Several rows below (KYC/AML, MiFID/SEC reporting, sub-ms latency) are listed for completeness but are explicitly **out of scope** for this project.

> **Disclaimer.** GoldTrackr is informational/educational and not financial advice. Trading paths default to dry-run.

---

## 1. Where We Are vs. Where We're Going

The original version of this plan claimed GoldTrackr had *no order execution* and *no backend*. **That is no longer true.** GoldTrackr now has Coinbase (CDP) and Kraken execution paths, a Supabase backend with Edge Functions and AES-GCM key storage, a pure-TypeScript backtesting engine, and a regime/fidelity analytics layer. The checklists below reflect that reality.

### Done ✅ (already shipped)

- [x] **Live market data** — CoinGecko + MetalPrice with graceful mock fallback (spot gold, PAXG, XAUT, BTC, ETH, BCH, silver/platinum/palladium)
- [x] **Order execution** — Coinbase CDP (ES256 JWT) and Kraken (direct PAXG/XAUT pair), dry-run by default
- [x] **Backend services** — Supabase Auth + Postgres + Edge Functions (`store-key`, `place-trade`, `test-connection`)
- [x] **Secure key storage** — AES-GCM encryption at rest in server-secure mode; RLS policies; keys never re-enter the browser after upload
- [x] **Back-testing engine** — pure TS `strategyEngine.ts` (arbitrage, mean-reversion, gold-exposure rebalancer, hold) with equity curve, trade log, max drawdown
- [x] **Scenario / stress testing** — Scenario Lab with macro shocks, portfolio seeding, and rebalance-vs-hold benchmarks
- [x] **Algorithmic signals** — trade suggestions + arbitrage detection + global arbitrage monitor
- [x] **Risk framing (basic)** — gold exposure %, crypto beta %, unrealized P&L, gold-exposure rebalancer bands
- [x] **Regime / fidelity analytics** — volatility/drawdown regime classification, Gold Fidelity Scores, rolling correlations
- [x] **Portfolio persistence** — Zustand persist + optional Coinbase balance sync
- [x] **Testing & CI** — Vitest unit tests on pure `src/lib/` modules with coverage gate; lint/test/build on every PR
- [x] **Alerting** — desktop arbitrage alerts + configurable alert rules

### Remaining ▢ (the OMS gap)

- [ ] **Full order lifecycle** — partial fills, cancellations, reconciliation after outages, resend of lost orders (today: fire-and-report execution)
- [ ] **Paper-trading ledger** — persist simulated fills and reconcile against portfolio ([#35](https://github.com/ford442/gold_tracker/issues/35))
- [ ] **Streaming prices** — WebSocket transport with polling fallback for sub-minute updates ([#38](https://github.com/ford442/gold_tracker/issues/38))
- [ ] **Shared market-history cache** — dedupe CoinGecko chart requests across panels ([#34](https://github.com/ford442/gold_tracker/issues/34))
- [ ] **Multi-exchange adapter interface** — unify Coinbase/Kraken behind one `ExchangeAdapter`; add venues; feed the global monitor with *real* quotes ([#33](https://github.com/ford442/gold_tracker/issues/33))
- [ ] **Automated risk engine** — position/exposure limits, stop-loss/take-profit automation, live margin
- [ ] **Tax-lot accounting** — FIFO/HIFO cost basis, realized-gains journal, CSV export, aggregate fine-gold-oz widget ([#41](https://github.com/ford442/gold_tracker/issues/41))
- [ ] **E2E test coverage** — Playwright smoke tests over critical user paths with stubbed network ([#36](https://github.com/ford442/gold_tracker/issues/36))
- [ ] **Hardened key UX** — typed Supabase client, stronger local-mode warnings, optional passphrase-encrypted session unlock ([#40](https://github.com/ford442/gold_tracker/issues/40))
- [ ] **Monitoring & observability** — connectivity health checks, trade-failure alerts, latency tracking

### Out of scope 🚫 (intentionally not pursued)

- Multi-user KYC/AML compliance, role-based access, and account management
- Regulatory trade surveillance / reporting (MiFID II, SEC)
- Sub-millisecond / high-frequency execution and co-located infrastructure
- 99.x% SLA redundancy and horizontal scaling — this is a personal terminal

---

## 2. Trading-Proficiency Assessment (updated)

GoldTrackr **can** now place and route trades on Coinbase and Kraken, backtest strategies, and stress-test a portfolio. What separates it from a *proficient* OMS is primarily **order-lifecycle robustness** and **automated risk controls**, not the absence of execution or a backend. The prioritized path to close that gap:

1. **Paper-trading ledger** ([#35](https://github.com/ford442/gold_tracker/issues/35)) — safe practice loop; foundation for realistic fill/PnL history.
2. **Order lifecycle & reconciliation** — track each order's states, handle partial fills and cancels, reconcile after outages.
3. **Risk engine** — position/exposure limits and stop-loss/take-profit automation on top of the existing exposure math.
4. **Streaming data** ([#38](https://github.com/ford442/gold_tracker/issues/38)) + **shared history cache** ([#34](https://github.com/ford442/gold_tracker/issues/34)) — tighter arb/trade UX and fewer rate-limit failures.
5. **Exchange adapter interface** ([#33](https://github.com/ford442/gold_tracker/issues/33)) — make new venues cheap and feed the arb monitor real quotes.

---

## 3. Architecture Principle

New capability lands **pure-logic-first**:

```
src/lib (pure, unit-tested) → src/hooks (React) → src/store (Zustand) → src/components (UI)
```

Keep the strategy engine, regime math, fee helpers, and API clients free of React so they stay testable. See [AGENTS.md](AGENTS.md) for conventions and the layer-by-layer file map.

---

### Conclusion

GoldTrackr has grown from a read-only dashboard into a working personal trading terminal with execution, a backend, backtesting, and regime analytics. The remaining work is an **OMS-hardening** effort — order lifecycle, automated risk, paper trading, streaming data, and test depth — tracked in the repository's [open issues](https://github.com/ford442/gold_tracker/issues). This document should be updated as those items ship.
