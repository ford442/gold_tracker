import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import { ChartSkeleton } from './LoadingSkeleton';

const ASSETS = [
  { id: 'pax-gold',     name: 'PAXG',   color: '#10b981' }, // emerald
  { id: 'tether-gold',  name: 'XAUT',   color: '#14b8a6' }, // teal
  { id: 'bitcoin',      name: 'BTC',    color: '#f59e0b' }, // amber
  { id: 'ethereum',     name: 'ETH',    color: '#8b5cf6' }, // violet
  { id: 'bitcoin-cash', name: 'BCH',    color: '#3b82f6' }, // blue
];

interface ChartPoint {
  day: string;
  [key: string]: number | string;
}

export function PerformanceComparisonChart() {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const days = 14;
        const merged: Record<number, ChartPoint> = {};

        for (const asset of ASSETS) {
          const res = await fetch(
            `https://api.coingecko.com/api/v3/coins/${asset.id}/market_chart?vs_currency=usd&days=${days}&interval=daily`
          );
          if (!res.ok) throw new Error(`Failed to fetch ${asset.name}`);
          const json = await res.json();
          const prices = json.prices.map(([, price]: [number, number]) => price);

          const base = prices[0];
          prices.forEach((price: number, i: number) => {
            const pct = ((price - base) / base) * 100;
            if (!merged[i]) {
              merged[i] = { day: new Date(Date.now() - (days - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
            }
            merged[i][asset.name] = Math.round(pct * 10) / 10;
          });
        }

        setData(Object.values(merged));
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <section aria-label="Performance Comparison">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-lg)', color: 'var(--color-text)' }}>
            📈 Performance Comparison (14 Days)
          </h2>
        </div>
        <ChartSkeleton />
      </section>
    );
  }

  if (error) {
    return (
      <section aria-label="Performance Comparison">
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-xl)',
          textAlign: 'center',
          color: 'var(--color-muted)',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚠️</div>
          <div>{error}</div>
          <div style={{ fontSize: 'var(--font-sm)', marginTop: '8px' }}>Try refreshing the page or check your connection</div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Performance Comparison">
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <h2 style={{ margin: 0, fontSize: 'var(--font-lg)', color: 'var(--color-text)' }}>
          📈 Performance Comparison (14 Days)
        </h2>
        <span className="badge badge-accent">Normalized % Return</span>
      </div>

      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-lg)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        {/* Chart - now responsive */}
        <div style={{ height: '300px', width: '100%' }} role="img" aria-label="14-day performance comparison chart showing normalized returns for PAXG, XAUT, BTC, ETH, and BCH">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis 
                dataKey="day" 
                stroke="var(--color-muted)" 
                tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
                tickMargin={10}
              />
              <YAxis 
                stroke="var(--color-muted)" 
                tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
                tickFormatter={(value) => `${value}%`}
                domain={['auto', 'auto']}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--color-surface2)', 
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text)',
                }}
                formatter={(value) => [`${Number(value) >= 0 ? '+' : ''}${value}%`, '']}
              />
              <Legend 
                wrapperStyle={{ color: 'var(--color-text)', paddingTop: '20px' }}
              />

              {ASSETS.map((asset) => (
                <Line
                  key={asset.id}
                  type="monotone"
                  dataKey={asset.name}
                  stroke={asset.color}
                  strokeWidth={3}
                  dot={{ r: 4, fill: asset.color, strokeWidth: 0 }}
                  activeDot={{ r: 7, stroke: asset.color, strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Stats bar */}
        <div style={{ 
          marginTop: '20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
          gap: '10px',
        }}>
          {ASSETS.map((asset) => {
            const latest = data[data.length - 1]?.[asset.name] as number || 0;
            return (
              <div key={asset.name} style={{
                background: 'var(--color-surface2)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 8px',
                textAlign: 'center',
              }}>
                <div style={{ 
                  fontSize: '1.1rem', 
                  fontWeight: 700,
                  color: latest >= 0 ? 'var(--color-green)' : 'var(--color-red)',
                }}>
                  {latest >= 0 ? '↑ +' : '↓ '}{latest}%
                </div>
                <div style={{ 
                  fontSize: 'var(--font-xs)', 
                  color: 'var(--color-muted)',
                  marginTop: '4px',
                }}>
                  {asset.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
