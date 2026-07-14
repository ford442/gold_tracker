/**
 * Portfolio lot-level cost basis — PURE logic (no React).
 *
 * Supports FIFO / HIFO / SpecID lot selection, unrealized + realized P&L,
 * fine-gold-oz aggregation, and CSV export for journaling. Educational only —
 * not tax advice.
 */

import { fineGoldOzForHolding, resolvePortfolioAssetId } from './assets';
import type {
  CostBasisMethod,
  PortfolioEntry,
  PortfolioLot,
  RealizedGainEvent,
} from '@/types';

export type { CostBasisMethod, PortfolioLot, RealizedGainEvent };

export interface LotConsumption {
  lotId: string;
  units: number;
  costPerUnit: number;
}

export interface UnrealizedLine {
  entryId: string;
  symbol: string;
  units: number;
  costBasisUsd: number;
  marketValueUsd: number;
  unrealizedPnlUsd: number;
}

export interface UnrealizedSummary {
  lines: UnrealizedLine[];
  totalCostBasisUsd: number;
  totalMarketValueUsd: number;
  totalUnrealizedPnlUsd: number;
}

export interface RealizedSummary {
  events: RealizedGainEvent[];
  totalProceedsUsd: number;
  totalCostBasisUsd: number;
  totalRealizedPnlUsd: number;
}

let lotSeq = 0;

export function nextLotId(prefix = 'lot'): string {
  lotSeq += 1;
  return `${prefix}-${Date.now()}-${lotSeq}`;
}

/** Backfill a single lot from legacy amount + buyPrice when lots are absent. */
export function ensureEntryLots(entry: PortfolioEntry, now?: string): PortfolioEntry {
  if (entry.lots && entry.lots.length > 0) {
    return syncEntryAggregates(entry);
  }
  const units = Number.isFinite(entry.amount) && entry.amount > 0 ? entry.amount : 0;
  const cost = Number.isFinite(entry.buyPrice) && entry.buyPrice > 0 ? entry.buyPrice : 0;
  if (units <= 0) {
    return { ...entry, lots: [], amount: 0, buyPrice: 0 };
  }
  const lot: PortfolioLot = {
    id: nextLotId(`lot-migrated-${entry.id}`),
    units,
    costPerUnit: cost,
    acquiredAt: now ?? new Date(0).toISOString(),
    note: 'Migrated from legacy position',
  };
  return { ...entry, lots: [lot], amount: units, buyPrice: cost };
}

/** Recompute entry.amount and weighted-average buyPrice from lots. */
export function syncEntryAggregates(entry: PortfolioEntry): PortfolioEntry {
  const lots = entry.lots ?? [];
  const amount = lots.reduce((s, l) => s + l.units, 0);
  const costBasis = lots.reduce((s, l) => s + l.units * l.costPerUnit, 0);
  const buyPrice = amount > 0 ? costBasis / amount : 0;
  return {
    ...entry,
    lots,
    amount: Math.round(amount * 1e8) / 1e8,
    buyPrice: Math.round(buyPrice * 100) / 100,
  };
}

export function migratePortfolioEntries(
  entries: PortfolioEntry[],
  now?: string,
): PortfolioEntry[] {
  return entries.map((e) => ensureEntryLots(e, now));
}

/** Build a new entry with a single acquisition lot. */
export function buildEntryWithLot(
  entry: Omit<PortfolioEntry, 'lots'>,
  acquiredAt?: string,
): PortfolioEntry {
  const at = acquiredAt ?? new Date().toISOString();
  const lot: PortfolioLot = {
    id: nextLotId(`lot-${entry.id}`),
    units: entry.amount,
    costPerUnit: entry.buyPrice,
    acquiredAt: at,
  };
  return syncEntryAggregates({ ...entry, lots: [lot] });
}

/** Replace all lots with a single lot (manual edit path). */
export function replaceWithSingleLot(
  entry: PortfolioEntry,
  units: number,
  costPerUnit: number,
  acquiredAt?: string,
): PortfolioEntry {
  const preservedAt = entry.lots?.[0]?.acquiredAt;
  const lot: PortfolioLot = {
    id: nextLotId(`lot-${entry.id}`),
    units,
    costPerUnit,
    acquiredAt: acquiredAt ?? preservedAt ?? new Date().toISOString(),
  };
  return syncEntryAggregates({ ...entry, lots: [lot] });
}

/** Append an acquisition lot (e.g. Coinbase balance increase). */
export function appendAcquisitionLot(
  entry: PortfolioEntry,
  deltaUnits: number,
  costPerUnit: number,
  acquiredAt?: string,
): PortfolioEntry {
  if (deltaUnits <= 0) return syncEntryAggregates(ensureEntryLots(entry));
  const base = ensureEntryLots(entry);
  const lot: PortfolioLot = {
    id: nextLotId(`lot-${entry.id}`),
    units: deltaUnits,
    costPerUnit,
    acquiredAt: acquiredAt ?? new Date().toISOString(),
    note: entry.source === 'coinbase' ? 'Coinbase sync acquisition' : undefined,
  };
  return syncEntryAggregates({ ...base, lots: [...(base.lots ?? []), lot] });
}

function sortLotsForMethod(
  lots: PortfolioLot[],
  method: CostBasisMethod,
  specLotIds?: string[],
): PortfolioLot[] {
  const open = lots.filter((l) => l.units > 0);
  if (method === 'SpecID' && specLotIds && specLotIds.length > 0) {
    const byId = new Map(open.map((l) => [l.id, l]));
    const ordered: PortfolioLot[] = [];
    for (const id of specLotIds) {
      const lot = byId.get(id);
      if (lot) ordered.push(lot);
    }
    return ordered;
  }
  if (method === 'HIFO') {
    return [...open].sort((a, b) => {
      if (b.costPerUnit !== a.costPerUnit) return b.costPerUnit - a.costPerUnit;
      return a.acquiredAt.localeCompare(b.acquiredAt);
    });
  }
  // FIFO default
  return [...open].sort((a, b) => a.acquiredAt.localeCompare(b.acquiredAt));
}

/** Select which lots to consume for a sale without mutating state. */
export function selectLotsForSale(
  lots: PortfolioLot[],
  unitsToSell: number,
  method: CostBasisMethod,
  specLotIds?: string[],
): { consumptions: LotConsumption[]; error?: string } {
  if (!Number.isFinite(unitsToSell) || unitsToSell <= 0) {
    return { consumptions: [], error: 'Units to sell must be positive' };
  }
  const available = lots.reduce((s, l) => s + l.units, 0);
  if (unitsToSell > available + 1e-10) {
    return { consumptions: [], error: `Cannot sell ${unitsToSell} — only ${available} available` };
  }

  const ordered = sortLotsForMethod(lots, method, specLotIds);
  if (method === 'SpecID' && (!specLotIds || specLotIds.length === 0)) {
    return { consumptions: [], error: 'SpecID requires at least one lot id' };
  }

  const consumptions: LotConsumption[] = [];
  let remaining = unitsToSell;

  for (const lot of ordered) {
    if (remaining <= 1e-10) break;
    const take = Math.min(lot.units, remaining);
    if (take > 0) {
      consumptions.push({ lotId: lot.id, units: take, costPerUnit: lot.costPerUnit });
      remaining -= take;
    }
  }

  if (remaining > 1e-8) {
    return { consumptions: [], error: 'Insufficient lot units for SpecID selection' };
  }

  return { consumptions };
}

/** Apply lot consumptions and return updated lots array. */
export function applyLotConsumptions(
  lots: PortfolioLot[],
  consumptions: LotConsumption[],
): PortfolioLot[] {
  const takeMap = new Map(consumptions.map((c) => [c.lotId, c.units]));
  return lots
    .map((lot) => {
      const take = takeMap.get(lot.id) ?? 0;
      if (take <= 0) return lot;
      const nextUnits = Math.round((lot.units - take) * 1e8) / 1e8;
      return { ...lot, units: Math.max(0, nextUnits) };
    })
    .filter((l) => l.units > 1e-10);
}

export interface SellFromEntryParams {
  unitsToSell: number;
  salePricePerUnit: number;
  method: CostBasisMethod;
  specLotIds?: string[];
  timestamp?: string;
  note?: string;
}

export interface SellFromEntryResult {
  entry: PortfolioEntry;
  event: RealizedGainEvent;
}

/** Sell units from an entry using the chosen cost-basis method. */
export function sellFromEntry(
  entry: PortfolioEntry,
  params: SellFromEntryParams,
): { ok: true; result: SellFromEntryResult } | { ok: false; error: string } {
  const base = ensureEntryLots(entry);
  const { unitsToSell, salePricePerUnit, method, specLotIds, timestamp, note } = params;

  if (!Number.isFinite(salePricePerUnit) || salePricePerUnit < 0) {
    return { ok: false, error: 'Sale price must be non-negative' };
  }

  const { consumptions, error } = selectLotsForSale(
    base.lots ?? [],
    unitsToSell,
    method,
    specLotIds,
  );
  if (error) return { ok: false, error };

  const costBasisUsd = consumptions.reduce((s, c) => s + c.units * c.costPerUnit, 0);
  const proceedsUsd = unitsToSell * salePricePerUnit;
  const realizedGainUsd = proceedsUsd - costBasisUsd;
  const updatedLots = applyLotConsumptions(base.lots ?? [], consumptions);
  const updatedEntry = syncEntryAggregates({ ...base, lots: updatedLots });

  const event: RealizedGainEvent = {
    id: `rg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: timestamp ?? new Date().toISOString(),
    entryId: entry.id,
    symbol: entry.symbol,
    unitsSold: unitsToSell,
    salePricePerUnit,
    proceedsUsd: Math.round(proceedsUsd * 100) / 100,
    costBasisUsd: Math.round(costBasisUsd * 100) / 100,
    realizedGainUsd: Math.round(realizedGainUsd * 100) / 100,
    costBasisMethod: method,
    lotConsumptions: consumptions,
    note,
  };

  return { ok: true, result: { entry: updatedEntry, event } };
}

/** Unrealized P&L for one open entry at a mark price. */
export function unrealizedForEntry(
  entry: PortfolioEntry,
  currentPrice: number,
): UnrealizedLine {
  const base = ensureEntryLots(entry);
  const units = base.amount;
  const costBasisUsd = (base.lots ?? []).reduce((s, l) => s + l.units * l.costPerUnit, 0);
  const marketValueUsd = units * currentPrice;
  return {
    entryId: entry.id,
    symbol: entry.symbol,
    units,
    costBasisUsd: Math.round(costBasisUsd * 100) / 100,
    marketValueUsd: Math.round(marketValueUsd * 100) / 100,
    unrealizedPnlUsd: Math.round((marketValueUsd - costBasisUsd) * 100) / 100,
  };
}

export function summarizeUnrealized(
  entries: PortfolioEntry[],
  getPrice: (symbol: string) => number,
): UnrealizedSummary {
  const lines: UnrealizedLine[] = [];
  for (const entry of entries) {
    const assetId = resolvePortfolioAssetId(entry.symbol);
    if (!assetId) continue;
    const price = getPrice(entry.symbol);
    if (entry.amount <= 0) continue;
    lines.push(unrealizedForEntry(entry, price));
  }
  const totalCostBasisUsd = lines.reduce((s, l) => s + l.costBasisUsd, 0);
  const totalMarketValueUsd = lines.reduce((s, l) => s + l.marketValueUsd, 0);
  return {
    lines,
    totalCostBasisUsd: Math.round(totalCostBasisUsd * 100) / 100,
    totalMarketValueUsd: Math.round(totalMarketValueUsd * 100) / 100,
    totalUnrealizedPnlUsd: Math.round((totalMarketValueUsd - totalCostBasisUsd) * 100) / 100,
  };
}

export function summarizeRealized(events: RealizedGainEvent[]): RealizedSummary {
  const ordered = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const totalProceedsUsd = ordered.reduce((s, e) => s + e.proceedsUsd, 0);
  const totalCostBasisUsd = ordered.reduce((s, e) => s + e.costBasisUsd, 0);
  return {
    events: ordered,
    totalProceedsUsd: Math.round(totalProceedsUsd * 100) / 100,
    totalCostBasisUsd: Math.round(totalCostBasisUsd * 100) / 100,
    totalRealizedPnlUsd: Math.round((totalProceedsUsd - totalCostBasisUsd) * 100) / 100,
  };
}

/** Sum fine troy oz across XAU + PAXG + XAUT holdings. */
export function totalFineGoldOz(entries: PortfolioEntry[]): number {
  let oz = 0;
  for (const entry of entries) {
    const assetId = resolvePortfolioAssetId(entry.symbol);
    if (!assetId) continue;
    oz += fineGoldOzForHolding(assetId, entry.amount);
  }
  return Math.round(oz * 1e6) / 1e6;
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const LOTS_CSV_HEADER = [
  'section',
  'symbol',
  'lot_id',
  'units',
  'cost_per_unit_usd',
  'cost_basis_usd',
  'acquired_at',
  'note',
  'current_price_usd',
  'market_value_usd',
  'unrealized_pnl_usd',
];

const REALIZED_CSV_HEADER = [
  'section',
  'timestamp',
  'symbol',
  'units_sold',
  'sale_price_usd',
  'proceeds_usd',
  'cost_basis_usd',
  'realized_gain_usd',
  'cost_basis_method',
  'lot_ids',
  'note',
];

/**
 * Serialize open lots + realized journal for accountant handoff.
 * Educational export only — not a tax filing product.
 */
export function portfolioToCsv(
  entries: PortfolioEntry[],
  realizedEvents: RealizedGainEvent[],
  getPrice: (symbol: string) => number,
): string {
  const rows: string[] = [];
  rows.push(LOTS_CSV_HEADER.join(','));

  for (const entry of migratePortfolioEntries(entries)) {
    const price = getPrice(entry.symbol);
    for (const lot of entry.lots ?? []) {
      const costBasis = lot.units * lot.costPerUnit;
      const marketValue = lot.units * price;
      rows.push(
        [
          'open_lot',
          entry.symbol,
          lot.id,
          lot.units,
          lot.costPerUnit,
          Math.round(costBasis * 100) / 100,
          lot.acquiredAt,
          lot.note ?? '',
          price,
          Math.round(marketValue * 100) / 100,
          Math.round((marketValue - costBasis) * 100) / 100,
        ]
          .map(csvCell)
          .join(','),
      );
    }
  }

  rows.push('');
  rows.push(REALIZED_CSV_HEADER.join(','));

  const realized = summarizeRealized(realizedEvents);
  for (const e of realized.events) {
    rows.push(
      [
        'realized_gain',
        e.timestamp,
        e.symbol,
        e.unitsSold,
        e.salePricePerUnit,
        e.proceedsUsd,
        e.costBasisUsd,
        e.realizedGainUsd,
        e.costBasisMethod,
        e.lotConsumptions.map((c) => c.lotId).join(';'),
        e.note ?? '',
      ]
        .map(csvCell)
        .join(','),
    );
  }

  return rows.join('\n');
}
