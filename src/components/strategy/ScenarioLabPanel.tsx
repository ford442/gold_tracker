import { BUILT_IN_SCENARIOS, SCENARIO_SHOCK_ASSETS } from './constants';
import { CostModelSelector } from './CostModelSelector';
import { inputStyle, labelStyle } from './strategyFormStyles';

interface ScenarioInfo {
  label: string;
  shocks: Record<string, number>;
  description: string;
}

interface Props {
  selectedScenario: string;
  customShocks: Record<string, number>;
  currentScenario: ScenarioInfo | null;
  seedFromPortfolio: boolean;
  extraCashUsd: number;
  dcaUsdPerPeriod: number;
  dcaPeriodCount: number;
  onSelectScenario: (key: string, shocks: Record<string, number>) => void;
  onSelectCustom: () => void;
  onCustomShockChange: (id: string, value: number) => void;
  onSeedFromPortfolioChange: (checked: boolean) => void;
  onExtraCashChange: (value: number) => void;
  onDcaParamsChange: (usdPerPeriod: number, periodCount: number) => void;
  costModelPreset: 'none' | 'coinbase' | 'kraken';
  onCostModelPresetChange: (preset: 'none' | 'coinbase' | 'kraken') => void;
}

export function ScenarioLabPanel({
  selectedScenario,
  customShocks,
  currentScenario,
  seedFromPortfolio,
  extraCashUsd,
  dcaUsdPerPeriod,
  dcaPeriodCount,
  onSelectScenario,
  onSelectCustom,
  onCustomShockChange,
  onSeedFromPortfolioChange,
  onExtraCashChange,
  onDcaParamsChange,
  costModelPreset,
  onCostModelPresetChange,
}: Props) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <CostModelSelector costModelPreset={costModelPreset} onChange={onCostModelPresetChange} />
      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', marginBottom: '8px', fontWeight: 600 }}>SCENARIO</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {Object.keys(BUILT_IN_SCENARIOS).map((key) => {
          const s = BUILT_IN_SCENARIOS[key];
          const active = selectedScenario === key;
          return (
            <button
              key={key}
              onClick={() => onSelectScenario(key, s.shocks)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                border: active ? '2px solid var(--color-gold)' : '1px solid var(--color-border)',
                background: active ? 'var(--color-gold-dim)' : 'var(--color-surface2)',
                color: active ? 'var(--color-gold)' : 'var(--color-text)',
                fontSize: 'var(--font-xxs)',
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
              }}
              title={s.description}
            >
              {s.label}
            </button>
          );
        })}
        <button
          onClick={onSelectCustom}
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-full)',
            border: selectedScenario === 'custom' ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
            background: selectedScenario === 'custom' ? 'var(--color-accent-dim)' : 'var(--color-surface2)',
            color: selectedScenario === 'custom' ? 'var(--color-accent)' : 'var(--color-text)',
            fontSize: 'var(--font-xxs)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Custom shocks
        </button>
      </div>
      {selectedScenario === 'custom' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
          {SCENARIO_SHOCK_ASSETS.map((id) => (
            <div key={id} style={{ minWidth: 110, flex: '1 1 auto' }}>
              <label style={{ ...labelStyle, fontSize: 'var(--font-xxs)' }}>{id}</label>
              <input
                type="number"
                step="0.01"
                value={customShocks[id] ?? 1}
                onChange={(e) => onCustomShockChange(id, parseFloat(e.target.value) || 1)}
                style={{ ...inputStyle, padding: '4px 8px', fontSize: 'var(--font-xs)' }}
              />
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', marginTop: '6px' }}>
        {currentScenario?.description} — shocks are simple multipliers (with optional ramp in the runner).
      </div>

      <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed var(--color-border)' }}>
        <label style={{ fontSize: 'var(--font-xxs)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="checkbox"
            checked={seedFromPortfolio}
            onChange={(e) => onSeedFromPortfolioChange(e.target.checked)}
          />
          Seed from my portfolio
        </label>
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
          <input
            type="number"
            placeholder="Extra $"
            value={extraCashUsd}
            onChange={(e) => onExtraCashChange(parseFloat(e.target.value) || 0)}
            style={{ width: 80, fontSize: 'var(--font-xxs)' }}
          />
          <input
            type="number"
            placeholder="DCA $"
            value={dcaUsdPerPeriod}
            onChange={(e) => onDcaParamsChange(parseFloat(e.target.value) || 0, dcaPeriodCount)}
            style={{ width: 70, fontSize: 'var(--font-xxs)' }}
          />
          <input
            type="number"
            placeholder="periods"
            value={dcaPeriodCount}
            onChange={(e) => onDcaParamsChange(dcaUsdPerPeriod, parseInt(e.target.value) || 0)}
            style={{ width: 60, fontSize: 'var(--font-xxs)' }}
          />
        </div>
      </div>
    </div>
  );
}
