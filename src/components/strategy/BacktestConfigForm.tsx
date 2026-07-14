import { MR_ASSET_OPTIONS } from './constants';
import { Field, TooltipIcon } from './StrategyFormPrimitives';
import { inputStyle, labelStyle } from './strategyFormStyles';

interface Props {
  strategyType: 'arbitrage' | 'mean-reversion';
  arbSpreadThreshold: number;
  arbTradeSize: number;
  arbRegimeGateEnabled: boolean;
  regimeMinFidelity: number;
  regimeFullSizeFidelity: number;
  regimeAllowDivergenceOverride: boolean;
  mrAsset: string;
  mrWindowSize: number;
  mrBuyThreshold: number;
  mrSellThreshold: number;
  mrStopLoss: number;
  mrTradeSize: number;
  estimatedTradesPerDay: number;
  onStrategyTypeChange: (type: 'arbitrage' | 'mean-reversion') => void;
  onArbConfigChange: (patch: { arbSpreadThreshold?: number; arbTradeSize?: number; arbRegimeGateEnabled?: boolean }) => void;
  onRegimeGateChange: (patch: { minFidelityScore?: number; fullSizeFidelityScore?: number; allowDivergenceOverride?: boolean }) => void;
  onMrConfigChange: (patch: Record<string, string | number>) => void;
}

export function BacktestConfigForm({
  strategyType,
  arbSpreadThreshold,
  arbTradeSize,
  arbRegimeGateEnabled,
  regimeMinFidelity,
  regimeFullSizeFidelity,
  regimeAllowDivergenceOverride,
  mrAsset,
  mrWindowSize,
  mrBuyThreshold,
  mrSellThreshold,
  mrStopLoss,
  mrTradeSize,
  estimatedTradesPerDay,
  onStrategyTypeChange,
  onArbConfigChange,
  onRegimeGateChange,
  onMrConfigChange,
}: Props) {
  return (
    <>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        {(['arbitrage', 'mean-reversion'] as const).map((t) => (
          <button
            key={t}
            onClick={() => onStrategyTypeChange(t)}
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

      {strategyType === 'arbitrage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <Field
              label="Spread Threshold"
              labelTooltip="Minimum price difference (%) between PAXG and XAUT to trigger a trade. Lower values = more frequent trades but smaller profits per trade."
              value={arbSpreadThreshold}
              min={0.05}
              max={5}
              step={0.05}
              onChange={(v) => onArbConfigChange({ arbSpreadThreshold: parseFloat(v) || 0.25 })}
              validate={(v) => v >= 0.05 && v <= 5}
              validationMessage="Must be between 0.05% and 5%"
              suffix="%"
            />
            <Field
              label="Trade Size"
              labelTooltip="USD amount to trade per arbitrage opportunity. Larger sizes = higher potential profit but more capital at risk."
              value={arbTradeSize}
              min={50}
              max={50000}
              step={50}
              onChange={(v) => onArbConfigChange({ arbTradeSize: parseFloat(v) || 500 })}
              validate={(v) => v >= 50 && v <= 50000}
              validationMessage="Must be between $50 and $50,000"
              suffix="$"
            />
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            background: 'var(--color-surface2)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--font-xs)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={arbRegimeGateEnabled}
                onChange={(e) => onArbConfigChange({ arbRegimeGateEnabled: e.target.checked })}
              />
              <strong>Regime gate</strong> — size/enable entries by Gold Fidelity (simulation only; never auto-live-trades)
            </label>
          </div>
          {arbRegimeGateEnabled && (
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <Field
                label="Min fidelity to enter"
                labelTooltip="Average PAXG/XAUT Gold Fidelity Score required to open arb (unless crypto-beta divergence override fires)."
                value={regimeMinFidelity}
                min={0}
                max={100}
                step={1}
                onChange={(v) => onRegimeGateChange({ minFidelityScore: parseFloat(v) || 45 })}
                validate={(v) => v >= 0 && v <= 100}
                validationMessage="0–100"
              />
              <Field
                label="Full size fidelity"
                labelTooltip="Avg score at which 100% of trade size is used. Between min and full, size scales linearly."
                value={regimeFullSizeFidelity}
                min={0}
                max={100}
                step={1}
                onChange={(v) => onRegimeGateChange({ fullSizeFidelityScore: parseFloat(v) || 70 })}
                validate={(v) => v >= 0 && v <= 100}
                validationMessage="0–100"
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--font-xs)', alignSelf: 'flex-end', paddingBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={regimeAllowDivergenceOverride}
                  onChange={(e) => onRegimeGateChange({ allowDivergenceOverride: e.target.checked })}
                />
                Allow crypto-beta divergence override
              </label>
            </div>
          )}
          <p style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', margin: 0 }}>
            Regime scores use sparkline fidelity with synthesized spot gold — educational simulation, not financial advice.
          </p>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            background: 'var(--color-gold-dim)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}
          >
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
            flexWrap: 'wrap',
          }}
          >
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
                onChange={(e) => onMrConfigChange({ mrAsset: e.target.value })}
                style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
              >
                {MR_ASSET_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
            <Field
              label="SMA Window"
              labelTooltip="Number of hours to calculate the Simple Moving Average. Shorter windows = more responsive but more false signals."
              value={mrWindowSize}
              min={4}
              max={168}
              step={1}
              onChange={(v) => onMrConfigChange({ mrWindowSize: parseInt(v) || 24 })}
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
              min={0.5}
              max={20}
              step={0.1}
              onChange={(v) => onMrConfigChange({ mrBuyThreshold: parseFloat(v) || 2.0 })}
              validate={(v) => v >= 0.5 && v <= 20}
              validationMessage="Must be between 0.5% and 20%"
              suffix="%"
            />
            <Field
              label="Sell Above SMA"
              labelTooltip="Percentage above SMA to trigger a sell signal. Should typically be lower than buy threshold for profit margin."
              value={mrSellThreshold}
              min={0.5}
              max={20}
              step={0.1}
              onChange={(v) => onMrConfigChange({ mrSellThreshold: parseFloat(v) || 1.5 })}
              validate={(v) => v >= 0.5 && v <= 20}
              validationMessage="Must be between 0.5% and 20%"
              suffix="%"
            />
            <Field
              label="Stop-Loss"
              labelTooltip="Maximum loss percentage before exiting position to limit downside. Essential risk management parameter."
              value={mrStopLoss}
              min={1}
              max={30}
              step={0.5}
              onChange={(v) => onMrConfigChange({ mrStopLoss: parseFloat(v) || 5.0 })}
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
              min={50}
              max={50000}
              step={50}
              onChange={(v) => onMrConfigChange({ mrTradeSize: parseFloat(v) || 1000 })}
              validate={(v) => v >= 50 && v <= 50000}
              validationMessage="Must be between $50 and $50,000"
              suffix="$"
            />
          </div>
          <p style={{
            margin: 0,
            fontSize: 'var(--font-xs)',
            color: 'var(--color-muted)',
            lineHeight: 1.5,
          }}
          >
            Prices generated with an Ornstein-Uhlenbeck process (θ=0.03, σ=0.8%/hr) for realistic mean-reverting behaviour.
            <span style={{ marginLeft: '16px', color: 'var(--color-accent)' }}>
              Est. frequency: ~{estimatedTradesPerDay} trades/day
            </span>
          </p>
        </div>
      )}
    </>
  );
}
