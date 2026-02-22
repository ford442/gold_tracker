import { useEffect, useCallback, useRef } from 'react';
import { usePriceStore } from '../store/priceStore';
import { fetchCryptoPrices, fetchSpotGold } from '../lib/api';

const POLL_INTERVAL = 60000; // 60 seconds

export function useGoldPrices() {
  const { setPrices, setGoldSpot, setLoading, setError } = usePriceStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [prices, gold] = await Promise.all([
        fetchCryptoPrices(import.meta.env.VITE_COINGECKO_API_KEY),
        fetchSpotGold(import.meta.env.VITE_METALPRICE_API_KEY),
      ]);
      setPrices(prices);
      setGoldSpot(gold);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
    }
  }, [setPrices, setGoldSpot, setLoading, setError]);

  useEffect(() => {
    fetchAll();
    timerRef.current = setInterval(fetchAll, POLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchAll]);

  return { refetch: fetchAll };
}
