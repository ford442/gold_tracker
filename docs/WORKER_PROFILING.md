# Analytics Worker Profiling

Issue #32 deferred C++/WASM until workers shipped ([#54](https://github.com/ford442/gold_tracker/issues/54)). This document records the **pre-worker baseline**, **worker offload scope**, and **post-WASM kernel** numbers.

## Methodology

1. Build production bundle: `npm run build && npm run preview`
2. Open Chrome DevTools → **Performance**
3. Enable **CPU throttling: 4× slowdown** (approximates mid-tier mobile)
4. Record while triggering each path below

Node synthetic stress (this PR): `GT_MATH_REQUIRE_WASM=1 npx vitest run src/lib/nativeAnalytics.test.ts` (see bench line in test output).

## Paths profiled

| Path | Trigger | Main-thread work (baseline) |
|------|---------|----------------------------|
| Classic backtest | Strategies → Classic → Run (arbitrage, 720 ticks) | `runBacktest` + strategy `onTick` loop |
| Scenario Lab | Strategies → Scenario Lab → Run (720 shocked ticks × 2 runs) | Two `runBacktest` passes (rebalancer + hold) |
| Regime analysis | Analytics → Fidelity & Regimes → switch 1Y / MAX | `computeFidelityScores` + `rollingCorrelations` on ~180 downsampled points |

## Baseline observations (4× CPU throttle, pre-worker)

> Record your local numbers when validating the PR. Representative ranges from dev profiling:

- **Classic backtest (720 ticks):** ~15–40 ms main-thread blocking (varies by strategy)
- **Scenario Lab (2 × 720 ticks):** ~30–80 ms — most noticeable UI jank source
- **Regime 1Y rolling corrs:** ~5–20 ms for dual `rollingCorrelations` windows; fidelity matrix adds ~10–25 ms

Long tasks (>50 ms) can delay paint/input on mid-tier mobile during Scenario Lab runs.

## Worker offload (#54)

| Task | Worker message | Main-thread fallback |
|------|----------------|---------------------|
| `runBacktest` | `runBacktest` | `dispatchRunBacktest` via `workerClient` |
| `rollingCorrelations` | `rollingCorrelations` | `dispatchRollingCorrelations` via `workerClient` |

**Not offloaded (yet):** `computeFidelityScores`, correlation matrix in `CorrelationMatrix` / tactical hooks — lighter than backtest loops; revisit if profiling shows long tasks.

## WASM kernel (#32) — 2026-09-15

Optional C++ package [`packages/gt-math`](../packages/gt-math/README.md) loaded **once inside the analytics worker** via `nativeAnalytics.ts`. Main thread never instantiates `.wasm`. Missing artifact → TS `analyticsDispatch` (same RPC).

### Current product series (still small)

| Path | Series length | Expected worker CPU |
|------|----------------|---------------------|
| Fidelity & Regimes 90d / 1Y | downsampled ≤ 180 pts, rolling window ~18–30 | well under 50 ms (pre-worker 5–20 ms at 4×) |
| Classic 90d historical | ~90 daily ticks | well under 50 ms |
| Classic 30d hourly | ~720 ticks | ~15–40 ms pre-worker at 4×; worker already removed UI blocking |

**Honest read:** shipping WASM does **not** change Fidelity/90d UX in a measurable way. The kernel exists so 1y–5y daily backtests, dense rolling-corr heatmaps, and Monte Carlo paths can depend on it later — those UIs are **not** in this issue.

### Synthetic stress (Node, unthrottled, Vitest)

Measured 2026-09-15 on the CI-class host after `npm run build:wasm`:

| Workload | TS reference | WASM kernel |
|----------|--------------|-------------|
| Rolling Pearson, 10k points, window 60 | ~74 ms | ~5.3 ms (~14×) |
| Hold backtest, 5k ticks | ~2.9 ms | ~5.6 ms (pack/unpack dominates; no strategy work) |

Takeaway: WASM wins on dense rolling Pearson. Simple `hold` on 5k ticks is packing-bound; arb/MR/rebalancer inner loops are the target for future 1y+ / Monte Carlo batching.

### Chrome 4× (product UI)

No new UI. With workers already off-thread, 90d/1Y interactions stay below the ~50 ms long-task bar on mid-tier profiles. Re-run Chrome Performance on Fidelity 90d/1Y and Classic 90d if a future feature stops downsampling or adds Monte Carlo.

## Acceptance

- Vitest parity: `src/lib/workerClient.test.ts` asserts worker dispatch === direct `runBacktest` / `rollingCorrelations` on shared fixtures
- `src/lib/analyticsDispatch.test.ts` gates the TS reference before C++ duplicates it
- `src/lib/nativeAnalytics.test.ts` loads `public/gt-math/gt_math.wasm` or skips unless `GT_MATH_REQUIRE_WASM=1`
- `forceMainThread: true` used in workerClient tests (Node has no `Worker`)
- Hooks import only `@lib/workerClient`, never worker internals or `.wasm`
