import { useState } from 'react';
import { useCorrelations } from '../hooks/useCorrelations';
import type { CorrelationPeriod } from '../types';

const PERIODS: CorrelationPeriod[] = ['1h', '1d', '7d', '30d'];

/**
 * Get gradient background for correlation value
 * Uses a diverging color scale centered at 0
 * -1 (red) → 0 (neutral) → +1 (blue/green)
 */
function getCorrelationStyle(value: number): { background: string; color: string } {
  if (value === 1) {
    // Perfect positive - diagonal only
    return { 
      background: 'rgba(124,92,252,0.3)', 
      color: '#fff' 
    };
  }
  
  if (value > 0) {
    // Positive correlation - blue/purple gradient
    const intensity = Math.pow(value, 0.7); // Non-linear for better visual distinction
    return {
      background: `linear-gradient(135deg, 
        rgba(124,92,252,${0.15 + intensity * 0.5}) 0%, 
        rgba(66,153,225,${0.1 + intensity * 0.4}) 100%)`,
      color: intensity > 0.5 ? '#fff' : 'var(--color-text)'
    };
  } else {
    // Negative correlation - red/pink gradient
    const intensity = Math.pow(Math.abs(value), 0.7);
    return {
      background: `linear-gradient(135deg, 
        rgba(255,94,125,${0.15 + intensity * 0.5}) 0%, 
        rgba(220,38,38,${0.1 + intensity * 0.4}) 100%)`,
      color: intensity > 0.5 ? '#fff' : 'var(--color-text)'
    };
  }
}

export function CorrelationMatrix() {
  const [period, setPeriod] = useState<CorrelationPeriod>('1d');
  const [hoveredCell, setHoveredCell] = useState<{i: number, j: number} | null>(null);
  const { assets, matrix } = useCorrelations(period);

  return (
    <section style={{ marginBottom: 'var(--space-2xl)' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 'var(--space-lg)', 
        flexWrap: 'wrap', 
        gap: '12px' 
      }}>
        <h2 className="section-heading">
          <span className="heading-icon">🔗</span>
          Correlation Matrix
        </h2>
        <div style={{ display: 'flex', gap: '6px' }}>
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="range-pill"
              aria-pressed={period === p}
              style={{
                background: period === p ? 'var(--color-accent)' : 'var(--color-surface2)',
                color: period === p ? '#fff' : 'var(--color-muted)',
                fontWeight: period === p ? 700 : 500,
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card" style={{
        padding: '20px',
        overflowX: 'auto',
      }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: '4px', width: '100%', minWidth: '320px' }}>
          <thead>
            <tr>
              <th style={{ 
                width: '70px', 
                padding: '8px', 
                fontSize: 'var(--font-xs)', 
                color: 'var(--color-muted)', 
                textAlign: 'left',
                fontWeight: 600
              }}></th>
              {assets.map((a) => (
                <th key={a} style={{ 
                  padding: '8px', 
                  fontSize: 'var(--font-xs)', 
                  color: 'var(--color-muted)', 
                  textAlign: 'center', 
                  fontWeight: 700,
                  letterSpacing: '0.03em'
                }}>
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={assets[i]}>
                <td style={{ 
                  padding: '8px', 
                  fontSize: 'var(--font-xs)', 
                  color: 'var(--color-text)', 
                  fontWeight: 700,
                  letterSpacing: '0.03em'
                }}>
                  {assets[i]}
                </td>
                {row.map((val, j) => {
                  const style = getCorrelationStyle(val);
                  const isHovered = hoveredCell?.i === i && hoveredCell?.j === j;
                  const isDiagonal = i === j;
                  
                  return (
                    <td key={j} style={{ padding: '2px', textAlign: 'center' }}>
                      <div
                        onMouseEnter={() => setHoveredCell({i, j})}
                        onMouseLeave={() => setHoveredCell(null)}
                        title={`${assets[i]} vs ${assets[j]}: ${val.toFixed(3)}`}
                        style={{
                          background: style.background,
                          borderRadius: 'var(--radius-md)',
                          padding: '10px 6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: style.color,
                          minWidth: '52px',
                          display: 'inline-block',
                          opacity: isDiagonal ? 0.4 : 1,
                          transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                          boxShadow: isHovered ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                          cursor: 'default',
                          border: isHovered ? '1px solid var(--color-border)' : '1px solid transparent',
                        }}
                      >
                        {val.toFixed(2)}
                      </div>
                      {/* Tooltip showing exact value */}
                      {isHovered && !isDiagonal && (
                        <div style={{
                          position: 'absolute',
                          transform: 'translateY(-100%)',
                          background: 'var(--color-surface2)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '4px 8px',
                          fontSize: '0.7rem',
                          color: 'var(--color-text)',
                          zIndex: 10,
                          pointerEvents: 'none',
                          marginTop: '-8px',
                          boxShadow: 'var(--shadow-md)',
                          whiteSpace: 'nowrap'
                        }}>
                          {assets[i]} vs {assets[j]}: {val.toFixed(4)}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ 
          marginTop: '16px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          fontSize: 'var(--font-xs)', 
          color: 'var(--color-muted)', 
          flexWrap: 'wrap',
          paddingTop: '12px',
          borderTop: '1px solid var(--color-border)'
        }}>
          <span style={{ fontWeight: 600 }}>Legend:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ 
              width: '24px', 
              height: '12px', 
              borderRadius: '4px', 
              background: 'linear-gradient(135deg, rgba(255,94,125,0.6) 0%, rgba(220,38,38,0.5) 100%)' 
            }} />
            <span>-1 Inverse</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ 
              width: '24px', 
              height: '12px', 
              borderRadius: '4px', 
              background: 'linear-gradient(135deg, rgba(124,92,252,0.6) 0%, rgba(66,153,225,0.5) 100%)' 
            }} />
            <span>+1 Synced</span>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>
            Auto-updates every 60s
            {period === '1h' && ' · 1h uses limited hourly samples'}
            {period === '30d' && ' · 30d uses 7d sparkline data'}
          </span>
        </div>
      </div>
    </section>
  );
}
