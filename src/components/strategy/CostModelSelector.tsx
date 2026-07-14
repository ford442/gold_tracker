import { COST_MODEL_OPTIONS } from './constants';

interface Props {
  costModelPreset: 'none' | 'coinbase' | 'kraken';
  onChange: (preset: 'none' | 'coinbase' | 'kraken') => void;
}

export function CostModelSelector({ costModelPreset, onChange }: Props) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', marginBottom: '8px', fontWeight: 600 }}>
        FEE PROFILE
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {COST_MODEL_OPTIONS.map((opt) => {
          const active = costModelPreset === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                border: active ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                background: active ? 'var(--color-accent-dim)' : 'var(--color-surface2)',
                color: active ? 'var(--color-accent)' : 'var(--color-text)',
                fontSize: 'var(--font-xxs)',
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
              }}
              title={opt.description}
            >
              {opt.label}
              <span style={{ marginLeft: '6px', opacity: 0.75 }}>({opt.feeLabel})</span>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', marginTop: '6px' }}>
        {COST_MODEL_OPTIONS.find((o) => o.id === costModelPreset)?.description}
        {' — '}
        simulations are gross of real-world slippage unless a fee profile is selected. Not financial advice.
      </div>
    </div>
  );
}
