import { useState, useEffect, useRef, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { usePriceStore } from '@/store/priceStore';
import { ChartSkeleton } from '../LoadingSkeleton';
import { pearsonCorrelation } from '@lib/utils';
import type { ChartRange } from '@/types';
import {
  OVERLAY_INSTRUMENTS,
  RANGES,
  RANGE_PARAMS,
  type InstrumentId,
  type OverlayPoint,
} from './constants';
import { generateMockGoldHistory, normalizeSeries } from './helpers';
import { InstrumentToggle } from './InstrumentToggle';

export function OverlayTab() {
  const { prices, goldSpot } = usePriceStore();

  const [range, setRange] = useState<ChartRange>('1M');
  const [activeInstruments, setActiveInstruments] = useState<Set<InstrumentId>>(
    new Set(['spot-gold', 'pax-gold', 'xaut', 'bitcoin', 'ethereum'] as InstrumentId[]),
  );
  const [overlayData, setOverlayData] = useState<OverlayPoint[]>([]);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchOverlayData = useCallback(async (currentRange: ChartRange) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setOverlayLoading(true);
    setOverlayError(null);
    setOverlayData([]);

    const { days, interval } = RANGE_PARAMS[currentRange];
    const apiKey = import.meta.env.VITE_COINGECKO_API_KEY as string | undefined;
    const headers: HeadersInit = apiKey ? { 'x-cg-demo-api-key': apiKey } : {};

    const cgInstruments = OVERLAY_INSTRUMENTS.filter((i) => i.cgId !== null);
    const results: Record<string, [number, number][]> = {};

    const fetches = cgInstruments.map(async (inst) => {
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/${inst.cgId}/market_chart?vs_currency=usd&days=${days}&interval=${interval}`,
          { signal: controller.signal, headers },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { prices: [number, number][] };
        results[inst.id] = json.prices;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') throw err;
        const fallback = prices[inst.cgId!]?.sparkline ?? [];
        results[inst.id] = fallback.map((p) => [p.time, p.price]);
      }
    });

    try {
      await Promise.all(fetches);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
    }

    const pointCount = days === 'max' ? 365 : parseInt(days) * (interval === 'hourly' ? 24 : 1);
    const spotBase = goldSpot?.price ?? 3290;
    results['spot-gold'] = generateMockGoldHistory(spotBase, Math.min(pointCount, 720));

    const refSeries = results['spot-gold'];
    if (!refSeries || refSeries.length < 2) {
      setOverlayError('Insufficient data to render chart');
      setOverlayLoading(false);
      return;
    }

    const step = Math.max(1, Math.floor(refSeries.length / 120));
    const sampledRef = refSeries.filter((_, i) => i % step === 0 || i === refSeries.length - 1);

    const getFormattedTime = (ts: number): string => {
      const d = new Date(ts);
      if (currentRange === '1D') {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      if (currentRange === '1W') {
        return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const normalizedResults: Record<string, number[]> = {};
    for (const [id, series] of Object.entries(results)) {
      if (!series.length) continue;
      const priceValues = series.map(([, p]) => p);
      normalizedResults[id] = normalizeSeries(priceValues);
    }

    const merged: OverlayPoint[] = sampledRef.map(([ts]) => {
      const pt: OverlayPoint = { time: getFormattedTime(ts) };
      for (const [id, normPrices] of Object.entries(normalizedResults)) {
        const srcSeries = results[id];
        let closestIdx = 0;
        let minDiff = Infinity;
        srcSeries.forEach(([t], i) => {
          const diff = Math.abs(t - ts);
          if (diff < minDiff) { minDiff = diff; closestIdx = i; }
        });
        const approxIdx = Math.round((closestIdx / srcSeries.length) * normPrices.length);
        const normIdx = Math.max(0, Math.min(approxIdx, normPrices.length - 1));
        pt[id] = normPrices[normIdx];
      }
      return pt;
    });

    setOverlayData(merged);
    setOverlayLoading(false);
  }, [goldSpot?.price, prices]);

  useEffect(() => {
    void fetchOverlayData(range);
    return () => abortRef.current?.abort();
  }, [range, fetchOverlayData]);

  const handleRangeChange = useCallback((r: ChartRange) => setRange(r), []);

  const toggleInstrument = useCallback((id: InstrumentId) => {
    setActiveInstruments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <div className="glass-card" style={{ padding: 'var(--space-lg)' }}>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        marginBottom: '16px',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }} role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r}
              className={`range-pill${range === r ? ' active' : ''}`}
              aria-pressed={range === r}
              onClick={() => handleRangeChange(r)}
            >
              {r}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {OVERLAY_INSTRUMENTS.map((inst) => (
            <InstrumentToggle
              key={inst.id}
              label={inst.label}
              color={inst.color}
              active={activeInstruments.has(inst.id as InstrumentId)}
              onToggle={() => toggleInstrument(inst.id as InstrumentId)}
            />
          ))}
        </div>
      </div>

      {overlayLoading ? (
        <ChartSkeleton />
      ) : overlayError ? (
        <div style={{
          padding: 'var(--space-xl)',
          textAlign: 'center',
          color: 'var(--color-muted)',
        }}>
          <div style={{ fontSize: '1.6rem', marginBottom: '8px' }}>⚠️</div>
          <div>{overlayError}</div>
        </div>
      ) : (
        <div
          style={{ height: '340px', width: '100%' }}
          role="img"
          aria-label="Multi-instrument normalized price overlay chart"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={overlayData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="time"
                stroke="var(--color-muted)"
                tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
                tickMargin={8}
                interval="preserveStartEnd"
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
                formatter={(value: number | undefined, name: string | undefined) => {
                  const inst = OVERLAY_INSTRUMENTS.find((i) => i.id === name);
                  const label = inst?.label ?? (name ?? '');
                  const v = Number(value ?? 0);
                  return [`${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, label] as [string, string];
                }}
              />
              <Legend
                wrapperStyle={{ color: 'var(--color-text)', paddingTop: '16px', fontSize: '0.72rem' }}
                formatter={(value) => OVERLAY_INSTRUMENTS.find((i) => i.id === value)?.label ?? value}
              />
              <ReferenceLine y={0} stroke="var(--color-border-strong)" strokeDasharray="4 4" />
              {OVERLAY_INSTRUMENTS.map((inst) =>
                activeInstruments.has(inst.id as InstrumentId) ? (
                  <Line
                    key={inst.id}
                    type="monotone"
                    dataKey={inst.id}
                    stroke={inst.color}
                    strokeWidth={inst.id === 'spot-gold' ? 2.5 : 2}
                    dot={false}
                    activeDot={{ r: 5, stroke: inst.color, strokeWidth: 2 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ) : null,
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {!overlayLoading && !overlayError && (
        <div style={{
          marginTop: '16px',
          paddingTop: '14px',
          borderTop: '1px solid var(--color-border)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
          gap: '8px',
        }}>
          {OVERLAY_INSTRUMENTS.filter((i) => activeInstruments.has(i.id as InstrumentId)).map((inst) => {
            const lastPt = overlayData[overlayData.length - 1];
            const val = lastPt ? (lastPt[inst.id] as number | undefined) : undefined;
            const pct = val ?? 0;
            return (
              <div key={inst.id} style={{
                background: 'var(--color-surface2)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 8px',
                textAlign: 'center',
                borderLeft: `3px solid ${inst.color}`,
              }}>
                <div style={{
                  fontSize: 'var(--font-lg)',
                  fontWeight: 700,
                  color: pct >= 0 ? 'var(--color-green)' : 'var(--color-red)',
                }}>
                  {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                </div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', marginTop: '2px' }}>
                  {inst.label}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{
        marginTop: '10px',
        fontSize: 'var(--font-xs)',
        color: 'var(--color-muted)',
        textAlign: 'right',
      }}>
        Normalized % return from period start · Spot gold uses estimated historical data
      </div>

      {!overlayLoading && !overlayError && overlayData.length > 3 && (
        <div style={{
          marginTop: '12px',
          paddingTop: '10px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
          fontSize: 'var(--font-xxs)',
        }}>
          <span style={{ color: 'var(--color-muted)', marginRight: '4px' }}>Fidelity (this window, from overlay):</span>
          {(() => {
            const paxgSeries = overlayData.map((d) => (d['pax-gold'] as number) ?? 0).filter((v) => typeof v === 'number');
            const xautSeries = overlayData.map((d) => (d['tether-gold'] as number) ?? 0).filter((v) => typeof v === 'number');
            const spotSeries = overlayData.map((d) => (d['spot-gold'] as number) ?? 0).filter((v) => typeof v === 'number');
            const btcSeries = overlayData.map((d) => (d['bitcoin'] as number) ?? 0).filter((v) => typeof v === 'number');
            const paxgGold = paxgSeries.length > 1 && spotSeries.length > 1 ? pearsonCorrelation(paxgSeries, spotSeries) : 0;
            const paxgBtc = paxgSeries.length > 1 && btcSeries.length > 1 ? pearsonCorrelation(paxgSeries, btcSeries) : 0;
            const xautGold = xautSeries.length > 1 && spotSeries.length > 1 ? pearsonCorrelation(xautSeries, spotSeries) : 0;
            const xautBtc = xautSeries.length > 1 && btcSeries.length > 1 ? pearsonCorrelation(xautSeries, btcSeries) : 0;
            const fidP = Math.max(0, Math.min(100, Math.round(50 + 50 * (paxgGold - paxgBtc))));
            const fidX = Math.max(0, Math.min(100, Math.round(50 + 50 * (xautGold - xautBtc))));
            return (
              <>
                <span className="badge badge-gold" title="Derived from normalized overlay series for this range. Full interactive matrix + rolling in Fidelity & Regimes tab.">
                  PAXG fid {fidP}
                </span>
                <span className="badge badge-gold" title="Derived from normalized overlay series for this range. Full interactive matrix + rolling in Fidelity & Regimes tab.">
                  XAUT fid {fidX}
                </span>
                <span style={{ color: 'var(--color-muted)', marginLeft: '4px' }}>· See Fidelity &amp; Regimes tab for scores, long matrix, and live deltas</span>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
