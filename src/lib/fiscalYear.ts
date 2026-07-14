/** Month names for fiscal calendar labels. */
export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * Month-aligned national fiscal calendars (see Wikipedia "Fiscal year").
 * startMonth is the 0-indexed calendar month the fiscal year begins.
 */
export const FISCAL_CALENDARS = [
  { id: 'calendar', label: 'Calendar Year', nations: 'China · Germany · Russia · Brazil', startMonth: 0, color: '#f0c845' },
  { id: 'april', label: 'April Start', nations: 'UK · India · Japan · Canada', startMonth: 3, color: '#10b981' },
  { id: 'july', label: 'July Start', nations: 'Australia · Egypt · Pakistan', startMonth: 6, color: '#f472b6' },
  { id: 'october', label: 'October Start', nations: 'United States · Thailand', startMonth: 9, color: '#60a5fa' },
] as const;

export type FiscalCalendarDef = (typeof FISCAL_CALENDARS)[number];
export type FiscalCalendarId = FiscalCalendarDef['id'];

export interface FiscalYearReturn {
  label: string;
  returnPct: number;
  monthsCovered: number;
  complete: boolean;
}

export interface FiscalCalendarStats {
  id: FiscalCalendarId;
  avgTrajectory: (number | null)[];
  yearCount: number;
  fyReturns: FiscalYearReturn[];
}

export interface FiscalChartPoint {
  fiscalMonth: number;
  [calendarId: string]: number | null;
}

export type FiscalSummaryRow = FiscalCalendarDef & {
  completed: FiscalYearReturn[];
  current: FiscalYearReturn | undefined;
  avg: number | null;
  best: FiscalYearReturn | null;
  worst: FiscalYearReturn | null;
};

/** Deterministic fallback series (~6 years, monthly seasonality + upward drift). */
export function generateMockGoldHistory(currentPrice: number): [number, number][] {
  const days = 365 * 6;
  const now = Date.now();
  const startPrice = currentPrice / 2.2;
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return Array.from({ length: days }, (_, i) => {
    const ts = now - (days - i) * 86400000;
    const progress = i / days;
    const trend = startPrice * Math.pow(currentPrice / startPrice, progress);
    const dayOfYear = new Date(ts).getUTCMonth() * 30 + new Date(ts).getUTCDate();
    const seasonal = 1 + 0.025 * Math.sin(((dayOfYear - 45) / 365) * 2 * Math.PI);
    const noise = 1 + (rand() - 0.5) * 0.02;
    return [ts, Math.round(trend * seasonal * noise * 100) / 100];
  });
}

/** Collapse a daily [ts, price][] series into average price per calendar month. */
export function monthlyAverages(series: [number, number][]): Map<string, number> {
  const buckets = new Map<string, { sum: number; n: number }>();
  for (const [ts, price] of series) {
    const d = new Date(ts);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const b = buckets.get(key) ?? { sum: 0, n: 0 };
    b.sum += price;
    b.n += 1;
    buckets.set(key, b);
  }
  const out = new Map<string, number>();
  for (const [key, { sum, n }] of buckets) out.set(key, sum / n);
  return out;
}

export function fiscalYearLabel(startYear: number, startMonth: number): string {
  if (startMonth === 0) return `${startYear}`;
  return `FY${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export function computeFiscalStats(
  monthly: Map<string, number>,
  calendar: FiscalCalendarDef,
): FiscalCalendarStats {
  const years = [...monthly.keys()].map((k) => parseInt(k.split('-')[0], 10));
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  const perMonthPcts: number[][] = Array.from({ length: 12 }, () => []);
  const fyReturns: FiscalYearReturn[] = [];

  for (let startYear = minYear - 1; startYear <= maxYear; startYear++) {
    const startPrice = monthly.get(`${startYear}-${calendar.startMonth}`);
    if (!startPrice) continue;

    let lastPct = 0;
    let monthsCovered = 0;
    for (let fm = 0; fm < 12; fm++) {
      const calMonth = (calendar.startMonth + fm) % 12;
      const calYear = startYear + (calendar.startMonth + fm >= 12 ? 1 : 0);
      const price = monthly.get(`${calYear}-${calMonth}`);
      if (price === undefined) continue;
      const pct = ((price - startPrice) / startPrice) * 100;
      perMonthPcts[fm].push(pct);
      lastPct = pct;
      monthsCovered = fm + 1;
    }

    if (monthsCovered >= 6) {
      fyReturns.push({
        label: fiscalYearLabel(startYear, calendar.startMonth),
        returnPct: lastPct,
        monthsCovered,
        complete: monthsCovered === 12,
      });
    }
  }

  const avgTrajectory = perMonthPcts.map((pcts) =>
    pcts.length > 0
      ? Math.round((pcts.reduce((s, p) => s + p, 0) / pcts.length) * 100) / 100
      : null,
  );

  return {
    id: calendar.id,
    avgTrajectory,
    yearCount: fyReturns.length,
    fyReturns,
  };
}

export function computeAllFiscalStats(history: [number, number][]): FiscalCalendarStats[] {
  if (history.length === 0) return [];
  const monthly = monthlyAverages(history);
  return FISCAL_CALENDARS.map((cal) => computeFiscalStats(monthly, cal));
}

export function buildFiscalChartData(stats: FiscalCalendarStats[]): FiscalChartPoint[] {
  if (stats.length === 0) return [];
  return Array.from({ length: 12 }, (_, fm) => {
    const pt: FiscalChartPoint = { fiscalMonth: fm + 1 };
    for (const s of stats) pt[s.id] = s.avgTrajectory[fm];
    return pt;
  });
}

export function buildFiscalSummaryRows(stats: FiscalCalendarStats[]): FiscalSummaryRow[] {
  return FISCAL_CALENDARS.map((cal) => {
    const s = stats.find((x) => x.id === cal.id);
    const completed = s?.fyReturns.filter((r) => r.complete) ?? [];
    const current = s?.fyReturns.find((r) => !r.complete);
    const avg = completed.length > 0
      ? completed.reduce((sum, r) => sum + r.returnPct, 0) / completed.length
      : null;
    const best = completed.length > 0
      ? completed.reduce((a, b) => (a.returnPct > b.returnPct ? a : b))
      : null;
    const worst = completed.length > 0
      ? completed.reduce((a, b) => (a.returnPct < b.returnPct ? a : b))
      : null;
    return { ...cal, completed, current, avg, best, worst };
  });
}
