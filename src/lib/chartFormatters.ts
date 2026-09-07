import type { ValueType } from 'recharts/types/component/DefaultTooltipContent';

/** Coerce Recharts tooltip values to a safe string for display. */
export function formatChartTooltipValue(value: ValueType | undefined): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(String).join(', ');
  return String(value);
}

/** Format a numeric chart value as a signed percent string. */
export function formatSignedPercent(value: ValueType | undefined): string {
  const n = Number(formatChartTooltipValue(value));
  if (!Number.isFinite(n)) return '';
  return `${n >= 0 ? '+' : ''}${n}%`;
}

/** Coerce Recharts axis/legend values to string. */
export function formatChartLabel(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return '';
}

/** Safe number coercion for tooltip formatters returning [label, name] tuples. */
export function coerceChartNumber(value: ValueType | undefined): number {
  const n = Number(formatChartTooltipValue(value));
  return Number.isFinite(n) ? n : 0;
}
