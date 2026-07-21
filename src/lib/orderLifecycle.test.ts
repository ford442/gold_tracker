import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPendingOrder,
  applyPlaceResult,
  mergePollResult,
  detectStaleSubmitted,
  canCancelOrder,
  canResubmit,
  findBlockingOrder,
  applyPaperFill,
  reconcileOrderBatch,
  normalizeCoinbasePlaceResponse,
  normalizeKrakenPlaceResponse,
  generateClientOrderId,
  buildIdempotencyKey,
  isTerminalState,
  needsReconciliation,
  FIXTURE_COINBASE_PLACE_SUCCESS,
  FIXTURE_COINBASE_PLACE_FAILURE,
  FIXTURE_COINBASE_DRY_RUN,
  FIXTURE_KRAKEN_PLACE_SUCCESS,
  FIXTURE_KRAKEN_PLACE_FAILURE,
  FIXTURE_COINBASE_POLL_PARTIAL,
  FIXTURE_COINBASE_POLL_FILLED,
  type OrderRecord,
} from './orderLifecycle';

const BASE_TS = '2026-07-20T12:00:00.000Z';

function pending(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    ...createPendingOrder({
      clientOrderId: 'gt-1',
      exchange: 'coinbase',
      mode: 'live',
      productId: 'PAXG-USD',
      side: 'BUY',
      requestedQty: 0.5,
      idempotencyKey: 'k1',
      now: BASE_TS,
    }),
    ...overrides,
  };
}

describe('orderLifecycle', () => {
  beforeEach(() => {
    // reset seq for deterministic ids in generateClientOrderId tests
  });

  it('creates pending order', () => {
    const o = pending();
    expect(o.state).toBe('pending');
    expect(o.filledQty).toBe(0);
  });

  it('normalizes Coinbase success to submitted for live', () => {
    const snap = normalizeCoinbasePlaceResponse(FIXTURE_COINBASE_PLACE_SUCCESS, 0.5, 'live');
    expect(snap.state).toBe('submitted');
    expect(snap.venueOrderId).toBe('cb-order-abc123');
  });

  it('normalizes Coinbase dry-run to filled', () => {
    const snap = normalizeCoinbasePlaceResponse(FIXTURE_COINBASE_DRY_RUN, 0.5, 'live');
    expect(snap.state).toBe('filled');
    expect(snap.filledQty).toBe(0.5);
  });

  it('normalizes Coinbase failure', () => {
    const snap = normalizeCoinbasePlaceResponse(FIXTURE_COINBASE_PLACE_FAILURE, 0.5, 'live');
    expect(snap.state).toBe('failed');
    expect(snap.error).toContain('INSUFFICIENT');
  });

  it('normalizes Kraken success to submitted for live', () => {
    const snap = normalizeKrakenPlaceResponse(FIXTURE_KRAKEN_PLACE_SUCCESS, 1, 'live');
    expect(snap.state).toBe('submitted');
    expect(snap.venueOrderId).toBe('KRAKEN-TXID-XYZ');
  });

  it('normalizes Kraken failure', () => {
    const snap = normalizeKrakenPlaceResponse(FIXTURE_KRAKEN_PLACE_FAILURE, 1, 'live');
    expect(snap.state).toBe('failed');
  });

  it('applyPlaceResult transitions pending → submitted on live success', () => {
    const result = applyPlaceResult(pending(), FIXTURE_COINBASE_PLACE_SUCCESS, BASE_TS);
    expect(result.state).toBe('submitted');
    expect(result.venueOrderId).toBe('cb-order-abc123');
    expect(result.submittedAt).toBe(BASE_TS);
  });

  it('applyPlaceResult marks failed on venue error', () => {
    const result = applyPlaceResult(pending(), FIXTURE_COINBASE_PLACE_FAILURE, BASE_TS);
    expect(result.state).toBe('failed');
  });

  it('mergePollResult updates partial fill without new row', () => {
    const submitted = applyPlaceResult(pending(), FIXTURE_COINBASE_PLACE_SUCCESS, BASE_TS);
    const partial = mergePollResult(submitted, FIXTURE_COINBASE_POLL_PARTIAL, BASE_TS);
    expect(partial.clientOrderId).toBe(submitted.clientOrderId);
    expect(partial.state).toBe('partially_filled');
    expect(partial.filledQty).toBe(0.25);
    expect(partial.feeUsd).toBe(1.59);
  });

  it('mergePollResult upgrades partial → filled', () => {
    const submitted = applyPlaceResult(pending(), FIXTURE_COINBASE_PLACE_SUCCESS, BASE_TS);
    const partial = mergePollResult(submitted, FIXTURE_COINBASE_POLL_PARTIAL, BASE_TS);
    const filled = mergePollResult(partial, FIXTURE_COINBASE_POLL_FILLED, BASE_TS);
    expect(filled.state).toBe('filled');
    expect(filled.filledQty).toBe(0.5);
  });

  it('detectStaleSubmitted marks needs_attention after threshold', () => {
    const submitted = {
      ...applyPlaceResult(pending(), FIXTURE_COINBASE_PLACE_SUCCESS, BASE_TS),
      submittedAt: new Date(Date.now() - 120_000).toISOString(),
    };
    const stale = detectStaleSubmitted(submitted, Date.now());
    expect(stale?.state).toBe('needs_attention');
    expect(stale?.attentionReason).toMatch(/No venue confirmation/);
  });

  it('canCancelOrder for open live orders only', () => {
    expect(canCancelOrder({ ...pending(), state: 'open', mode: 'live' })).toBe(true);
    expect(canCancelOrder({ ...pending(), state: 'open', mode: 'paper' })).toBe(false);
    expect(canCancelOrder({ ...pending(), state: 'filled', mode: 'live' })).toBe(false);
  });

  it('findBlockingOrder prevents duplicate in-flight idempotency keys', () => {
    const orders = [pending({ idempotencyKey: 'dup', state: 'submitted' })];
    expect(findBlockingOrder(orders, 'dup')).toBeDefined();
    expect(findBlockingOrder(orders, 'other')).toBeUndefined();
  });

  it('canResubmit after cooldown on failed', () => {
    const failed = {
      ...pending(),
      state: 'failed' as const,
      updatedAt: new Date(Date.now() - 60_000).toISOString(),
    };
    expect(canResubmit(failed, Date.now())).toBe(true);
  });

  it('applyPaperFill uses paper mode and links fill id', () => {
    const result = applyPaperFill(pending({ mode: 'paper' }), 'paper-123', 0.5, 1.5, 2650, BASE_TS);
    expect(result.mode).toBe('paper');
    expect(result.state).toBe('filled');
    expect(result.paperFillId).toBe('paper-123');
  });

  it('reconcileOrderBatch merges polls by venue id', () => {
    const nowIso = new Date().toISOString();
    const submitted = applyPlaceResult(pending(), FIXTURE_COINBASE_PLACE_SUCCESS, nowIso);
    const polls = new Map([[submitted.venueOrderId!, FIXTURE_COINBASE_POLL_FILLED]]);
    const [reconciled] = reconcileOrderBatch([submitted], polls, Date.now());
    expect(reconciled.state).toBe('filled');
  });

  it('terminal vs reconcile state helpers', () => {
    expect(isTerminalState('filled')).toBe(true);
    expect(needsReconciliation('submitted')).toBe(true);
    expect(needsReconciliation('filled')).toBe(false);
  });

  it('generateClientOrderId and idempotency key are stable shape', () => {
    expect(generateClientOrderId(1000)).toMatch(/^gt-1000-/);
    expect(buildIdempotencyKey('coinbase', 'PAXG-USD', 'BUY', 0.5, 's1')).toBe(
      'coinbase:PAXG-USD:BUY:s1:0.5',
    );
  });
});
