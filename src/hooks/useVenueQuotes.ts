import { useCallback, useEffect, useRef, useState } from 'react';
import { usePriceStore } from '@/store/priceStore';
import { getVenueGoldSnapshots } from '@lib/venueQuoteFanout';
import {
  bestCrossVenueOpportunity,
  summarizeQuoteSources,
  type CrossVenueOpportunity,
  type VenueGoldSnapshot,
} from '@lib/venueQuotes';

const POLL_INTERVAL_MS = 15_000;
const STALE_MS = 30_000;

export interface UseVenueQuotesResult {
  snapshots: VenueGoldSnapshot[];
  bestOpportunity: CrossVenueOpportunity | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  isMock: boolean;
  isStale: boolean;
  dataSourceSummary: string;
  refresh: () => void;
}

export function useVenueQuotes(): UseVenueQuotesResult {
  const prices = usePriceStore((s) => s.prices);
  const isMockData = usePriceStore((s) => s.isMockData);

  const [snapshots, setSnapshots] = useState<VenueGoldSnapshot[]>([]);
  const [bestOpportunity, setBestOpportunity] = useState<CrossVenueOpportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [dataSourceSummary, setDataSourceSummary] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(
    async (forceRefresh = false) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const paxgMid = prices['pax-gold']?.price;
      const xautMid = prices['tether-gold']?.price;

      try {
        if (!forceRefresh) setLoading(true);
        const result = await getVenueGoldSnapshots({
          signal: controller.signal,
          forceRefresh,
          useMock: isMockData,
          indexMids: {
            paxg: paxgMid,
            xaut: xautMid,
          },
        });

        if (!mountedRef.current || controller.signal.aborted) return;

        setSnapshots(result.snapshots);
        setBestOpportunity(bestCrossVenueOpportunity(result.snapshots));
        setLastUpdated(result.fetchedAt);
        setIsMock(result.isMock);
        setDataSourceSummary(summarizeQuoteSources(result.snapshots).label);
        setError(result.errors.length > 0 ? result.errors.join('; ') : null);
      } catch (err) {
        if (!mountedRef.current || controller.signal.aborted) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load venue quotes');
      } finally {
        if (mountedRef.current && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [isMockData, prices],
  );

  const refresh = useCallback(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    mountedRef.current = true;
    void load();

    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void load(true);
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [load]);

  const isStale = lastUpdated != null && Date.now() - lastUpdated > STALE_MS;

  return {
    snapshots,
    bestOpportunity,
    loading,
    error,
    lastUpdated,
    isMock,
    isStale,
    dataSourceSummary,
    refresh,
  };
}
