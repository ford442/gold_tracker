import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { CounterfactualPoint } from '@lib/counterfactual';
import { formatPrice } from '@lib/utils';

interface Props {
  data: CounterfactualPoint[];
  fromSymbol: string;
  toSymbol: string;
  isProfitable: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    payload: CounterfactualPoint;
  }>;
  label?: string;
  fromSymbol: string;
  toSymbol: string;
}

function CustomTooltip({ active, payload, fromSymbol, toSymbol }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const pt = payload[0].payload;
  const isPositive = pt.deltaUsd >= 0;

  return (
    <div
      style={{
        background: 'var(--color-surface, #1e222d)',
        border: '1px solid var(--color-border, #2a2e39)',
        borderRadius: 'var(--radius-md, 8px)',
        padding: '12px 14px',
        boxShadow: 'var(--glass-shadow, 0 8px 32px rgba(0, 0, 0, 0.4))',
        fontSize: 'var(--font-xs, 12px)',
        minWidth: '200px',
      }}
    >
      <div style={{ color: 'var(--color-muted, #848e9c)', marginBottom: '8px', fontWeight: 600 }}>
        📅 {new Date(pt.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', gap: '12px' }}>
        <span style={{ color: 'var(--color-accent, #7c5cfc)', fontWeight: 600 }}>
          🟣 If Traded ({toSymbol}):
        </span>
        <span style={{ fontWeight: 700, color: 'var(--color-text, #fff)' }}>
          {formatPrice(pt.valueIfTraded)}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', gap: '12px' }}>
        <span style={{ color: 'var(--color-gold, #f0c845)', fontWeight: 600 }}>
          🟡 If Kept ({fromSymbol}):
        </span>
        <span style={{ fontWeight: 700, color: 'var(--color-text, #fff)' }}>
          {formatPrice(pt.valueIfKept)}
        </span>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--color-border, #2a2e39)',
          paddingTop: '6px',
          display: 'flex',
          justifyContent: 'space-between',
          color: isPositive ? 'var(--color-green, #00dba6)' : 'var(--color-red, #ff5a78)',
          fontWeight: 700,
        }}
      >
        <span>Spread Delta:</span>
        <span>
          {isPositive ? '+' : ''}
          {formatPrice(pt.deltaUsd)} ({isPositive ? '+' : ''}
          {pt.alphaPct.toFixed(2)}%)
        </span>
      </div>
    </div>
  );
}

export function CounterfactualChart({ data, fromSymbol, toSymbol, isProfitable }: Props) {
  if (!data || data.length < 2) {
    return (
      <div
        style={{
          height: 240,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-muted)',
          fontSize: 'var(--font-xs)',
        }}
      >
        Collecting historical price series to render trajectory chart...
      </div>
    );
  }

  // Calculate domain min & max with margin
  const allValues = data.flatMap((d) => [d.valueIfTraded, d.valueIfKept]);
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const padding = (maxVal - minVal) * 0.1 || minVal * 0.05 || 10;
  const yDomain = [Math.max(0, Math.floor(minVal - padding)), Math.ceil(maxVal + padding)];

  return (
    <div style={{ width: '100%', height: 280, marginTop: '16px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="cfTradedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#7c5cfc" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#7c5cfc" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="cfKeptGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f0c845" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#f0c845" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, rgba(255,255,255,0.06))" vertical={false} />

          <XAxis
            dataKey="dateStr"
            stroke="var(--color-muted, #848e9c)"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-border, #2a2e39)' }}
          />

          <YAxis
            domain={yDomain}
            stroke="var(--color-muted, #848e9c)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val: number) => `$${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0)}`}
          />

          <Tooltip
            content={<CustomTooltip fromSymbol={fromSymbol} toSymbol={toSymbol} />}
          />

          {/* Area 1: If Kept (Gold) */}
          <Area
            type="monotone"
            dataKey="valueIfKept"
            stroke="#f0c845"
            strokeWidth={2}
            fill="url(#cfKeptGradient)"
            name={`If Kept (${fromSymbol})`}
            isAnimationActive={false}
          />

          {/* Area 2: If Traded (Purple) */}
          <Area
            type="monotone"
            dataKey="valueIfTraded"
            stroke={isProfitable ? '#00dba6' : '#7c5cfc'}
            strokeWidth={2.5}
            fill="url(#cfTradedGradient)"
            name={`If Traded (${toSymbol})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend below chart */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
          marginTop: '8px',
          fontSize: 'var(--font-xxs, 11px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: 12, height: 3, background: '#f0c845', borderRadius: 2 }} />
          <span style={{ color: 'var(--color-muted)' }}>If Kept ({fromSymbol})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: 12, height: 3, background: isProfitable ? '#00dba6' : '#7c5cfc', borderRadius: 2 }} />
          <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>If Traded ({toSymbol})</span>
        </div>
      </div>
    </div>
  );
}
