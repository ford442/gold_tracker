import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { BacktestResult } from '@lib/strategyEngine';
import { formatPercent, formatPrice } from '@lib/utils';
import { downsampleEquityCurve } from '@lib/strategyMockTicks';

const tooltipContentStyle: React.CSSProperties = {
  backgroundColor: 'rgba(16,19,35,0.92)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(212,175,55,0.18)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--color-text)',
  fontSize: '0.75rem',
  boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
};

interface Props {
  result: BacktestResult;
  isLab: boolean;
}

export function EquityCurveChart({ result, isLab }: Props) {
  const equityCurveDisplay = downsampleEquityCurve(result.equityCurve);
  if (equityCurveDisplay.length <= 1) return null;

  return (
    <div className="glass-card" style={{ padding: 'var(--space-xl)' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px',
      }}
      >
        <h3 className="section-heading">
          <span className="heading-icon">📈</span> {isLab ? 'Portfolio Value Under Scenario' : 'Portfolio Value Over Time'}
        </h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <span style={{
            fontSize: 'var(--font-xs)',
            padding: '3px 10px',
            borderRadius: '999px',
            background: 'var(--color-accent-dim)',
            color: 'var(--color-accent)',
            fontWeight: 600,
          }}
          >
            {isLab ? 'Shocked / synthetic path' : '30-day simulation'}
          </span>
          <span className={`badge ${result.totalReturn >= 0 ? 'badge-green' : 'badge-red'}`}>
            {result.totalReturn >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(result.totalReturn))}
          </span>
        </div>
      </div>

      <div style={{ width: '100%', height: 300 }} role="img" aria-label="Simulated portfolio equity curve">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={equityCurveDisplay} margin={{ top: 5, right: 12, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(80,86,140,0.15)" vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(t: number) =>
                new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              stroke="var(--color-muted)"
              tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
              stroke="var(--color-muted)"
              tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
              width={62}
            />
            <Tooltip
              contentStyle={tooltipContentStyle}
              formatter={(v: unknown) => [formatPrice(v as number), 'Portfolio Value']}
              labelFormatter={(t: unknown) => new Date(t as number).toLocaleString()}
            />
            <ReferenceLine
              y={result.initialBalance}
              stroke="var(--color-muted)"
              strokeDasharray="5 4"
              strokeOpacity={0.6}
              label={{
                value: 'Start',
                fill: 'var(--color-muted)',
                fontSize: 10,
                position: 'right',
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--color-accent)"
              fill="url(#equityGradient)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--color-accent)' }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
