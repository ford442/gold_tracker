import { useMemo } from 'react';
import { usePriceStore } from '@/store/priceStore';
import { computeFidelityScores, generateSyntheticSpotPrices } from '@lib/regime';
import { sparklinePrices } from '@lib/utils';
import type { FidelityScore } from '@/types';

export interface SparklineFidelitySnapshot {
  paxg: FidelityScore;
  xaut: FidelityScore;
  /** True when spot gold path was synthesized (always for sparkline-based estimates). */
  isEstimatedSpot: boolean;
}

/**
 * Lightweight fidelity snapshot from dashboard sparklines.
 * Used by alert rules, trade suggestions, and strategy gating — not long-horizon RegimeLens data.
 */
export function useFidelityScores(): SparklineFidelitySnapshot | null {
  const { prices, goldSpot } = usePriceStore();

  return useMemo(() => {
    const paxg = prices['pax-gold'];
    const xaut = prices['tether-gold'];
    const btc = prices.bitcoin;
    const eth = prices.ethereum;
    const spot = goldSpot?.price ?? paxg?.price;
    if (!paxg || !xaut || !btc || !eth || !spot) return null;

    const len = Math.min(
      sparklinePrices(paxg.sparkline, 30).length,
      sparklinePrices(xaut.sparkline, 30).length,
      sparklinePrices(btc.sparkline, 30).length,
      sparklinePrices(eth.sparkline, 30).length,
    );
    if (len < 5) return null;

    const paxgP = sparklinePrices(paxg.sparkline, len);
    const xautP = sparklinePrices(xaut.sparkline, len);
    const btcP = sparklinePrices(btc.sparkline, len);
    const ethP = sparklinePrices(eth.sparkline, len);
    const goldP = generateSyntheticSpotPrices(spot, len);

    const { paxg: paxgScore, xaut: xautScore } = computeFidelityScores(
      goldP,
      paxgP,
      xautP,
      btcP,
      ethP,
    );

    return {
      paxg: paxgScore,
      xaut: xautScore,
      isEstimatedSpot: goldSpot?.isMock !== false,
    };
  }, [prices, goldSpot]);
}
