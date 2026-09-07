import { describe, expect, it } from 'vitest';
import {
  coerceChartNumber,
  formatChartLabel,
  formatChartTooltipValue,
  formatSignedPercent,
} from './chartFormatters';

describe('chartFormatters', () => {
  it('formats tooltip and percent values safely', () => {
    expect(formatChartTooltipValue(undefined)).toBe('');
    expect(formatSignedPercent(2.5)).toBe('+2.5%');
    expect(formatSignedPercent(-1)).toBe('-1%');
    expect(coerceChartNumber('3.14')).toBeCloseTo(3.14);
  });

  it('formats chart labels without object stringification', () => {
    expect(formatChartLabel('paxg')).toBe('paxg');
    expect(formatChartLabel(42)).toBe('42');
    expect(formatChartLabel({})).toBe('');
  });
});
