import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import type { ScenarioMode } from '@/types';
import type { ChartDataPoint, ReplayStats } from './types';

interface Props {
  chartData: ChartDataPoint[];
  trades: ChartDataPoint[];
  entryPrice: number;
  stats: ReplayStats;
  scenario: ScenarioMode;
  showBaseline: boolean;
  isMobile: boolean;
  isLoadingHistory: boolean;
  selectedAssetLabel: string;
}

export function ReplayChart({
  chartData,
  trades,
  entryPrice,
  stats,
  scenario,
  showBaseline,
  isMobile,
  isLoadingHistory,
  selectedAssetLabel,
}: Props) {
  return (
    <>
      <div
        style={{ width: '100%', height: isMobile ? 240 : 340, position: 'relative' }}
        role="img"
        aria-label={`Trade replay price chart for ${selectedAssetLabel} with buy and sell markers`}
      >
        {isLoadingHistory && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--color-surface)',
              opacity: 0.7,
              borderRadius: 'var(--radius-md)',
              zIndex: 10,
              fontSize: 'var(--font-sm)',
              color: 'var(--color-muted)',
            }}
          >
            Loading {selectedAssetLabel} data…
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: isMobile ? -10 : 0, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(80,86,140,0.15)" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="var(--color-muted)"
              tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
              tickMargin={8}
              interval={isMobile ? Math.max(1, Math.ceil(chartData.length / 5)) : 'preserveStartEnd'}
            />
            <YAxis
              stroke="var(--color-muted)"
              tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
              tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
              domain={['auto', 'auto']}
              width={isMobile ? 45 : 60}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(16,19,35,0.92)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(212,175,55,0.18)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text)',
                fontSize: '0.75rem',
                boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              }}
              formatter={(value?: number, name?: string) => {
                const v = value ?? 0;
                if (isNaN(v)) return ['-', name ?? ''];
                const label =
                  name === 'price' ? 'Price' : name === 'benchmark' ? 'Benchmark' : (name ?? '');
                const pctVsEntry =
                  entryPrice > 0 ? (((v - entryPrice) / entryPrice) * 100).toFixed(2) : '0';
                return [
                  `$${v.toFixed(2)} (${Number(pctVsEntry) >= 0 ? '+' : ''}${pctVsEntry}% vs entry)`,
                  label,
                ];
              }}
            />

            {showBaseline && entryPrice > 0 && (
              <ReferenceLine
                y={entryPrice}
                stroke="var(--color-gold)"
                strokeDasharray="6 4"
                strokeOpacity={0.6}
                label={{
                  value: `Entry $${entryPrice.toFixed(0)}`,
                  fill: 'var(--color-gold)',
                  fontSize: 10,
                  position: 'right',
                }}
              />
            )}

            {scenario !== 'realized' && (
              <Area
                type="monotone"
                dataKey="forecastHigh"
                stroke="none"
                fill="var(--color-accent)"
                fillOpacity={0.08}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
            {scenario !== 'realized' && (
              <Area
                type="monotone"
                dataKey="forecastLow"
                stroke="none"
                fill="var(--color-accent)"
                fillOpacity={0.05}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}

            <Line
              type="monotone"
              dataKey="benchmark"
              stroke="var(--color-muted)"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />

            {scenario !== 'realized' && (
              <Line
                type="monotone"
                dataKey="forecastBase"
                stroke="var(--color-accent)"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}

            <Line
              type="monotone"
              dataKey="price"
              stroke="var(--color-gold)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, stroke: 'var(--color-gold)', strokeWidth: 2 }}
              connectNulls={false}
            />

            {trades.map((t, i) => (
              <ReferenceDot
                key={i}
                x={t.time}
                y={t.eventPrice ?? t.price}
                r={7}
                fill={t.event === 'buy' ? 'var(--color-green)' : 'var(--color-red)'}
                stroke="#fff"
                strokeWidth={2}
                label={{
                  value: t.event === 'buy' ? '▲ BUY' : '▼ SELL',
                  fill: t.event === 'buy' ? 'var(--color-green)' : 'var(--color-red)',
                  fontSize: 9,
                  fontWeight: 700,
                  position: t.event === 'buy' ? 'bottom' : 'top',
                }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          marginTop: '16px',
          paddingTop: '14px',
          borderTop: '1px solid var(--color-border)',
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: '10px',
        }}
      >
        <div
          style={{
            background: 'var(--color-surface2)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>Since Entry</div>
          <div
            style={{
              fontSize: 'var(--font-lg)',
              fontWeight: 700,
              color: stats.sinceEntry >= 0 ? 'var(--color-green)' : 'var(--color-red)',
            }}
          >
            {stats.sinceEntry >= 0 ? '↑' : '↓'} {stats.sinceEntry >= 0 ? '+' : ''}
            {stats.sinceEntry.toFixed(2)}%
          </div>
        </div>
        <div
          style={{
            background: 'var(--color-surface2)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>Max Drawdown</div>
          <div
            style={{
              fontSize: 'var(--font-lg)',
              fontWeight: 700,
              color: 'var(--color-red)',
            }}
          >
            ↓ {stats.maxDD.toFixed(2)}%
          </div>
        </div>
        <div
          style={{
            background: 'var(--color-surface2)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>Current</div>
          <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
            ${stats.current.toFixed(2)}
          </div>
        </div>
        <div
          style={{
            background: 'var(--color-surface2)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>Period High</div>
          <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--color-green)' }}>
            ${stats.high.toFixed(2)}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: '10px',
          fontSize: 'var(--font-xs)',
          color: 'var(--color-muted)',
          textAlign: 'right',
        }}
      >
        Last updated: {new Date().toLocaleTimeString()}
      </div>
    </>
  );
}
