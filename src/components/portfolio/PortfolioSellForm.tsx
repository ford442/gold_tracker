import { useMemo, type CSSProperties, type FormEvent } from 'react';
import type { CostBasisMethod, PortfolioEntry, PortfolioLot } from '@/types';
import { ensureEntryLots } from '@lib/portfolioLots';
import { formatPrice } from '@lib/utils';

interface Props {
  entry: PortfolioEntry;
  method: CostBasisMethod;
  onCancel: () => void;
  onSell: (units: number, salePrice: number, specLotIds?: string[]) => void;
  defaultSalePrice: number;
}

export function PortfolioSellForm({
  entry,
  method,
  onCancel,
  onSell,
  defaultSalePrice,
}: Props) {
  const lots = useMemo(() => ensureEntryLots(entry).lots ?? [], [entry]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const unitsRaw = fd.get('units');
    const salePriceRaw = fd.get('salePrice');
    const units = parseFloat(typeof unitsRaw === 'string' ? unitsRaw : '');
    const salePrice = parseFloat(typeof salePriceRaw === 'string' ? salePriceRaw : '');
    if (!Number.isFinite(units) || units <= 0 || units > entry.amount) return;
    if (!Number.isFinite(salePrice) || salePrice < 0) return;

    let specLotIds: string[] | undefined;
    if (method === 'SpecID') {
      specLotIds = lots
        .filter((l) => fd.get(`lot-${l.id}`) === 'on')
        .map((l) => l.id);
      if (specLotIds.length === 0) return;
    }

    onSell(units, salePrice, specLotIds);
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: 'var(--color-surface2)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '16px',
        marginBottom: 'var(--space-md)',
      }}
      aria-label={`Sell ${entry.symbol} position`}
    >
      <div
        style={{
          fontSize: 'var(--font-sm)',
          fontWeight: 700,
          color: 'var(--color-gold)',
          marginBottom: '12px',
        }}
      >
        Sell {entry.symbol} · {entry.amount} available · {method} basis
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          alignItems: 'end',
          marginBottom: method === 'SpecID' ? '14px' : 0,
        }}
      >
        <div>
          <label
            htmlFor="sell-units"
            style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--color-muted)',
              display: 'block',
              marginBottom: '4px',
            }}
          >
            Units to sell
          </label>
          <input
            id="sell-units"
            name="units"
            type="number"
            min="0"
            max={entry.amount}
            step="any"
            defaultValue={Math.min(1, entry.amount)}
            required
            style={inputStyle}
          />
        </div>
        <div>
          <label
            htmlFor="sell-price"
            style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--color-muted)',
              display: 'block',
              marginBottom: '4px',
            }}
          >
            Sale price (USD/unit)
          </label>
          <input
            id="sell-price"
            name="salePrice"
            type="number"
            min="0"
            step="any"
            defaultValue={defaultSalePrice > 0 ? defaultSalePrice : ''}
            required
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="submit" style={submitStyle}>
            Record sale
          </button>
          <button type="button" onClick={onCancel} style={cancelStyle}>
            Cancel
          </button>
        </div>
      </div>

      {method === 'SpecID' && lots.length > 0 && (
        <LotPicker lots={lots} />
      )}
    </form>
  );
}

function LotPicker({ lots }: { lots: PortfolioLot[] }) {
  return (
    <div style={{ marginTop: '12px' }}>
      <div
        style={{
          fontSize: 'var(--font-xs)',
          color: 'var(--color-muted)',
          marginBottom: '8px',
          fontWeight: 600,
        }}
      >
        Select lots (SpecID) — consumed top to bottom
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {lots.map((lot) => (
          <label
            key={lot.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: 'var(--font-xs)',
              color: 'var(--color-text)',
              cursor: 'pointer',
            }}
          >
            <input type="checkbox" name={`lot-${lot.id}`} />
            <span>
              {lot.units} @ {formatPrice(lot.costPerUnit)} ·{' '}
              {new Date(lot.acquiredAt).toLocaleDateString()}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: 'var(--font-sm)',
};

const submitStyle: CSSProperties = {
  padding: '8px 14px',
  borderRadius: 'var(--radius-sm)',
  border: 'none',
  background: 'var(--color-gold)',
  color: '#000',
  fontWeight: 700,
  fontSize: 'var(--font-xs)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const cancelStyle: CSSProperties = {
  padding: '8px 14px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'transparent',
  color: 'var(--color-muted)',
  fontWeight: 600,
  fontSize: 'var(--font-xs)',
  cursor: 'pointer',
};
