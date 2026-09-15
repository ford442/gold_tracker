#pragma once

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#define GT_KEEP EMSCRIPTEN_KEEPALIVE
#else
#define GT_KEEP
#endif

#ifdef __cplusplus
extern "C" {
#endif

enum {
  GT_STRAT_HOLD = 0,
  GT_STRAT_ARB = 1,
  GT_STRAT_MR = 2,
  GT_STRAT_REBAL = 3
};

enum {
  GT_SIDE_BUY = 0,
  GT_SIDE_SELL = 1
};

/** Pearson correlation; n < 2 returns 0. Clamped to [-1, 1]. */
GT_KEEP double gt_pearson(const double* x, const double* y, int n);

/**
 * Naive windowed rolling Pearson (same algorithm as TS slice + pearson).
 * Writes n - window + 1 values to out. Returns count written, or 0 if n < window.
 */
GT_KEEP int gt_rolling_pearson(const double* a, const double* b, int n, int window, double* out);

/** Max drawdown as percent, rounded to 2 decimals. n < 2 returns 0. */
GT_KEEP double gt_max_drawdown(const double* prices, int n);

/**
 * Align multi-asset [ts, price] series (nearest-bin, same as
 * alignHistoricalSeriesToTicks). series_ts / series_px are concatenated per asset.
 * lengths[i] = point count for asset i (pre-filter; invalid points are dropped).
 * required_idx[0..n_required) are asset indices that MUST match.
 * base_asset_idx < 0 means pick the required asset with the most points (ties keep earlier).
 * out_px is n_ticks * n_assets, row-major; missing optional prices are 0.
 * Returns n_ticks written (0 on failure / empty).
 */
GT_KEEP int gt_align_ticks(
    int n_assets,
    const int* lengths,
    const double* series_ts,
    const double* series_px,
    int n_required,
    const int* required_idx,
    int base_asset_idx,
    double max_gap_ms,
    int max_out,
    double* out_ts,
    double* out_px);

/**
 * Packed backtest matching dispatchRunBacktest numeric / trade-leg results.
 *
 * prices: n_ticks * n_assets, row-major; 0 means missing.
 * timestamps: n_ticks
 * has_regime: per-tick 0/1 (int32). If 1, regime_scores holds 6 doubles per tick:
 *   paxg.score, paxg.corrToGold, paxg.corrToBtc, xaut.score, xaut.corrToGold, xaut.corrToBtc
 *
 * Strategy packing is documented in nativeAnalytics.ts.
 *
 * metrics[9]:
 *   finalBalance, totalReturn, grossTotalReturn, grossFinalBalance,
 *   totalFeesUsd, totalSlippageUsd, maxDrawdown, totalTrades, winningTrades
 * trades_out: max_trades rows of 8 doubles:
 *   ts, asset_idx, side, price, units, amountUSD, pnl, feeUsd
 *
 * Returns number of trades written, or -1 on error.
 */
GT_KEEP int gt_run_backtest(
    int n_ticks,
    int n_assets,
    const double* timestamps,
    const double* prices,
    const int* has_regime,
    const double* regime_scores,
    int strat_kind,
    const int* strat_ints,
    int n_strat_ints,
    const double* strat_doubles,
    int n_strat_doubles,
    double initial_balance,
    int n_init_pos,
    const int* init_pos_idx,
    const double* init_pos_units,
    const double* init_pos_avg,
    double fee_bps,
    double slippage_bps,
    double* metrics,
    double* equity_ts,
    double* equity_val,
    int max_trades,
    double* trades_out);

#ifdef __cplusplus
}
#endif
