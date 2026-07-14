import type { PriceData, GoldSpot, MetalSpot } from '@/types';

const SNAPSHOT_KEY = 'goldtrackr-price-snapshot';

export interface PriceSnapshot {
  prices: Record<string, PriceData>;
  goldSpot: GoldSpot | null;
  otherMetals: MetalSpot[];
  savedAt: number;
  isMockData: boolean;
}

export function savePriceSnapshot(data: Omit<PriceSnapshot, 'savedAt'>): void {
  try {
    const payload: PriceSnapshot = { ...data, savedAt: Date.now() };
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(payload));
  } catch {
    // localStorage full or unavailable (private mode)
  }
}

export function loadPriceSnapshot(): PriceSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PriceSnapshot;
    if (!parsed.savedAt || typeof parsed.savedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPriceSnapshot(): void {
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    // ignore
  }
}
