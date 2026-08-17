import { describe, it, expect, vi } from 'vitest';
import {
  executeOrderWithLifecycle,
  cancelOrderWithLifecycle,
  pollOrderStatus,
  requestedQtyFromOrder,
  OrderExecutionError,
  type ExecuteOrderParams,
  type OrderExecutionDeps,
  type CancelOrderDeps,
  type PollOrderStatusDeps,
} from './executeOrder';
import { buildMarketIocOrder, buildLimitGtcOrder } from './orderTypes';
import { buildIdempotencyKey, type OrderRecord } from './orderLifecycle';
import type { RiskCheckResult } from './riskEngine';

function makeMockDeps(overrides: Partial<OrderExecutionDeps> = {}): {
  deps: OrderExecutionDeps;
  upserted: OrderRecord[];
  routeOrderMock: ReturnType<typeof vi.fn>;
} {
  const upserted: OrderRecord[] = [];
  const routeOrderMock = vi.fn().mockResolvedValue({
    success: true,
    order_id: 'venue-123',
    message: 'Order placed',
  });

  const deps: OrderExecutionDeps = {
    evaluateRisk: vi.fn().mockReturnValue({ allowed: true, reasons: [] } as RiskCheckResult),
    upsertOrder: vi.fn((rec: OrderRecord) => {
      upserted.push(rec);
    }),
    getOrders: vi.fn().mockReturnValue([]),
    routeOrder: routeOrderMock,
    now: vi.fn().mockReturnValue(1700000000000),
    ...overrides,
  };

  return { deps, upserted, routeOrderMock };
}

function makeTestOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    clientOrderId: 'cli-test',
    exchange: 'coinbase',
    mode: 'live',
    state: 'submitted',
    productId: 'PAXG-USD',
    side: 'BUY',
    requestedQty: 0.5,
    filledQty: 0,
    feeUsd: 0,
    idempotencyKey: 'coinbase:PAXG-USD:BUY:manual:0.5',
    createdAt: '2026-08-17T00:00:00Z',
    updatedAt: '2026-08-17T00:00:00Z',
    ...overrides,
  };
}

describe('executeOrder pure orchestrator', () => {
  describe('requestedQtyFromOrder', () => {
    it('extracts base_size from market IOC orders', () => {
      const order = buildMarketIocOrder('PAXG-USD', 'BUY', 1.25);
      expect(requestedQtyFromOrder(order)).toBe(1.25);
    });

    it('extracts base_size from limit GTC orders', () => {
      const order = buildLimitGtcOrder('PAXG-USD', 'SELL', 0.5, 2650);
      expect(requestedQtyFromOrder(order)).toBe(0.5);
    });

    it('returns 0 for invalid or empty sizes', () => {
      const order = {
        product_id: 'PAXG-USD',
        side: 'BUY',
        order_configuration: {
          market_market_ioc: { base_size: 'invalid' },
        },
      } as unknown as ReturnType<typeof buildMarketIocOrder>;
      expect(requestedQtyFromOrder(order)).toBe(0);
    });
  });

  describe('executeOrderWithLifecycle', () => {
    it('blocks execution when risk gate rejects order', async () => {
      const { deps, upserted, routeOrderMock } = makeMockDeps({
        evaluateRisk: vi.fn().mockReturnValue({
          allowed: false,
          reasons: ['Kill switch active', 'Single trade notional exceeded'],
        }),
      });

      const params: ExecuteOrderParams = {
        order: buildMarketIocOrder('PAXG-USD', 'BUY', 0.5),
        dryRun: false,
        exchange: 'coinbase',
      };

      const result = await executeOrderWithLifecycle(params, deps);

      expect(result.result.success).toBe(false);
      expect(result.result.error).toContain('Kill switch active');
      expect(result.result.error).toContain('Single trade notional exceeded');
      expect(upserted).toHaveLength(0);
      expect(routeOrderMock).not.toHaveBeenCalled();
    });

    it('blocks execution when an in-flight duplicate order exists', async () => {
      const existingOrder = makeTestOrder({
        clientOrderId: 'cli-existing',
        exchange: 'coinbase',
        mode: 'live',
        state: 'submitted',
        productId: 'PAXG-USD',
        side: 'BUY',
        requestedQty: 0.5,
        source: 'sug-1',
        idempotencyKey: buildIdempotencyKey('coinbase', 'PAXG-USD', 'BUY', 0.5, 'sug-1'),
      });

      const { deps, upserted, routeOrderMock } = makeMockDeps({
        getOrders: vi.fn().mockReturnValue([existingOrder]),
      });

      const params: ExecuteOrderParams = {
        order: buildMarketIocOrder('PAXG-USD', 'BUY', 0.5),
        dryRun: false,
        exchange: 'coinbase',
        source: 'sug-1',
      };

      const result = await executeOrderWithLifecycle(params, deps);

      expect(result.result.success).toBe(false);
      expect(result.result.error).toBe('Duplicate order in flight');
      expect(result.record).toBe(existingOrder);
      expect(upserted).toHaveLength(0);
      expect(routeOrderMock).not.toHaveBeenCalled();
    });

    it('executes paper trade without calling routeOrder', async () => {
      const { deps, upserted, routeOrderMock } = makeMockDeps();

      const params: ExecuteOrderParams = {
        order: buildMarketIocOrder('PAXG-USD', 'BUY', 0.5),
        dryRun: true,
        exchange: 'coinbase',
        source: 'test-paper',
        paperFillId: 'fill-999',
        unitPriceUsd: 2600,
      };

      const result = await executeOrderWithLifecycle(params, deps);

      expect(result.result.success).toBe(true);
      expect(result.result.message).toBe('PAPER trade recorded');
      expect(result.record?.mode).toBe('paper');
      expect(result.record?.state).toBe('filled');
      expect(result.record?.venueOrderId).toBe('paper-fill-999');
      expect(result.record?.filledQty).toBe(0.5);

      // Pending state then Filled state upserted
      expect(upserted).toHaveLength(2);
      expect(upserted[0].state).toBe('pending');
      expect(upserted[1].state).toBe('filled');
      expect(routeOrderMock).not.toHaveBeenCalled();
    });

    it('executes live trade successfully and transitions state', async () => {
      const { deps, upserted, routeOrderMock } = makeMockDeps();
      routeOrderMock.mockResolvedValue({
        success: true,
        order_id: 'cb-order-456',
        message: 'Order accepted',
      });

      const params: ExecuteOrderParams = {
        order: buildMarketIocOrder('PAXG-USD', 'BUY', 0.25),
        dryRun: false,
        exchange: 'coinbase',
        source: 'live-test',
      };

      const result = await executeOrderWithLifecycle(params, deps);

      expect(result.result.success).toBe(true);
      expect(result.record?.state).toBe('submitted');
      expect(result.record?.venueOrderId).toBe('cb-order-456');

      expect(upserted).toHaveLength(2);
      expect(upserted[0].state).toBe('pending');
      expect(upserted[1].state).toBe('submitted');
      expect(routeOrderMock).toHaveBeenCalledTimes(1);
    });

    it('records failed state when routeOrder returns venue failure', async () => {
      const { deps, upserted, routeOrderMock } = makeMockDeps();
      routeOrderMock.mockResolvedValue({
        success: false,
        error: 'INSUFFICIENT_FUNDS',
      });

      const params: ExecuteOrderParams = {
        order: buildMarketIocOrder('PAXG-USD', 'BUY', 10),
        dryRun: false,
        exchange: 'kraken',
      };

      const result = await executeOrderWithLifecycle(params, deps);

      expect(result.result.success).toBe(false);
      expect(result.result.error).toBe('INSUFFICIENT_FUNDS');
      expect(result.record?.state).toBe('failed');
      expect(result.record?.error).toBe('INSUFFICIENT_FUNDS');

      expect(upserted).toHaveLength(2);
      expect(upserted[0].state).toBe('pending');
      expect(upserted[1].state).toBe('failed');
    });

    it('records failed state and rethrows on network/transport throw', async () => {
      const { deps, upserted, routeOrderMock } = makeMockDeps();
      routeOrderMock.mockRejectedValue(new Error('Connection timed out'));

      const params: ExecuteOrderParams = {
        order: buildMarketIocOrder('PAXG-USD', 'BUY', 0.1),
        dryRun: false,
        exchange: 'coinbase',
      };

      await expect(executeOrderWithLifecycle(params, deps)).rejects.toThrow('Connection timed out');

      expect(upserted).toHaveLength(2);
      expect(upserted[0].state).toBe('pending');
      expect(upserted[1].state).toBe('failed');
      expect(upserted[1].error).toBe('Connection timed out');
    });
  });

  describe('cancelOrderWithLifecycle', () => {
    it('cancels an open order successfully', async () => {
      const upserted: OrderRecord[] = [];
      const cancelVenueOrder = vi.fn().mockResolvedValue({ success: true });
      const deps: CancelOrderDeps = {
        upsertOrder: (rec) => upserted.push(rec),
        cancelVenueOrder,
        now: () => 1700000000000,
      };

      const order = makeTestOrder({
        clientOrderId: 'cli-1',
        venueOrderId: 'venue-1',
        exchange: 'coinbase',
        mode: 'live',
        state: 'open',
        productId: 'PAXG-USD',
        side: 'BUY',
        requestedQty: 1,
      });

      const cancelled = await cancelOrderWithLifecycle(order, deps);

      expect(cancelled.state).toBe('cancelled');
      expect(cancelVenueOrder).toHaveBeenCalledWith('venue-1', 'coinbase', 'PAXG-USD');
      expect(upserted).toHaveLength(1);
      expect(upserted[0].state).toBe('cancelled');
    });

    it('marks order as failed when cancelVenueOrder fails', async () => {
      const upserted: OrderRecord[] = [];
      const cancelVenueOrder = vi.fn().mockResolvedValue({
        success: false,
        error: 'Order already filled',
      });
      const deps: CancelOrderDeps = {
        upsertOrder: (rec) => upserted.push(rec),
        cancelVenueOrder,
      };

      const order = makeTestOrder({
        clientOrderId: 'cli-2',
        venueOrderId: 'venue-2',
        exchange: 'kraken',
        mode: 'live',
        state: 'submitted',
        productId: 'PAXG-USD',
        side: 'SELL',
        requestedQty: 1,
      });

      const failed = await cancelOrderWithLifecycle(order, deps);

      expect(failed.state).toBe('failed');
      expect(failed.error).toBe('Order already filled');
      expect(upserted).toHaveLength(1);
    });

    it('marks order as failed immediately if venueOrderId is missing', async () => {
      const upserted: OrderRecord[] = [];
      const cancelVenueOrder = vi.fn();
      const deps: CancelOrderDeps = {
        upsertOrder: (rec) => upserted.push(rec),
        cancelVenueOrder,
      };

      const order = makeTestOrder({
        clientOrderId: 'cli-3',
        exchange: 'coinbase',
        mode: 'live',
        state: 'pending',
        productId: 'PAXG-USD',
        side: 'BUY',
        requestedQty: 1,
        venueOrderId: undefined,
      });

      const failed = await cancelOrderWithLifecycle(order, deps);

      expect(failed.state).toBe('failed');
      expect(failed.error).toBe('No venue order id to cancel');
      expect(cancelVenueOrder).not.toHaveBeenCalled();
      expect(upserted).toHaveLength(1);
    });
  });

  describe('pollOrderStatus', () => {
    it('delegates to pollVenueStatus when venueOrderId is present', async () => {
      const pollVenueStatus = vi.fn().mockResolvedValue({
        status: 'filled',
        venueOrderId: 'venue-10',
        filledQty: 0.5,
        avgFillPrice: 2650,
      });

      const deps: PollOrderStatusDeps = { pollVenueStatus };

      const order = makeTestOrder({
        clientOrderId: 'cli-10',
        venueOrderId: 'venue-10',
        exchange: 'coinbase',
        mode: 'live',
        state: 'submitted',
        productId: 'PAXG-USD',
        side: 'BUY',
        requestedQty: 0.5,
      });

      const result = await pollOrderStatus(order, deps);

      expect(result.status).toBe('filled');
      expect(result.filledQty).toBe(0.5);
      expect(pollVenueStatus).toHaveBeenCalledWith('venue-10', 'coinbase', 'PAXG-USD');
    });

    it('returns unknown error when venueOrderId is missing', async () => {
      const pollVenueStatus = vi.fn();
      const deps: PollOrderStatusDeps = { pollVenueStatus };

      const order = makeTestOrder({
        clientOrderId: 'cli-11',
        exchange: 'coinbase',
        mode: 'live',
        state: 'pending',
        productId: 'PAXG-USD',
        side: 'BUY',
        requestedQty: 0.5,
        venueOrderId: undefined,
      });

      const result = await pollOrderStatus(order, deps);

      expect(result.status).toBe('unknown');
      expect(result.error).toBe('No venue order id');
      expect(pollVenueStatus).not.toHaveBeenCalled();
    });
  });

  describe('OrderExecutionError', () => {
    it('creates error with exchange property', () => {
      const err = new OrderExecutionError('Failed to execute', 'kraken');
      expect(err.message).toBe('Failed to execute');
      expect(err.exchange).toBe('kraken');
      expect(err.name).toBe('OrderExecutionError');
    });
  });
});
