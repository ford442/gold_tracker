import { totalFineGoldOz } from '@lib/portfolioLots';
import { GOLD_SLEEVE_ASSET_IDS, resolvePortfolioAssetId } from '@lib/assets';
import type { PortfolioEntry } from '@/types';

interface Props {
  entries: PortfolioEntry[];
}

function formatOz(oz: number): string {
  if (oz < 0.0001) return '0';
  if (oz < 1) return oz.toFixed(4);
  return oz.toFixed(2);
}

export function PortfolioGoldOzWidget({ entries }: Props) {
  const totalOz = totalFineGoldOz(entries);

  const byAsset = GOLD_SLEEVE_ASSET_IDS.map((assetId) => {
    const symbol =
      assetId === 'gold' ? 'XAU' : assetId === 'pax-gold' ? 'PAXG' : 'XAUT';
    const units = entries
      .filter((e) => resolvePortfolioAssetId(e.symbol) === assetId)
      .reduce((s, e) => s + e.amount, 0);
    return { symbol, units };
  }).filter((row) => row.units > 1e-10);

  if (totalOz <= 0) return null;

  return (
    <div
      className="glass-card-gold"
      style={{
        padding: '18px 20px',
        marginBottom: 'var(--space-lg)',
      }}
      aria-label="Total fine gold ounces"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--color-muted)',
              marginBottom: '4px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Total Fine Gold (est.)
          </div>
          <div
            style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              color: 'var(--color-gold-bright)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatOz(totalOz)} troy oz
          </div>
          <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', marginTop: '6px' }}>
            XAU + PAXG + XAUT · 1 unit ≈ 1 fine troy oz (model assumption)
          </div>
        </div>
        {byAsset.length > 0 && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {byAsset.map((row) => (
              <div
                key={row.symbol}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-gold-dim)',
                  border: '1px solid var(--color-border)',
                  minWidth: '72px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', fontWeight: 600 }}>
                  {row.symbol}
                </div>
                <div
                  style={{
                    fontSize: 'var(--font-sm)',
                    fontWeight: 700,
                    color: 'var(--color-gold)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatOz(row.units)} oz
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
