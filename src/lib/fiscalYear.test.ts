import { describe, expect, it } from 'vitest';
import {
  buildFiscalChartData,
  buildFiscalSummaryRows,
  computeAllFiscalStats,
  computeFiscalStats,
  fiscalYearLabel,
  FISCAL_CALENDARS,
  generateMockGoldHistory,
  monthlyAverages,
} from './fiscalYear';

describe('fiscalYearLabel', () => {
  it('returns calendar year for January start', () => {
    expect(fiscalYearLabel(2023, 0)).toBe('2023');
  });

  it('returns FY label for non-calendar starts', () => {
    expect(fiscalYearLabel(2023, 3)).toBe('FY2023/24');
    expect(fiscalYearLabel(2023, 9)).toBe('FY2023/24');
  });
});

describe('monthlyAverages', () => {
  it('averages prices within the same UTC month', () => {
    const jan1 = Date.UTC(2024, 0, 1);
    const jan15 = Date.UTC(2024, 0, 15);
    const feb1 = Date.UTC(2024, 1, 1);
    const monthly = monthlyAverages([
      [jan1, 100],
      [jan15, 200],
      [feb1, 300],
    ]);
    expect(monthly.get('2024-0')).toBe(150);
    expect(monthly.get('2024-1')).toBe(300);
  });
});

describe('computeFiscalStats', () => {
  it('computes cumulative % from fiscal year start', () => {
    const monthly = new Map<string, number>([
      ['2023-0', 100],
      ['2023-1', 110],
      ['2023-2', 120],
      ['2023-3', 130],
      ['2023-4', 140],
      ['2023-5', 150],
      ['2023-6', 160],
    ]);
    const calendar = FISCAL_CALENDARS.find((c) => c.id === 'calendar')!;
    const stats = computeFiscalStats(monthly, calendar);
    expect(stats.fyReturns.length).toBeGreaterThan(0);
    expect(stats.avgTrajectory[0]).not.toBeNull();
    expect(stats.avgTrajectory[1]).not.toBeNull();
  });
});

describe('generateMockGoldHistory', () => {
  it('returns deterministic length and ends near target price', () => {
    const series = generateMockGoldHistory(2200);
    expect(series).toHaveLength(365 * 6);
    const lastPrice = series[series.length - 1][1];
    expect(lastPrice).toBeGreaterThan(1500);
    expect(lastPrice).toBeLessThan(3500);
  });
});

describe('buildFiscalChartData', () => {
  it('produces 12 fiscal month points', () => {
    const history = generateMockGoldHistory(3000);
    const stats = computeAllFiscalStats(history);
    const chart = buildFiscalChartData(stats);
    expect(chart).toHaveLength(12);
    expect(chart[0].fiscalMonth).toBe(1);
    expect(chart[11].fiscalMonth).toBe(12);
    expect(chart[0].calendar).not.toBeUndefined();
  });
});

describe('buildFiscalSummaryRows', () => {
  it('includes calendar metadata per row', () => {
    const history = generateMockGoldHistory(3000);
    const stats = computeAllFiscalStats(history);
    const rows = buildFiscalSummaryRows(stats);
    expect(rows).toHaveLength(FISCAL_CALENDARS.length);
    expect(rows[0].label).toBe('Calendar Year');
  });
});
