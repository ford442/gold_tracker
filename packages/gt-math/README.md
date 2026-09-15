# gt-math — optional C++ WASM analytics kernel

GoldTrackr stays TypeScript-first. This package is an **add-on** for heavy numeric loops (rolling Pearson, max drawdown, tick align, backtest inner loop). The TS implementations in `src/lib/regime.ts`, `src/lib/utils.ts`, `src/lib/historicalTicks.ts`, and `src/lib/strategyEngine.ts` remain the numeric source of truth.

UI, Zustand, hooks, JWT/HMAC, and exchange adapters **must not** import this package or any `.wasm` file. The analytics worker loads the artifact via `src/lib/nativeAnalytics.ts` and falls back to `analyticsDispatch.ts` when the files are missing.

## Toolchain

- CMake ≥ 3.20
- Emscripten (`emcc` / `emcmake`) — local installs via [emsdk](https://emscripten.org/docs/getting_started/downloads.html)
- From the repo root:

```bash
npm run build:wasm
```

That runs `scripts/build-wasm.sh`: `emcmake cmake` + build, then copies `gt_math.js` and `gt_math.wasm` to `packages/gt-math/dist/` and `public/gt-math/`.

Root `npm run build` (`tsc -b && vite build`) **does not** require Emscripten. If `public/gt-math/` is absent, Vite still succeeds and the worker uses the TS reference path.

## clangd / Cursor C++ intelligence

`compile_commands.json` is generated **inside this package**, not at the Vite repo root:

```bash
cd packages/gt-math
emcmake cmake -S . -B build -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
```

[`.clangd`](.clangd) points clangd at `build/`. Do not add a root `compile_commands.json` — it would confuse the TypeScript/Vite project.

The compilation database contains machine-local Emscripten paths; it is gitignored (`packages/gt-math/build/`).

## Exported C ABI

| Symbol | TS reference |
|--------|----------------|
| `gt_pearson` | `pearsonCorrelation` |
| `gt_rolling_pearson` | `rollingCorrelations` (naive windowed Pearson, not incremental) |
| `gt_max_drawdown` | `maxDrawdownFromPrices` |
| `gt_align_ticks` | `alignHistoricalSeriesToTicks` |
| `gt_run_backtest` | `dispatchRunBacktest` (hold / arb / mean-reversion / gold rebalancer) |

Fees and slippage are passed in as basis points. Asset symbols and venue registry stay in TypeScript (`toSymbol`, `exchanges.json`).

## Numeric parity

WASM must match TS fixtures on:

- Pearson / rolling Pearson arrays
- Max drawdown (2-decimal rounding)
- Align timestamps and prices
- Backtest metrics and trade legs (`side`, `asset`, `price`, `units`, `amountUSD`, `pnl`, `feeUsd`, equity curve)

**Not** compared: trade `id` and `reason` strings (TS `toFixed` / `toSymbol` text). See `expectNumericBacktestParity` in `src/lib/nativeAnalytics.test.ts`.

## Tests

```bash
# TS reference (always)
npx vitest run src/lib/analyticsDispatch.test.ts

# WASM path — skip unless the artifact exists, unless the flag is set
GT_MATH_REQUIRE_WASM=1 npm test -- src/lib/nativeAnalytics.test.ts
```

CI builds this package, then runs the flagged Vitest. Frontend `quality` tests run **without** the artifact so the TS fallback stays covered.
