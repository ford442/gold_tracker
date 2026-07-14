import { useState, useEffect, useRef, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { usePriceStore } from '@/store/priceStore';
import { ChartSkeleton } from './LoadingSkeleton';
import { fetchMarketChartSeries } from '@lib/api';
import {
  FISCAL_CALENDARS,
  MONTH_NAMES,
  buildFiscalChartData,
  buildFiscalSummaryRows,
  computeAllFiscalStats,
  generateMockGoldHistory,
  type FiscalCalendarId,
} from '@lib/fiscalYear';

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

export function FiscalYearChart() {
  const { goldSpot, prices } = usePriceStore();

  const [history, setHistory] = useState<[number, number][]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEstimated, setIsEstimated] = useState(false);
  const [activeCalendars, setActiveCalendars] = useState<Set<FiscalCalendarId>>(
    new Set(FISCAL_CALENDARS.map((c) => c.id)),
  );
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setIsLoading(true);

    const apiKey = import.meta.env.VITE_COINGECKO_API_KEY as string | undefined;
    fetchMarketChartSeries('pax-gold', 'max', 'daily', controller.signal, apiKey)
      .then((series) => {
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

  const stats = useMemo(() => computeAllFiscalStats(history), [history]);
  const chartData = useMemo(() => buildFiscalChartData(stats), [stats]);
  const summaryRows = useMemo(() => buildFiscalSummaryRows(stats), [stats]);

  const toggleCalendar = (id: FiscalCalendarId) => {
    setActiveCalendars((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <section aria-label="Gold Fiscal Year Seasonality">
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
