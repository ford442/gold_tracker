import { useEffect, useState } from 'react';
import { usePriceStore } from '@/store/priceStore';

const STALE_MS = 120_000;

export type DataFreshness = 'live' | 'stale' | 'cached' | 'offline' | 'loading';

export function useConnectivityStatus() {
  const [isOnline, setIsOnline] = useState(
    () => (typeof navigator !== 'undefined' ? navigator.onLine : true),
  );
  const [now, setNow] = useState(() => Date.now());

  const lastUpdated = usePriceStore((s) => s.lastUpdated);
  const isLoading = usePriceStore((s) => s.isLoading);
  const error = usePriceStore((s) => s.error);
  const isFromCache = usePriceStore((s) => s.isFromCache);
  const snapshotSavedAt = usePriceStore((s) => s.snapshotSavedAt);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  const referenceTime = lastUpdated ?? snapshotSavedAt;
  const ageMs = referenceTime != null ? now - referenceTime : null;
  const isStale = ageMs != null && ageMs > STALE_MS;

  let freshness: DataFreshness = 'loading';
  if (!isOnline) {
    freshness = isFromCache || referenceTime != null ? 'offline' : 'offline';
  } else if (isLoading && referenceTime == null) {
    freshness = 'loading';
  } else if (isFromCache) {
    freshness = 'cached';
  } else if (isStale) {
    freshness = 'stale';
  } else if (referenceTime != null) {
    freshness = 'live';
  }

  const showBanner =
    !isOnline
    || isFromCache
    || (isStale && !isLoading && referenceTime != null)
    || (error != null && referenceTime != null);

  return {
    isOnline,
    isStale,
    isFromCache,
    lastUpdated: referenceTime,
    snapshotSavedAt,
    error,
    isLoading,
    freshness,
    showBanner,
  };
}
