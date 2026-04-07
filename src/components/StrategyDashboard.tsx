import { useCallback, useState } from 'react';
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

// Tooltip component
function TooltipIcon({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  
  return (
    <span 
      style={{ 
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: 'var(--color-surface2)',
        color: 'var(--color-muted)',
        fontSize: '0.7rem',
        cursor: 'help',
        marginLeft: '6px',
        position: 'relative',
        border: '1px solid var(--color-border)'
      }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      aria-label="More information"
    >
      ?
      {show && (
        <span style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--color-surface2)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 12px',
          fontSize: '0.75rem',
          color: 'var(--color-text)',
          whiteSpace: 'nowrap',
          zIndex: 100,
          boxShadow: 'var(--shadow-md)',
          marginBottom: '6px',
          minWidth: '200px',
          lineHeight: 1.4
        }}>
          {text}
          <span style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            border: '6px solid transparent',
            borderTopColor: 'var(--color-border)'
          }} />
        </span>
      )}
    </span>
  );
}

// Validation indicator
function ValidationIndicator({ valid, message }: { valid: boolean; message?: string }) {
  return (
    <span 
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: '6px',
        fontSize: '0.75rem',
        color: valid ? 'var(--color-green)' : 'var(--color-red)'
      }}
      title={message}
    >
      {valid ? '✓' : '✗'}
    </span>
  );
}

// ─── Mock tick generator ──────────────────────────────────────────────────────

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

const TICK_COUNT = 720;

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
      paxg *= Math.exp(0.0001 + 0.003 * randn());
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
    const theta = 0.03;
    const sigma = mu * 0.008;
    let price = mu;

    for (let i = 0; i < TICK_COUNT; i++) {
      const timestamp = now - (TICK_COUNT - i) * 3_600_000;
      price = price + theta * (mu - price) + sigma * randn();
      price = Math.max(price, mu * 0.5);

      ticks.push({
        timestamp,
        prices: { [asset]: parseFloat(price.toFixed(4)) },
      });
    }
  }

  return ticks;
}

const tooltipContentStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--color-text)',
  fontSize: '0.75rem',
};

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
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }}>
      <span style={{ 
        fontSize: 'var(--font-xs)', 
        color: 'var(--color-muted)', 
        textTransform: 'uppercase', 
        letterSpacing: '0.06em',
        fontWeight: 600
      }}>
        {label}
      </span>
      <span style={{ 
        fontSize: 'var(--font-lg)', 
        fontWeight: 700, 
        color: color ?? 'var(--color-text)', 
        fontVariantNumeric: 'tabular-nums' 
      }}>
        {value}
      </span>
      {subtext && (
        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>{subtext}</span>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--color-surface2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text)',
  fontSize: 'var(--font-sm)',
  padding: '8px 12px',
  width: '100%',
  outline: 'none',
  transition: 'border-color 0.15s ease'
};

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--font-xs)',
  color: 'var(--color-muted)',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center'
};

interface FieldProps {
  label: string;
  labelTooltip?: string;
  value: string | number;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
  type?: string;
  validate?: (v: number) => boolean;
  validationMessage?: string;
  suffix?: string;
}

function Field({
  label, labelTooltip, value, onChange, min, max, step, type = 'number',
  validate, validationMessage, suffix
}: FieldProps) {
  const numValue = parseFloat(value as string);
  const isValid = !isNaN(numValue) && (!validate || validate(numValue));
  
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label style={labelStyle}>
        {label}
        {labelTooltip && <TooltipIcon text={labelTooltip} />}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={type}
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.value)}
          style={{
            ...inputStyle,
            borderColor: value && !isValid ? 'var(--color-red)' : 'var(--color-border)',
            paddingRight: suffix ? '30px' : '12px'
          }}
        />
        {suffix && (
          <span style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--color-muted)',
            fontSize: '0.85rem'
          }}>
            {suffix}
          </span>
        )}
        {value && validate && (
          <ValidationIndicator valid={isValid} message={validationMessage} />
        )}
      </div>
    </div>
  );
}

export function StrategyDashboard() {
  const {
    strategyType, setStrategyType,
    arbSpreadThreshold, arbTradeSize, arbAsset1, arbAsset2, setArbConfig,
    mrAsset, mrWindowSize, mrBuyThreshold, mrSellThreshold, mrStopLoss, mrTradeSize, setMrConfig,
    initialBalance, setInitialBalance,
    lastResult, setLastResult,
    isRunning, setIsRunning,
  } = useStrategyStore();

  const handleRunBacktest = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);

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

  const r = lastResult;
  const returnColor = !r ? 'var(--color-text)'
    : r.totalReturn >= 0 ? 'var(--color-green)' : 'var(--color-red)';
  const winRate = r && r.totalTrades > 0
    ? ((r.winningTrades / r.totalTrades) * 100).toFixed(1) + '%'
    : '—';

  const equityCurveDisplay = r
    ? (() => {
        const curve = r.equityCurve;
        if (curve.length <= 200) return curve;
        const step = Math.ceil(curve.length / 200);
        return curve.filter((_, i) => i % step === 0 || i === curve.length - 1);
      })()
    : [];

  const tradeLogDisplay = r
    ? [...r.trades].reverse().slice(0, 100)
    : [];

  const mrAssetOptions = [
    { id: 'bitcoin',     label: 'BTC — Bitcoin' },
    { id: 'ethereum',    label: 'ETH — Ethereum' },
    { id: 'pax-gold',    label: 'PAXG — PAX Gold' },
    { id: 'tether-gold', label: 'XAUT — Tether Gold' },
  ];

  // Calculate estimated trade frequency
  const estimatedTradesPerDay = strategyType === 'arbitrage' 
    ? Math.round((0.08 * 24 * (0.25 / arbSpreadThreshold)) * 10) / 10
    : Math.round((24 / mrWindowSize) * 10) / 10;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)', marginBottom: 'var(--space-2xl)' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-xl)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.5rem' }}>⚙️</span>
            <h2 style={{ 
              margin: 0, 
              fontSize: 'var(--font-xl)', 
              fontWeight: 800, 
              color: 'var(--color-text)',
              letterSpacing: '-0.02em'
            }}>
              Strategy Engine
            </h2>
            <span style={{
              fontSize: 'var(--font-xs)',
              padding: '3px 10px',
              borderRadius: '999px',
              background: 'var(--color-accent-dim)',
              color: 'var(--color-accent)',
              fontWeight: 700,
              letterSpacing: '0.08em'
            }}>
              BACKTEST MODE
            </span>
          </div>
          <p style={{ 
            margin: '6px 0 0 0', 
            fontSize: 'var(--font-sm)', 
            color: 'var(--color-muted)',
            maxWidth: '600px'
          }}>
            Simulate algorithmic strategies over 30 days of synthetic price data — no real funds at risk.
          </p>
        </div>
        {r && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span className={`badge ${r.totalReturn >= 0 ? 'badge-green' : 'badge-red'}`}>
              {r.totalReturn >= 0 ? '▲' : '▼'} {formatPercent(r.totalReturn)} return
            </span>
            <span style={{
              fontSize: 'var(--font-xs)',
              padding: '3px 10px',
              borderRadius: '999px',
              background: 'var(--color-accent-dim)',
              color: 'var(--color-accent)',
              fontWeight: 600
            }}>
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
        padding: 'var(--space-xl)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <h3 style={{ 
          margin: '0 0 20px 0', 
          fontSize: 'var(--font-lg)', 
          fontWeight: 700, 
          color: 'var(--color-text)',
          letterSpacing: '-0.01em'
        }}>
          🔧 Strategy Configurator
        </h3>

        {/* Strategy type pills */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
          {(['arbitrage', 'mean-reversion'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setStrategyType(t)}
              style={{
                padding: '10px 20px',
                borderRadius: 'var(--radius-full)',
                border: strategyType === t
                  ? '2px solid var(--color-accent)'
                  : '2px solid var(--color-border)',
                background: strategyType === t ? 'var(--color-accent-dim)' : 'transparent',
                color: strategyType === t ? 'var(--color-accent)' : 'var(--color-muted)',
                fontWeight: strategyType === t ? 700 : 500,
                fontSize: 'var(--font-sm)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {t === 'arbitrage' ? '⚡ Arbitrage' : '📈 Mean Reversion'}
            </button>
          ))}
        </div>

        <div style={{ height: '1px', background: 'var(--color-border)', marginBottom: '24px' }} />

        {/* ── Arbitrage params ──────────────────────────────────────────── */}
        {strategyType === 'arbitrage' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <Field
                label="Spread Threshold"
                labelTooltip="Minimum price difference (%) between PAXG and XAUT to trigger a trade. Lower values = more frequent trades but smaller profits per trade."
                value={arbSpreadThreshold}
                min={0.05} max={5} step={0.05}
                onChange={(v) => setArbConfig({ arbSpreadThreshold: parseFloat(v) || 0.25 })}
                validate={(v) => v >= 0.05 && v <= 5}
                validationMessage="Must be between 0.05% and 5%"
                suffix="%"
              />
              <Field
                label="Trade Size"
                labelTooltip="USD amount to trade per arbitrage opportunity. Larger sizes = higher potential profit but more capital at risk."
                value={arbTradeSize}
                min={50} max={50000} step={50}
                onChange={(v) => setArbConfig({ arbTradeSize: parseFloat(v) || 500 })}
                validate={(v) => v >= 50 && v <= 50000}
                validationMessage="Must be between $50 and $50,000"
                suffix="$"
              />
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 16px',
              background: 'var(--color-gold-dim)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}>
              <span style={{ fontSize: '1rem' }}>🔗</span>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-gold)' }}>
                Assets locked to <strong>PAXG ↔ XAUT</strong> — the two most liquid gold-backed tokens on-chain.
                Spread events fire at ≈8% of ticks in the synthetic data.
              </span>
            </div>
            <div style={{
              display: 'flex',
              gap: '20px',
              fontSize: 'var(--font-xs)',
              color: 'var(--color-muted)',
              flexWrap: 'wrap'
            }}>
              <span>
                <strong style={{ color: 'var(--color-text)' }}>Entry:</strong> Buy cheaper asset when spread &gt; threshold
              </span>
              <span>
                <strong style={{ color: 'var(--color-text)' }}>Exit:</strong> Sell when spread ≤ threshold / 2
              </span>
              <span style={{ marginLeft: 'auto' }}>
                <strong style={{ color: 'var(--color-accent)' }}>Est. frequency:</strong> ~{estimatedTradesPerDay} trades/day
              </span>
            </div>
          </div>
        )}

        {/* ── Mean-Reversion params ─────────────────────────────────────── */}
        {strategyType === 'mean-reversion' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={labelStyle}>
                  Asset
                  <TooltipIcon text="The cryptocurrency or token to trade using mean-reversion strategy" />
                </label>
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
                label="SMA Window"
                labelTooltip="Number of hours to calculate the Simple Moving Average. Shorter windows = more responsive but more false signals."
                value={mrWindowSize}
                min={4} max={168} step={1}
                onChange={(v) => setMrConfig({ mrWindowSize: parseInt(v) || 24 })}
                validate={(v) => v >= 4 && v <= 168}
                validationMessage="Must be between 4 and 168 hours"
                suffix="hrs"
              />
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <Field
                label="Buy Below SMA"
                labelTooltip="Percentage below SMA to trigger a buy signal. Higher values = fewer but deeper discount entries."
                value={mrBuyThreshold}
                min={0.5} max={20} step={0.1}
                onChange={(v) => setMrConfig({ mrBuyThreshold: parseFloat(v) || 2.0 })}
                validate={(v) => v >= 0.5 && v <= 20}
                validationMessage="Must be between 0.5% and 20%"
                suffix="%"
              />
              <Field
                label="Sell Above SMA"
                labelTooltip="Percentage above SMA to trigger a sell signal. Should typically be lower than buy threshold for profit margin."
                value={mrSellThreshold}
                min={0.5} max={20} step={0.1}
                onChange={(v) => setMrConfig({ mrSellThreshold: parseFloat(v) || 1.5 })}
                validate={(v) => v >= 0.5 && v <= 20}
                validationMessage="Must be between 0.5% and 20%"
                suffix="%"
              />
              <Field
                label="Stop-Loss"
                labelTooltip="Maximum loss percentage before exiting position to limit downside. Essential risk management parameter."
                value={mrStopLoss}
                min={1} max={30} step={0.5}
                onChange={(v) => setMrConfig({ mrStopLoss: parseFloat(v) || 5.0 })}
                validate={(v) => v >= 1 && v <= 30}
                validationMessage="Must be between 1% and 30%"
                suffix="%"
              />
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <Field
                label="Trade Size"
                labelTooltip="USD amount per trade. This is the maximum capital allocated to each position."
                value={mrTradeSize}
                min={50} max={50000} step={50}
                onChange={(v) => setMrConfig({ mrTradeSize: parseFloat(v) || 1000 })}
                validate={(v) => v >= 50 && v <= 50000}
                validationMessage="Must be between $50 and $50,000"
                suffix="$"
              />
            </div>
            <p style={{ 
              margin: 0, 
              fontSize: 'var(--font-xs)', 
              color: 'var(--color-muted)',
              lineHeight: 1.5
            }}>
              Prices generated with an Ornstein-Uhlenbeck process (θ=0.03, σ=0.8%/hr) for realistic mean-reverting behaviour.
              <span style={{ marginLeft: '16px', color: 'var(--color-accent)' }}>
                Est. frequency: ~{estimatedTradesPerDay} trades/day
              </span>
            </p>
          </div>
        )}

        <div style={{ height: '1px', background: 'var(--color-border)', margin: '24px 0' }} />

        {/* Common: initial balance */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '24px' }}>
          <div style={{ flex: 1, minWidth: 180, maxWidth: 280 }}>
            <Field
              label="Starting Balance"
              labelTooltip="Initial capital for the backtest simulation. Results are calculated based on this starting amount."
              value={initialBalance}
              min={100} max={1_000_000} step={100}
              onChange={(v) => setInitialBalance(parseFloat(v) || 10_000)}
              validate={(v) => v >= 100 && v <= 1000000}
              validationMessage="Must be between $100 and $1,000,000"
              suffix="$"
            />
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={handleRunBacktest}
          disabled={isRunning}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: isRunning ? 'var(--color-border)' : 'var(--color-accent)',
            color: isRunning ? 'var(--color-muted)' : '#fff',
            fontWeight: 700,
            fontSize: 'var(--font-base)',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: isRunning ? 'none' : 'var(--shadow-md)'
          }}
          aria-label="Run back-test over 30 days of synthetic data"
        >
          {isRunning ? (
            <>
              <span style={{
                display: 'inline-block',
                width: 16, height: 16,
                border: '2px solid var(--color-muted)',
                borderTopColor: '#fff',
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
          padding: 'var(--space-xl)',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <h3 style={{ 
            margin: '0 0 20px 0', 
            fontSize: 'var(--font-lg)', 
            fontWeight: 700, 
            color: 'var(--color-text)',
            letterSpacing: '-0.01em'
          }}>
            📊 Backtest Summary
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
          padding: 'var(--space-xl)',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            marginBottom: '20px', 
            flexWrap: 'wrap', 
            gap: '12px' 
          }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: 'var(--font-lg)', 
              fontWeight: 700, 
              color: 'var(--color-text)',
              letterSpacing: '-0.01em'
            }}>
              📈 Portfolio Value Over Time
            </h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <span style={{
                fontSize: 'var(--font-xs)',
                padding: '3px 10px',
                borderRadius: '999px',
                background: 'var(--color-accent-dim)',
                color: 'var(--color-accent)',
                fontWeight: 600
              }}>
                30-day simulation
              </span>
              <span className={`badge ${r.totalReturn >= 0 ? 'badge-green' : 'badge-red'}`}>
                {r.totalReturn >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(r.totalReturn))}
              </span>
            </div>
          </div>

          <div style={{ width: '100%', height: 300 }} role="img" aria-label="Simulated portfolio equity curve">
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
                  formatter={(v: unknown) => [formatPrice(v as number), 'Portfolio Value']}
                  labelFormatter={(t: unknown) => new Date(t as number).toLocaleString()}
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
          padding: 'var(--space-xl)',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            marginBottom: '20px', 
            flexWrap: 'wrap', 
            gap: '12px' 
          }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: 'var(--font-lg)', 
              fontWeight: 700, 
              color: 'var(--color-text)',
              letterSpacing: '-0.01em'
            }}>
              🗒 Simulated Trade Log
            </h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <span style={{
                fontSize: 'var(--font-xs)',
                padding: '3px 10px',
                borderRadius: '999px',
                background: 'var(--color-surface2)',
                color: 'var(--color-muted)',
                fontWeight: 600
              }}>
                {r.trades.length} executions
              </span>
              <span style={{
                fontSize: 'var(--font-xs)',
                padding: '3px 10px',
                borderRadius: '999px',
                background: 'var(--color-accent-dim)',
                color: 'var(--color-accent)',
                fontWeight: 600
              }}>
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
                          padding: '10px 12px',
                          textAlign: h === 'P&L' || h === 'Amount (USD)' || h === 'Price' || h === 'Units' ? 'right' : 'left',
                          color: 'var(--color-muted)',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          borderBottom: '2px solid var(--color-border)',
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
                        <td style={{ padding: '10px 12px', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(trade.timestamp).toLocaleString('en-US', {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--color-text)' }}>
                          {trade.symbol}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 10px',
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
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>
                          {formatPrice(trade.price)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {trade.units < 0.01
                            ? trade.units.toFixed(6)
                            : trade.units < 1
                              ? trade.units.toFixed(4)
                              : trade.units.toFixed(2)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>
                          {formatPrice(trade.amountUSD)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: pnlColor, fontVariantNumeric: 'tabular-nums' }}>
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
            <p style={{ margin: '12px 0 0 0', fontSize: 'var(--font-xs)', color: 'var(--color-muted)', textAlign: 'center' }}>
              Showing most recent 100 of {r.trades.length} total executions
            </p>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
