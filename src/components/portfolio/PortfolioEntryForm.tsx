import { ASSETS, PORTFOLIO_ASSET_IDS } from '@lib/assets';
import type { PortfolioFormState } from './portfolioUtils';

interface Props {
  form: PortfolioFormState;
  editingId: string | null;
  onFormChange: (form: PortfolioFormState) => void;
  onSubmit: () => void;
}

export function PortfolioEntryForm({ form, editingId, onFormChange, onSubmit }: Props) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: `2px solid ${editingId ? 'var(--color-gold)' : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        marginBottom: 'var(--space-lg)',
      }}
    >
      {editingId && (
        <div
          style={{
            fontSize: 'var(--font-xs)',
            color: 'var(--color-gold)',
            marginBottom: '12px',
            fontWeight: 600,
          }}
        >
          ✏️ Editing position
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '14px',
          alignItems: 'end',
        }}
      >
        <div>
          <label
            style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--color-muted)',
              display: 'block',
              marginBottom: '6px',
              fontWeight: 500,
            }}
          >
            Asset
          </label>
          <select
            value={form.assetId}
            onChange={(e) => onFormChange({ ...form, assetId: e.target.value })}
            aria-label="Select asset"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface2)',
              color: 'var(--color-text)',
              fontSize: 'var(--font-base)',
            }}
          >
            {PORTFOLIO_ASSET_IDS.map((id) => {
              const a = ASSETS[id];
              return (
                <option key={a.id} value={a.id}>
                  {a.symbol} — {a.name}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label
            style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--color-muted)',
              display: 'block',
              marginBottom: '6px',
              fontWeight: 500,
            }}
          >
            Amount
          </label>
          <input
            type="number"
            min="0"
            step="any"
            value={form.amount}
            onChange={(e) => onFormChange({ ...form, amount: e.target.value })}
            placeholder="e.g. 2.5"
            aria-label="Amount"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface2)',
              color: 'var(--color-text)',
              fontSize: 'var(--font-base)',
            }}
          />
        </div>
        <div>
          <label
            style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--color-muted)',
              display: 'block',
              marginBottom: '6px',
              fontWeight: 500,
            }}
          >
            Buy Price (USD)
          </label>
          <input
            type="number"
            min="0"
            step="any"
            value={form.buyPrice}
            onChange={(e) => onFormChange({ ...form, buyPrice: e.target.value })}
            placeholder="e.g. 3200"
            aria-label="Buy price in USD"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface2)',
              color: 'var(--color-text)',
              fontSize: 'var(--font-base)',
            }}
          />
        </div>
        <button
          onClick={onSubmit}
          aria-label={editingId ? 'Save changes' : 'Add position'}
          style={{
            padding: '10px 20px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: editingId ? 'var(--color-gold)' : 'var(--color-green)',
            color: editingId ? '#000' : '#fff',
            cursor: 'pointer',
            fontSize: 'var(--font-base)',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          {editingId ? '💾 Save' : '➕ Add'}
        </button>
      </div>
    </div>
  );
}
