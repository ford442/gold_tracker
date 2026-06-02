import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { usePriceStore } from '../store/priceStore';
import { usePortfolioStore } from '../store/portfolioStore';
import { ChartSkeleton } from './LoadingSkeleton';
import { RegimeLens } from './RegimeLens';
import { pearsonCorrelation } from '../lib/utils';
import type { ChartRange } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

type ComparisonTab = 'overlay' | 'premiums' | 'currencies' | 'portfolio' | 'regimes';

const TABS: { id: ComparisonTab; label: string; icon: string }[] = [
  { id: 'overlay',    label: 'Price Overlay',  icon: '📊' },
  { id: 'premiums',   label: 'Premiums',       icon: '🏅' },
  { id: 'currencies', label: 'Currencies',     icon: '🌍' },
  { id: 'portfolio',  label: 'Portfolio',      icon: '💼' },
  { id: 'regimes',    label: 'Fidelity & Regimes', icon: '🔬' },
];

// Instruments shown on the overlay chart
const OVERLAY_INSTRUMENTS = [
  { id: 'spot-gold',    label: 'Spot Gold',  color: '#f0c845', cgId: null           },
  { id: 'pax-gold',     label: 'PAXG',       color: '#10b981', cgId: 'pax-gold'     },
  { id: 'tether-gold',  label: 'XAUT',       color: '#14b8a6', cgId: 'tether-gold'  },
  { id: 'bitcoin',      label: 'BTC',        color: '#f59e0b', cgId: 'bitcoin'      },
  { id: 'ethereum',     label: 'ETH',        color: '#8b5cf6', cgId: 'ethereum'     },
] as const;

type InstrumentId = typeof OVERLAY_INSTRUMENTS[number]['id'];

const RANGES: ChartRange[] = ['1D', '1W', '1M', '1Y', 'MAX'];

const RANGE_PARAMS: Record<string, { days: string; interval: string }> = {
  '1D':  { days: '1',   interval: 'hourly' },
  '1W':  { days: '7',   interval: 'hourly' },
  '1M':  { days: '30',  interval: 'daily'  },
  '1Y':  { days: '365', interval: 'daily'  },
  'MAX': { days: 'max', interval: 'daily'  },
};

// Gold form premiums over spot (approximate real-world dealer premiums)
const GOLD_FORMS = [
  {
    id: 'spot',       name: 'Spot Gold (XAU)',          unit: '1 troy oz',
    premiumPct: 0,    premiumNote: 'Reference price',
    icon: '📍',
  },
  {
    id: 'kilo-bar',   name: '1 kg Gold Bar',            unit: '32.15 oz',
    premiumPct: 0.4,  premiumNote: 'LBMA-certified',
    icon: '🔶',
  },
  {
    id: '100g-bar',   name: '100g Gold Bar',            unit: '3.215 oz',
    premiumPct: 1.2,  premiumNote: 'Branded refinery',
    icon: '🟡',
  },
  {
    id: '1oz-bar',    name: '1 oz Gold Bar',            unit: '1 oz',
    premiumPct: 2.5,  premiumNote: 'PAMP / Valcambi',
    icon: '🟧',
  },
  {
    id: 'eagle',      name: 'American Gold Eagle (1oz)', unit: '1 oz',
    premiumPct: 4.5,  premiumNote: 'US Mint coin',
    icon: '🦅',
  },
  {
    id: 'maple',      name: 'Canadian Maple Leaf (1oz)', unit: '1 oz',
    premiumPct: 4.0,  premiumNote: 'Royal Canadian Mint',
    icon: '🍁',
  },
  {
    id: 'krugerrand', name: 'Krugerrand (1oz)',          unit: '1 oz',
    premiumPct: 3.8,  premiumNote: 'South African',
    icon: '🪙',
  },
  {
    id: 'paxg',       name: 'PAXG (Crypto-gold)',        unit: '1 oz equiv.',
    premiumPct: null, premiumNote: 'Market-driven spread',
    icon: '🔐',
  },
  {
    id: 'xaut',       name: 'XAUT (Crypto-gold)',        unit: '1 oz equiv.',
    premiumPct: null, premiumNote: 'Market-driven spread',
    icon: '🔑',
  },
] as const;

// Major world currencies with approximate FX rates vs USD (fallback static)
const CURRENCIES = [
  { code: 'USD', name: 'US Dollar',        symbol: '$',  rateToUsd: 1.0    },
  { code: 'EUR', name: 'Euro',             symbol: '€',  rateToUsd: 1.08   },
  { code: 'GBP', name: 'British Pound',    symbol: '£',  rateToUsd: 1.27   },
  { code: 'JPY', name: 'Japanese Yen',     symbol: '¥',  rateToUsd: 0.0067 },
  { code: 'CNY', name: 'Chinese Yuan',     symbol: '¥',  rateToUsd: 0.138  },
  { code: 'CHF', name: 'Swiss Franc',      symbol: 'Fr', rateToUsd: 1.12   },
  { code: 'AUD', name: 'Australian Dollar',symbol: 'A$', rateToUsd: 0.65   },
  { code: 'CAD', name: 'Canadian Dollar',  symbol: 'C$', rateToUsd: 0.74   },
  { code: 'INR', name: 'Indian Rupee',     symbol: '₹',  rateToUsd: 0.012  },
  { code: 'RUB', name: 'Russian Ruble',    symbol: '₽',  rateToUsd: 0.011  },
] as const;




// ─── Types ────────────────────────────────────────────────────────────────────

interface OverlayPoint {
  time: string;
  [key: string]: number | string | undefined;
}

const PORTFOLIO_COLUMNS: { label: string; align: 'left' | 'right' }[] = [
  { label: 'Asset',       align: 'left'  },
  { label: 'Amount',      align: 'right' },
  { label: 'Buy Price',   align: 'right' },
  { label: 'Current',     align: 'right' },
  { label: 'Value',       align: 'right' },
  { label: 'P&L',         align: 'right' },
  { label: 'Gold Equiv.', align: 'right' },
];

// ─── Utility helpers ──────────────────────────────────────────────────────────

function generateMockGoldHistory(basePrice: number, points: number): [number, number][] {
  const now = Date.now();
  const msPerPoint = (points <= 24 ? 3600000 : 86400000);
  let price = basePrice;
  return Array.from({ length: points }, (_, i) => {
    price = price * (1 + (Math.random() - 0.485) * 0.008);
    // 0.485 gives a slight upward drift; 0.008 is ±0.8% per-step volatility
    return [now - (points - i) * msPerPoint, Math.round(price * 100) / 100];
  });
}

function normalizeSeries(prices: number[]): number[] {
  const base = prices[0];
  if (!base) return prices;
  return prices.map((p) => Math.round(((p - base) / base) * 10000) / 100);
}

function formatCurrencyAmount(usdAmount: number, rate: number, symbol: string): string {
  const val = usdAmount / rate;
  if (val >= 1000) return `${symbol}${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** A styled toggle pill for showing/hiding overlay instruments */
function InstrumentToggle({
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

export function GoldComparisonTools() {
  const { prices, goldSpot } = usePriceStore();
  const { entries: portfolioEntries } = usePortfolioStore();

  const [activeTab, setActiveTab] = useState<ComparisonTab>('overlay');
  const [range, setRange] = useState<ChartRange>('1M');
  const [activeInstruments, setActiveInstruments] = useState<Set<InstrumentId>>(
    new Set(['spot-gold', 'pax-gold', 'xaut', 'bitcoin', 'ethereum'] as InstrumentId[]),
  );
  const [overlayData, setOverlayData] = useState<OverlayPoint[]>([]);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Overlay tab: fetch & merge historical data ──────────────────────────────

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

    // Fetch CoinGecko instruments (all except spot-gold)
    const cgInstruments = OVERLAY_INSTRUMENTS.filter((i) => i.cgId !== null);

    const results: Record<string, [number, number][]> = {};

    // Build all fetch promises
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
        // Use sparkline fallback
        const fallback = prices[inst.cgId!]?.sparkline ?? [];
        results[inst.id] = fallback.map((p) => [p.time, p.price]);
      }
    });

    try {
      await Promise.all(fetches);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
    }

    // Generate spot gold mock series aligned to the same timeline
    const pointCount = days === 'max' ? 365 : parseInt(days) * (interval === 'hourly' ? 24 : 1);
    const spotBase = goldSpot?.price ?? 3290;
    results['spot-gold'] = generateMockGoldHistory(spotBase, Math.min(pointCount, 720));

    // Align all series to the same time points (use spot-gold as reference)
    const refSeries = results['spot-gold'];
    if (!refSeries || refSeries.length < 2) {
      setOverlayError('Insufficient data to render chart');
      setOverlayLoading(false);
      return;
    }

    // For each reference timestamp, find closest prices in other series
    // Down-sample to max 120 points for performance
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

    // Normalize each series relative to its own first price
    const normalizedResults: Record<string, number[]> = {};
    for (const [id, series] of Object.entries(results)) {
      if (!series.length) continue;
      const prices = series.map(([, p]) => p);
      normalizedResults[id] = normalizeSeries(prices);
    }

    const merged: OverlayPoint[] = sampledRef.map(([ts]) => {
      const pt: OverlayPoint = { time: getFormattedTime(ts) };
      // Map each instrument's normalized value
      for (const [id, normPrices] of Object.entries(normalizedResults)) {
        const srcSeries = results[id];
        // Find closest point in source series by timestamp
        let closestIdx = 0;
        let minDiff = Infinity;
        srcSeries.forEach(([t], i) => {
          const diff = Math.abs(t - ts);
          if (diff < minDiff) { minDiff = diff; closestIdx = i; }
        });
        // Use sampling ratio to find approximate index
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
    if (activeTab === 'overlay') {
      void fetchOverlayData(range);
    }
    return () => abortRef.current?.abort();
  }, [activeTab, range, fetchOverlayData]);

  const handleRangeChange = useCallback((r: ChartRange) => setRange(r), []);

  const toggleInstrument = useCallback((id: InstrumentId) => {
    setActiveInstruments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id); // keep at least one
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // ── Premiums tab: calculate real-time premiums ──────────────────────────────

  const spotPrice = goldSpot?.price ?? prices['pax-gold']?.price ?? 3290;
  const paxgPrice = prices['pax-gold']?.price;
  const xautPrice = prices['tether-gold']?.price;

  const premiumsData = useMemo(() => {
    return GOLD_FORMS.map((form) => {
      let price: number;
      let premium: number;
      let premiumPct: number;

      if (form.id === 'paxg') {
        price = paxgPrice ?? spotPrice;
        premiumPct = paxgPrice ? ((paxgPrice - spotPrice) / spotPrice) * 100 : 0;
        premium = price - spotPrice;
      } else if (form.id === 'xaut') {
        price = xautPrice ?? spotPrice;
        premiumPct = xautPrice ? ((xautPrice - spotPrice) / spotPrice) * 100 : 0;
        premium = price - spotPrice;
      } else if (form.id === 'spot') {
        price = spotPrice;
        premiumPct = 0;
        premium = 0;
      } else {
        premiumPct = form.premiumPct as number;
        price = spotPrice * (1 + premiumPct / 100);
        premium = price - spotPrice;
      }

      return { ...form, calcPrice: price, premium, premiumPct };
    });
  }, [spotPrice, paxgPrice, xautPrice]);

  // ── Currencies tab ──────────────────────────────────────────────────────────

  const currencyData = useMemo(() => {
    return CURRENCIES.map((c) => ({
      ...c,
      goldPriceInCurrency: spotPrice / c.rateToUsd,
      change24h: goldSpot?.change24h ?? 0,
      ouncesPerUnit: c.rateToUsd / spotPrice, // how much gold 1 unit buys
    }));
  }, [spotPrice, goldSpot?.change24h]);

  // ── Portfolio tab ──────────────────────────────────────────────────────────

  const portfolioData = useMemo(() => {
    return portfolioEntries.map((entry) => {
      const currentPrice = prices[entry.id]?.price
        ?? prices[entry.symbol.toLowerCase()]?.price
        ?? (entry.symbol === 'XAU' ? spotPrice : entry.buyPrice);
      const currentValue = entry.amount * currentPrice;
      const costBasis = entry.amount * entry.buyPrice;
      const pnl = currentValue - costBasis;
      const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

      // Gold equivalence: how many oz of gold is this position worth
      const goldEquivOz = spotPrice > 0 ? currentValue / spotPrice : 0;

      // Is this a gold-backed token?
      const isGoldBacked = ['PAXG', 'XAUT', 'XAU'].includes(entry.symbol);
      const goldExposurePct = isGoldBacked ? 100 : 0;

      return {
        ...entry,
        currentPrice,
        currentValue,
        costBasis,
        pnl,
        pnlPct,
        goldEquivOz,
        goldExposurePct,
        isGoldBacked,
      };
    });
  }, [portfolioEntries, prices, spotPrice]);

  const totalValue = portfolioData.reduce((sum, e) => sum + e.currentValue, 0);
  const totalGoldEquiv = portfolioData.reduce((sum, e) => sum + e.goldEquivOz, 0);
  const totalGoldBacked = portfolioData
    .filter((e) => e.isGoldBacked ?? false)
    .reduce((sum, e) => sum + e.currentValue, 0);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <section aria-label="Advanced Gold Comparison Tools">
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
          <span className="heading-icon">⚖️</span>
          Advanced Gold Comparison Tools
        </h2>
        <span className="badge badge-gold">Multi-Instrument · Multi-Currency</span>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '16px',
        background: 'var(--color-surface2)',
        borderRadius: 'var(--radius-lg)',
        padding: '4px',
        flexWrap: 'wrap',
      }} role="tablist" aria-label="Comparison tool tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: '1 1 auto',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: activeTab === tab.id
                ? 'linear-gradient(135deg, rgba(240,200,69,0.18), rgba(240,200,69,0.06))'
                : 'transparent',
              borderBottom: activeTab === tab.id
                ? '2px solid var(--color-gold)'
                : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--color-gold)' : 'var(--color-muted)',
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERLAY TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'overlay' && (
        <div className="glass-card" style={{ padding: 'var(--space-lg)' }}>
          {/* Controls row */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: '16px',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            {/* Time range */}
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

            {/* Instrument toggles */}
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

          {/* Chart area */}
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

          {/* Current value strip */}
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

          {/* Lightweight fidelity callout derived from the *same* overlay data (no extra fetches) */}
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
      )}

      {/* ── PREMIUMS TAB ────────────────────────────────────────────────── */}
      {activeTab === 'premiums' && (
        <div className="glass-card" style={{ padding: 'var(--space-lg)' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              fontSize: 'var(--font-base)',
              color: 'var(--color-text)',
              fontWeight: 600,
              marginBottom: '4px',
            }}>
              Gold Form Premium Analysis
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>
              Premiums over spot gold (${spotPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}/oz)
              for small vs large transactions
            </div>
          </div>

          {/* Premium table */}
          <div style={{ overflowX: 'auto' }}>
            <table
              className="table-zebra"
              style={{ width: '100%', borderCollapse: 'collapse' }}
              aria-label="Gold form premium comparison table"
            >
              <thead>
                <tr>
                  <th style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    fontSize: 'var(--font-xs)',
                    color: 'var(--color-muted)',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    borderBottom: '1px solid var(--color-border)',
                    whiteSpace: 'nowrap',
                  }}>Gold Form</th>
                  <th style={{
                    textAlign: 'right',
                    padding: '10px 12px',
                    fontSize: 'var(--font-xs)',
                    color: 'var(--color-muted)',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    borderBottom: '1px solid var(--color-border)',
                    whiteSpace: 'nowrap',
                  }}>Unit</th>
                  <th style={{
                    textAlign: 'right',
                    padding: '10px 12px',
                    fontSize: 'var(--font-xs)',
                    color: 'var(--color-muted)',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    borderBottom: '1px solid var(--color-border)',
                    whiteSpace: 'nowrap',
                  }}>Price / oz</th>
                  <th style={{
                    textAlign: 'right',
                    padding: '10px 12px',
                    fontSize: 'var(--font-xs)',
                    color: 'var(--color-muted)',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    borderBottom: '1px solid var(--color-border)',
                    whiteSpace: 'nowrap',
                  }}>Premium $</th>
                  <th style={{
                    textAlign: 'right',
                    padding: '10px 12px',
                    fontSize: 'var(--font-xs)',
                    color: 'var(--color-muted)',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    borderBottom: '1px solid var(--color-border)',
                    whiteSpace: 'nowrap',
                  }}>Premium %</th>
                  <th style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    fontSize: 'var(--font-xs)',
                    color: 'var(--color-muted)',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    borderBottom: '1px solid var(--color-border)',
                    whiteSpace: 'nowrap',
                  }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {premiumsData.map((form) => {
                  const isNegative = form.premiumPct < 0;
                  const isCrypto = form.id === 'paxg' || form.id === 'xaut';
                  const isZero = form.id === 'spot';
                  return (
                    <tr key={form.id}>
                      <td style={{ padding: '10px 12px', fontSize: 'var(--font-sm)', color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                        <span style={{ marginRight: '8px' }}>{form.icon}</span>
                        {form.name}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 'var(--font-xs)', color: 'var(--color-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {form.unit}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--color-text)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        ${form.calcPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{
                        padding: '10px 12px',
                        fontSize: 'var(--font-sm)',
                        fontWeight: 600,
                        color: isZero ? 'var(--color-muted)' : (isNegative ? 'var(--color-red)' : 'var(--color-green)'),
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}>
                        {isZero ? '—' : `${form.premium >= 0 ? '+' : ''}$${form.premium.toFixed(2)}`}
                      </td>
                      <td style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}>
                        {isZero ? (
                          <span className="badge badge-gold">Reference</span>
                        ) : isCrypto ? (
                          <span className={`badge ${form.premiumPct >= 0 ? 'badge-green' : 'badge-red'}`}>
                            {form.premiumPct >= 0 ? '+' : ''}{form.premiumPct.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="badge badge-accent">
                            +{form.premiumPct.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 'var(--font-xs)', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                        {form.premiumNote}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary callout */}
          {(() => {
            const eaglePrice = premiumsData.find(f => f.id === 'eagle')?.calcPrice ?? 0;
            const kiloBarPrice = premiumsData.find(f => f.id === 'kilo-bar')?.calcPrice ?? 0;
            const savingsPerOz = (eaglePrice - kiloBarPrice).toFixed(2);
            return (
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-gold-dim)',
                border: '1px solid rgba(240,200,69,0.2)',
                fontSize: 'var(--font-xs)',
                color: 'var(--color-muted)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
              }}>
                <div>
                  <span style={{ color: 'var(--color-gold)', fontWeight: 700 }}>💡 Buying large (kilo bars)</span>
                  {' '}saves{' '}
                  <strong style={{ color: 'var(--color-text)' }}>~${savingsPerOz}</strong>
                  {' '}per oz vs coins
                </div>
                <div>
                  <span style={{ color: 'var(--color-cyan)', fontWeight: 700 }}>🔐 Crypto-gold spread</span>
                  {' '}PAXG vs XAUT:{' '}
                  <strong style={{ color: 'var(--color-text)' }}>
                    {paxgPrice && xautPrice
                      ? `$${Math.abs(paxgPrice - xautPrice).toFixed(2)} (${(((paxgPrice - xautPrice) / xautPrice) * 100).toFixed(3)}%)`
                      : 'N/A'}
                  </strong>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── CURRENCIES TAB ──────────────────────────────────────────────── */}
      {activeTab === 'currencies' && (
        <div className="glass-card" style={{ padding: 'var(--space-lg)' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              fontSize: 'var(--font-base)',
              color: 'var(--color-text)',
              fontWeight: 600,
              marginBottom: '4px',
            }}>
              Gold Value in World Currencies
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>
              Price of 1 troy oz of gold in major world currencies · FX rates are approximate
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table
              className="table-zebra"
              style={{ width: '100%', borderCollapse: 'collapse' }}
              aria-label="Gold price in world currencies table"
            >
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 'var(--font-xs)', color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                    Currency
                  </th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 'var(--font-xs)', color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                    Price / oz
                  </th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 'var(--font-xs)', color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                    24h Change
                  </th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 'var(--font-xs)', color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                    FX Rate (vs USD)
                  </th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 'var(--font-xs)', color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                    Grams per 100 units
                  </th>
                </tr>
              </thead>
              <tbody>
                {currencyData.map((c) => {
                  const goldPriceStr = formatCurrencyAmount(spotPrice, c.rateToUsd, c.symbol);
                  const change = c.change24h;
                  const gramsPerUnit = (c.rateToUsd / spotPrice) * 31.1035;
                  const gramsPerHundred = gramsPerUnit * 100;
                  return (
                    <tr key={c.code}>
                      <td style={{ padding: '10px 12px', fontSize: 'var(--font-sm)', color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-gold)' }}>{c.code}</span>
                        <span style={{ marginLeft: '8px', color: 'var(--color-muted)', fontSize: 'var(--font-xs)' }}>{c.name}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--color-text)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {goldPriceStr}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span className={change >= 0 ? 'change-chip-green' : 'change-chip-red'}>
                          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 'var(--font-xs)', color: 'var(--color-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {c.code === 'USD' ? '1.0000' : c.rateToUsd.toFixed(4)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 'var(--font-sm)', color: 'var(--color-text)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {gramsPerHundred >= 0.001
                          ? `${gramsPerHundred.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}g`
                          : `${(gramsPerHundred * 1000).toFixed(3)} mg`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Value difference summary */}
          <div style={{
            marginTop: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '10px',
          }}>
            {['USD', 'EUR', 'GBP', 'JPY'].map((code) => {
              const c = currencyData.find((x) => x.code === code);
              if (!c) return null;
              return (
                <div key={code} style={{
                  background: 'var(--color-surface2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', marginBottom: '4px' }}>
                    Gold / oz in {code}
                  </div>
                  <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--color-gold)' }}>
                    {formatCurrencyAmount(spotPrice, c.rateToUsd, c.symbol)}
                  </div>
                  <div style={{
                    fontSize: 'var(--font-xs)',
                    color: c.change24h >= 0 ? 'var(--color-green)' : 'var(--color-red)',
                    marginTop: '4px',
                  }}>
                    {c.change24h >= 0 ? '▲ +' : '▼ '}{Math.abs(c.change24h).toFixed(2)}%
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{
            marginTop: '12px',
            fontSize: 'var(--font-xxs)',
            color: 'var(--color-muted)',
            opacity: 0.7,
          }}>
            ⚠️ FX rates are static approximations. Real-time FX requires a dedicated currency API.
          </div>
        </div>
      )}

      {/* ── REGIMES / FIDELITY TAB ─────────────────────────────────────── */}
      {activeTab === 'regimes' && (
        <RegimeLens />
      )}

      {/* ── PORTFOLIO TAB ───────────────────────────────────────────────── */}
      {activeTab === 'portfolio' && (
        <div className="glass-card" style={{ padding: 'var(--space-lg)' }}>
          {portfolioEntries.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: 'var(--space-xl)',
              color: 'var(--color-muted)',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💼</div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>No portfolio entries yet</div>
              <div style={{ fontSize: 'var(--font-xs)' }}>
                Add positions in the Portfolio Tracker section below to see comparison data here.
              </div>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '10px',
                marginBottom: '20px',
              }}>
                <div style={{ background: 'var(--color-surface2)', borderRadius: 'var(--radius-md)', padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', marginBottom: '4px' }}>Total Value</div>
                  <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--color-gold)' }}>
                    ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ background: 'var(--color-surface2)', borderRadius: 'var(--radius-md)', padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', marginBottom: '4px' }}>Gold Exposure</div>
                  <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--color-text)' }}>
                    ${totalGoldBacked.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>
                    {totalValue > 0 ? ((totalGoldBacked / totalValue) * 100).toFixed(1) : 0}% of portfolio
                  </div>
                </div>
                <div style={{ background: 'var(--color-surface2)', borderRadius: 'var(--radius-md)', padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', marginBottom: '4px' }}>Gold Equiv. (oz)</div>
                  <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--color-cyan)' }}>
                    {totalGoldEquiv.toFixed(4)} oz
                  </div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>
                    ≈ {(totalGoldEquiv * 31.1035).toFixed(2)}g
                  </div>
                </div>
                <div style={{ background: 'var(--color-surface2)', borderRadius: 'var(--radius-md)', padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', marginBottom: '4px' }}>Spot Gold Price</div>
                  <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--color-gold)' }}>
                    ${spotPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 'var(--font-xs)', color: goldSpot?.change24h && goldSpot.change24h >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                    {goldSpot?.change24h !== undefined
                      ? `${goldSpot.change24h >= 0 ? '▲ +' : '▼ '}${Math.abs(goldSpot.change24h).toFixed(2)}%`
                      : '—'}
                  </div>
                </div>
              </div>

              {/* Holdings detail table */}
              <div style={{ overflowX: 'auto' }}>
                <table
                  className="table-zebra"
                  style={{ width: '100%', borderCollapse: 'collapse' }}
                  aria-label="Portfolio holdings vs spot gold comparison"
                >
                  <thead>
                    <tr>
                      {PORTFOLIO_COLUMNS.map((col) => (
                        <th key={col.label} style={{
                          padding: '10px 12px',
                          fontSize: 'var(--font-xs)',
                          color: 'var(--color-muted)',
                          fontWeight: 600,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          borderBottom: '1px solid var(--color-border)',
                          textAlign: col.align,
                          whiteSpace: 'nowrap',
                        }}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {portfolioData.map((entry) => (
                      <tr key={entry.id}>
                        <td style={{ padding: '10px 12px', fontSize: 'var(--font-sm)', color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-gold)' }}>{entry.symbol}</span>
                          <span style={{ marginLeft: '6px', fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>{entry.name}</span>
                          {entry.source === 'coinbase' && (
                            <span className="badge badge-accent" style={{ marginLeft: '6px', fontSize: 'var(--font-xxs)' }}>CB</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 'var(--font-sm)', color: 'var(--color-text)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {entry.amount.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 'var(--font-xs)', color: 'var(--color-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          ${entry.buyPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-text)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          ${entry.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--color-text)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          ${entry.currentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <span className={entry.pnl >= 0 ? 'change-chip-green' : 'change-chip-red'}>
                            {entry.pnl >= 0 ? '+' : ''}${entry.pnl.toFixed(2)}
                            {' '}({entry.pnlPct >= 0 ? '+' : ''}{entry.pnlPct.toFixed(2)}%)
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 'var(--font-xs)', color: 'var(--color-cyan)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {entry.goldEquivOz.toFixed(4)} oz
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ padding: '10px 12px', fontSize: 'var(--font-xs)', color: 'var(--color-muted)', fontWeight: 600, borderTop: '1px solid var(--color-border)' }}>
                        Total
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--color-gold)', textAlign: 'right', borderTop: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                        ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {(() => {
                          const totalPnl = portfolioData.reduce((s, e) => s + e.pnl, 0);
                          const totalCost = portfolioData.reduce((s, e) => s + e.costBasis, 0);
                          const totalPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
                          return (
                            <span className={totalPnl >= 0 ? 'change-chip-green' : 'change-chip-red'}>
                              {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
                              {' '}({totalPct >= 0 ? '+' : ''}{totalPct.toFixed(2)}%)
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 'var(--font-xs)', color: 'var(--color-cyan)', textAlign: 'right', fontWeight: 700, borderTop: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                        {totalGoldEquiv.toFixed(4)} oz
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* vs-spot callout */}
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-accent-dim)',
                border: '1px solid rgba(124,92,252,0.2)',
                fontSize: 'var(--font-xs)',
                color: 'var(--color-muted)',
              }}>
                💡 <strong style={{ color: 'var(--color-text)' }}>Portfolio vs Spot Gold:</strong>
                {' '}Your portfolio is worth{' '}
                <strong style={{ color: 'var(--color-gold)' }}>
                  {totalGoldEquiv.toFixed(4)} troy oz
                </strong>
                {' '}of gold at current spot price.
                {totalGoldBacked > 0 && (
                  <span>
                    {' '}
                    <strong style={{ color: 'var(--color-green)' }}>
                      {((totalGoldBacked / totalValue) * 100).toFixed(1)}%
                    </strong>
                    {' '}of your portfolio is gold-backed (PAXG/XAUT/XAU).
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
