import { useState, useEffect, useRef, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { usePriceStore } from '../store/priceStore';
import { ChartSkeleton } from './LoadingSkeleton';
import { fetchMarketChartSeries } from '../lib/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Month-aligned national fiscal calendars (see Wikipedia "Fiscal year").
 * startMonth is the 0-indexed calendar month the fiscal year begins.
 * The calendar-year group doubles as the plain "yearly pattern" baseline.
 */
const FISCAL_CALENDARS = [
  { id: 'calendar', label: 'Calendar Year', nations: 'China · Germany · Russia · Brazil', startMonth: 0, color: '#f0c845' },
  { id: 'april',    label: 'April Start',   nations: 'UK · India · Japan · Canada',       startMonth: 3, color: '#10b981' },
  { id: 'july',     label: 'July Start',    nations: 'Australia · Egypt · Pakistan',      startMonth: 6, color: '#f472b6' },
  { id: 'october',  label: 'October Start', nations: 'United States · Thailand',          startMonth: 9, color: '#60a5fa' },
] as const;

type FiscalCalendarId = typeof FISCAL_CALENDARS[number]['id'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface FiscalYearReturn {
  label: string;       // e.g. "FY2022/23" or "2023"
  returnPct: number;   // % change from fiscal month 1 to last available month
  monthsCovered: number;
  complete: boolean;   // all 12 fiscal months present
}

interface FiscalCalendarStats {
  id: FiscalCalendarId;
  /** Average cumulative % change since FY start, indexed by fiscal month (0-11). */
  avgTrajectory: (number | null)[];
  /** How many fiscal years contributed to each fiscal month average. */
  yearCount: number;
  fyReturns: FiscalYearReturn[];
}

interface FiscalChartPoint {
  fiscalMonth: number; // 1-12
  [calendarId: string]: number | null;
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

/** Deterministic fallback series (~6 years, monthly seasonality + upward drift). */
function generateMockGoldHistory(currentPrice: number): [number, number][] {
  const days = 365 * 6;
  const now = Date.now();
  const startPrice = currentPrice / 2.2; // rough long-run appreciation
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
function monthlyAverages(series: [number, number][]): Map<string, number> {
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

function fiscalYearLabel(startYear: number, startMonth: number): string {
  if (startMonth === 0) return `${startYear}`;
  return `FY${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/**
 * Re-index the monthly price history onto one fiscal calendar:
 * for every fiscal year in the data, compute the cumulative % change from
 * fiscal month 1, then average each fiscal month across all years.
 */
function computeFiscalStats(
  monthly: Map<string, number>,
  calendar: typeof FISCAL_CALENDARS[number],
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

    // Need at least half a fiscal year before it says anything about the pattern
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function CalendarToggle({
  label,
  color,
  active,
  onToggle,
}: {
  label: string;
  color: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={active}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        padding: '4px 10px',
        borderRadius: 'var(--radius-full)',
        border: `1px solid ${active ? color : 'var(--color-border)'}`,
        background: active ? `${color}18` : 'transparent',
        color: active ? color : 'var(--color-muted)',
        fontSize: 'var(--font-xs)',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: active ? color : 'var(--color-muted)',
        flexShrink: 0,
        transition: 'background 0.18s ease',
      }} />
      {label}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FiscalYearChart() {
  const { goldSpot, prices } = usePriceStore();

  const [history, setHistory] = useState<[number, number][]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEstimated, setIsEstimated] = useState(false);
  const [activeCalendars, setActiveCalendars] = useState<Set<FiscalCalendarId>>(
    new Set(FISCAL_CALENDARS.map((c) => c.id)),
  );
  const abortRef = useRef<AbortController | null>(null);

  // Fetch full PAXG history once as the gold proxy (longest free daily series)
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setIsLoading(true);

    const apiKey = import.meta.env.VITE_COINGECKO_API_KEY as string | undefined;
    fetchMarketChartSeries('pax-gold', 'max', 'daily', controller.signal, apiKey)
      .then((series) => {
        // Need 2+ years of data for a meaningful cross-year average
        if (series.length >= 730) {
          setHistory(series);
          setIsEstimated(false);
        } else {
          setHistory(generateMockGoldHistory(goldSpot?.price ?? prices['pax-gold']?.price ?? 3290));
          setIsEstimated(true);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setHistory(generateMockGoldHistory(goldSpot?.price ?? 3290));
        setIsEstimated(true);
        setIsLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    if (history.length === 0) return [];
    const monthly = monthlyAverages(history);
    return FISCAL_CALENDARS.map((cal) => computeFiscalStats(monthly, cal));
  }, [history]);

  const chartData = useMemo<FiscalChartPoint[]>(() => {
    if (stats.length === 0) return [];
    return Array.from({ length: 12 }, (_, fm) => {
      const pt: FiscalChartPoint = { fiscalMonth: fm + 1 };
      for (const s of stats) pt[s.id] = s.avgTrajectory[fm];
      return pt;
    });
  }, [stats]);

  const toggleCalendar = (id: FiscalCalendarId) => {
    setActiveCalendars((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id); // keep at least one
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const summaryRows = useMemo(() => {
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
  }, [stats]);

  return (
    <section aria-label="Gold Fiscal Year Seasonality">
      {/* Section header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        <h2 className="section-heading" style={{ margin: 0 }}>
          <span className="heading-icon">🗓️</span>
          Fiscal Year Seasonality
        </h2>
        <span className="badge badge-gold">
          {isEstimated ? 'Estimated History' : 'Multi-Year Gold History'}
        </span>
      </div>

      <div className="glass-card" style={{ padding: 'var(--space-lg)' }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '16px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', maxWidth: '520px' }}>
            Gold's average price path re-indexed to each nation's fiscal year.
            Each line shows the mean cumulative % change since that fiscal year's
            start, averaged across all years of history — Calendar Year is the
            plain yearly pattern baseline.
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {FISCAL_CALENDARS.map((cal) => (
              <CalendarToggle
                key={cal.id}
                label={`${cal.label} (${MONTH_NAMES[cal.startMonth]})`}
                color={cal.color}
                active={activeCalendars.has(cal.id)}
                onToggle={() => toggleCalendar(cal.id)}
              />
            ))}
          </div>
        </div>

        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <div
            style={{ height: '320px', width: '100%' }}
            role="img"
            aria-label="Average gold price trajectory across national fiscal years"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="fiscalMonth"
                  stroke="var(--color-muted)"
                  tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
                  tickMargin={8}
                  tickFormatter={(v) => `M${v}`}
                />
                <YAxis
                  stroke="var(--color-muted)"
                  tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
                  tickFormatter={(v) => `${Number(v) >= 0 ? '+' : ''}${v}%`}
                  domain={['auto', 'auto']}
                  width={55}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-text)',
                    fontSize: '0.72rem',
                  }}
                  labelFormatter={(fm) => `Fiscal month ${fm}`}
                  formatter={(value: number | undefined, name: string | undefined) => {
                    const cal = FISCAL_CALENDARS.find((c) => c.id === name);
                    const fmLabel = cal ? `${cal.label}` : (name ?? '');
                    const v = Number(value ?? 0);
                    return [`${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, fmLabel] as [string, string];
                  }}
                />
                <Legend
                  wrapperStyle={{ color: 'var(--color-text)', paddingTop: '16px', fontSize: '0.72rem' }}
                  formatter={(value) => {
                    const cal = FISCAL_CALENDARS.find((c) => c.id === value);
                    return cal ? `${cal.label} — ${cal.nations}` : value;
                  }}
                />
                <ReferenceLine y={0} stroke="var(--color-border-strong)" strokeDasharray="4 4" />
                {FISCAL_CALENDARS.map((cal) =>
                  activeCalendars.has(cal.id) ? (
                    <Line
                      key={cal.id}
                      type="monotone"
                      dataKey={cal.id}
                      stroke={cal.color}
                      strokeWidth={cal.id === 'calendar' ? 2.5 : 2}
                      dot={{ r: 2.5 }}
                      activeDot={{ r: 5, stroke: cal.color, strokeWidth: 2 }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ) : null,
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Per-calendar fiscal year return summary */}
        {!isLoading && (
          <div style={{ overflowX: 'auto', marginTop: '16px' }}>
            <table
              className="table-zebra"
              style={{ width: '100%', borderCollapse: 'collapse' }}
              aria-label="Gold returns by national fiscal year"
            >
              <thead>
                <tr>
                  {['Fiscal Calendar', 'Nations', 'FY Span', 'Avg FY Return', 'Best FY', 'Worst FY', 'Current FY'].map((label, i) => (
                    <th key={label} style={{
                      textAlign: i < 3 ? 'left' : 'right',
                      padding: '10px 12px',
                      fontSize: 'var(--font-xs)',
                      color: 'var(--color-muted)',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      borderBottom: '1px solid var(--color-border)',
                      whiteSpace: 'nowrap',
                    }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row) => {
                  const endMonth = MONTH_NAMES[(row.startMonth + 11) % 12];
                  return (
                    <tr key={row.id}>
                      <td style={{ padding: '10px 12px', fontSize: 'var(--font-sm)', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: row.color,
                          marginRight: '8px',
                        }} />
                        <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{row.label}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 'var(--font-xs)', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                        {row.nations}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 'var(--font-xs)', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                        {MONTH_NAMES[row.startMonth]} – {endMonth}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {row.avg !== null ? (
                          <span className={`badge ${row.avg >= 0 ? 'badge-green' : 'badge-red'}`}>
                            {row.avg >= 0 ? '+' : ''}{row.avg.toFixed(2)}%
                          </span>
                        ) : <span style={{ color: 'var(--color-muted)' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 'var(--font-xs)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {row.best ? (
                          <span>
                            <span style={{ color: 'var(--color-muted)' }}>{row.best.label} </span>
                            <span style={{ color: 'var(--color-green)', fontWeight: 600 }}>
                              {row.best.returnPct >= 0 ? '+' : ''}{row.best.returnPct.toFixed(1)}%
                            </span>
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 'var(--font-xs)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {row.worst ? (
                          <span>
                            <span style={{ color: 'var(--color-muted)' }}>{row.worst.label} </span>
                            <span style={{
                              color: row.worst.returnPct < 0 ? 'var(--color-red)' : 'var(--color-green)',
                              fontWeight: 600,
                            }}>
                              {row.worst.returnPct >= 0 ? '+' : ''}{row.worst.returnPct.toFixed(1)}%
                            </span>
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 'var(--font-xs)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {row.current ? (
                          <span>
                            <span style={{ color: 'var(--color-muted)' }}>
                              {row.current.label} (M{row.current.monthsCovered}){' '}
                            </span>
                            <span style={{
                              color: row.current.returnPct >= 0 ? 'var(--color-green)' : 'var(--color-red)',
                              fontWeight: 600,
                            }}>
                              {row.current.returnPct >= 0 ? '+' : ''}{row.current.returnPct.toFixed(1)}%
                            </span>
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{
          marginTop: '12px',
          fontSize: 'var(--font-xs)',
          color: 'var(--color-muted)',
          textAlign: 'right',
        }}>
          {isEstimated
            ? 'Estimated multi-year history (live fetch unavailable) · '
            : 'PAXG full history used as spot gold proxy · '}
          M1 = first month of each nation's fiscal year · Averages span all available fiscal years
        </div>
      </div>
    </section>
  );
}
