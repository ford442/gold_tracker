#include "gt_math.h"

#include <cmath>
#include <limits>
#include <vector>

namespace {

struct Point {
  double ts;
  double px;
};

bool is_valid_point(double ts, double px) {
  return std::isfinite(ts) && ts > 0.0 && std::isfinite(px) && px > 0.0;
}

/** Closest valid price within maxGapMs — same binary-search + [high, low] scan as TS. */
double find_closest_price(const std::vector<Point>& series, double target_ts, double max_gap_ms) {
  const int n = static_cast<int>(series.size());
  if (n == 0) return 0.0;

  int low = 0;
  int high = n - 1;

  while (low <= high) {
    const int mid = static_cast<int>(std::floor((low + high) / 2.0));
    const double mid_ts = series[static_cast<size_t>(mid)].ts;
    if (mid_ts == target_ts) {
      const double p = series[static_cast<size_t>(mid)].px;
      return (std::isfinite(p) && p > 0.0) ? p : 0.0;
    }
    if (mid_ts < target_ts) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  double best_dist = std::numeric_limits<double>::infinity();
  double best_price = 0.0;
  const int candidates[2] = {high, low};
  for (int c = 0; c < 2; ++c) {
    const int idx = candidates[c];
    if (idx >= 0 && idx < n) {
      const Point& pt = series[static_cast<size_t>(idx)];
      const double dist = std::fabs(pt.ts - target_ts);
      if (dist <= max_gap_ms && dist < best_dist && std::isfinite(pt.px) && pt.px > 0.0) {
        best_dist = dist;
        best_price = pt.px;
      }
    }
  }
  return best_price;
}

}  // namespace

int gt_align_ticks(
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
    double* out_px) {
  if (n_assets <= 0 || lengths == nullptr || series_ts == nullptr || series_px == nullptr ||
      n_required <= 0 || required_idx == nullptr || out_ts == nullptr || out_px == nullptr ||
      max_out <= 0) {
    return 0;
  }

  std::vector<std::vector<Point>> clean(static_cast<size_t>(n_assets));
  int offset = 0;
  for (int a = 0; a < n_assets; ++a) {
    const int len = lengths[a];
    if (len < 0) return 0;
    std::vector<Point> pts;
    pts.reserve(static_cast<size_t>(len));
    for (int i = 0; i < len; ++i) {
      const double ts = series_ts[offset + i];
      const double px = series_px[offset + i];
      if (is_valid_point(ts, px)) {
        pts.push_back({ts, px});
      }
    }
    // Insertion order is already chronological in TS after sort; sort here to match.
    for (size_t i = 1; i < pts.size(); ++i) {
      const Point key = pts[i];
      size_t j = i;
      while (j > 0 && pts[j - 1].ts > key.ts) {
        pts[j] = pts[j - 1];
        --j;
      }
      pts[j] = key;
    }
    clean[static_cast<size_t>(a)] = std::move(pts);
    offset += len;
  }

  for (int r = 0; r < n_required; ++r) {
    const int idx = required_idx[r];
    if (idx < 0 || idx >= n_assets) return 0;
    if (clean[static_cast<size_t>(idx)].empty()) return 0;
  }

  int master = base_asset_idx;
  if (master < 0 || master >= n_assets || clean[static_cast<size_t>(master)].empty()) {
    master = required_idx[0];
    int best_len = static_cast<int>(clean[static_cast<size_t>(master)].size());
    for (int r = 1; r < n_required; ++r) {
      const int idx = required_idx[r];
      const int cur_len = static_cast<int>(clean[static_cast<size_t>(idx)].size());
      if (cur_len > best_len) {
        best_len = cur_len;
        master = idx;
      }
    }
  }

  const std::vector<Point>& timeline = clean[static_cast<size_t>(master)];
  if (timeline.empty()) return 0;

  int n_out = 0;
  for (const Point& master_pt : timeline) {
    if (n_out >= max_out) break;

    std::vector<double> row(static_cast<size_t>(n_assets), 0.0);
    row[static_cast<size_t>(master)] = master_pt.px;
    bool missing_required = false;

    for (int r = 0; r < n_required; ++r) {
      const int req = required_idx[r];
      if (req == master) continue;
      const double matched = find_closest_price(clean[static_cast<size_t>(req)], master_pt.ts, max_gap_ms);
      if (matched == 0.0) {
        missing_required = true;
        break;
      }
      row[static_cast<size_t>(req)] = matched;
    }

    if (missing_required) continue;

    for (int a = 0; a < n_assets; ++a) {
      if (row[static_cast<size_t>(a)] != 0.0) continue;
      if (clean[static_cast<size_t>(a)].empty()) continue;
      const double matched = find_closest_price(clean[static_cast<size_t>(a)], master_pt.ts, max_gap_ms);
      if (matched != 0.0) {
        row[static_cast<size_t>(a)] = matched;
      }
    }

    out_ts[n_out] = master_pt.ts;
    for (int a = 0; a < n_assets; ++a) {
      out_px[n_out * n_assets + a] = row[static_cast<size_t>(a)];
    }
    ++n_out;
  }

  return n_out;
}
