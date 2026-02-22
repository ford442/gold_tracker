import { useEffect, useRef } from 'react';
import { usePriceStore } from '../store/priceStore';
import { useAlertStore } from '../store/alertStore';
import { computeSpread } from '../lib/utils';

const SPREAD_THRESHOLD = 0.5; // percent

export function useArbitrageAlerts() {
  const { prices } = usePriceStore();
  const { addAlert } = useAlertStore();
  const lastAlertRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const paxg = prices['pax-gold'];
    const xaut = prices['tether-gold'];
    if (!paxg || !xaut) return;

    const spread = computeSpread(paxg.price, xaut.price);
    const absSpread = Math.abs(spread);
    const key = 'paxg-xaut';
    const now = Date.now();
    const lastAlert = lastAlertRef.current[key] ?? 0;

    // Alert at most once per 5 minutes for same pair
    if (absSpread > SPREAD_THRESHOLD && now - lastAlert > 300000) {
      const cheaper = spread < 0 ? 'XAUT' : 'PAXG';
      const pricier = spread < 0 ? 'PAXG' : 'XAUT';
      addAlert({
        type: 'arbitrage',
        message: `${cheaper} is ${absSpread.toFixed(2)}% cheaper than ${pricier} — potential swap signal!`,
        spread: absSpread,
      });
      lastAlertRef.current[key] = now;
    }
  }, [prices, addAlert]);
}
