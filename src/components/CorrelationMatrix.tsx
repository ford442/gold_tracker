import { useState } from 'react';
import { useCorrelations } from '../hooks/useCorrelations';
import { correlationColor } from '../lib/utils';
import type { CorrelationPeriod } from '../types';

const PERIODS: CorrelationPeriod[] = ['1h', '1d', '7d', '30d'];

export function CorrelationMatrix() {
  const [period, setPeriod] = useState<CorrelationPeriod>('1d');
  const { assets, matrix } = useCorrelations(period);

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text)' }}>
          🔗 Correlation Matrix
        </h2>
        <div style={{ display: 'flex', gap: '6px' }}>
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                background: period === p ? 'var(--color-accent)' : 'var(--color-surface2)',
                color: period === p ? '#fff' : 'var(--color-muted)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: period === p ? 700 : 400,
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '12px',
        padding: '16px',
        overflowX: 'auto',
      }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '300px' }}>
          <thead>
            <tr>
              <th style={{ width: '70px', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--color-muted)', textAlign: 'left' }}></th>
              {assets.map((a) => (
                <th key={a} style={{ padding: '6px 8px', fontSize: '0.75rem', color: 'var(--color-muted)', textAlign: 'center', fontWeight: 600 }}>
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={assets[i]}>
                <td style={{ padding: '6px 8px', fontSize: '0.75rem', color: 'var(--color-text)', fontWeight: 600 }}>
                  {assets[i]}
                </td>
                {row.map((val, j) => (
                  <td key={j} style={{ padding: '4px 6px', textAlign: 'center' }}>
                    <div
                      title={`${assets[i]} vs ${assets[j]}: ${val.toFixed(3)}`}
                      style={{
                        background: correlationColor(val),
                        borderRadius: '6px',
                        padding: '6px 4px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#fff',
                        minWidth: '44px',
                        display: 'inline-block',
                        opacity: i === j ? 0.5 : 1,
                      }}
                    >
                      {val.toFixed(2)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: 'var(--color-muted)', flexWrap: 'wrap' }}>
          <span>Legend:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '20px', height: '10px', borderRadius: '3px', background: 'rgb(255,94,125)' }} />
            <span>-1 Inverse</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '20px', height: '10px', borderRadius: '3px', background: 'rgb(66,153,225)' }} />
            <span>+1 Synced</span>
          </div>
          <span style={{ marginLeft: 'auto' }}>
            Auto-updates every 60s
            {period === '30d' && ' · 30d uses 7d sparkline data (free API limit)'}
          </span>
        </div>
      </div>
    </section>
  );
}
