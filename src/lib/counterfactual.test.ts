import { describe, it, expect } from 'vitest';
import {
  getCounterfactualFeeBps,
  findClosestPriceInSeries,
  evaluateCounterfactualTrade,
  generateCounterfactualTrajectory,
  COUNTERFACTUAL_RANGE_DAYS,
  type HypotheticalTrade,
} from './counterfactual';

describe('counterfactual engine', () => {
  describe('COUNTERFACTUAL_RANGE_DAYS', () => {
    it('defines standard historical horizons', () => {
      expect(COUNTERFACTUAL_RANGE_DAYS['7d']).toBe(7);
      expect(COUNTERFACTUAL_RANGE_DAYS['14d']).toBe(14);
      expect(COUNTERFACTUAL_RANGE_DAYS['30d']).toBe(30);
      expect(COUNTERFACTUAL_RANGE_DAYS['60d']).toBe(60);
      expect(COUNTERFACTUAL_RANGE_DAYS['90d']).toBe(90);
      expect(COUNTERFACTUAL_RANGE_DAYS['180d']).toBe(180);
      expect(COUNTERFACTUAL_RANGE_DAYS['1y']).toBe(365);
    });
  });

  describe('getCounterfactualFeeBps', () => {
    it('returns zero for none preset', () => {
      expect(getCounterfactualFeeBps('none')).toBe(0);
    });

    it('returns venue taker fees for coinbase and kraken', () => {
      expect(getCounterfactualFeeBps('coinbase')).toBeGreaterThan(0);
      expect(getCounterfactualFeeBps('kraken')).toBeGreaterThan(0);
    });

    it('returns custom bps when custom preset is selected', () => {
      expect(getCounterfactualFeeBps('custom', 45)).toBe(45);
    });
  });

  describe('findClosestPriceInSeries', () => {
    it('finds exact and closest timestamp within tolerance', () => {
      const series: [number, number][] = [
        [1000, 100],
        [2000, 200],
        [3000, 300],
      ];

      expect(findClosestPriceInSeries(series, 1000)).toBe(100);
      expect(findClosestPriceInSeries(series, 2050, 100)).toBe(200);
      expect(findClosestPriceInSeries(series, 2950, 100)).toBe(300);
    });

    it('returns null if closest point exceeds max gap or series is empty', () => {
      const series: [number, number][] = [[1000, 100]];
      expect(findClosestPriceInSeries([], 1000)).toBeNull();
      expect(findClosestPriceInSeries(series, 10000, 100)).toBeNull();
    });

    it('skips non-positive or invalid price entries', () => {
      const series: [number, number][] = [
        [1000, -50],
        [2000, 200],
      ];
      expect(findClosestPriceInSeries(series, 1000)).toBe(200);
    });
  });

  describe('evaluateCounterfactualTrade', () => {
    const tradeTs = 1_700_000_000_000;
    const nowTs = 1_700_000_000_000 + 30 * 86_400_000;

    const btcSeries: [number, number][] = [
      [tradeTs, 60_000],
      [tradeTs + 15 * 86_400_000, 65_000],
      [nowTs, 70_000],
    ];

    const paxgSeries: [number, number][] = [
      [tradeTs, 2_000],
      [tradeTs + 15 * 86_400_000, 2_200],
      [nowTs, 2_500],
    ];

    it('evaluates a profitable swap trade (BTC to PAXG)', () => {
      // Swapping 1 BTC (at $60,000) for 30 PAXG (at $2,000).
      // Now BTC is $70,000 (+16.67%), PAXG is $2,500 (+25%).
      // Value if kept = 1 * 70,000 = $70,000.
      // Value if traded = 30 * 2,500 = $75,000.
      // Delta = +$5,000.
      const trade: HypotheticalTrade = {
        id: 'test-1',
        fromAsset: 'bitcoin',
        toAsset: 'pax-gold',
        fromAmount: 1,
        timestamp: tradeTs,
        feeBps: 0,
      };

      const result = evaluateCounterfactualTrade({
        trade,
        fromSeries: btcSeries,
        toSeries: paxgSeries,
        currentPriceFrom: 70_000,
        currentPriceTo: 2_500,
        currentTimestamp: nowTs,
      });

      expect(result.priceFromAtTrade).toBe(60_000);
      expect(result.priceToAtTrade).toBe(2_000);
      expect(result.tradeValueUsd).toBe(60_000);
      expect(result.toAmountReceived).toBe(30);
      expect(result.currentValueIfKept).toBe(70_000);
      expect(result.currentValueIfTraded).toBe(75_000);
      expect(result.deltaUsd).toBe(5_000);
      expect(result.isProfitable).toBe(true);
      expect(result.alphaPct).toBeCloseTo(7.14, 1);
      expect(result.trajectory.length).toBeGreaterThanOrEqual(3);
    });

    it('correctly applies exchange fee drag', () => {
      const tradeWithFee: HypotheticalTrade = {
        id: 'test-2',
        fromAsset: 'bitcoin',
        toAsset: 'pax-gold',
        fromAmount: 1,
        timestamp: tradeTs,
        feeBps: 100, // 1% fee = $600
      };

      const result = evaluateCounterfactualTrade({
        trade: tradeWithFee,
        fromSeries: btcSeries,
        toSeries: paxgSeries,
        currentPriceFrom: 70_000,
        currentPriceTo: 2_500,
        currentTimestamp: nowTs,
      });

      expect(result.feeUsd).toBe(600);
      expect(result.netTradeValueUsd).toBe(59_400);
      expect(result.toAmountReceived).toBe(29.7); // 59,400 / 2,000
      expect(result.currentValueIfTraded).toBe(74_250); // 29.7 * 2500
    });

    it('handles USD as fromAsset (buying crypto with cash)', () => {
      const trade: HypotheticalTrade = {
        id: 'test-usd-buy',
        fromAsset: 'usd',
        toAsset: 'pax-gold',
        fromAmount: 10_000, // $10,000 cash
        timestamp: tradeTs,
        feeBps: 0,
      };

      const result = evaluateCounterfactualTrade({
        trade,
        fromSeries: [],
        toSeries: paxgSeries,
        currentPriceFrom: 1,
        currentPriceTo: 2_500,
        currentTimestamp: nowTs,
      });

      expect(result.priceFromAtTrade).toBe(1);
      expect(result.toAmountReceived).toBe(5); // $10,000 / $2,000
      expect(result.currentValueIfKept).toBe(10_000);
      expect(result.currentValueIfTraded).toBe(12_500); // 5 * $2,500
      expect(result.deltaUsd).toBe(2_500);
    });

    it('handles USD as toAsset (selling crypto to cash)', () => {
      const trade: HypotheticalTrade = {
        id: 'test-crypto-sell',
        fromAsset: 'bitcoin',
        toAsset: 'usd',
        fromAmount: 1,
        timestamp: tradeTs,
        feeBps: 0,
      };

      const result = evaluateCounterfactualTrade({
        trade,
        fromSeries: btcSeries,
        toSeries: [],
        currentPriceFrom: 70_000,
        currentPriceTo: 1,
        currentTimestamp: nowTs,
      });

      expect(result.toAmountReceived).toBe(60_000);
      expect(result.currentValueIfKept).toBe(70_000);
      expect(result.currentValueIfTraded).toBe(60_000);
      expect(result.deltaUsd).toBe(-10_000);
      expect(result.isProfitable).toBe(false);
    });
  });

  describe('generateCounterfactualTrajectory', () => {
    it('generates points from trade time to end time with delta calculations', () => {
      const tradeTs = 1_700_000_000_000;
      const endTs = tradeTs + 7 * 86_400_000;

      const fromSeries: [number, number][] = [
        [tradeTs, 100],
        [tradeTs + 3 * 86_400_000, 110],
        [endTs, 120],
      ];
      const toSeries: [number, number][] = [
        [tradeTs, 10],
        [tradeTs + 3 * 86_400_000, 12],
        [endTs, 15],
      ];

      const points = generateCounterfactualTrajectory({
        tradeTimestamp: tradeTs,
        endTimestamp: endTs,
        fromAmount: 2, // started with 2 * 100 = $200
        toAmount: 20,  // received 20 * 10 = $200
        fromSeries,
        toSeries,
        currentPriceFrom: 120,
        currentPriceTo: 15,
        isFromUsd: false,
        isToUsd: false,
      });

      expect(points.length).toBeGreaterThanOrEqual(3);
      expect(points[0].valueIfKept).toBe(200);
      expect(points[0].valueIfTraded).toBe(200);
      expect(points[0].deltaUsd).toBe(0);

      const last = points[points.length - 1];
      expect(last.valueIfKept).toBe(240);   // 2 * 120
      expect(last.valueIfTraded).toBe(300); // 20 * 15
      expect(last.deltaUsd).toBe(60);
    });
  });
});
