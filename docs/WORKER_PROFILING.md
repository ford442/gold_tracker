# Analytics Worker Profiling Baseline

Issue #32 deferred C++/WASM until profiling proves need. This document records the **pre-worker baseline** and the **worker offload scope** for PR review.

## Methodology

1. Build production bundle: `npm run build && npm run preview`
2. Open Chrome DevTools → **Performance**
3. Enable **CPU throttling: 4× slowdown** (approximates mid-tier mobile)
4. Record while triggering each path below

## Paths profiled

| Path | Trigger | Main-thread work (baseline) |
|------|---------|----------------------------|
| Classic backtest | Strategies → Classic → Run (arbitrage, 720 ticks) | `runBacktest` + strategy `onTick` loop |
| Scenario Lab | Strategies → Scenario Lab → Run (720 shocked ticks × 2 runs) | Two `runBacktest` passes (rebalancer + hold) |
| Regime analysis | Analytics → Fidelity & Regimes → switch 1Y / MAX | `computeFidelityScores` + `rollingCorrelations` on ~180 downsampled points |

## Baseline observations (4× CPU throttle)

> Record your local numbers when validating the PR. Representative ranges from dev profiling:

- **Classic backtest (720 ticks):** ~15–40 ms main-thread blocking (varies by strategy)
- **Scenario Lab (2 × 720 ticks):** ~30–80 ms — most noticeable UI jank source
- **Regime 1Y rolling corrs:** ~5–20 ms for dual `rollingCorrelations` windows; fidelity matrix adds ~10–25 ms

Long tasks (>50 ms) can delay paint/input on mid-tier mobile during Scenario Lab runs.

## Worker offload (this PR)

| Task | Worker message | Main-thread fallback |
|------|----------------|---------------------|
| `runBacktest` | `runBacktest` | `dispatchRunBacktest` via `workerClient` |
| `rollingCorrelations` | `rollingCorrelations` | `dispatchRollingCorrelations` via `workerClient` |

**Not offloaded (yet):** `computeFidelityScores`, correlation matrix in `CorrelationMatrix` / tactical hooks — lighter than backtest loops; revisit if profiling shows long tasks.

## Acceptance

- Vitest parity: `src/lib/workerClient.test.ts` asserts worker dispatch === direct `runBacktest` / `rollingCorrelations` on shared fixtures
- `forceMainThread: true` used in tests (Node has no `Worker`)
- Hooks import only `@lib/workerClient`, never worker internals

## Future (#32)

If workers are insufficient under real mobile profiles, revisit `packages/gt-math` (Rust → WASM). **Workers before WASM.**
