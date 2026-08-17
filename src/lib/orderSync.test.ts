import { describe, it, expect } from 'vitest';
import {
  orderRecordToDbRow,
  dbRowToOrderRecord,
  resolveOrderConflict,
  mergeOrderRecords,
  findUnsyncedOrders,
  type DbOrderJournalRow,
} from './orderSync';
import type { OrderRecord } from './orderLifecycle';

const BASE_TS_1 = '2026-07-20T10:00:00.000Z';
const BASE_TS_2 = '2026-07-20T10:05:00.000Z';
const BASE_TS_3 = '2026-07-20T10:10:00.000Z';

function sampleRecord(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    clientOrderId: 'gt-100-1',
    venueOrderId: 'cb-venue-1',
    exchange: 'coinbase',
    mode: 'live',
    state: 'submitted',
    productId: 'PAXG-USD',
    side: 'BUY',
    requestedQty: 1.5,
    filledQty: 0,
    avgFillPrice: undefined,
    feeUsd: 0,
    idempotencyKey: 'coinbase:PAXG-USD:BUY:manual:1.5',
    source: 'manual',
    error: undefined,
    needsAttention: false,
    createdAt: BASE_TS_1,
    updatedAt: BASE_TS_1,
    ...overrides,
  };
}

function sampleDbRow(overrides: Partial<DbOrderJournalRow> = {}): DbOrderJournalRow {
  return {
    user_id: 'user-abc',
    client_order_id: 'gt-100-1',
    venue_order_id: 'cb-venue-1',
    exchange: 'coinbase',
    mode: 'live',
    state: 'submitted',
    product_id: 'PAXG-USD',
    side: 'BUY',
    requested_qty: '1.5',
    filled_qty: '0',
    avg_fill_price: null,
    fee_usd: '0',
    idempotency_key: 'coinbase:PAXG-USD:BUY:manual:1.5',
    source: 'manual',
    error: null,
    paper_fill_id: null,
    needs_attention: false,
    attention_reason: null,
    submitted_at: BASE_TS_1,
    created_at: BASE_TS_1,
    updated_at: BASE_TS_1,
    ...overrides,
  };
}

describe('orderSync - DB Mapping', () => {
  it('maps OrderRecord to DbOrderJournalRow accurately', () => {
    const record = sampleRecord({
      avgFillPrice: 2650.5,
      feeUsd: 3.25,
      filledQty: 1.5,
      state: 'filled',
      paperFillId: 'fill-1',
      needsAttention: true,
      attentionReason: 'manual review',
    });

    const row = orderRecordToDbRow(record, 'user-123');

    expect(row.user_id).toBe('user-123');
    expect(row.client_order_id).toBe('gt-100-1');
    expect(row.venue_order_id).toBe('cb-venue-1');
    expect(row.exchange).toBe('coinbase');
    expect(row.mode).toBe('live');
    expect(row.state).toBe('filled');
    expect(row.product_id).toBe('PAXG-USD');
    expect(row.side).toBe('BUY');
    expect(row.requested_qty).toBe(1.5);
    expect(row.filled_qty).toBe(1.5);
    expect(row.avg_fill_price).toBe(2650.5);
    expect(row.fee_usd).toBe(3.25);
    expect(row.idempotency_key).toBe('coinbase:PAXG-USD:BUY:manual:1.5');
    expect(row.paper_fill_id).toBe('fill-1');
    expect(row.needs_attention).toBe(true);
    expect(row.attention_reason).toBe('manual review');
  });

  it('maps DbOrderJournalRow to OrderRecord accurately (with numeric conversion)', () => {
    const row = sampleDbRow({
      requested_qty: '2.5',
      filled_qty: '1.25',
      avg_fill_price: '2700.10',
      fee_usd: '5.40',
      state: 'partially_filled',
      needs_attention: true,
      attention_reason: 'venue hiccup',
    });

    const record = dbRowToOrderRecord(row);

    expect(record.clientOrderId).toBe('gt-100-1');
    expect(record.requestedQty).toBe(2.5);
    expect(record.filledQty).toBe(1.25);
    expect(record.avgFillPrice).toBe(2700.1);
    expect(record.feeUsd).toBe(5.4);
    expect(record.state).toBe('partially_filled');
    expect(record.needsAttention).toBe(true);
    expect(record.attentionReason).toBe('venue hiccup');
  });

  it('handles null / undefined / zero fields in dbRowToOrderRecord gracefully', () => {
    const row = sampleDbRow({
      venue_order_id: null,
      avg_fill_price: null,
      source: null,
      error: null,
      paper_fill_id: null,
      attention_reason: null,
      submitted_at: null,
    });

    const record = dbRowToOrderRecord(row);

    expect(record.venueOrderId).toBeUndefined();
    expect(record.avgFillPrice).toBeUndefined();
    expect(record.source).toBeUndefined();
    expect(record.error).toBeUndefined();
    expect(record.paperFillId).toBeUndefined();
    expect(record.attentionReason).toBeUndefined();
    expect(record.submittedAt).toBeUndefined();
  });
});

describe('orderSync - Conflict Resolution', () => {
  it('remote terminal state wins over local non-terminal state', () => {
    const local = sampleRecord({ state: 'submitted', filledQty: 0, updatedAt: BASE_TS_1 });
    const remote = sampleRecord({ state: 'filled', filledQty: 1.5, avgFillPrice: 2650, updatedAt: BASE_TS_2 });

    const winner = resolveOrderConflict(local, remote);
    expect(winner.state).toBe('filled');
    expect(winner.filledQty).toBe(1.5);
    expect(winner.avgFillPrice).toBe(2650);
  });

  it('local terminal state wins over remote non-terminal state', () => {
    const local = sampleRecord({ state: 'cancelled', updatedAt: BASE_TS_2 });
    const remote = sampleRecord({ state: 'open', updatedAt: BASE_TS_1 });

    const winner = resolveOrderConflict(local, remote);
    expect(winner.state).toBe('cancelled');
  });

  it('filled terminal state wins over cancelled if filledQty > 0', () => {
    const localCancelled = sampleRecord({ state: 'cancelled', filledQty: 0, updatedAt: BASE_TS_2 });
    const remoteFilled = sampleRecord({ state: 'filled', filledQty: 1.5, updatedAt: BASE_TS_1 });

    const winner = resolveOrderConflict(localCancelled, remoteFilled);
    expect(winner.state).toBe('filled');
    expect(winner.filledQty).toBe(1.5);
  });

  it('resolves non-terminal conflict by choosing higher filledQty', () => {
    const localPartial = sampleRecord({ state: 'partially_filled', filledQty: 0.5, updatedAt: BASE_TS_1 });
    const remotePartial = sampleRecord({ state: 'partially_filled', filledQty: 1.0, updatedAt: BASE_TS_2 });

    const winner = resolveOrderConflict(localPartial, remotePartial);
    expect(winner.filledQty).toBe(1.0);
  });

  it('resolves pending vs submitted conflict by choosing submitted with venueOrderId', () => {
    const localPending = sampleRecord({ state: 'pending', venueOrderId: undefined, updatedAt: BASE_TS_1 });
    const remoteSubmitted = sampleRecord({ state: 'submitted', venueOrderId: 'cb-123', updatedAt: BASE_TS_2 });

    const winner = resolveOrderConflict(localPending, remoteSubmitted);
    expect(winner.state).toBe('submitted');
    expect(winner.venueOrderId).toBe('cb-123');
  });

  it('preserves local-only properties like paperFillId and source', () => {
    const local = sampleRecord({
      state: 'pending',
      source: 'arb-monitor',
      paperFillId: 'local-fill-1',
      updatedAt: BASE_TS_1,
    });
    const remote = sampleRecord({
      state: 'submitted',
      source: undefined,
      paperFillId: undefined,
      updatedAt: BASE_TS_2,
    });

    const winner = resolveOrderConflict(local, remote);
    expect(winner.state).toBe('submitted');
    expect(winner.source).toBe('arb-monitor');
    expect(winner.paperFillId).toBe('local-fill-1');
  });

  it('determines earliest createdAt and latest updatedAt correctly', () => {
    const local = sampleRecord({ createdAt: BASE_TS_1, updatedAt: BASE_TS_2 });
    const remote = sampleRecord({ createdAt: BASE_TS_2, updatedAt: BASE_TS_3 });

    const winner = resolveOrderConflict(local, remote);
    expect(winner.createdAt).toBe(BASE_TS_1);
    expect(winner.updatedAt).toBe(BASE_TS_3);
  });
});

describe('orderSync - List Merge & Diff', () => {
  it('merges disjoint and overlapping local and remote lists', () => {
    const localOnly = sampleRecord({ clientOrderId: 'local-1', createdAt: BASE_TS_1 });
    const localOverlap = sampleRecord({ clientOrderId: 'shared-1', state: 'submitted', createdAt: BASE_TS_2 });
    const remoteOverlap = sampleRecord({ clientOrderId: 'shared-1', state: 'filled', filledQty: 1.5, createdAt: BASE_TS_2 });
    const remoteOnly = sampleRecord({ clientOrderId: 'remote-1', state: 'filled', createdAt: BASE_TS_3 });

    const merged = mergeOrderRecords([localOnly, localOverlap], [remoteOverlap, remoteOnly]);

    expect(merged).toHaveLength(3);
    // Should be sorted by createdAt DESC: remote-1 (TS_3), shared-1 (TS_2), local-1 (TS_1)
    expect(merged[0].clientOrderId).toBe('remote-1');
    expect(merged[1].clientOrderId).toBe('shared-1');
    expect(merged[1].state).toBe('filled');
    expect(merged[2].clientOrderId).toBe('local-1');
  });

  it('findUnsyncedOrders detects missing or newly modified local orders', () => {
    const syncedOrder = sampleRecord({ clientOrderId: 'synced-1', state: 'filled', updatedAt: BASE_TS_1 });
    const newLocalOrder = sampleRecord({ clientOrderId: 'new-local-1', state: 'pending', updatedAt: BASE_TS_2 });
    const updatedLocalOrder = sampleRecord({ clientOrderId: 'updated-1', state: 'cancelled', updatedAt: BASE_TS_3 });
    const remoteOlderOrder = sampleRecord({ clientOrderId: 'updated-1', state: 'open', updatedAt: BASE_TS_1 });

    const unsynced = findUnsyncedOrders(
      [syncedOrder, newLocalOrder, updatedLocalOrder],
      [syncedOrder, remoteOlderOrder],
    );

    expect(unsynced.map((o) => o.clientOrderId)).toEqual(['new-local-1', 'updated-1']);
  });
});
