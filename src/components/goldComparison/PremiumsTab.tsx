import { useMemo } from 'react';
import { usePriceStore } from '@/store/priceStore';
import { GOLD_FORMS } from './constants';

export function PremiumsTab() {
  const { prices, goldSpot } = usePriceStore();

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

  const eaglePrice = premiumsData.find((f) => f.id === 'eagle')?.calcPrice ?? 0;
  const kiloBarPrice = premiumsData.find((f) => f.id === 'kilo-bar')?.calcPrice ?? 0;
  const savingsPerOz = (eaglePrice - kiloBarPrice).toFixed(2);

  return (
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

      <div style={{ overflowX: 'auto' }}>
        <table
          className="table-zebra"
          style={{ width: '100%', borderCollapse: 'collapse' }}
          aria-label="Gold form premium comparison table"
        >
          <thead>
            <tr>
              {['Gold Form', 'Unit', 'Price / oz', 'Premium $', 'Premium %', 'Note'].map((header, i) => (
                <th key={header} style={{
                  textAlign: i === 0 || i === 5 ? 'left' : 'right',
                  padding: '10px 12px',
                  fontSize: 'var(--font-xs)',
                  color: 'var(--color-muted)',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid var(--color-border)',
                  whiteSpace: 'nowrap',
                }}>
                  {header}
                </th>
              ))}
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
                  <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
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
    </div>
  );
}
