import { useMemo } from 'react';
import { usePriceStore } from '../store/priceStore';
import { pearsonCorrelation, sparklinePrices } from '../lib/utils';
import type { CorrelationMatrix, CorrelationPeriod } from '../types';

const ASSET_KEYS = ['gold', 'pax-gold', 'tether-gold', 'bitcoin', 'ethereum'];
const ASSET_LABELS = ['Gold', 'PAXG', 'XAUT', 'BTC', 'ETH'];

const PERIOD_POINTS: Record<CorrelationPeriod, number> = {
  '1h': 1,
  '1d': 24,
  '7d': 168,
  '30d': 168, // limited by sparkline data
};

export function useCorrelations(period: CorrelationPeriod): CorrelationMatrix {
  const { prices, goldSpot } = usePriceStore();

  return useMemo(() => {
    const n = PERIOD_POINTS[period];

    const seriesMap: Record<string, number[]> = {
      gold: goldSpot ? sparklinePrices(goldSpot.sparkline, n) : [],
      'pax-gold': prices['pax-gold'] ? sparklinePrices(prices['pax-gold'].sparkline, n) : [],
      'tether-gold': prices['tether-gold'] ? sparklinePrices(prices['tether-gold'].sparkline, n) : [],
      bitcoin: prices['bitcoin'] ? sparklinePrices(prices['bitcoin'].sparkline, n) : [],
      ethereum: prices['ethereum'] ? sparklinePrices(prices['ethereum'].sparkline, n) : [],
    };

    const matrix: number[][] = ASSET_KEYS.map((a) =>
      ASSET_KEYS.map((b) => {
        if (a === b) return 1;
        const sa = seriesMap[a];
        const sb = seriesMap[b];
        if (sa.length < 2 || sb.length < 2) return 0;
        return pearsonCorrelation(sa, sb);
      })
    );

    return { period, assets: ASSET_LABELS, matrix, updatedAt: Date.now() };
  }, [prices, goldSpot, period]);
}
