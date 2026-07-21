import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import { ASSETS, PERFORMANCE_COMPARISON_ASSET_IDS } from '@lib/assets';
import { getMarketChartSeries } from '@lib/marketCache';
import { ChartSkeleton } from './LoadingSkeleton';

const PERFORMANCE_ASSETS = PERFORMANCE_COMPARISON_ASSET_IDS.map((id) => ({
  id: ASSETS[id].cgId ?? id,
  name: ASSETS[id].symbol,
  color: ASSETS[id].chartColor,
}));

interface ChartPoint {
  day: string;
  [key: string]: number | string;
}

export function PerformanceComparisonChart() {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const apiKey = import.meta.env.VITE_COINGECKO_API_KEY as string | undefined;

    const loadData = async () => {
      try {
        const days = 14;
        const merged: Record<number, ChartPoint> = {};

        const seriesByAsset = await Promise.all(
          PERFORMANCE_ASSETS.map((asset) =>
            getMarketChartSeries(asset.id, String(days), 'daily', {
              signal: controller.signal,
              apiKey,
            }),
          ),
        );

        PERFORMANCE_ASSETS.forEach((asset, ai) => {
          const prices = seriesByAsset[ai].map(([, price]) => price);
          if (prices.length === 0) throw new Error(`Failed to fetch ${asset.name}`);

          const base = prices[0];
          prices.forEach((price, i) => {
            const pct = ((price - base) / base) * 100;
            if (!merged[i]) {
              merged[i] = { day: new Date(Date.now() - (days - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
            }
            merged[i][asset.name] = Math.round(pct * 10) / 10;
          });
        });

        setData(Object.values(merged));
        setLoading(false);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setLoading(false);
      }
    };

    void loadData();
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <section aria-label="Performance Comparison">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 className="section-heading" style={{ margin: 0 }}>
            <span className="heading-icon">📈</span>
            Performance Comparison (14 Days)
          </h2>
        </div>
        <ChartSkeleton />
      </section>
    );
  }

  if (error) {
    return (
      <section aria-label="Performance Comparison">
        <div className="glass-card" style={{
          padding: 'var(--space-xl)',
          textAlign: 'center',
          color: 'var(--color-muted)',
        }}>
          <div style={{ fontSize: '1.8rem', marginBottom: '8px', opacity: 0.7 }}>⚠️</div>
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
        <h2 className="section-heading" style={{ margin: 0 }}>
          <span className="heading-icon">📈</span>
          Performance Comparison (14 Days)
        </h2>
        <span className="badge badge-accent">Normalized % Return</span>
      </div>

      <div className="glass-card" style={{
        padding: 'var(--space-lg)',
      }}>
        {/* Chart - now responsive */}
        <div style={{ height: '300px', width: '100%' }} role="img" aria-label="14-day performance comparison chart showing normalized returns for PAXG, XAUT, BTC, ETH, and BCH">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(80,86,140,0.15)" vertical={false} />
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
                  backgroundColor: 'rgba(16,19,35,0.92)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(212,175,55,0.18)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                }}
                formatter={(value) => [`${Number(value) >= 0 ? '+' : ''}${value}%`, '']}
              />
              <Legend 
                wrapperStyle={{ color: 'var(--color-text)', paddingTop: '20px' }}
              />

              {PERFORMANCE_ASSETS.map((asset) => (
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
          {PERFORMANCE_ASSETS.map((asset) => {
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
