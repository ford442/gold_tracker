import { describe, it, expect } from 'vitest';
import { orderJournalService } from '../orderJournalService';
import type { OrderRecord } from '@/lib/orderLifecycle';

const sampleOrder: OrderRecord = {
  clientOrderId: 'gt-test-1',
  venueOrderId: 'venue-1',
  exchange: 'coinbase',
  mode: 'live',
  state: 'submitted',
  productId: 'PAXG-USD',
  side: 'BUY',
  requestedQty: 1.0,
  filledQty: 0,
  feeUsd: 0,
  idempotencyKey: 'k-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('orderJournalService (with mock/offline fallback)', () => {
  it('fetchUserOrders returns empty array when unconfigured or invalid user', async () => {
    const orders = await orderJournalService.fetchUserOrders('');
    expect(orders).toEqual([]);
  });

  it('fetchUserOrders handles queries without throwing', async () => {
    const orders = await orderJournalService.fetchUserOrders('user-123');
    expect(Array.isArray(orders)).toBe(true);
  });

  it('upsertOrder returns false for missing userId or clientOrderId', async () => {
    const res1 = await orderJournalService.upsertOrder(sampleOrder, '');
    expect(res1).toBe(false);

    const res2 = await orderJournalService.upsertOrder({ ...sampleOrder, clientOrderId: '' }, 'user-123');
    expect(res2).toBe(false);
  });

  it('upsertOrders returns false for empty records array', async () => {
    const res = await orderJournalService.upsertOrders([], 'user-123');
    expect(res).toBe(false);
  });
});
