import { useState } from 'react';
import type { AssetId } from '@lib/assets';
import { ASSETS, GOLD_SLEEVE_ASSET_IDS, STRATEGY_MR_ASSET_IDS } from '@lib/assets';
import type {
  AlertRule,
  AlertRuleType,
  GoldPremiumMode,
} from '@lib/alertRules';
import { describeRule } from '@lib/alertRules';
import type { AnalysisHorizon } from '@/types';

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface2)',
  color: 'var(--color-text)',
  fontSize: 'var(--font-sm)',
} as const;

const labelStyle = {
  display: 'block',
  fontSize: 'var(--font-xs)',
  color: 'var(--color-muted)',
  marginBottom: '6px',
  fontWeight: 500,
} as const;

interface Props {
  initial?: AlertRule;
  onSave: (rule: AlertRule) => void;
  onCancel: () => void;
}

function newRuleId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyRule(type: AlertRuleType): AlertRule {
  const now = Date.now();
  const base = {
    id: newRuleId(),
    name: '',
    enabled: true,
    cooldownMinutes: 5,
    delivery: { browser: true, toast: true, inApp: true },
    createdAt: now,
    updatedAt: now,
  };
  switch (type) {
    case 'spread':
      return { ...base, type, name: 'Spread alert', assetA: 'pax-gold', assetB: 'tether-gold', thresholdPct: 0.5 };
    case 'price_cross':
      return { ...base, type, name: 'Price cross', asset: 'pax-gold', level: 3300, direction: 'above' };
    case 'fidelity':
      return { ...base, type, name: 'Fidelity drop', asset: 'pax-gold', threshold: 50, horizon: '30d' as AnalysisHorizon };
    case 'gold_premium':
      return { ...base, type, name: 'Gold premium', asset: 'pax-gold', thresholdPct: 0.8, mode: 'either' as GoldPremiumMode };
  }
}

const SPREAD_ASSETS = STRATEGY_MR_ASSET_IDS.filter((id) => id === 'pax-gold' || id === 'tether-gold' || id === 'bitcoin' || id === 'ethereum');
const PRICE_ASSETS = [...GOLD_SLEEVE_ASSET_IDS, 'bitcoin', 'ethereum'] as AssetId[];

export function AlertRuleForm({ initial, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<AlertRule>(() => initial ?? emptyRule('spread'));

  const patch = (partial: Partial<AlertRule>) => {
    setDraft((prev) => ({ ...prev, ...partial, updatedAt: Date.now() } as AlertRule));
  };

  const handleTypeChange = (type: AlertRuleType) => {
    const kept = {
      id: draft.id,
      name: draft.name,
      enabled: draft.enabled,
      cooldownMinutes: draft.cooldownMinutes,
      quietHours: draft.quietHours,
      delivery: draft.delivery,
      createdAt: draft.createdAt,
      updatedAt: Date.now(),
    };
    setDraft({ ...emptyRule(type), ...kept } as AlertRule);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = draft.name.trim() || describeRule(draft);
    onSave({ ...draft, name, updatedAt: Date.now() });
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '16px', marginBottom: '12px' }}>
      <div style={{ display: 'grid', gap: '12px' }}>
        <div>
          <label style={labelStyle}>Rule name</label>
          <input
            style={inputStyle}
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="e.g. PAXG/XAUT wide spread"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Type</label>
            <select
              style={inputStyle}
              value={draft.type}
              onChange={(e) => handleTypeChange(e.target.value as AlertRuleType)}
            >
              <option value="spread">Spread (A vs B)</option>
              <option value="price_cross">Price crosses level</option>
              <option value="fidelity">Fidelity score</option>
              <option value="gold_premium">Gold premium/discount</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Cooldown (minutes)</label>
            <input
              type="number"
              min={0}
              step={1}
              style={inputStyle}
              value={draft.cooldownMinutes}
              onChange={(e) => patch({ cooldownMinutes: Math.max(0, Number(e.target.value)) })}
            />
          </div>
        </div>

        {draft.type === 'spread' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Asset A</label>
              <select
                style={inputStyle}
                value={draft.assetA}
                onChange={(e) => patch({ assetA: e.target.value as AssetId })}
              >
                {SPREAD_ASSETS.map((id) => (
                  <option key={id} value={id}>{ASSETS[id].symbol}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Asset B</label>
              <select
                style={inputStyle}
                value={draft.assetB}
                onChange={(e) => patch({ assetB: e.target.value as AssetId })}
              >
                {SPREAD_ASSETS.map((id) => (
                  <option key={id} value={id}>{ASSETS[id].symbol}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Threshold %</label>
              <input
                type="number"
                min={0}
                step={0.01}
                style={inputStyle}
                value={draft.thresholdPct}
                onChange={(e) => patch({ thresholdPct: Number(e.target.value) })}
              />
            </div>
          </div>
        )}

        {draft.type === 'price_cross' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Asset</label>
              <select
                style={inputStyle}
                value={draft.asset}
                onChange={(e) => patch({ asset: e.target.value as AssetId })}
              >
                {PRICE_ASSETS.map((id) => (
                  <option key={id} value={id}>{ASSETS[id].symbol}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Level ($)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                style={inputStyle}
                value={draft.level}
                onChange={(e) => patch({ level: Number(e.target.value) })}
              />
            </div>
            <div>
              <label style={labelStyle}>Direction</label>
              <select
                style={inputStyle}
                value={draft.direction}
                onChange={(e) => patch({ direction: e.target.value as 'above' | 'below' | 'either' })}
              >
                <option value="above">Cross above</option>
                <option value="below">Cross below</option>
                <option value="either">Either</option>
              </select>
            </div>
          </div>
        )}

        {draft.type === 'fidelity' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Token</label>
              <select
                style={inputStyle}
                value={draft.asset}
                onChange={(e) => patch({ asset: e.target.value as 'pax-gold' | 'tether-gold' })}
              >
                <option value="pax-gold">PAXG</option>
                <option value="tether-gold">XAUT</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Alert when score &lt;</label>
              <input
                type="number"
                min={0}
                max={100}
                style={inputStyle}
                value={draft.threshold}
                onChange={(e) => patch({ threshold: Number(e.target.value) })}
              />
            </div>
            <div>
              <label style={labelStyle}>Horizon (label only)</label>
              <select
                style={inputStyle}
                value={draft.horizon}
                onChange={(e) => patch({ horizon: e.target.value as AnalysisHorizon })}
              >
                <option value="30d">30D</option>
                <option value="90d">90D</option>
                <option value="1y">1Y</option>
                <option value="max">MAX</option>
              </select>
            </div>
          </div>
        )}

        {draft.type === 'gold_premium' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Token</label>
              <select
                style={inputStyle}
                value={draft.asset}
                onChange={(e) => patch({ asset: e.target.value as 'pax-gold' | 'tether-gold' })}
              >
                <option value="pax-gold">PAXG</option>
                <option value="tether-gold">XAUT</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Threshold %</label>
              <input
                type="number"
                min={0}
                step={0.01}
                style={inputStyle}
                value={draft.thresholdPct}
                onChange={(e) => patch({ thresholdPct: Number(e.target.value) })}
              />
            </div>
            <div>
              <label style={labelStyle}>Mode</label>
              <select
                style={inputStyle}
                value={draft.mode}
                onChange={(e) => patch({ mode: e.target.value as GoldPremiumMode })}
              >
                <option value="either">Premium or discount</option>
                <option value="premium">Premium only</option>
                <option value="discount">Discount only</option>
              </select>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Quiet hours start (optional)</label>
            <input
              type="time"
              style={inputStyle}
              value={draft.quietHours?.start ?? ''}
              onChange={(e) => {
                const start = e.target.value;
                if (!start) patch({ quietHours: undefined });
                else patch({ quietHours: { start, end: draft.quietHours?.end ?? '07:00' } });
              }}
            />
          </div>
          <div>
            <label style={labelStyle}>Quiet hours end</label>
            <input
              type="time"
              style={inputStyle}
              value={draft.quietHours?.end ?? ''}
              onChange={(e) => {
                const end = e.target.value;
                if (!draft.quietHours?.start && !end) patch({ quietHours: undefined });
                else patch({ quietHours: { start: draft.quietHours?.start ?? '22:00', end } });
              }}
            />
          </div>
        </div>

        <fieldset style={{ border: 'none', padding: 0 }}>
          <legend style={{ ...labelStyle, marginBottom: '8px' }}>Delivery channels</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {(['inApp', 'toast', 'browser'] as const).map((ch) => (
              <label key={ch} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-sm)' }}>
                <input
                  type="checkbox"
                  checked={draft.delivery[ch]}
                  onChange={(e) =>
                    patch({ delivery: { ...draft.delivery, [ch]: e.target.checked } })
                  }
                />
                {ch === 'inApp' ? 'In-app feed' : ch === 'toast' ? 'Toast' : 'Browser notification'}
              </label>
            ))}
          </div>
        </fieldset>

        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', margin: 0 }}>
          Preview: {describeRule(draft)}
        </p>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-muted)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'var(--color-gold)',
              color: '#1a1a1a',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Save rule
          </button>
        </div>
      </div>
    </form>
  );
}
