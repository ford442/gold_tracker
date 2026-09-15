#include "gt_math.h"

#include <cmath>

double gt_max_drawdown(const double* prices, int n) {
  if (prices == nullptr || n < 2) return 0.0;

  double peak = prices[0];
  double worst = 0.0;
  for (int i = 0; i < n; ++i) {
    const double p = prices[i];
    if (p > peak) peak = p;
    const double dd = peak > 0.0 ? ((peak - p) / peak) * 100.0 : 0.0;
    if (dd > worst) worst = dd;
  }
  return std::round(worst * 100.0) / 100.0;
}
