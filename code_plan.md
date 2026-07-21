# Code Plan — GoldTrackr OMS Vision

This document frames GoldTrackr's evolution from a monitoring dashboard toward a **personal-scale order-management system (OMS)** for tokenized gold and crypto. It is a *forward-looking vision*, not a description of the current build — the current build is documented in [README.md](README.md) and [AGENTS.md](AGENTS.md). For a one-page summary, see [docs/ROADMAP.md](docs/ROADMAP.md).

> **Scope note.** The goal is a robust *personal* gold/crypto terminal with real dry-run-first execution — **not** an HFT or regulated multi-tenant trading venue. Several rows below (KYC/AML, MiFID/SEC reporting, sub-ms latency) are listed for completeness but are explicitly **out of scope** for this project.

> **Disclaimer.** GoldTrackr is informational/educational and not financial advice. Trading paths default to dry-run.

---

## 1. Where We Are vs. Where We're Going

The original version of this plan claimed GoldTrackr had *no order execution* and *no backend*. **That is no longer true.** GoldTrackr now has Coinbase (CDP) and Kraken execution paths, a Supabase backend with Edge Functions and AES-GCM key storage, a pure-TypeScript backtesting engine, and a regime/fidelity analytics layer. The checklists below reflect **`main` branch reality** as of the last refresh ([#51](https://github.com/ford442/gold_tracker/issues/51)).

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
- [x] **Paper-trading ledger** ([#35](https://github.com/ford442/gold_tracker/issues/35)) — `paperTradeStore`, `PaperLedgerPanel`, dry-run fills via `lib/paperTrade.ts`
- [x] **Shared market-history cache** ([#34](https://github.com/ford442/gold_tracker/issues/34)) — `lib/marketCache.ts` (TTL + in-flight dedupe)
- [x] **Multi-exchange adapter Phase A** ([#33](https://github.com/ford442/gold_tracker/issues/33)) — `exchangeAdapters.ts` + `exchanges.ts` (Coinbase/Kraken; arb monitor not yet unified)
- [x] **E2E smoke tests** ([#36](https://github.com/ford442/gold_tracker/issues/36)) — `e2e/` + dedicated CI job
- [x] **Tax-lot accounting** ([#41](https://github.com/ford442/gold_tracker/issues/41)) — `portfolioLots.ts` + cost-basis / gold-oz UI
- [x] **Hardened key UX** ([#40](https://github.com/ford442/gold_tracker/issues/40)) — typed Supabase client + mock fallback

### Remaining ▢ (the OMS gap)

- [ ] **Order lifecycle & reconciliation** ([#46](https://github.com/ford442/gold_tracker/issues/46)) — durable journal, partial fills, cancel, reconcile after outages (today: fire-and-report execution)
- [ ] **Shared exchange registry (client + Edge)** ([#45](https://github.com/ford442/gold_tracker/issues/45)) — one venue artifact for Vite and Deno; stop duplicating `PAIR_MAP` in Edge Functions
- [ ] **Adapter unification** ([#47](https://github.com/ford442/gold_tracker/issues/47)) — route all execution paths through `ExchangeAdapter` (e.g. `GlobalArbitrageMonitor` still imports `coinbaseTrader` on main)
- [ ] **Live automated risk engine** ([#50](https://github.com/ford442/gold_tracker/issues/50)) — pre-trade exposure limits, kill switch, daily-loss guardrails
- [ ] **WebSocket price transport** ([#48](https://github.com/ford442/gold_tracker/issues/48)) — sub-minute crypto ticks with polling fallback (re-open #38 scope)
- [ ] **Trade & connectivity observability** ([#49](https://github.com/ford442/gold_tracker/issues/49)) — API health, trade-failure history, latency / cache metrics
- [x] **Real multi-venue arbitrage (Phase B)** ([#53](https://github.com/ford442/gold_tracker/issues/53)) — replace synthetic global-monitor signals with net-of-fees cross-venue quotes
- [ ] **Gold news proxy** ([#52](https://github.com/ford442/gold_tracker/issues/52)) — server-side RSS via Supabase Edge Function (re-open #28 scope)
- [ ] **Analytics web workers** ([#54](https://github.com/ford442/gold_tracker/issues/54)) — offload backtests / regime math before WASM (#32)

**Mock vs live vs shipped (on `main` today):**

- **Mock** — no API keys or offline → CoinGecko / MetalPrice / news mocks (`fetchGoldNews()` in `api.ts`)
- **Live data** — keys present → real prices via 60s REST poll; news still mock until [#52](https://github.com/ford442/gold_tracker/issues/52)
- **Live trading** — server-secure or local keys with dry-run off; still fire-and-report until [#46](https://github.com/ford442/gold_tracker/issues/46) / [#50](https://github.com/ford442/gold_tracker/issues/50) land

### Out of scope 🚫 (intentionally not pursued)

- Multi-user KYC/AML compliance, role-based access, and account management
- Regulatory trade surveillance / reporting (MiFID II, SEC)
- Sub-millisecond / high-frequency execution and co-located infrastructure
- 99.x% SLA redundancy and horizontal scaling — this is a personal terminal

---

## For agents — closed issues vs shipped

**Rule of thumb:** GitHub issue state ≠ ship status. Use this checklist + file presence on `main` before assuming a feature exists.

| Closed issue | Why closed early | Replacement | Verify on `main` by |
|--------------|------------------|-------------|---------------------|
| [#28](https://github.com/ford442/gold_tracker/issues/28) news RSS | CORS / no server proxy | [#52](https://github.com/ford442/gold_tracker/issues/52) | `api.ts` → `fetchGoldNews()` returns mock |
| [#38](https://github.com/ford442/gold_tracker/issues/38) WebSocket | Not implemented | [#48](https://github.com/ford442/gold_tracker/issues/48) | `useGoldPrices` 60s `POLL_INTERVAL` only |
| [#33](https://github.com/ford442/gold_tracker/issues/33) multi-venue | Phase A only | [#45](https://github.com/ford442/gold_tracker/issues/45), [#47](https://github.com/ford442/gold_tracker/issues/47), [#53](https://github.com/ford442/gold_tracker/issues/53) | `exchangeAdapters` exists; arb monitor has synthetic signals |
| [#32](https://github.com/ford442/gold_tracker/issues/32) WASM perf | Deferred | [#54](https://github.com/ford442/gold_tracker/issues/54) | no `src/workers/` on `main` |
| [#46](https://github.com/ford442/gold_tracker/issues/46)–[#50](https://github.com/ford442/gold_tracker/issues/50) foundation | May be closed before merge | same issue numbers | `git ls-tree origin/main -- <paths>` — see Remaining table |

When in doubt, read [docs/ROADMAP.md](docs/ROADMAP.md) and the Done/Remaining lists above rather than trusting a closed issue alone.

---

## 2. Trading-Proficiency Assessment (updated)

GoldTrackr **can** now place and route trades on Coinbase and Kraken, backtest strategies, stress-test a portfolio, and practice via the paper ledger. What separates it from a *proficient* OMS is primarily **order-lifecycle robustness**, **automated risk controls**, and **live market-data depth** — not the absence of execution or a backend. The prioritized path to close that gap:

1. **Order lifecycle & reconciliation** ([#46](https://github.com/ford442/gold_tracker/issues/46)) — durable journal, partial fills, cancel, reconcile after tab sleep / network blips
2. **Live risk engine** ([#50](https://github.com/ford442/gold_tracker/issues/50)) — pre-trade guardrails before non-dry-run capital
3. **Registry + adapter unification** ([#45](https://github.com/ford442/gold_tracker/issues/45), [#47](https://github.com/ford442/gold_tracker/issues/47)) — one venue registry; all execution through `ExchangeAdapter`
4. **Streaming prices** ([#48](https://github.com/ford442/gold_tracker/issues/48)) — WebSocket + poll fallback for arb alerts and trade suggestions
5. **Observability** ([#49](https://github.com/ford442/gold_tracker/issues/49)) — API health, trade-failure history, latency tracking
6. **Real multi-venue arb** ([#53](https://github.com/ford442/gold_tracker/issues/53)) — replace synthetic global-monitor cards with net-of-fees cross-venue spreads
7. **News proxy** ([#52](https://github.com/ford442/gold_tracker/issues/52)) — server-side RSS so Markets is not mock-only
8. **Analytics workers** ([#54](https://github.com/ford442/gold_tracker/issues/54)) — main-thread offload for Scenario Lab / regime; try before WASM

---

## 3. Architecture Principle

New capability lands **pure-logic-first**:

```
src/lib (pure, unit-tested) → src/hooks (React) → src/store (Zustand) → src/components (UI)
```

Keep the strategy engine, regime math, fee helpers, and API clients free of React so they stay testable. See [AGENTS.md](AGENTS.md) for conventions and the layer-by-layer file map.

---

### Conclusion

GoldTrackr has grown from a read-only dashboard into a working personal trading terminal with execution, a backend, backtesting, paper trading, and regime analytics. The remaining work is an **OMS-hardening** effort — tracked in [#48](https://github.com/ford442/gold_tracker/issues/48), [#52](https://github.com/ford442/gold_tracker/issues/52)–[#54](https://github.com/ford442/gold_tracker/issues/54), and foundation issues [#45](https://github.com/ford442/gold_tracker/issues/45)–[#50](https://github.com/ford442/gold_tracker/issues/50) (verify merge on `main`). See [docs/ROADMAP.md](docs/ROADMAP.md) for the navigable summary. Update this document as those items ship.
