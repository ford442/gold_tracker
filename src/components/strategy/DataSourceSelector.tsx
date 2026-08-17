import type { HistoricalRange, TickSource } from '@lib/historicalTicks';
import { HISTORICAL_RANGE_CONFIG } from '@lib/historicalTicks';

interface Props {
  tickSource: TickSource;
  historicalRange: HistoricalRange;
  historicalFallbackNotice: string | null;
  onTickSourceChange: (source: TickSource) => void;
  onHistoricalRangeChange: (range: HistoricalRange) => void;
}

const RANGES: HistoricalRange[] = ['7d', '30d', '90d'];

export function DataSourceSelector({
  tickSource,
  historicalRange,
  historicalFallbackNotice,
  onTickSourceChange,
  onHistoricalRangeChange,
}: Props) {
  const isHistorical = tickSource === 'historical';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--glass-bg, rgba(255, 255, 255, 0.03))',
        border: '1px solid var(--color-border)',
        marginBottom: '20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Source Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', fontWeight: 600 }}>
            DATA SOURCE:
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => onTickSourceChange('historical')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                border: isHistorical
                  ? '2px solid var(--color-gold, #f0c845)'
                  : '2px solid var(--color-border)',
                background: isHistorical
                  ? 'var(--color-gold-dim, rgba(240, 200, 69, 0.15))'
                  : 'transparent',
                color: isHistorical ? 'var(--color-gold, #f0c845)' : 'var(--color-muted)',
                fontWeight: isHistorical ? 700 : 500,
                fontSize: 'var(--font-xs)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              📊 Historical (CoinGecko)
            </button>

            <button
              type="button"
              onClick={() => onTickSourceChange('synthetic')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                border: !isHistorical
                  ? '2px solid var(--color-accent, #7c5cfc)'
                  : '2px solid var(--color-border)',
                background: !isHistorical
                  ? 'var(--color-accent-dim, rgba(124, 92, 252, 0.15))'
                  : 'transparent',
                color: !isHistorical ? 'var(--color-accent, #7c5cfc)' : 'var(--color-muted)',
                fontWeight: !isHistorical ? 700 : 500,
                fontSize: 'var(--font-xs)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              🧪 Synthetic (Mock)
            </button>
          </div>
        </div>

        {/* Range Selector (Historical mode only) */}
        {isHistorical && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', fontWeight: 600 }}>
              HORIZON:
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {RANGES.map((r) => {
                const active = historicalRange === r;
                const label = HISTORICAL_RANGE_CONFIG[r]?.label ?? r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onHistoricalRangeChange(r)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm, 6px)',
                      border: active
                        ? '1px solid var(--color-gold, #f0c845)'
                        : '1px solid var(--color-border)',
                      background: active
                        ? 'var(--color-gold-dim, rgba(240, 200, 69, 0.15))'
                        : 'transparent',
                      color: active ? 'var(--color-gold, #f0c845)' : 'var(--color-muted)',
                      fontSize: 'var(--font-xxs)',
                      fontWeight: active ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Info / Fallback Notice Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: 'var(--radius-sm, 6px)',
          background: historicalFallbackNotice
            ? 'var(--color-gold-dim, rgba(240, 200, 69, 0.12))'
            : isHistorical
              ? 'var(--color-green-dim, rgba(0, 219, 166, 0.08))'
              : 'rgba(255, 255, 255, 0.02)',
          border: `1px solid ${
            historicalFallbackNotice
              ? 'rgba(240, 200, 69, 0.3)'
              : isHistorical
                ? 'rgba(0, 219, 166, 0.2)'
                : 'var(--color-border)'
          }`,
          fontSize: 'var(--font-xs)',
          color: historicalFallbackNotice
            ? 'var(--color-gold, #f0c845)'
            : isHistorical
              ? 'var(--color-green, #00dba6)'
              : 'var(--color-muted)',
        }}
      >
        <span>
          {historicalFallbackNotice ? '⚠️' : isHistorical ? '🟢' : 'ℹ️'}
        </span>
        <div style={{ flex: 1 }}>
          {historicalFallbackNotice ? (
            <span>
              <strong>Fallback Notice:</strong> {historicalFallbackNotice}
            </span>
          ) : isHistorical ? (
            <span>
              Real CoinGecko price path ({HISTORICAL_RANGE_CONFIG[historicalRange]?.label}) aligned via shared cache · Backtest simulation only (NFA).
            </span>
          ) : (
            <span>
              Synthetic geometric random-walk / mean-reverting path (720 ticks) · Backtest simulation only (NFA).
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
