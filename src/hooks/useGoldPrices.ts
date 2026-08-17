import { useEffect, useCallback, useRef } from 'react';
import { usePriceStore } from '@/store/priceStore';
import { useSettingsStore } from '@/store/settingsStore';
import { fetchCryptoPrices, fetchSpotGold, fetchOtherMetals } from '@lib/api';
import { loadPriceSnapshot, savePriceSnapshot } from '@lib/priceSnapshot';
import { DASHBOARD_PRICE_ASSET_IDS } from '@lib/assets';
import { recordObservabilityEvent } from '@lib/observability';
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
    const start = performance.now();
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
      recordObservabilityEvent({
        kind: 'price_fetch',
        severity: 'info',
        ok: true,
        source: 'metalprice',
        action: 'poll',
        latencyMs: performance.now() - start,
        detail: `Spot metals updated: gold $${gold.price.toFixed(2)}`,
        meta: { isMock: Boolean(gold.isMock) },
      });
    } catch {
      recordObservabilityEvent({
        kind: 'price_fetch',
        severity: 'warn',
        ok: false,
        source: 'metalprice',
        action: 'poll',
        detail: 'Spot metals poll failed; retaining previous snapshot',
      });
    }
  }, [setGoldSpot, setOtherMetals]);

  const bootstrapRest = useCallback(async () => {
    const mode = modeRef.current;
    if (!navigator.onLine) {
      if (applySnapshotIfAvailable()) {
        setError(null);
        setTransportMeta({ kind: 'offline', mode });
        recordObservabilityEvent({
          kind: 'price_fetch',
          severity: 'warn',
          ok: true,
          source: 'offline-snapshot',
          action: 'hydrate',
          detail: 'Offline: hydrated prices from local snapshot',
        });
      } else {
        setError('Offline — no cached prices available');
        setTransportMeta({ kind: 'offline', mode });
        recordObservabilityEvent({
          kind: 'price_fetch',
          severity: 'error',
          ok: false,
          source: 'offline-snapshot',
          action: 'hydrate',
          detail: 'Offline: no cached price snapshot available',
        });
      }
      setLoading(false);
      isMockRef.current = usePriceStore.getState().isMockData;
      return;
    }

    setLoading(true);
    const start = performance.now();
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

      const cryptoCount = Object.keys(prices).filter((k) => !k.startsWith('__')).length;
      recordObservabilityEvent({
        kind: 'price_fetch',
        severity: 'info',
        ok: true,
        source: isMock ? 'mock-rest' : 'coingecko+metalprice',
        action: 'poll',
        latencyMs: performance.now() - start,
        detail: `REST price poll: ${cryptoCount} crypto assets, spot gold $${gold.price.toFixed(2)} (${isMock ? 'mock' : 'live'})`,
        meta: { isMock, cryptoCount },
      });
    } catch (err) {
      const restored = applySnapshotIfAvailable();
      isMockRef.current = usePriceStore.getState().isMockData;
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch prices';
      setError(restored ? null : errorMsg);
      recordObservabilityEvent({
        kind: 'price_fetch',
        severity: restored ? 'warn' : 'error',
        ok: false,
        source: 'rest-poll',
        action: 'poll',
        latencyMs: performance.now() - start,
        detail: `REST price poll failed: ${errorMsg}${restored ? ' (restored from snapshot)' : ''}`,
      });
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
