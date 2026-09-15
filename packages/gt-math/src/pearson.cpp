#include "gt_math.h"

#include <cmath>

double gt_pearson(const double* x, const double* y, int n) {
  if (x == nullptr || y == nullptr || n < 2) return 0.0;

  double sx = 0.0;
  double sy = 0.0;
  for (int i = 0; i < n; ++i) {
    sx += x[i];
    sy += y[i];
  }
  const double mx = sx / static_cast<double>(n);
  const double my = sy / static_cast<double>(n);

  double num = 0.0;
  double dx2 = 0.0;
  double dy2 = 0.0;
  for (int i = 0; i < n; ++i) {
    const double dx = x[i] - mx;
    const double dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }

  const double denom = std::sqrt(dx2 * dy2);
  if (denom == 0.0) return 0.0;
  const double r = num / denom;
  if (r > 1.0) return 1.0;
  if (r < -1.0) return -1.0;
  return r;
}

int gt_rolling_pearson(const double* a, const double* b, int n, int window, double* out) {
  if (a == nullptr || b == nullptr || out == nullptr || window <= 0 || n < window) {
    return 0;
  }
  int count = 0;
  for (int i = window; i <= n; ++i) {
    out[count++] = gt_pearson(a + (i - window), b + (i - window), window);
  }
  return count;
}
