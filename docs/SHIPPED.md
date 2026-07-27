# Shipped checklist (agent-maintained)

Quick verify list for foundation modules on `main`. Update this file in the **same PR** that adds or completes a module.

**Truth protocol:** (1) path exists on `main`, (2) imported from a hook or component, (3) box checked here + moved in `code_plan.md` Done/Remaining.

```bash
# Example verify
git ls-tree origin/main -- src/lib/orderLifecycle.ts
rg "useOrderReconciliation|OrderHistoryPanel" src/
```

---

## Data plane

| Module | Verify path | Wired from |
|--------|-------------|------------|
| Price transport (poll + WS) | `src/lib/priceTransport.ts` | `useGoldPrices`, `settings/DataFeedPanel.tsx` |
| Market history cache | `src/lib/marketCache.ts` | hooks/charts via `getMarketChartSeries` |
| Venue quote fanout | `src/lib/venueQuoteFanout.ts` | `useVenueQuotes`, `GlobalArbitrageMonitor` |

## Execution plane

| Module | Verify path | Wired from |
|--------|-------------|------------|
| Order lifecycle (pure) | `src/lib/orderLifecycle.ts` | `executeOrder.ts`, `orderStore` |
| Order orchestrator | `src/lib/executeOrder.ts` | `useTradeExecution`, `GlobalArbitrageMonitor` |
| Order journal store | `src/store/orderStore.ts` | `executeOrderWithLifecycle`, `OrderHistoryPanel` |
| Reconciliation hook | `src/hooks/useOrderReconciliation.ts` | `App.tsx` |
| Order history UI | `src/components/OrderHistoryPanel.tsx` | `PortfolioSection`, `MarketsSection` |
| Risk engine | `src/lib/riskEngine.ts` | `useRiskContext`, `DryRunToggles` / Risk panel |
| Exchange adapters | `src/lib/exchangeAdapters.ts` | `executeOrder.ts` |
| Shared registry | `shared/exchanges.json`, `shared/registry.ts` | `lib/exchanges.ts`, Edge `_shared/registry.ts` |

## Backend / services

| Module | Verify path | Wired from |
|--------|-------------|------------|
| News proxy | `supabase/functions/fetch-news/` | `services/newsService.ts` → `useNews` |
| Place trade (Edge) | `supabase/functions/place-trade/` | `services/tradeService.ts` |

## Analytics

| Module | Verify path | Wired from |
|--------|-------------|------------|
| Analytics worker | `src/workers/analyticsWorker.ts` | `lib/workerClient.ts` |
| Worker client | `src/lib/workerClient.ts` | `useStrategyBacktest`, `useRegimeAnalysis` |

---

## Not shipped (do not check)

| Gap | Why |
|-----|-----|
| Server-durable order journal | `orderStore` is browser `localStorage` only |
| Observability dashboard | [#49](https://github.com/ford442/gold_tracker/issues/49) — no dedicated UI |
| Gemini live trading | Registry `canTrade: false`; no adapter |
| Real-tick backtests | `strategyMockTicks.ts` only |
| `lint:strict` CI gate | ~52 violations remain |
