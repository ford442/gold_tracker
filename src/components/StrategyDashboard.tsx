import { useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { toast } from 'react-hot-toast';
import {
  runBacktest,
  createArbitrageStrategy,
  createMeanReversionStrategy,
  type BacktestTick,
  type BacktestResult,
} from '../lib/strategyEngine';
import { useStrategyStore } from '../store/strategyStore';
import { formatPrice, formatPercent } from '../lib/utils';

// ─── Mock tick generator ──────────────────────────────────────────────────────

/** Box-Muller transform → standard normal sample */
function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

const BASE_PRICES: Record<string, number> = {
  'pax-gold':    3280.5,
  'tether-gold': 3284.2,
  'bitcoin':     97450,
  'ethereum':    3850,
};

const TICK_COUNT = 720; // 30 days × 24 h

/**
 * Generates 720 hourly ticks of mock price data suitable for back-testing.
 *
 * Arbitrage mode:  PAXG follows GBM; XAUT tracks PAXG closely with
 *                  occasional divergence events (~8% of ticks).
 *
 * Mean-Reversion:  Target asset follows an Ornstein-Uhlenbeck process
 *                  (θ=0.03, σ=0.8%/hr) that naturally mean-reverts.
 */
function generateMockTicks(
  strategyType: 'arbitrage' | 'mean-reversion',
  mrAsset: string,
): BacktestTick[] {
  const now = Date.now();
  const ticks: BacktestTick[] = [];

  if (strategyType === 'arbitrage') {
    let paxg = BASE_PRICES['pax-gold'];
    let xaut = BASE_PRICES['tether-gold'];

    for (let i = 0; i < TICK_COUNT; i++) {
      const timestamp = now - (TICK_COUNT - i) * 3_600_000;

      // PAXG: GBM  μ=+0.01%/hr, σ=0.3%/hr
      paxg *= Math.exp(0.0001 + 0.003 * randn());

      // XAUT: follows PAXG with tight correlation; 8% chance of spread event
      const isSpreadEvent = Math.random() < 0.08;
      const noise = isSpreadEvent ? randn() * 0.012 : randn() * 0.0015;
      xaut = paxg * (1 + noise);

      ticks.push({
        timestamp,
        prices: {
          'pax-gold':    parseFloat(paxg.toFixed(4)),
          'tether-gold': parseFloat(xaut.toFixed(4)),
        },
      });
    }
  } else {
    const asset = mrAsset;
    const mu = BASE_PRICES[asset] ?? 10_000;
    const theta = 0.03;            // mean-reversion speed
    const sigma = mu * 0.008;      // 0.8 %/hr vol
    let price = mu;

    for (let i = 0; i < TICK_COUNT; i++) {
      const timestamp = now - (TICK_COUNT - i) * 3_600_000;
      // Ornstein-Uhlenbeck step
      price = price + theta * (mu - price) + sigma * randn();
      price = Math.max(price, mu * 0.5); // floor at 50% of base

      ticks.push({
        timestamp,
        prices: { [asset]: parseFloat(price.toFixed(4)) },
      });
    }
  }

  return ticks;
}

// ─── Tooltip content style (reused) ──────────────────────────────────────────

const tooltipContentStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--color-text)',
  fontSize: '0.75rem',
};

// ─── Labelled stat box ────────────────────────────────────────────────────────

interface StatBoxProps {
  label: string;
  value: string;
  color?: string;
  subtext?: string;
}

function StatBox({ label, value, color, subtext }: StatBoxProps) {
  return (
    <div style={{
      background: 'var(--color-surface2)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: color ?? 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      {subtext && (
        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>{subtext}</span>
      )}
    </div>
  );
}

// ─── Input helpers ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'var(--color-surface2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text)',
  fontSize: 'var(--font-sm)',
  padding: '6px 10px',
  width: '100%',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--font-xs)',
  color: 'var(--color-muted)',
  marginBottom: '4px',
  display: 'block',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

function Field({
  label, value, onChange, min, max, step, type = 'number',
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
  type?: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function StrategyDashboard() {
  const {
    strategyType, setStrategyType,
    arbSpreadThreshold, arbTradeSize, arbAsset1, arbAsset2, setArbConfig,
    mrAsset, mrWindowSize, mrBuyThreshold, mrSellThreshold, mrStopLoss, mrTradeSize, setMrConfig,
    initialBalance, setInitialBalance,
    lastResult, setLastResult,
    isRunning, setIsRunning,
  } = useStrategyStore();

  // ── Run backtest ────────────────────────────────────────────────────────
  const handleRunBacktest = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);

    // Yield to React so spinner renders before heavy JS
    await new Promise<void>((r) => setTimeout(r, 60));

    let result: BacktestResult;
    try {
      const ticks = generateMockTicks(strategyType, mrAsset);

      const strategy = strategyType === 'arbitrage'
        ? createArbitrageStrategy({
            asset1: arbAsset1,
            asset2: arbAsset2,
            spreadThreshold: arbSpreadThreshold,
            tradeSize: arbTradeSize,
          })
        : createMeanReversionStrategy({
            asset: mrAsset,
            windowSize: mrWindowSize,
            buyThreshold: mrBuyThreshold,
            sellThreshold: mrSellThreshold,
            tradeSize: mrTradeSize,
            stopLoss: mrStopLoss,
          });

      result = runBacktest(ticks, strategy, initialBalance);
      setLastResult(result);
      toast.success(
        `Backtest complete — ${result.totalTrades} trades, ${formatPercent(result.totalReturn)} return`,
        { duration: 4000 }
      );
    } catch (err) {
      console.error('[StrategyDashboard] backtest error:', err);
      toast.error('Backtest failed — check console for details');
    } finally {
      setIsRunning(false);
    }
  }, [
    isRunning, strategyType, arbAsset1, arbAsset2, arbSpreadThreshold, arbTradeSize,
    mrAsset, mrWindowSize, mrBuyThreshold, mrSellThreshold, mrTradeSize, mrStopLoss,
    initialBalance, setLastResult, setIsRunning,
  ]);

  // ── Derived display values ─────────────────────────────────────────────
  const r = lastResult;
  const returnColor = !r ? 'var(--color-text)'
    : r.totalReturn >= 0 ? 'var(--color-green)' : 'var(--color-red)';
  const winRate = r && r.totalTrades > 0
    ? ((r.winningTrades / r.totalTrades) * 100).toFixed(1) + '%'
    : '—';

  // Downsample equity curve to ≤200 points for smooth Recharts rendering
  const equityCurveDisplay = r
    ? (() => {
        const curve = r.equityCurve;
        if (curve.length <= 200) return curve;
        const step = Math.ceil(curve.length / 200);
        return curve.filter((_, i) => i % step === 0 || i === curve.length - 1);
      })()
    : [];

  // Show only the last 100 trades, newest-first
  const tradeLogDisplay = r
    ? [...r.trades].reverse().slice(0, 100)
    : [];

  // ── MR asset options ───────────────────────────────────────────────────
  const mrAssetOptions = [
    { id: 'bitcoin',     label: 'BTC — Bitcoin' },
    { id: 'ethereum',    label: 'ETH — Ethereum' },
    { id: 'pax-gold',    label: 'PAXG — PAX Gold' },
    { id: 'tether-gold', label: 'XAUT — Tether Gold' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-lg)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>⚙️</span>
            <h2 style={{ margin: 0, fontSize: 'var(--font-xl)', fontWeight: 800, color: 'var(--color-text)' }}>
              Strategy Engine
            </h2>
            <span className="badge badge-accent" style={{ fontSize: 'var(--font-xs)', letterSpacing: '0.08em' }}>
              BACKTEST MODE
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: 'var(--font-sm)', color: 'var(--color-muted)' }}>
            Simulate algorithmic strategies over 30 days of synthetic price data — no real funds at risk.
          </p>
        </div>
        {r && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span className={`badge ${r.totalReturn >= 0 ? 'badge-green' : 'badge-red'}`}>
              {r.totalReturn >= 0 ? '▲' : '▼'} {formatPercent(r.totalReturn)} return
            </span>
            <span className="badge" style={{ background: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}>
              {r.totalTrades} trades
            </span>
          </div>
        )}
      </div>

      {/* ── Configurator ────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-lg)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 'var(--font-base)', fontWeight: 700, color: 'var(--color-text)' }}>
          🔧 Strategy Configurator
        </h3>

        {/* Strategy type pills */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {(['arbitrage', 'mean-reversion'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setStrategyType(t)}
              style={{
                padding: '7px 18px',
                borderRadius: 'var(--radius-full)',
                border: strategyType === t
                  ? '2px solid var(--color-accent)'
                  : '2px solid var(--color-border)',
                background: strategyType === t ? 'var(--color-accent-dim)' : 'transparent',
                color: strategyType === t ? 'var(--color-accent)' : 'var(--color-muted)',
                fontWeight: strategyType === t ? 700 : 400,
                fontSize: 'var(--font-sm)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {t === 'arbitrage' ? '⚡ Arbitrage' : '📈 Mean Reversion'}
            </button>
          ))}
        </div>

        <div style={{ height: '1px', background: 'var(--color-border)', marginBottom: '20px' }} />

        {/* ── Arbitrage params ──────────────────────────────────────────── */}
        {strategyType === 'arbitrage' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <Field
                label="Spread Threshold (%)"
                value={arbSpreadThreshold}
                min={0.05} max={5} step={0.05}
                onChange={(v) => setArbConfig({ arbSpreadThreshold: parseFloat(v) || 0.25 })}
              />
              <Field
                label="Trade Size (USD)"
                value={arbTradeSize}
                min={50} max={50000} step={50}
                onChange={(v) => setArbConfig({ arbTradeSize: parseFloat(v) || 500 })}
              />
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 12px',
              background: 'var(--color-gold-dim)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
            }}>
              <span style={{ fontSize: '0.8rem' }}>🔗</span>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-gold)' }}>
                Assets locked to <strong>PAXG ↔ XAUT</strong> — the two most liquid gold-backed tokens on-chain.
                Spread events fire at ≈8% of ticks in the synthetic data.
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>
              Entry: buy cheaper asset when spread &gt; threshold. Exit: sell when spread ≤ threshold / 2.
            </p>
          </div>
        )}

        {/* ── Mean-Reversion params ─────────────────────────────────────── */}
        {strategyType === 'mean-reversion' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={labelStyle}>Asset</label>
                <select
                  value={mrAsset}
                  onChange={(e) => setMrConfig({ mrAsset: e.target.value })}
                  style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                >
                  {mrAssetOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
              <Field
                label="SMA Window (hours)"
                value={mrWindowSize}
                min={4} max={168} step={1}
                onChange={(v) => setMrConfig({ mrWindowSize: parseInt(v) || 24 })}
              />
            </div>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <Field
                label="Buy Below SMA (%)"
                value={mrBuyThreshold}
                min={0.5} max={20} step={0.1}
                onChange={(v) => setMrConfig({ mrBuyThreshold: parseFloat(v) || 2.0 })}
              />
              <Field
                label="Sell Above SMA (%)"
                value={mrSellThreshold}
                min={0.5} max={20} step={0.1}
                onChange={(v) => setMrConfig({ mrSellThreshold: parseFloat(v) || 1.5 })}
              />
              <Field
                label="Stop-Loss (%)"
                value={mrStopLoss}
                min={1} max={30} step={0.5}
                onChange={(v) => setMrConfig({ mrStopLoss: parseFloat(v) || 5.0 })}
              />
            </div>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <Field
                label="Trade Size (USD)"
                value={mrTradeSize}
                min={50} max={50000} step={50}
                onChange={(v) => setMrConfig({ mrTradeSize: parseFloat(v) || 1000 })}
              />
            </div>
            <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>
              Prices generated with an Ornstein-Uhlenbeck process (θ=0.03, σ=0.8%/hr) for realistic mean-reverting behaviour.
            </p>
          </div>
        )}

        <div style={{ height: '1px', background: 'var(--color-border)', margin: '20px 0' }} />

        {/* Common: initial balance */}
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '20px' }}>
          <div style={{ flex: 1, minWidth: 160, maxWidth: 240 }}>
            <Field
              label="Starting Balance (USD)"
              value={initialBalance}
              min={100} max={1_000_000} step={100}
              onChange={(v) => setInitialBalance(parseFloat(v) || 10_000)}
            />
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={handleRunBacktest}
          disabled={isRunning}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: isRunning ? 'var(--color-border)' : 'var(--color-accent)',
            color: isRunning ? 'var(--color-muted)' : '#fff',
            fontWeight: 700,
            fontSize: 'var(--font-base)',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
          aria-label="Run back-test over 30 days of synthetic data"
        >
          {isRunning ? (
            <>
              <span style={{
                display: 'inline-block',
                width: 14, height: 14,
                border: '2px solid var(--color-muted)',
                borderTopColor: 'var(--color-text)',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
              Running simulation…
            </>
          ) : (
            '▶ Run Backtest (30 Days)'
          )}
        </button>
      </div>

      {/* ── Results Summary ──────────────────────────────────────────────── */}
      {r && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-lg)',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 'var(--font-base)', fontWeight: 700, color: 'var(--color-text)' }}>
            📊 Backtest Summary
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatBox
              label="Final Balance"
              value={formatPrice(r.finalBalance)}
              color={returnColor}
            />
            <StatBox
              label="Total Return"
              value={formatPercent(r.totalReturn)}
              color={returnColor}
              subtext={`from ${formatPrice(r.initialBalance)}`}
            />
            <StatBox
              label="Max Drawdown"
              value={formatPercent(-r.maxDrawdown)}
              color={r.maxDrawdown > 10 ? 'var(--color-red)' : 'var(--color-muted)'}
            />
            <StatBox
              label="Win Rate"
              value={winRate}
              color={
                r.totalTrades > 0 && r.winningTrades / r.totalTrades >= 0.5
                  ? 'var(--color-green)'
                  : 'var(--color-red)'
              }
              subtext={`${r.winningTrades} / ${r.totalTrades} trades`}
            />
            <StatBox
              label="Total Trades"
              value={String(r.totalTrades)}
              subtext={`${r.trades.length} executions`}
            />
          </div>
        </div>
      )}

      {/* ── Equity Curve ─────────────────────────────────────────────────── */}
      {r && equityCurveDisplay.length > 1 && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-lg)',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--font-base)', fontWeight: 700, color: 'var(--color-text)' }}>
              📈 Portfolio Value Over Time
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span className="badge" style={{ background: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}>
                30-day simulation
              </span>
              <span className={`badge ${r.totalReturn >= 0 ? 'badge-green' : 'badge-red'}`}>
                {r.totalReturn >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(r.totalReturn))}
              </span>
            </div>
          </div>

          <div style={{ width: '100%', height: 280 }} role="img" aria-label="Simulated portfolio equity curve">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityCurveDisplay} margin={{ top: 5, right: 12, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--color-accent)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(t: number) =>
                    new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }
                  stroke="var(--color-muted)"
                  tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
                  stroke="var(--color-muted)"
                  tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
                  width={62}
                />
                <Tooltip
                  contentStyle={tooltipContentStyle}
                  formatter={(v: number) => [formatPrice(v), 'Portfolio Value']}
                  labelFormatter={(t: number) => new Date(t).toLocaleString()}
                />
                <ReferenceLine
                  y={r.initialBalance}
                  stroke="var(--color-muted)"
                  strokeDasharray="5 4"
                  strokeOpacity={0.6}
                  label={{
                    value: 'Start',
                    fill: 'var(--color-muted)',
                    fontSize: 10,
                    position: 'right',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-accent)"
                  fill="url(#equityGradient)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--color-accent)' }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Trade Log ────────────────────────────────────────────────────── */}
      {r && r.trades.length > 0 && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-lg)',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--font-base)', fontWeight: 700, color: 'var(--color-text)' }}>
              🗒 Simulated Trade Log
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span className="badge" style={{ background: 'var(--color-surface2)', color: 'var(--color-muted)' }}>
                {r.trades.length} executions
              </span>
              <span className="badge badge-accent">
                Showing last {Math.min(100, r.trades.length)}
              </span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-xs)' }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 1 }}>
                    {['Date / Time', 'Asset', 'Side', 'Price', 'Units', 'Amount (USD)', 'P&L'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '8px 10px',
                          textAlign: h === 'P&L' || h === 'Amount (USD)' || h === 'Price' || h === 'Units' ? 'right' : 'left',
                          color: 'var(--color-muted)',
                          fontWeight: 600,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          borderBottom: '1px solid var(--color-border)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tradeLogDisplay.map((trade, idx) => {
                    const isEven = idx % 2 === 0;
                    const pnlColor = trade.side === 'BUY'
                      ? 'var(--color-muted)'
                      : trade.pnl >= 0
                        ? 'var(--color-green)'
                        : 'var(--color-red)';

                    return (
                      <tr
                        key={trade.id}
                        style={{
                          background: isEven ? 'transparent' : 'var(--color-surface2)',
                          borderBottom: '1px solid var(--color-border)',
                          transition: 'background 0.1s',
                        }}
                        title={trade.reason}
                      >
                        {/* Date/Time */}
                        <td style={{ padding: '7px 10px', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(trade.timestamp).toLocaleString('en-US', {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        {/* Asset */}
                        <td style={{ padding: '7px 10px', fontWeight: 600, color: 'var(--color-text)' }}>
                          {trade.symbol}
                        </td>
                        {/* Side badge */}
                        <td style={{ padding: '7px 10px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            background: trade.side === 'BUY'
                              ? 'var(--color-gold-dim)'
                              : trade.pnl >= 0
                                ? 'var(--color-green-dim)'
                                : 'var(--color-red-dim)',
                            color: trade.side === 'BUY'
                              ? 'var(--color-gold)'
                              : trade.pnl >= 0
                                ? 'var(--color-green)'
                                : 'var(--color-red)',
                          }}>
                            {trade.side}
                          </span>
                        </td>
                        {/* Price */}
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>
                          {formatPrice(trade.price)}
                        </td>
                        {/* Units */}
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {trade.units < 0.01
                            ? trade.units.toFixed(6)
                            : trade.units < 1
                              ? trade.units.toFixed(4)
                              : trade.units.toFixed(2)}
                        </td>
                        {/* Amount USD */}
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>
                          {formatPrice(trade.amountUSD)}
                        </td>
                        {/* P&L */}
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, color: pnlColor, fontVariantNumeric: 'tabular-nums' }}>
                          {trade.side === 'BUY'
                            ? <span style={{ color: 'var(--color-muted)' }}>—</span>
                            : (trade.pnl >= 0 ? '+' : '') + formatPrice(trade.pnl)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {r.trades.length > 100 && (
            <p style={{ margin: '10px 0 0 0', fontSize: 'var(--font-xs)', color: 'var(--color-muted)', textAlign: 'center' }}>
              Showing most recent 100 of {r.trades.length} total executions
            </p>
          )}
        </div>
      )}

      {/* Inline keyframe for spinner (injected once) */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
