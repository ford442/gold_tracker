import { useState } from 'react';
import { usePriceStore } from '@/store/priceStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useRiskContext } from '@/hooks/useRiskContext';
import { useVenueQuotes } from '@/hooks/useVenueQuotes';
import { resolvePaxgXautArbOrder } from '@lib/orderTypes';
import { executeOrderWithLifecycle, OrderExecutionError } from '@lib/executeOrder';
import {
  comparePaxgXautArbFees,
  getExchangeConfig,
} from '@lib/exchanges';
import {
  DEFAULT_ARB_NET_THRESHOLD_PCT,
  intraVenueSpread,
  venueListsXaut,
  type VenueGoldSnapshot,
  type VenueLegQuote,
} from '@lib/venueQuotes';
import { computeSpread, formatPercent, formatPrice } from '@lib/utils';
import { toast, Toaster } from 'react-hot-toast';

function SourceBadge({ source }: { source: VenueLegQuote['source'] }) {
  const styles: Record<VenueLegQuote['source'], { bg: string; color: string; label: string }> = {
    live: { bg: 'rgba(0,219,166,0.12)', color: 'var(--color-green)', label: 'LIVE' },
    estimated: { bg: 'rgba(240,200,69,0.12)', color: 'var(--color-gold)', label: 'EST.' },
    mock: { bg: 'rgba(124,92,252,0.12)', color: 'var(--color-accent)', label: 'MOCK' },
  };
  const s = styles[source];
  return (
    <span style={{
      fontSize: '0.65rem',
      padding: '2px 6px',
      borderRadius: '999px',
      background: s.bg,
      color: s.color,
      fontWeight: 700,
      letterSpacing: '0.04em',
    }}>
      {s.label}
    </span>
  );
}

function formatLeg(leg: VenueLegQuote | undefined): string {
  if (!leg) return '—';
  return `${formatPrice(leg.bid)} / ${formatPrice(leg.ask)}`;
}

function VenueRow({ snapshot }: { snapshot: VenueGoldSnapshot }) {
  const cfg = getExchangeConfig(snapshot.venueId);
  const spread = intraVenueSpread(snapshot);
  const hasXaut = venueListsXaut(snapshot.venueId);
  const quoteOnly = cfg?.canTrade === false;

  return (
    <tr>
      <td style={{ fontWeight: 600 }}>
        {cfg?.icon} {cfg?.shortLabel ?? snapshot.venueId}
        {quoteOnly && (
          <span className="badge-accent" style={{ marginLeft: '8px', fontSize: '0.65rem' }}>
            {' '}Quote only
          </span>
        )}
      </td>
      <td>
        <div>{formatLeg(snapshot.paxgUsd)}</div>
        <SourceBadge source={snapshot.paxgUsd.source} />
      </td>
      <td>
        {hasXaut && snapshot.xautUsd ? (
          <>
            <div>{formatLeg(snapshot.xautUsd)}</div>
            <SourceBadge source={snapshot.xautUsd.source} />
          </>
        ) : (
          <span style={{ color: 'var(--color-muted)' }}>—</span>
        )}
      </td>
      <td style={{ fontFamily: 'monospace' }}>
        {spread ? (
          <>
            <div>{formatPercent(spread.rawSpreadPct)}</div>
            {snapshot.paxgXautDirect && (
              <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>
                direct {formatPercent(computeSpread(snapshot.paxgXautDirect.bid, snapshot.paxgXautDirect.ask))}
              </div>
            )}
          </>
        ) : (
          '—'
        )}
      </td>
      <td style={{ fontFamily: 'monospace', color: 'var(--color-muted)' }}>
        {spread ? `${spread.roundTripFeeBps} bps` : quoteOnly ? `${(cfg?.takerFeeBps ?? 0) * 2} bps` : '—'}
      </td>
      <td style={{
        fontFamily: 'monospace',
        fontWeight: 700,
        color: spread && spread.netSpreadPct >= 0 ? 'var(--color-green)' : 'var(--color-red)',
      }}>
        {spread ? formatPercent(spread.netSpreadPct) : '—'}
      </td>
    </tr>
  );
}

export function GlobalArbitrageMonitor() {
  const { prices } = usePriceStore();
  const { dryRun, selectedExchange, maxTradeSize, setSelectedExchange } = useSettingsStore();
  const { user } = useAuthStore();
  const { checkOrderRisk, nfaCopy, priceMap } = useRiskContext();
  const {
    snapshots,
    bestOpportunity,
    loading,
    error,
    lastUpdated,
    isMock,
    isStale,
    dataSourceSummary,
    refresh,
  } = useVenueQuotes();

  const [executing, setExecuting] = useState(false);
  const [showIndex, setShowIndex] = useState(false);

  const paxgIndex = prices['pax-gold']?.price ?? 0;
  const xautIndex = prices['tether-gold']?.price ?? 0;
  const indexSpread = paxgIndex && xautIndex ? computeSpread(paxgIndex, xautIndex) : 0;

  const selectedSnapshot = snapshots.find((s) => s.venueId === selectedExchange);
  const selectedSpread = selectedSnapshot ? intraVenueSpread(selectedSnapshot) : null;
  const netSpread = selectedSpread?.netSpreadPct ?? bestOpportunity?.netSpreadPct ?? 0;
  const rawSpread = selectedSpread?.rawSpreadPct ?? bestOpportunity?.rawSpreadPct ?? 0;
  const isArbOpportunity = Math.abs(netSpread) >= DEFAULT_ARB_NET_THRESHOLD_PCT;

  const feeQuotes = comparePaxgXautArbFees(maxTradeSize * (paxgIndex || 2600));
  const bestFeeVenue = feeQuotes[0];
  const showVenueHint =
    bestFeeVenue && bestFeeVenue.id !== selectedExchange && getExchangeConfig(selectedExchange)?.canTrade;

  const handleExecuteArb = async () => {
    if (executing || !isArbOpportunity) return;
    setExecuting(true);

    const spreadSign = netSpread >= 0 ? rawSpread : -Math.abs(rawSpread);
    const buyToken = spreadSign > 0 ? 'PAXG' : 'XAUT';
    const sellToken = spreadSign > 0 ? 'XAUT' : 'PAXG';
    const unitPrice =
      spreadSign > 0
        ? selectedSnapshot?.paxgUsd.ask ?? paxgIndex
        : selectedSnapshot?.xautUsd?.ask ?? xautIndex;
    const mode = dryRun ? 'paper' : 'live';

    const risk = checkOrderRisk({
      productId: spreadSign > 0 ? 'PAXG-USD' : 'XAUT-USD',
      side: 'BUY',
      requestedQty: maxTradeSize,
      unitPriceUsd: unitPrice,
      mode,
    });

    if (!risk.allowed) {
      toast.error(
        <div className="flex flex-col">
          <span className="font-semibold">Risk guardrail blocked trade</span>
          <ul className="text-sm mt-1 list-disc pl-4">
            {risk.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <span className="text-xs text-gray-500 mt-2">{nfaCopy}</span>
        </div>,
        { duration: 7000 },
      );
      setExecuting(false);
      return;
    }

    const qty = risk.adjustedQty ?? maxTradeSize;

    const toastId = toast.loading(
      `Executing ARB: Buy ${buyToken} → Sell ${sellToken} on ${selectedExchange.toUpperCase()}...`,
      { duration: 30000 },
    );

    try {
      const order = resolvePaxgXautArbOrder(selectedExchange, spreadSign, qty);
      const { result } = await executeOrderWithLifecycle({
        order,
        dryRun,
        exchange: selectedExchange,
        user,
        source: 'arb',
        mode: dryRun ? 'paper' : 'live',
        riskPrices: priceMap,
        unitPriceUsd: unitPrice,
      });

      if (result.success) {
        const msg = result.message || `ARB executed: Buy ${buyToken} / Sell ${sellToken}`;
        toast.success(
          `${dryRun ? 'DRY RUN' : 'Success'}: ${msg}`,
          { id: toastId, duration: 5000, icon: dryRun ? '\u{1F512}' : '\u2705' },
        );
      } else {
        toast.error(`Trade Failed: ${result.error || 'Unknown error'}`, { id: toastId, duration: 6000 });
      }
    } catch (err) {
      if (err instanceof OrderExecutionError) {
        toast.error(err.message, { id: toastId, duration: 6000 });
      } else {
        toast.error(
          `Execution Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          { id: toastId, duration: 6000 },
        );
      }
    } finally {
      setExecuting(false);
    }
  };

  return (
    <section style={{ marginBottom: 'var(--space-2xl)' }}>
      <Toaster position="top-right" />
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-lg)',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <h2 style={{
          margin: 0,
          fontSize: 'var(--font-xl)',
          fontWeight: 700,
          color: 'var(--color-text)',
          letterSpacing: '-0.02em',
        }}>
          Global Arbitrage Monitor
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {isStale && !loading && (
            <span style={{
              fontSize: 'var(--font-xs)',
              padding: '4px 10px',
              borderRadius: '999px',
              background: 'rgba(217,119,6,0.1)',
              color: 'var(--color-gold)',
              fontWeight: 500,
            }}>
              Stale quotes
            </span>
          )}
          {error && (
            <button
              type="button"
              onClick={refresh}
              style={{
                fontSize: 'var(--font-xs)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-muted)',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          )}
          <span style={{
            fontSize: 'var(--font-xs)',
            background: 'var(--color-surface2)',
            color: 'var(--color-muted)',
            padding: '4px 10px',
            borderRadius: '999px',
            fontWeight: 500,
          }}>
            {isMock ? 'MOCK' : 'LIVE'} · {dataSourceSummary || 'loading…'}
            {lastUpdated ? ` · ${Math.max(0, Math.round((Date.now() - lastUpdated) / 1000))}s ago` : ''}
          </span>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '24px' }}>
        {bestOpportunity && (
          <div style={{
            marginBottom: '20px',
            padding: '14px 16px',
            borderRadius: 'var(--radius-md)',
            background: bestOpportunity.profitable ? 'var(--color-gold-dim)' : 'var(--color-surface2)',
            border: bestOpportunity.profitable ? '1px solid var(--color-gold)' : '1px solid var(--color-border)',
            fontSize: '0.85rem',
            lineHeight: 1.6,
          }}>
            <strong>Best cross-venue:</strong>{' '}
            Buy {bestOpportunity.buyAsset} @ {getExchangeConfig(bestOpportunity.buyVenue)?.shortLabel},{' '}
            sell {bestOpportunity.sellAsset} @ {getExchangeConfig(bestOpportunity.sellVenue)?.shortLabel}{' '}
            → {formatPercent(bestOpportunity.rawSpreadPct)} raw,{' '}
            <span style={{ fontWeight: 700 }}>{formatPercent(bestOpportunity.netSpreadPct)} net</span>
            {bestOpportunity.profitable ? ' — opportunity' : ' — below threshold'}
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table className="table-zebra" style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead>
          <tr>
            <th scope="col" style={{ textAlign: 'left' }}>Venue</th>
            <th scope="col" style={{ textAlign: 'left' }}>PAXG bid/ask</th>
            <th scope="col" style={{ textAlign: 'left' }}>XAUT bid/ask</th>
            <th scope="col" style={{ textAlign: 'left' }}>Intra spread</th>
            <th scope="col" style={{ textAlign: 'left' }}>RT fees</th>
            <th scope="col" style={{ textAlign: 'left' }}>Net edge</th>
          </tr>
        </thead>
            <tbody>
              {loading && snapshots.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="skeleton" style={{ height: '48px' }} />
                  </td>
                </tr>
              ) : (
                snapshots.map((snap) => <VenueRow key={snap.venueId} snapshot={snap} />)
              )}
            </tbody>
          </table>
        </div>

        <div style={{
          marginTop: '24px',
          paddingTop: '20px',
          borderTop: '1px solid var(--color-border)',
        }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', marginBottom: '6px' }}>
                Execute on {getExchangeConfig(selectedExchange)?.label ?? selectedExchange}
              </div>
              <div style={{
                fontSize: '2rem',
                fontFamily: 'monospace',
                fontWeight: 700,
                color: netSpread >= 0 ? 'var(--color-green)' : 'var(--color-red)',
              }}>
                {formatPercent(netSpread)} net
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', marginTop: '4px' }}>
                Raw {formatPercent(rawSpread)} · threshold {DEFAULT_ARB_NET_THRESHOLD_PCT}%
              </div>
            </div>

            <div style={{ flex: '1 1 220px', maxWidth: '320px' }}>
              <button
                type="button"
                onClick={handleExecuteArb}
                disabled={!isArbOpportunity || executing || !getExchangeConfig(selectedExchange)?.canTrade}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: executing
                    ? 'var(--color-surface)'
                    : isArbOpportunity
                    ? (dryRun ? 'var(--color-green)' : 'var(--color-gold)')
                    : 'var(--color-surface)',
                  color: executing
                    ? 'var(--color-muted)'
                    : isArbOpportunity
                    ? '#000'
                    : 'var(--color-muted)',
                  border: isArbOpportunity ? 'none' : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: isArbOpportunity && !executing ? 'pointer' : 'not-allowed',
                  opacity: isArbOpportunity && !executing ? 1 : 0.5,
                }}
              >
                {executing
                  ? 'Executing…'
                  : dryRun
                  ? `DRY RUN ARB on ${selectedExchange.toUpperCase()}`
                  : `EXECUTE ARB on ${selectedExchange.toUpperCase()}`}
              </button>

              {showVenueHint && bestFeeVenue && (
                <div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                  {bestFeeVenue.label} saves ~{formatPercent(
                    ((feeQuotes.find((q) => q.id === selectedExchange)?.roundTripBps ?? 0) -
                      bestFeeVenue.roundTripBps) /
                      100,
                    false,
                  )} fees.{' '}
                  <button
                    type="button"
                    onClick={() => setSelectedExchange(bestFeeVenue.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-accent)',
                      cursor: 'pointer',
                      padding: 0,
                      fontWeight: 600,
                      textDecoration: 'underline',
                    }}
                  >
                    Switch to {getExchangeConfig(bestFeeVenue.id)?.shortLabel ?? bestFeeVenue.label}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <button
            type="button"
            onClick={() => setShowIndex((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-muted)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {showIndex ? '▼' : '▶'} CoinGecko index reference (EST.)
          </button>
          {showIndex && (
            <div style={{
              marginTop: '8px',
              fontSize: '0.8rem',
              color: 'var(--color-muted)',
              fontFamily: 'monospace',
            }}>
              PAXG {formatPrice(paxgIndex)} · XAUT {formatPrice(xautIndex)} · spread{' '}
              {formatPercent(indexSpread)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
