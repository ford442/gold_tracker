import { useMemo } from 'react';
import { useCounterfactual } from '@/hooks/useCounterfactual';
import { CounterfactualChart } from '@components/counterfactual/CounterfactualChart';
import { CounterfactualStatCards } from '@components/counterfactual/CounterfactualStatCards';
import { ASSETS, resolvePortfolioAssetId } from '@lib/assets';
import { type CounterfactualPresetRange, COUNTERFACTUAL_RANGE_DAYS } from '@lib/counterfactual';
import { formatPrice } from '@lib/utils';

const SELECTABLE_ASSETS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', icon: '₿' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', icon: 'Ξ' },
  { id: 'pax-gold', symbol: 'PAXG', name: 'PAX Gold', icon: '🪙' },
  { id: 'tether-gold', symbol: 'XAUT', name: 'Tether Gold', icon: '🟡' },
  { id: 'bitcoin-cash', symbol: 'BCH', name: 'Bitcoin Cash', icon: 'BCH' },
  { id: 'usd', symbol: 'USD', name: 'US Dollar (Cash)', icon: '💵' },
];

const HORIZON_PRESETS: CounterfactualPresetRange[] = ['7d', '14d', '30d', '60d', '90d', '180d', '1y'];

export function CounterfactualTradeExplorer() {
  const {
    fromAsset,
    toAsset,
    fromAmount,
    selectedRange,
    costPreset,
    isExpanded,
    curPriceFrom,
    curPriceTo,
    evaluation,
    isLoading,
    error,
    portfolioEntries,
    setFromAsset,
    setToAsset,
    setFromAmount,
    setSelectedRange,
    setCostPreset,
    setIsExpanded,
    flipAssets,
    loadPreset,
    seedFromHolding,
  } = useCounterfactual();

  const fromSymbol = fromAsset === 'usd' ? 'USD' : (ASSETS[fromAsset as keyof typeof ASSETS]?.symbol ?? fromAsset.toUpperCase());
  const toSymbol = toAsset === 'usd' ? 'USD' : (ASSETS[toAsset as keyof typeof ASSETS]?.symbol ?? toAsset.toUpperCase());

  // Find if user has a holding for fromAsset
  const matchingHolding = useMemo(() => {
    return portfolioEntries.find((e) => resolvePortfolioAssetId(e.symbol) === fromAsset);
  }, [portfolioEntries, fromAsset]);

  return (
    <div className="glass-card" style={{ padding: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div>
          <h3 className="section-heading" style={{ margin: 0 }}>
            <span className="heading-icon">🔮</span> Counterfactual Trade Explorer
          </h3>
          <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', margin: '4px 0 0 0' }}>
            What-If Simulator: Evaluate what your crypto or gold would be worth today if you had made different trades.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface2)',
            color: 'var(--color-text)',
            fontSize: 'var(--font-xs)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {isExpanded ? '▲ Collapse' : '▼ Expand Simulator'}
        </button>
      </div>

      {isExpanded && (
        <>
          {/* Quick Preset Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
              marginBottom: '16px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--color-border)',
            }}
          >
            <span style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', fontWeight: 700 }}>
              PRESETS:
            </span>
            <button
              type="button"
              onClick={() => loadPreset('bitcoin', 'pax-gold', 0.25, '30d')}
              className="range-pill"
              style={{ fontSize: 'var(--font-xxs)', padding: '4px 10px' }}
            >
              ⚡ 0.25 BTC ➔ PAXG (30d)
            </button>
            <button
              type="button"
              onClick={() => loadPreset('ethereum', 'tether-gold', 1.0, '14d')}
              className="range-pill"
              style={{ fontSize: 'var(--font-xxs)', padding: '4px 10px' }}
            >
              ⚡ 1.0 ETH ➔ XAUT (14d)
            </button>
            <button
              type="button"
              onClick={() => loadPreset('pax-gold', 'bitcoin', 5.0, '60d')}
              className="range-pill"
              style={{ fontSize: 'var(--font-xxs)', padding: '4px 10px' }}
            >
              ⚡ 5.0 PAXG ➔ BTC (60d)
            </button>
            <button
              type="button"
              onClick={() => loadPreset('usd', 'pax-gold', 5000, '90d')}
              className="range-pill"
              style={{ fontSize: 'var(--font-xxs)', padding: '4px 10px' }}
            >
              ⚡ $5,000 USD ➔ PAXG (90d)
            </button>
          </div>

          {/* Portfolio Seed Chips (if user has actual holdings) */}
          {portfolioEntries.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                marginBottom: '16px',
                fontSize: 'var(--font-xs)',
              }}
            >
              <span style={{ color: 'var(--color-muted)', fontWeight: 600 }}>My Portfolio:</span>
              {portfolioEntries.map((e) => {
                const assetId = resolvePortfolioAssetId(e.symbol);
                const isSelected = fromAsset === assetId;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => seedFromHolding(e.id, 1.0)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm, 6px)',
                      border: isSelected ? '1px solid var(--color-gold)' : '1px solid var(--color-border)',
                      background: isSelected ? 'var(--color-gold-dim)' : 'var(--color-surface2)',
                      color: isSelected ? 'var(--color-gold)' : 'var(--color-text)',
                      fontSize: 'var(--font-xxs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    💼 Load My {e.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {e.symbol.toUpperCase()}
                  </button>
                );
              })}
            </div>
          )}

          {/* Trade Builder Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '14px',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface2, rgba(255, 255, 255, 0.03))',
              border: '1px solid var(--color-border)',
              marginBottom: '16px',
            }}
          >
            {/* From Asset */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', fontWeight: 600, marginBottom: '6px' }}>
                FROM ASSET (SOLD)
              </label>
              <select
                value={fromAsset}
                onChange={(e) => setFromAsset(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {SELECTABLE_ASSETS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.icon} {a.name} ({a.symbol})
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', marginTop: '4px' }}>
                Now: {formatPrice(curPriceFrom)}
              </div>
            </div>

            {/* Swap Button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={flipAssets}
                title="Swap Direction"
                style={{
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontSize: 'var(--font-base)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                ⇄
              </button>
            </div>

            {/* To Asset */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', fontWeight: 600, marginBottom: '6px' }}>
                TO ASSET (BOUGHT)
              </label>
              <select
                value={toAsset}
                onChange={(e) => setToAsset(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {SELECTABLE_ASSETS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.icon} {a.name} ({a.symbol})
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', marginTop: '4px' }}>
                Now: {formatPrice(curPriceTo)}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', fontWeight: 600, marginBottom: '6px' }}>
                AMOUNT TO SWAP ({fromSymbol})
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  value={fromAmount || ''}
                  onChange={(e) => setFromAmount(parseFloat(e.target.value) || 0)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    fontSize: 'var(--font-sm)',
                    fontWeight: 600,
                  }}
                />
              </div>
              {matchingHolding && (
                <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setFromAmount(matchingHolding.amount * 0.25)}
                    style={{ fontSize: 'var(--font-xxs)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer' }}
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    onClick={() => setFromAmount(matchingHolding.amount * 0.5)}
                    style={{ fontSize: 'var(--font-xxs)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer' }}
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setFromAmount(matchingHolding.amount)}
                    style={{ fontSize: 'var(--font-xxs)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer' }}
                  >
                    100%
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Horizon & Fee Controls Row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px',
              marginBottom: '16px',
            }}
          >
            {/* Horizon */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', fontWeight: 600 }}>
                TRADE DATE / HORIZON:
              </span>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {HORIZON_PRESETS.map((range) => {
                  const active = selectedRange === range;
                  return (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setSelectedRange(range)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 'var(--radius-full)',
                        border: active ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                        background: active ? 'var(--color-accent-dim)' : 'transparent',
                        color: active ? 'var(--color-accent)' : 'var(--color-muted)',
                        fontSize: 'var(--font-xs)',
                        fontWeight: active ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {COUNTERFACTUAL_RANGE_DAYS[range]}D Ago
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cost Preset */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', fontWeight: 600 }}>
                FEE MODEL:
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['none', 'coinbase', 'kraken'] as const).map((preset) => {
                  const active = costPreset === preset;
                  const label = preset === 'none' ? 'Zero-Fee' : preset === 'coinbase' ? 'Coinbase (~0.6%)' : 'Kraken (~0.26%)';
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCostPreset(preset)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm, 6px)',
                        border: active ? '1px solid var(--color-gold)' : '1px solid var(--color-border)',
                        background: active ? 'var(--color-gold-dim)' : 'transparent',
                        color: active ? 'var(--color-gold)' : 'var(--color-muted)',
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
          </div>

          {/* Loading / Error / Results */}
          {isLoading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-muted)' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 20,
                  height: 20,
                  border: '2px solid var(--color-muted)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                  marginRight: '8px',
                }}
              />
              Loading historical price series…
            </div>
          ) : error ? (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-red-dim)',
                border: '1px solid rgba(255, 90, 120, 0.3)',
                color: 'var(--color-red)',
                fontSize: 'var(--font-xs)',
              }}
            >
              ⚠️ {error}
            </div>
          ) : evaluation ? (
            <>
              {/* Stat Cards */}
              <CounterfactualStatCards
                evaluation={evaluation}
                fromSymbol={fromSymbol}
                toSymbol={toSymbol}
              />

              {/* Trajectory Area Chart */}
              <CounterfactualChart
                data={evaluation.trajectory}
                fromSymbol={fromSymbol}
                toSymbol={toSymbol}
                isProfitable={evaluation.isProfitable}
              />
            </>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 'var(--font-xs)' }}>
              Enter an amount to calculate what-if valuation.
            </div>
          )}

          {/* NFA Disclaimer Footer */}
          <div
            style={{
              marginTop: '16px',
              fontSize: 'var(--font-xxs)',
              color: 'var(--color-muted)',
              borderTop: '1px solid var(--color-border)',
              paddingTop: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <span>
              ℹ️ Counterfactual simulation uses aligned historical CoinGecko closing prices and selected taker fee models.
            </span>
            <span>Educational simulation only (NFA).</span>
          </div>
        </>
      )}
    </div>
  );
}
