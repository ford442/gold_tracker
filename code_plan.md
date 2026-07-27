# Code Plan — GoldTrackr OMS Vision

This document frames GoldTrackr's evolution from a monitoring dashboard toward a **personal-scale order-management system (OMS)** for tokenized gold and crypto. It is a *forward-looking vision*, not a description of the current build — the current build is documented in [README.md](README.md) and [AGENTS.md](AGENTS.md). For a one-page summary, see [docs/ROADMAP.md](docs/ROADMAP.md).

> **Scope note.** The goal is a robust *personal* gold/crypto terminal with real dry-run-first execution — **not** an HFT or regulated multi-tenant trading venue. Several rows below (KYC/AML, MiFID/SEC reporting, sub-ms latency) are listed for completeness but are explicitly **out of scope** for this project.

> **Disclaimer.** GoldTrackr is informational/educational and not financial advice. Trading paths default to dry-run.

---

## 1. Where We Are vs. Where We're Going

The original version of this plan claimed GoldTrackr had *no order execution* and *no backend*. **That is no longer true.** GoldTrackr now has Coinbase (CDP) and Kraken execution paths, a Supabase backend with Edge Functions and AES-GCM key storage, a pure-TypeScript backtesting engine, regime/fidelity analytics, client-side order lifecycle with reconciliation, pre-trade risk gates, WebSocket price transport, analytics web workers, and a shared client+Edge exchange registry. The checklists below reflect **`main` branch reality** as of July 2026 (tree audit + import-graph wiring).

### Done ✅ (already shipped)

- [x] **Live market data** — CoinGecko + MetalPrice with graceful mock fallback (spot gold, PAXG, XAUT, BTC, ETH, BCH, silver/platinum/palladium)
- [x] **WebSocket price transport** ([#48](https://github.com/ford442/gold_tracker/issues/48)) — `priceTransport.ts` with `auto` / `poll` / `stream` modes; `useGoldPrices` + Settings → Data Feed panel
- [x] **Order execution** — Coinbase CDP (ES256 JWT) and Kraken (direct PAXG/XAUT pair), dry-run by default
- [x] **Order lifecycle & reconciliation (client)** ([#46](https://github.com/ford442/gold_tracker/issues/46)) — `orderLifecycle.ts`, `orderStore`, `executeOrderWithLifecycle`, `useOrderReconciliation`, `OrderHistoryPanel` (partial fills, cancel, poll-after-outage)
- [x] **Live automated risk engine** ([#50](https://github.com/ford442/gold_tracker/issues/50)) — `riskEngine.ts`, `useRiskContext`, Settings kill-switch / exposure / daily-loss limits
- [x] **Backend services** — Supabase Auth + Postgres + Edge Functions (`store-key`, `place-trade`, `test-connection`, `fetch-news`)
- [x] **Secure key storage** — AES-GCM encryption at rest in server-secure mode; RLS policies; keys never re-enter the browser after upload
- [x] **Shared exchange registry (client + Edge)** ([#45](https://github.com/ford442/gold_tracker/issues/45)) — `shared/exchanges.json` + `shared/registry.ts`; Vite facade `lib/exchanges.ts`; Edge re-export `supabase/functions/_shared/registry.ts`
- [x] **Adapter-routed execution** ([#47](https://github.com/ford442/gold_tracker/issues/47)) — `exchangeAdapters.ts` + `executeOrder.ts`; trade suggestions + global arb monitor call `executeOrderWithLifecycle`
- [x] **Back-testing engine** — pure TS `strategyEngine.ts` (arbitrage, mean-reversion, gold-exposure rebalancer, hold) with equity curve, trade log, max drawdown
- [x] **Analytics web workers** ([#54](https://github.com/ford442/gold_tracker/issues/54)) — `workers/analyticsWorker.ts` + `workerClient.ts` (backtests + rolling correlations; main-thread fallback)
- [x] **Scenario / stress testing** — Scenario Lab with macro shocks, portfolio seeding, and rebalance-vs-hold benchmarks
- [x] **Algorithmic signals** — trade suggestions + arbitrage detection + global arbitrage monitor
- [x] **Real multi-venue arbitrage** ([#53](https://github.com/ford442/gold_tracker/issues/53)) — `venueQuotes.ts` + `venueQuoteFanout.ts` + `GlobalArbitrageMonitor` (Coinbase, Kraken, Gemini quote-only)
- [x] **Gold news proxy** ([#52](https://github.com/ford442/gold_tracker/issues/52)) — `fetch-news` Edge Function + `newsService.ts` + `useNews` (mock fallback when Supabase offline/unconfigured)
- [x] **Risk framing (basic)** — gold exposure %, crypto beta %, unrealized P&L, gold-exposure rebalancer bands
- [x] **Regime / fidelity analytics** — volatility/drawdown regime classification, Gold Fidelity Scores, rolling correlations
- [x] **Portfolio persistence** — Zustand persist + optional Coinbase balance sync
- [x] **Testing & CI** — Vitest unit tests on pure `src/lib/` modules with coverage gate; lint/test/build on every PR
- [x] **Alerting** — desktop arbitrage alerts + configurable alert rules
- [x] **Paper-trading ledger** ([#35](https://github.com/ford442/gold_tracker/issues/35)) — `paperTradeStore`, `PaperLedgerPanel`, dry-run fills via `lib/paperTrade.ts`
- [x] **Shared market-history cache** ([#34](https://github.com/ford442/gold_tracker/issues/34)) — `lib/marketCache.ts` (TTL + in-flight dedupe)
- [x] **Multi-exchange adapter Phase A** ([#33](https://github.com/ford442/gold_tracker/issues/33)) — `exchangeAdapters.ts` + `exchanges.ts` (Coinbase/Kraken live; Gemini planned)
- [x] **E2E smoke tests** ([#36](https://github.com/ford442/gold_tracker/issues/36)) — `e2e/` + dedicated CI job
- [x] **Tax-lot accounting** ([#41](https://github.com/ford442/gold_tracker/issues/41)) — `portfolioLots.ts` + cost-basis / gold-oz UI
- [x] **Hardened key UX** ([#40](https://github.com/ford442/gold_tracker/issues/40)) — typed Supabase client + mock fallback
- [x] **Docs truth refresh** ([#51](https://github.com/ford442/gold_tracker/issues/51)) — this document + [docs/ROADMAP.md](docs/ROADMAP.md) + [AGENTS.md](AGENTS.md) + [docs/SHIPPED.md](docs/SHIPPED.md)

### Remaining ▢ (verified gaps only)

- [ ] **Trade & connectivity observability** ([#49](https://github.com/ford442/gold_tracker/issues/49)) — API health dashboard, trade-failure history, latency / cache metrics (today: toasts + `OfflineBanner` only)
- [ ] **Server-side order journal durability** — order journal persists in browser `localStorage` via `orderStore`; no Postgres `trade_logs` replay / multi-device journal yet
- [ ] **Gemini live trading** — Gemini is quote-only in `shared/exchanges.json` (`canTrade: false`); no `ExchangeAdapter` or Edge execution path
- [ ] **Historical backtests on real market data** — Classic Backtest / Scenario Lab still seed from `strategyMockTicks.ts`; no CoinGecko tick replay pipeline
- [ ] **`lint:strict` CI gate** — ~52 `ESLINT_STRICT=1` violations remain; aspirational gate not wired into CI
- [ ] **WASM analytics offload** ([#32](https://github.com/ford442/gold_tracker/issues/32)) — deferred; web workers shipped instead ([#54](https://github.com/ford442/gold_tracker/issues/54))

**Mock vs live vs shipped (on `main` today):**

- **Mock** — no API keys, offline, or Supabase unconfigured → CoinGecko / MetalPrice / news mocks
- **Live data** — keys present → real prices via REST + optional WebSocket transport (`settingsStore.priceTransportMode`); news live when Supabase `fetch-news` is deployed
- **Live trading** — server-secure or local keys with dry-run off → `executeOrderWithLifecycle` with risk gates + client journal; still no server-durable order history

### Out of scope 🚫 (intentionally not pursued)

- Multi-user KYC/AML compliance, role-based access, and account management
- Regulatory trade surveillance / reporting (MiFID II, SEC)
- Sub-millisecond / high-frequency execution and co-located infrastructure
- 99.x% SLA redundancy and horizontal scaling — this is a personal terminal

---

## Truth protocol (for agents)

> **GitHub closed ≠ shipped.** An issue may be closed before code merges, or code may ship while the issue stays open. Do not trust issue state alone.

**Verify in three steps:**

1. **Path presence** — `git ls-tree origin/main -- <path>` (see [docs/SHIPPED.md](docs/SHIPPED.md) for canonical paths).
2. **Wiring** — grep imports from `src/hooks/`, `src/components/`, or `App.tsx` into the lib/module (a file alone is not shipped UX).
3. **Docs** — update Done/Remaining in this file + `docs/SHIPPED.md` in the same PR when adding foundation modules.

When a feature ships, move it from Remaining → Done here and check the box in `docs/SHIPPED.md`.

---

## For agents — closed issues vs shipped

| Closed issue | Why closed early | Replacement / note | Verify on `main` by |
|--------------|------------------|--------------------|---------------------|
| [#28](https://github.com/ford442/gold_tracker/issues/28) news RSS | CORS in browser | [#52](https://github.com/ford442/gold_tracker/issues/52) shipped | `services/newsService.ts` → `fetch-news` Edge Function; mock when Supabase absent |
| [#38](https://github.com/ford442/gold_tracker/issues/38) WebSocket | Superseded | [#48](https://github.com/ford442/gold_tracker/issues/48) shipped | `lib/priceTransport.ts` + `useGoldPrices` + Settings Data Feed |
| [#33](https://github.com/ford442/gold_tracker/issues/33) multi-venue | Phase A label | [#45](https://github.com/ford442/gold_tracker/issues/45), [#47](https://github.com/ford442/gold_tracker/issues/47), [#53](https://github.com/ford442/gold_tracker/issues/53) shipped | `shared/registry.ts`, `executeOrder.ts`, `venueQuoteFanout.ts` |
| [#32](https://github.com/ford442/gold_tracker/issues/32) WASM perf | Deferred | [#54](https://github.com/ford442/gold_tracker/issues/54) workers shipped | `src/workers/analyticsWorker.ts`, `lib/workerClient.ts` |
| [#46](https://github.com/ford442/gold_tracker/issues/46) order lifecycle | Closed on GitHub | **Client shipped**; server journal remaining | `orderLifecycle.ts`, `orderStore`, `useOrderReconciliation`, `OrderHistoryPanel` |
| [#45](https://github.com/ford442/gold_tracker/issues/45) registry | Closed on GitHub | **Shipped** | `shared/exchanges.json`, Edge `_shared/registry.ts` |
| [#47](https://github.com/ford442/gold_tracker/issues/47) adapters | Closed on GitHub | **Shipped** | `executeOrderWithLifecycle` → `getAdapter()`; no direct `coinbaseTrader` from UI |
| [#48](https://github.com/ford442/gold_tracker/issues/48) WebSocket transport | Closed on GitHub | **Shipped** | `priceTransportMode` in settings; `createPriceTransport` in `useGoldPrices` |
| [#50](https://github.com/ford442/gold_tracker/issues/50) risk engine | Closed on GitHub | **Shipped** | `riskEngine.ts`, `useRiskContext`, Settings Risk Management panel |
| [#52](https://github.com/ford442/gold_tracker/issues/52) news proxy | Closed on GitHub | **Shipped** (mock fallback retained) | `supabase/functions/fetch-news/`, `newsService.ts` |
| [#53](https://github.com/ford442/gold_tracker/issues/53) multi-venue arb | Closed on GitHub | **Shipped** | `GlobalArbitrageMonitor` + `useVenueQuotes` |
| [#54](https://github.com/ford442/gold_tracker/issues/54) workers | Closed on GitHub | **Shipped** | `useStrategyBacktest` / `useRegimeAnalysis` → `workerClient` |

When in doubt, read [docs/ROADMAP.md](docs/ROADMAP.md), [docs/SHIPPED.md](docs/SHIPPED.md), and the Done/Remaining lists above rather than trusting a closed issue alone.

---

## 2. Trading-Proficiency Assessment (updated)

GoldTrackr **can** now place and route trades on Coinbase and Kraken, backtest strategies (mock ticks), stress-test a portfolio, practice via the paper ledger, stream or poll live prices, enforce pre-trade risk limits, and reconcile orders after outages — all with a client-side order journal. What separates it from a *proficient* OMS is primarily **server-durable order history**, **operational observability**, and **real-tick backtests** — not the absence of execution, risk gates, or streaming data.

Prioritized path to close the remaining gap:

1. **Observability** ([#49](https://github.com/ford442/gold_tracker/issues/49)) — API health, trade-failure history, latency / cache metrics
2. **Server-side order journal** — durable Postgres journal + multi-device replay (extend `trade_logs` / Edge)
3. **Historical backtests** — CoinGecko tick replay into `strategyEngine` (replace mock-only Classic Backtest seed)
4. **Gemini trading** — adapter + Edge path for venues marked `canTrade: true`
5. **`lint:strict` in CI** — burn down remaining type-safety violations

---

## 3. Architecture Principle

New capability lands **pure-logic-first**:

```
src/lib (pure, unit-tested) → src/hooks (React) → src/store (Zustand) → src/components (UI)
```

Keep the strategy engine, regime math, fee helpers, and API clients free of React so they stay testable. See [AGENTS.md](AGENTS.md) for conventions and the layer-by-layer file map.

---

### Conclusion

GoldTrackr has grown from a read-only dashboard into a working personal trading terminal with execution, risk gates, client order lifecycle, streaming prices, a backend, backtesting, paper trading, regime analytics, and cross-venue arbitrage monitoring. The remaining work is **OMS hardening and ops** — observability ([#49](https://github.com/ford442/gold_tracker/issues/49)), server-durable journals, real-tick backtests, and Gemini execution. See [docs/ROADMAP.md](docs/ROADMAP.md) for the navigable summary. Update this document and [docs/SHIPPED.md](docs/SHIPPED.md) as those items ship.
