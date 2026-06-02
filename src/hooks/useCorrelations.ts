import { useMemo } from 'react';
import { usePriceStore } from '../store/priceStore';
import { pearsonCorrelation, sparklinePrices } from '../lib/utils';
import type { CorrelationMatrix, CorrelationPeriod } from '../types';

const ASSET_KEYS = ['gold', 'pax-gold', 'tether-gold', 'bitcoin', 'ethereum'];
const ASSET_LABELS = ['Gold', 'PAXG', 'XAUT', 'BTC', 'ETH'];

const PERIOD_POINTS: Record<CorrelationPeriod, number> = {
  '1h': 6,
  '1d': 24,
  '7d': 168,
  '30d': 168, // CoinGecko free tier provides 7 days of hourly sparkline data
};

// NOTE: The above are short-term/tactical windows on live sparklines.
// For true 90d/1y/MAX structural correlations, Gold Fidelity Scores (PAXG/XAUT vs spot vs BTC/ETH),
// rolling divergence history, and vol/drawdown regime lens, use the "Fidelity & Regimes" tab
// inside Advanced Gold Comparison Tools (powered by full market_chart + pure lib/regime.ts).

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

    return { period, assets: ASSET_LABELS, matrix };
  }, [prices, goldSpot, period]);
}
