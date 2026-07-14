import { useEffect, useCallback, useRef } from 'react';
import { usePriceStore } from '@/store/priceStore';
import { fetchCryptoPrices, fetchSpotGold, fetchOtherMetals } from '@lib/api';
import { loadPriceSnapshot, savePriceSnapshot } from '@lib/priceSnapshot';

const POLL_INTERVAL = 60000; // 60 seconds

function applySnapshotIfAvailable(): boolean {
  const snapshot = loadPriceSnapshot();
  if (!snapshot) return false;
  usePriceStore.getState().hydrateFromSnapshot(snapshot);
  return true;
}

export function useGoldPrices() {
  const {
    setPrices,
    setGoldSpot,
    setOtherMetals,
    setLoading,
    setError,
    setIsMockData,
  } = usePriceStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);

  const fetchAll = useCallback(async () => {
    if (!navigator.onLine) {
      if (applySnapshotIfAvailable()) {
        setError(null);
      } else {
        setError('Offline — no cached prices available');
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [prices, gold, metals] = await Promise.all([
        fetchCryptoPrices(import.meta.env.VITE_COINGECKO_API_KEY),
        fetchSpotGold(import.meta.env.VITE_METALPRICE_API_KEY),
        fetchOtherMetals(import.meta.env.VITE_METALPRICE_API_KEY),
      ]);
      const isMock =
        ('__mock' in prices && prices.__mock === true) ||
        ('__mock' in gold && gold.__mock === true) ||
        gold.isMock === true;
      setIsMockData(isMock);
      setPrices(prices);
      setGoldSpot(gold);
      setOtherMetals(metals);
      setError(null);

      savePriceSnapshot({
        prices,
        goldSpot: gold,
        otherMetals: metals,
        isMockData: isMock,
      });
    } catch (err) {
      const restored = applySnapshotIfAvailable();
      setError(
        restored
          ? null
          : (err instanceof Error ? err.message : 'Failed to fetch prices'),
      );
    } finally {
      setLoading(false);
    }
  }, [setPrices, setGoldSpot, setOtherMetals, setLoading, setError, setIsMockData]);

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      if (!navigator.onLine) {
        applySnapshotIfAvailable();
      }
    }

    fetchAll();
    timerRef.current = setInterval(fetchAll, POLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchAll]);

  return { refetch: fetchAll };
}
