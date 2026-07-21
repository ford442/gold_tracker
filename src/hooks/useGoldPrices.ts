import { useEffect, useCallback, useRef } from 'react';
import { usePriceStore } from '@/store/priceStore';
import { useSettingsStore } from '@/store/settingsStore';
import { fetchCryptoPrices, fetchSpotGold, fetchOtherMetals } from '@lib/api';
import { loadPriceSnapshot, savePriceSnapshot } from '@lib/priceSnapshot';
import { DASHBOARD_PRICE_ASSET_IDS } from '@lib/assets';
import {
  createPriceTransport,
  ticksToPricePatches,
  type PriceTransport,
} from '@lib/priceTransport';

const POLL_INTERVAL = 60_000;
const METALS_POLL_INTERVAL = 60_000;

function applySnapshotIfAvailable(): boolean {
  const snapshot = loadPriceSnapshot();
  if (!snapshot) return false;
  usePriceStore.getState().hydrateFromSnapshot(snapshot);
  return true;
}

export function useGoldPrices() {
  const priceTransportMode = useSettingsStore((s) => s.priceTransportMode);
  const {
    setPrices,
    patchPrices,
    setGoldSpot,
    setOtherMetals,
    setLoading,
    setError,
    setIsMockData,
    setTransportMeta,
  } = usePriceStore();

  const transportRef = useRef<PriceTransport | null>(null);
  const metalsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hydratedRef = useRef(false);
  const isMockRef = useRef(false);
  const modeRef = useRef(priceTransportMode);
  modeRef.current = priceTransportMode;

  const fetchMetalsOnly = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const [gold, metals] = await Promise.all([
        fetchSpotGold(import.meta.env.VITE_METALPRICE_API_KEY),
        fetchOtherMetals(import.meta.env.VITE_METALPRICE_API_KEY),
      ]);
      setGoldSpot(gold);
      setOtherMetals(metals);
      const state = usePriceStore.getState();
      savePriceSnapshot({
        prices: state.prices,
        goldSpot: gold,
        otherMetals: metals,
        isMockData: state.isMockData,
      });
    } catch {
      // keep last good values
    }
  }, [setGoldSpot, setOtherMetals]);

  const bootstrapRest = useCallback(async () => {
    const mode = modeRef.current;
    if (!navigator.onLine) {
      if (applySnapshotIfAvailable()) {
        setError(null);
        setTransportMeta({ kind: 'offline', mode });
      } else {
        setError('Offline — no cached prices available');
        setTransportMeta({ kind: 'offline', mode });
      }
      setLoading(false);
      isMockRef.current = usePriceStore.getState().isMockData;
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
      isMockRef.current = isMock;
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
      isMockRef.current = usePriceStore.getState().isMockData;
      setError(
        restored
          ? null
          : (err instanceof Error ? err.message : 'Failed to fetch prices'),
      );
    } finally {
      setLoading(false);
    }
  }, [setPrices, setGoldSpot, setOtherMetals, setLoading, setError, setIsMockData, setTransportMeta]);

  const stopTransport = useCallback(() => {
    transportRef.current?.stop();
    transportRef.current = null;
    if (metalsTimerRef.current) {
      clearInterval(metalsTimerRef.current);
      metalsTimerRef.current = null;
    }
  }, []);

  const startTransport = useCallback(() => {
    stopTransport();

    const mode = modeRef.current;
    if (!navigator.onLine) {
      setTransportMeta({ kind: 'offline', mode });
      return;
    }

    const transport = createPriceTransport({
      mode,
      pollIntervalMs: POLL_INTERVAL,
      isMock: isMockRef.current,
      isOnline: () => navigator.onLine,
      onPoll: () => void bootstrapRest(),
      onTicks: (ticks) => {
        const patches = ticksToPricePatches(ticks);
        if (Object.keys(patches).length > 0) patchPrices(patches);
      },
    });

    transport.subscribe(DASHBOARD_PRICE_ASSET_IDS);
    transport.start();
    transportRef.current = transport;

    const status = transport.getStatus();
    setTransportMeta({
      kind: isMockRef.current ? 'mock' : status.kind,
      mode,
    });

    if (mode !== 'poll') {
      metalsTimerRef.current = setInterval(() => void fetchMetalsOnly(), METALS_POLL_INTERVAL);
    }
  }, [stopTransport, bootstrapRest, patchPrices, setTransportMeta, fetchMetalsOnly]);

  const refetch = useCallback(async () => {
    await bootstrapRest();
    startTransport();
  }, [bootstrapRest, startTransport]);

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      if (!navigator.onLine) {
        applySnapshotIfAvailable();
      }
    }

    void bootstrapRest().then(() => {
      startTransport();
    });

    return () => stopTransport();
  }, [bootstrapRest, startTransport, stopTransport, priceTransportMode]);

  useEffect(() => {
    const tick = setInterval(() => {
      const t = transportRef.current;
      if (!t) return;
      const status = t.getStatus();
      setTransportMeta({
        kind: isMockRef.current ? 'mock' : status.kind,
        mode: modeRef.current,
      });
    }, 2_000);
    return () => clearInterval(tick);
  }, [setTransportMeta]);

  return { refetch };
}
