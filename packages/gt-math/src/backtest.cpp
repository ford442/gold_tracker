#include "gt_math.h"

#include <cmath>
#include <vector>

namespace {

struct Position {
  int asset;
  double units;
  double avg_cost;
};

struct TradeOut {
  double ts;
  double asset_idx;
  double side;
  double price;
  double units;
  double amount_usd;
  double pnl;
  double fee_usd;
};

struct Engine {
  double balance;
  std::vector<Position> positions;
};

double tick_price(const double* prices, int n_assets, int tick, int asset) {
  if (asset < 0 || asset >= n_assets) return 0.0;
  return prices[tick * n_assets + asset];
}

Position* find_pos(Engine& st, int asset) {
  for (Position& p : st.positions) {
    if (p.asset == asset) return &p;
  }
  return nullptr;
}

const Position* find_pos_c(const Engine& st, int asset) {
  for (const Position& p : st.positions) {
    if (p.asset == asset) return &p;
  }
  return nullptr;
}

void erase_pos(Engine& st, int asset) {
  for (size_t i = 0; i < st.positions.size(); ++i) {
    if (st.positions[i].asset == asset) {
      st.positions.erase(st.positions.begin() + static_cast<std::ptrdiff_t>(i));
      return;
    }
  }
}

double effective_buy(double mid, double slip_bps) {
  return mid * (1.0 + slip_bps / 10000.0);
}

double effective_sell(double mid, double slip_bps) {
  return mid * (1.0 - slip_bps / 10000.0);
}

double leg_fee(double notional, double fee_bps) {
  return notional * fee_bps / 10000.0;
}

bool is_crypto_like(double score, double corr_btc, double corr_gold, double delta) {
  if (score < 45.0) return true;
  return corr_btc - corr_gold >= delta;
}

double regime_size_mult(
    double avg_score,
    bool divergence,
    double min_fid,
    double full_fid,
    double min_mult) {
  if (avg_score >= full_fid) return 1.0;
  if (avg_score <= min_fid) {
    return divergence ? std::max(min_mult, 0.5) : min_mult;
  }
  const double t = (avg_score - min_fid) / (full_fid - min_fid);
  return min_mult + t * (1.0 - min_mult);
}

struct Signal {
  int asset;
  int side;  // GT_SIDE_*
  double amount_usd;
};

struct ArbState {
  int open_side;  // 0 none, 1 long1, 2 long2
};

struct MrState {
  std::vector<double> history;
  double entry_price;
  bool has_entry;
};

void collect_arb_signals(
    Signal* out,
    int* n_out,
    ArbState& arb,
    const Engine& st,
    double p1,
    double p2,
    int a1,
    int a2,
    double spread_threshold,
    double trade_size,
    bool gate_enabled,
    bool has_regime,
    const double* regime6,
    double min_fid,
    double full_fid,
    double min_mult,
    double crypto_delta,
    bool allow_override) {
  *n_out = 0;
  if (p1 == 0.0 || p2 == 0.0) return;

  const double spread = ((p1 - p2) / p2) * 100.0;

  if (arb.open_side == 0) {
    if (std::fabs(spread) > spread_threshold) {
      double effective_trade_size = trade_size;
      if (gate_enabled && has_regime && regime6 != nullptr) {
        const double paxg_score = regime6[0];
        const double paxg_gold = regime6[1];
        const double paxg_btc = regime6[2];
        const double xaut_score = regime6[3];
        const double xaut_gold = regime6[4];
        const double xaut_btc = regime6[5];
        const double avg_score = (paxg_score + xaut_score) / 2.0;
        const bool divergence =
            is_crypto_like(paxg_score, paxg_btc, paxg_gold, crypto_delta) ||
            is_crypto_like(xaut_score, xaut_btc, xaut_gold, crypto_delta);
        const bool high_fid = avg_score >= min_fid;
        const bool allowed = high_fid || (allow_override && divergence);
        if (!allowed) return;
        effective_trade_size = trade_size * regime_size_mult(avg_score, divergence, min_fid, full_fid, min_mult);
      }

      if (spread > 0.0) {
        if (st.balance >= 1.0) {
          const double amt = std::min(effective_trade_size, st.balance);
          out[(*n_out)++] = {a2, GT_SIDE_BUY, amt};
          arb.open_side = 2;
        }
      } else {
        if (st.balance >= 1.0) {
          const double amt = std::min(effective_trade_size, st.balance);
          out[(*n_out)++] = {a1, GT_SIDE_BUY, amt};
          arb.open_side = 1;
        }
      }
    }
  } else {
    if (std::fabs(spread) < spread_threshold / 2.0) {
      const int asset_to_sell = arb.open_side == 1 ? a1 : a2;
      const Position* pos = find_pos_c(st, asset_to_sell);
      if (pos && pos->units > 0.0) {
        out[(*n_out)++] = {asset_to_sell, GT_SIDE_SELL, 0.0};
        arb.open_side = 0;
      }
    }
  }
}

void collect_mr_signals(
    Signal* out,
    int* n_out,
    MrState& mr,
    const Engine& st,
    double price,
    int asset,
    int window_size,
    double buy_threshold,
    double sell_threshold,
    double trade_size,
    double stop_loss) {
  *n_out = 0;
  if (price == 0.0) return;

  mr.history.push_back(price);
  if (static_cast<int>(mr.history.size()) > window_size) {
    mr.history.erase(mr.history.begin());
  }
  if (static_cast<int>(mr.history.size()) < window_size) return;

  double sum = 0.0;
  for (double v : mr.history) sum += v;
  const double sma = sum / static_cast<double>(mr.history.size());

  const Position* pos = find_pos_c(st, asset);
  const bool has_position = pos && pos->units > 0.000001;

  if (!has_position) {
    if (price < sma * (1.0 - buy_threshold / 100.0)) {
      if (st.balance >= 1.0) {
        out[(*n_out)++] = {asset, GT_SIDE_BUY, std::min(trade_size, st.balance)};
        mr.entry_price = price;
        mr.has_entry = true;
      }
    }
  } else {
    if (price > sma * (1.0 + sell_threshold / 100.0)) {
      out[(*n_out)++] = {asset, GT_SIDE_SELL, 0.0};
      mr.has_entry = false;
    } else if (mr.has_entry && price < mr.entry_price * (1.0 - stop_loss / 100.0)) {
      out[(*n_out)++] = {asset, GT_SIDE_SELL, 0.0};
      mr.has_entry = false;
    }
  }
}

void collect_rebal_signals(
    Signal* out,
    int* n_out,
    const Engine& st,
    const double* tick_px,
    int n_assets,
    const int* gold_ids,
    int n_gold,
    double target_pct,
    double band_pct,
    bool use_trade_size,
    double trade_size_usd) {
  *n_out = 0;
  if (n_gold <= 0) return;

  double total_equity = st.balance;
  for (const Position& pos : st.positions) {
    if (pos.asset < 0 || pos.asset >= n_assets) continue;
    const double p = tick_px[pos.asset];
    if (p != 0.0 && pos.units > 0.0) total_equity += pos.units * p;
  }
  if (total_equity <= 0.0) return;

  double gold_value = 0.0;
  for (int i = 0; i < n_gold; ++i) {
    const int gid = gold_ids[i];
    if (gid < 0 || gid >= n_assets) continue;
    const double p = tick_px[gid];
    const Position* pos = find_pos_c(st, gid);
    if (p != 0.0 && pos && pos->units > 0.0) gold_value += pos->units * p;
  }

  const double actual_pct = gold_value / total_equity;
  if (std::fabs(actual_pct - target_pct) <= band_pct) return;

  int target_gold = -1;
  for (int i = 0; i < n_gold; ++i) {
    const int gid = gold_ids[i];
    if (gid >= 0 && gid < n_assets && tick_px[gid] != 0.0) {
      target_gold = gid;
      break;
    }
  }
  if (target_gold < 0) target_gold = gold_ids[0];
  if (target_gold < 0 || target_gold >= n_assets) return;
  const double target_price = tick_px[target_gold];
  if (target_price <= 0.0) return;

  const double desired = total_equity * target_pct;
  const double delta = desired - gold_value;
  if (std::fabs(delta) < 1.0) return;

  if (delta > 0.0) {
    double spend;
    if (use_trade_size) {
      spend = std::min(trade_size_usd, std::min(st.balance, delta));
    } else {
      spend = std::min(st.balance, delta * 0.98);
    }
    if (spend >= 1.0) {
      out[(*n_out)++] = {target_gold, GT_SIDE_BUY, spend};
    }
  } else {
    const Position* pos = find_pos_c(st, target_gold);
    if (pos && pos->units > 0.000001) {
      const double sell_value = use_trade_size
          ? std::min(trade_size_usd, std::fabs(delta))
          : std::fabs(delta) * 0.98;
      const double units_to_sell = std::min(pos->units, sell_value / target_price);
      if (units_to_sell * target_price >= 1.0) {
        out[(*n_out)++] = {target_gold, GT_SIDE_SELL, 0.0};
      }
    }
  }
}

void apply_buy(
    Engine& st,
    std::vector<TradeOut>& trades,
    double ts,
    int asset,
    double mid,
    double spend_req,
    double fee_bps,
    double slip_bps,
    double* total_fees,
    double* total_slip) {
  const double max_spend_before_fee =
      fee_bps > 0.0 ? st.balance / (1.0 + fee_bps / 10000.0) : st.balance;
  const double spend = std::min(spend_req, max_spend_before_fee);
  if (spend < 0.01) return;

  const double eff = effective_buy(mid, slip_bps);
  const double fee = leg_fee(spend, fee_bps);
  const double total_debit = spend + fee;
  if (total_debit > st.balance + 0.0001) return;

  const double units = spend / eff;
  const double slip_cost = spend - units * mid;

  st.balance -= total_debit;
  *total_fees += fee;
  *total_slip += std::max(0.0, slip_cost);

  Position* existing = find_pos(st, asset);
  if (existing) {
    const double total_cost = existing->units * existing->avg_cost + spend;
    existing->units += units;
    existing->avg_cost = total_cost / existing->units;
  } else {
    st.positions.push_back({asset, units, mid});
  }

  trades.push_back({ts, static_cast<double>(asset), static_cast<double>(GT_SIDE_BUY), mid, units, spend, 0.0, fee});
}

bool apply_sell(
    Engine& st,
    std::vector<TradeOut>& trades,
    double ts,
    int asset,
    double mid,
    double fee_bps,
    double slip_bps,
    double* total_fees,
    double* total_slip,
    int* winning) {
  Position* pos = find_pos(st, asset);
  if (!pos || pos->units < 0.000001) return false;

  const double eff = effective_sell(mid, slip_bps);
  const double gross = pos->units * eff;
  const double fee = leg_fee(gross, fee_bps);
  const double net = gross - fee;
  const double mid_proceeds = pos->units * mid;
  const double slip_cost = mid_proceeds - gross;
  const double pnl = net - pos->units * pos->avg_cost;

  if (pnl > 0.0) ++(*winning);

  st.balance += net;
  *total_fees += fee;
  *total_slip += std::max(0.0, slip_cost);

  trades.push_back({
      ts,
      static_cast<double>(asset),
      static_cast<double>(GT_SIDE_SELL),
      mid,
      pos->units,
      gross,
      pnl,
      fee,
  });
  erase_pos(st, asset);
  return true;
}

}  // namespace

int gt_run_backtest(
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
    double* trades_out) {
  if (metrics == nullptr) return -1;
  for (int i = 0; i < 9; ++i) metrics[i] = 0.0;

  Engine st;
  st.balance = initial_balance;
  if (n_init_pos > 0 && init_pos_idx && init_pos_units && init_pos_avg) {
    st.positions.reserve(static_cast<size_t>(n_init_pos));
    for (int i = 0; i < n_init_pos; ++i) {
      st.positions.push_back({init_pos_idx[i], init_pos_units[i], init_pos_avg[i]});
    }
  }

  if (n_ticks <= 0 || n_assets <= 0 || timestamps == nullptr || prices == nullptr) {
    metrics[0] = initial_balance;
    return 0;
  }

  ArbState arb{0};
  MrState mr;
  mr.has_entry = false;
  mr.entry_price = 0.0;

  int a1 = 0, a2 = 0, gate_enabled = 0;
  double spread_th = 0, trade_size = 0, min_fid = 45, full_fid = 70, min_mult = 0.35;
  double crypto_delta = 0.12;
  bool allow_override = true;

  int mr_asset = 0, mr_window = 0;
  double mr_buy = 0, mr_sell = 0, mr_tsize = 0, mr_stop = 0;

  int n_gold = 0;
  const int* gold_ids = nullptr;
  double target_pct = 0, band_pct = 0, rebal_tsize = 0;
  bool use_trade_size = false;

  if (strat_kind == GT_STRAT_ARB) {
    if (n_strat_ints < 3 || n_strat_doubles < 7) return -1;
    a1 = strat_ints[0];
    a2 = strat_ints[1];
    gate_enabled = strat_ints[2];
    spread_th = strat_doubles[0];
    trade_size = strat_doubles[1];
    min_fid = strat_doubles[2];
    full_fid = strat_doubles[3];
    min_mult = strat_doubles[4];
    crypto_delta = strat_doubles[5];
    allow_override = strat_doubles[6] != 0.0;
  } else if (strat_kind == GT_STRAT_MR) {
    if (n_strat_ints < 2 || n_strat_doubles < 4) return -1;
    mr_asset = strat_ints[0];
    mr_window = strat_ints[1];
    mr_buy = strat_doubles[0];
    mr_sell = strat_doubles[1];
    mr_tsize = strat_doubles[2];
    mr_stop = strat_doubles[3];
  } else if (strat_kind == GT_STRAT_REBAL) {
    if (n_strat_ints < 2 || n_strat_doubles < 3) return -1;
    n_gold = strat_ints[0];
    if (n_gold < 0 || n_strat_ints < 2 + n_gold) return -1;
    gold_ids = strat_ints + 1;
    use_trade_size = strat_ints[1 + n_gold] != 0;
    target_pct = strat_doubles[0];
    band_pct = strat_doubles[1];
    rebal_tsize = strat_doubles[2];
  }

  std::vector<TradeOut> trades;
  trades.reserve(static_cast<size_t>(n_ticks + 8));

  double peak_equity = initial_balance;
  double max_dd = 0.0;
  int winning = 0;
  double total_fees = 0.0;
  double total_slip = 0.0;

  Signal sigs[8];

  for (int t = 0; t < n_ticks; ++t) {
    const double ts = timestamps[t];
    const double* row = prices + t * n_assets;
    const bool tick_has_regime = has_regime != nullptr && has_regime[t] != 0;
    const double* regime6 = (tick_has_regime && regime_scores) ? regime_scores + t * 6 : nullptr;

    int n_sig = 0;
    if (strat_kind == GT_STRAT_ARB) {
      collect_arb_signals(
          sigs, &n_sig, arb, st, tick_price(prices, n_assets, t, a1),
          tick_price(prices, n_assets, t, a2), a1, a2, spread_th, trade_size,
          gate_enabled != 0, tick_has_regime, regime6, min_fid, full_fid, min_mult, crypto_delta,
          allow_override);
    } else if (strat_kind == GT_STRAT_MR) {
      collect_mr_signals(
          sigs, &n_sig, mr, st, tick_price(prices, n_assets, t, mr_asset), mr_asset, mr_window,
          mr_buy, mr_sell, mr_tsize, mr_stop);
    } else if (strat_kind == GT_STRAT_REBAL) {
      collect_rebal_signals(
          sigs, &n_sig, st, row, n_assets, gold_ids, n_gold, target_pct, band_pct, use_trade_size,
          rebal_tsize);
    }

    for (int s = 0; s < n_sig; ++s) {
      const double mid = tick_price(prices, n_assets, t, sigs[s].asset);
      if (mid <= 0.0) continue;
      if (sigs[s].side == GT_SIDE_BUY) {
        apply_buy(
            st, trades, ts, sigs[s].asset, mid, sigs[s].amount_usd, fee_bps, slippage_bps,
            &total_fees, &total_slip);
      } else {
        apply_sell(
            st, trades, ts, sigs[s].asset, mid, fee_bps, slippage_bps, &total_fees, &total_slip,
            &winning);
      }
    }

    double equity = st.balance;
    for (const Position& pos : st.positions) {
      const double p = (pos.asset >= 0 && pos.asset < n_assets) ? row[pos.asset] : 0.0;
      if (p != 0.0) equity += pos.units * p;
    }
    if (equity_ts) equity_ts[t] = ts;
    if (equity_val) equity_val[t] = equity;
    if (equity > peak_equity) peak_equity = equity;
    if (peak_equity > 0.0) {
      const double dd = ((peak_equity - equity) / peak_equity) * 100.0;
      if (dd > max_dd) max_dd = dd;
    }
  }

  const int last = n_ticks - 1;
  const double last_ts = timestamps[last];
  std::vector<Position> remaining = st.positions;
  for (const Position& pos : remaining) {
    const double mid = tick_price(prices, n_assets, last, pos.asset);
    if (mid != 0.0 && pos.units > 0.000001) {
      apply_sell(
          st, trades, last_ts, pos.asset, mid, fee_bps, slippage_bps, &total_fees, &total_slip,
          &winning);
    }
  }

  const double final_bal = st.balance;
  if (equity_val) equity_val[last] = final_bal;

  const double gross_final = final_bal + total_fees + total_slip;
  const double total_return =
      initial_balance != 0.0 ? ((final_bal - initial_balance) / initial_balance) * 100.0 : 0.0;
  const double gross_return =
      initial_balance != 0.0 ? ((gross_final - initial_balance) / initial_balance) * 100.0 : 0.0;

  int sell_count = 0;
  for (const TradeOut& tr : trades) {
    if (static_cast<int>(tr.side) == GT_SIDE_SELL) ++sell_count;
  }

  metrics[0] = final_bal;
  metrics[1] = total_return;
  metrics[2] = gross_return;
  metrics[3] = gross_final;
  metrics[4] = total_fees;
  metrics[5] = total_slip;
  metrics[6] = max_dd;
  metrics[7] = static_cast<double>(sell_count);
  metrics[8] = static_cast<double>(winning);

  const int n_write = std::min(static_cast<int>(trades.size()), std::max(0, max_trades));
  if (trades_out) {
    for (int i = 0; i < n_write; ++i) {
      double* row = trades_out + i * 8;
      row[0] = trades[static_cast<size_t>(i)].ts;
      row[1] = trades[static_cast<size_t>(i)].asset_idx;
      row[2] = trades[static_cast<size_t>(i)].side;
      row[3] = trades[static_cast<size_t>(i)].price;
      row[4] = trades[static_cast<size_t>(i)].units;
      row[5] = trades[static_cast<size_t>(i)].amount_usd;
      row[6] = trades[static_cast<size_t>(i)].pnl;
      row[7] = trades[static_cast<size_t>(i)].fee_usd;
    }
  }
  return n_write;
}
