/**
 * Single source of truth for tracked asset metadata (ids, symbols, CoinGecko/Coinbase mapping).
 * Import from here — do not duplicate asset lists in components.
 */

export type AssetCategory = 'metal' | 'gold' | 'crypto' | 'stablecoin';

export interface AssetDef {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  /** CoinGecko coin id; null when price comes from another feed (e.g. spot gold). */
  readonly cgId: string | null;
  /** Coinbase currency code, when supported for balance sync. */
  readonly coinbaseCode: string | null;
  readonly icon: string;
  readonly category: AssetCategory;
  /** Short label for correlation matrix headers (defaults to symbol in helpers). */
  readonly correlationLabel: string;
  /** Line color for multi-asset performance / overlay charts. */
  readonly chartColor: string;
}

export const ASSETS = {
  gold: {
    id: 'gold',
    symbol: 'XAU',
    name: 'Spot Gold',
    cgId: null,
    coinbaseCode: 'XAU',
    icon: '🥇',
    category: 'metal',
    correlationLabel: 'Gold',
    chartColor: '#f0c845',
  },
  'pax-gold': {
    id: 'pax-gold',
    symbol: 'PAXG',
    name: 'PAX Gold',
    cgId: 'pax-gold',
    coinbaseCode: 'PAXG',
    icon: '🪙',
    category: 'gold',
    correlationLabel: 'PAXG',
    chartColor: '#10b981',
  },
  'tether-gold': {
    id: 'tether-gold',
    symbol: 'XAUT',
    name: 'Tether Gold',
    cgId: 'tether-gold',
    coinbaseCode: 'XAUT',
    icon: '🟡',
    category: 'gold',
    correlationLabel: 'XAUT',
    chartColor: '#14b8a6',
  },
  bitcoin: {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    cgId: 'bitcoin',
    coinbaseCode: 'BTC',
    icon: '₿',
    category: 'crypto',
    correlationLabel: 'BTC',
    chartColor: '#f59e0b',
  },
  ethereum: {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    cgId: 'ethereum',
    coinbaseCode: 'ETH',
    icon: 'Ξ',
    category: 'crypto',
    correlationLabel: 'ETH',
    chartColor: '#8b5cf6',
  },
  'bitcoin-cash': {
    id: 'bitcoin-cash',
    symbol: 'BCH',
    name: 'Bitcoin Cash',
    cgId: 'bitcoin-cash',
    coinbaseCode: null,
    icon: 'BCH',
    category: 'crypto',
    correlationLabel: 'BCH',
    chartColor: '#3b82f6',
  },
  'usd-coin': {
    id: 'usd-coin',
    symbol: 'USDC',
    name: 'USD Coin',
    cgId: 'usd-coin',
    coinbaseCode: 'USDC',
    icon: '💵',
    category: 'stablecoin',
    correlationLabel: 'USDC',
    chartColor: '#2775ca',
  },
} as const satisfies Record<string, AssetDef>;

export type AssetId = keyof typeof ASSETS;

export const ASSET_LIST: AssetDef[] = Object.values(ASSETS);

/** Dashboard price cards (excludes spot gold — shown in GoldSpotCard). */
export const DASHBOARD_PRICE_ASSET_IDS = [
  'pax-gold',
  'tether-gold',
  'bitcoin',
  'ethereum',
  'bitcoin-cash',
] as const satisfies readonly AssetId[];

/** Tactical correlation matrix universe. */
export const CORRELATION_ASSET_IDS = [
  'gold',
  'pax-gold',
  'tether-gold',
  'bitcoin',
  'ethereum',
] as const satisfies readonly AssetId[];

/** Portfolio manual-entry dropdown + PnL symbol resolution. */
export const PORTFOLIO_ASSET_IDS = [
  'gold',
  'pax-gold',
  'tether-gold',
  'bitcoin',
  'ethereum',
  'usd-coin',
] as const satisfies readonly AssetId[];

/** Trade replay asset picker. */
export const TRADE_REPLAY_ASSET_IDS = [
  'pax-gold',
  'tether-gold',
  'bitcoin',
  'ethereum',
  'bitcoin-cash',
] as const satisfies readonly AssetId[];

/** 14-day performance comparison chart. */
export const PERFORMANCE_COMPARISON_ASSET_IDS = TRADE_REPLAY_ASSET_IDS;

/** Gold exposure sleeve (spot + tokenized gold). */
export const GOLD_SLEEVE_ASSET_IDS = [
  'gold',
  'pax-gold',
  'tether-gold',
] as const satisfies readonly AssetId[];

/** CoinGecko /coins/markets `ids` param (comma-separated). */
export const COINGECKO_MARKET_IDS = (
  DASHBOARD_PRICE_ASSET_IDS.map((id) => ASSETS[id].cgId).filter(Boolean) as string[]
).join(',');

/** Map Coinbase currency codes → internal asset ids. */
export const COINBASE_CURRENCY_TO_ASSET_ID: Record<string, AssetId> = Object.fromEntries(
  ASSET_LIST
    .filter((a): a is AssetDef & { coinbaseCode: string } => a.coinbaseCode !== null)
    .map((a) => [a.coinbaseCode, a.id as AssetId]),
) as Record<string, AssetId>;

const SYMBOL_TO_ID = new Map(
  ASSET_LIST.map((a) => [a.symbol.toUpperCase(), a.id as AssetId]),
);

export function isAssetId(id: string): id is AssetId {
  return id in ASSETS;
}

export function getAsset(id: string): AssetDef | undefined {
  return isAssetId(id) ? ASSETS[id] : undefined;
}

export function toSymbol(assetId: string): string {
  return getAsset(assetId)?.symbol ?? assetId.toUpperCase();
}

export function assetName(assetId: string): string {
  return getAsset(assetId)?.name ?? assetId;
}

export function assetIcon(assetId: string): string {
  return getAsset(assetId)?.icon ?? '💎';
}

export function correlationLabel(assetId: string): string {
  return getAsset(assetId)?.correlationLabel ?? toSymbol(assetId);
}

export function fromSymbol(symbol: string): AssetDef | undefined {
  return getAsset(SYMBOL_TO_ID.get(symbol.toUpperCase()) ?? '');
}

export function fromCoinbaseCode(code: string): AssetDef | undefined {
  const id = COINBASE_CURRENCY_TO_ASSET_ID[code];
  return id ? ASSETS[id] : undefined;
}

/** Resolve portfolio entry symbol → internal asset id (XAU → gold). */
export function resolvePortfolioAssetId(symbol: string): AssetId | '' {
  if (symbol.toUpperCase() === 'XAU') return 'gold';
  const id = SYMBOL_TO_ID.get(symbol.toUpperCase());
  return id ?? '';
}

export function isGoldToken(assetId: string): boolean {
  return getAsset(assetId)?.category === 'gold';
}

export function isGoldSleeve(assetId: string): boolean {
  return (GOLD_SLEEVE_ASSET_IDS as readonly string[]).includes(assetId);
}

/**
 * Fine troy ounces represented by a gold-sleeve holding.
 * PAXG, XAUT, and spot XAU are modeled as 1 oz per unit — educational estimate only.
 */
export function fineGoldOzForHolding(assetId: string, units: number): number {
  if (!isGoldSleeve(assetId) || !Number.isFinite(units) || units <= 0) return 0;
  return units;
}

export function isStablecoin(assetId: string): boolean {
  return getAsset(assetId)?.category === 'stablecoin';
}

/** Strategy dashboard mean-reversion asset dropdown labels. */
export function strategySelectOptions(ids: readonly AssetId[]): { id: AssetId; label: string }[] {
  return ids.map((id) => ({
    id,
    label: `${ASSETS[id].symbol} — ${ASSETS[id].name}`,
  }));
}

export const STRATEGY_MR_ASSET_IDS = [
  'bitcoin',
  'ethereum',
  'pax-gold',
  'tether-gold',
] as const satisfies readonly AssetId[];
