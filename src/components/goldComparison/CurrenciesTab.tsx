import { useMemo } from 'react';
import { usePriceStore } from '@/store/priceStore';
import { CURRENCIES } from './constants';
import { formatCurrencyAmount } from './helpers';

export function CurrenciesTab() {
  const { prices, goldSpot } = usePriceStore();

  const spotPrice = goldSpot?.price ?? prices['pax-gold']?.price ?? 3290;

  const currencyData = useMemo(() => {
    return CURRENCIES.map((c) => ({
      ...c,
      goldPriceInCurrency: spotPrice / c.rateToUsd,
      change24h: goldSpot?.change24h ?? 0,
      ouncesPerUnit: c.rateToUsd / spotPrice,
    }));
  }, [spotPrice, goldSpot?.change24h]);

  return (
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
              {['Currency', 'Price / oz', '24h Change', 'FX Rate (vs USD)', 'Grams per 100 units'].map((header, i) => (
                <th key={header} style={{
                  textAlign: i === 0 ? 'left' : 'right',
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
  );
}
