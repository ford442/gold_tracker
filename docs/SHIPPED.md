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
| Order orchestrator (pure) | `src/lib/executeOrder.ts` | `useOrderExecution.ts` |
| Order execution hook | `src/hooks/useOrderExecution.ts` | `useTradeExecution`, `GlobalArbitrageMonitor`, `OrderHistoryPanel`, `useOrderReconciliation` |
| Order journal store | `src/store/orderStore.ts` | `useOrderExecution`, `OrderHistoryPanel` |
| Reconciliation hook | `src/hooks/useOrderReconciliation.ts` | `App.tsx` |
| Order history UI | `src/components/OrderHistoryPanel.tsx` | `PortfolioSection`, `MarketsSection` |
| Risk engine | `src/lib/riskEngine.ts` | `useRiskContext`, `DryRunToggles` / Risk panel |
| Exchange adapters | `src/lib/exchangeAdapters.ts` | `useOrderExecution.ts` |
| Shared registry | `shared/exchanges.json`, `shared/registry.ts` | `lib/exchanges.ts`, Edge `_shared/registry.ts` |

## Observability & diagnostics

| Module | Verify path | Wired from |
|--------|-------------|------------|
| Telemetry ring buffer (pure) | `src/lib/observability.ts` | `priceTransport.ts`, `useGoldPrices.ts`, `marketCache.ts`, `venueQuoteFanout.ts`, `executeOrder.ts`, `tradeService.ts`, `newsService.ts` |
| Observability hook | `src/hooks/useObservability.ts` | `SystemObservabilityPanel.tsx` |
| Diagnostics UI | `src/components/settings/SystemObservabilityPanel.tsx` | `SettingsModal.tsx` |

## Backend / services

| Module | Verify path | Wired from |
|--------|-------------|------------|
| News proxy | `supabase/functions/fetch-news/` | `services/newsService.ts` → `useNews` |
| Place trade (Edge) | `supabase/functions/place-trade/` | `services/tradeService.ts` |
| Server order journal | `src/lib/orderSync.ts`, `src/services/orderJournalService.ts`, `supabase/schema.sql` (`order_journal`) | `src/hooks/useOrderSync.ts`, `App.tsx` |

## Analytics

| Module | Verify path | Wired from |
|--------|-------------|------------|
| Analytics worker | `src/workers/analyticsWorker.ts` | `lib/workerClient.ts` |
| Worker client | `src/lib/workerClient.ts` | `useStrategyBacktest`, `useRegimeAnalysis` |
| Historical backtest ticks (pure) | `src/lib/historicalTicks.ts` | `useStrategyBacktest.ts` via `marketCache` |
| Data source UI | `src/components/strategy/DataSourceSelector.tsx` | `StrategyDashboard.tsx` |
| Counterfactual trade engine (pure) | `src/lib/counterfactual.ts` | `useCounterfactual.ts` |
| Counterfactual trade explorer UI | `src/components/CounterfactualTradeExplorer.tsx` | `PortfolioSection.tsx` |

---

## Not shipped (do not check)

| Gap | Why |
|-----|-----|
| Gemini live trading | Registry `canTrade: false`; no adapter |
| `lint:strict` CI gate | ~52 violations remain |



