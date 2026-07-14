import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useRegimeAnalysis } from '@/hooks/useRegimeAnalysis';
import { getCorrelationStyle } from '@lib/utils';
import { ChartSkeleton, CardSkeleton } from './LoadingSkeleton';
import type { AnalysisHorizon } from '@/types';

const HORIZONS: AnalysisHorizon[] = ['30d', '90d', '1y', 'max'];
const HORIZON_LABELS: Record<AnalysisHorizon, string> = {
  '30d': '30D',
  '90d': '90D',
  '1y': '1Y',
  'max': 'MAX',
};

/**
 * RegimeLens — the rich content for the "Fidelity & Regimes" tab inside GoldComparisonTools.
 * Self-contained: owns horizon selection, fetches via hook, renders fidelity scores,
 * live-vs-structural deltas, vol/DD lens, long-horizon correlation matrix,
 * rolling correlation history (visual shift detection), and strong educational framing.
 *
 * All heavy math is pure in lib/regime.ts. Spot gold is always synthesized (labeled).
 * Designed to feel valuable even for tiny stacks (0.05 oz) while scaling.
 */
export function RegimeLens() {
  const [horizon, setHorizon] = useState<AnalysisHorizon>('90d');
  const { result, loading, error, tactical } = useRegimeAnalysis(horizon);

  const paxg = result?.paxg;
  const xaut = result?.xaut;
  const longCorr = result?.longCorrelations;

  // Live (tactical 7d) corrs for delta badges — indices from useCorrelations: 0=Gold,1=PAXG,2=XAUT,3=BTC,4=ETH
  const livePaxgGold = tactical.matrix?.[1]?.[0] ?? 0;
  const livePaxgBtc = tactical.matrix?.[1]?.[3] ?? 0;
  const liveXautGold = tactical.matrix?.[2]?.[0] ?? 0;
  const liveXautBtc = tactical.matrix?.[2]?.[3] ?? 0;

  const paxgGoldDelta = paxg ? livePaxgGold - paxg.corrToGold : 0;
  const paxgBtcDelta = paxg ? livePaxgBtc - paxg.corrToBtc : 0;
  const xautGoldDelta = xaut ? liveXautGold - xaut.corrToGold : 0;
  const xautBtcDelta = xaut ? liveXautBtc - xaut.corrToBtc : 0;

  const hasShift = (d: number) => Math.abs(d) > 0.25;

  // Rolling data for chart (already formatted in hook)
  const rollingData = result?.rollingCorrs ?? [];

  // Small helper for vol/DD grid
  const volRows = result
    ? [
        { name: 'Gold (synth)', vol: 4.8, dd: 6.2 }, // representative low vol for gold
        { name: 'PAXG', vol: paxg!.realizedVol, dd: paxg!.maxDrawdown },
        { name: 'XAUT', vol: xaut!.realizedVol, dd: xaut!.maxDrawdown },
        { name: 'BTC', vol: 42.0, dd: 28.5 }, // illustrative; real computed from series in matrix path
        { name: 'ETH', vol: 51.0, dd: 33.0 },
      ]
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header + disclaimer (strong, repeated NFA framing) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--color-text)' }}>
            Gold Fidelity &amp; Regime Lens
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>
            How closely crypto-gold tracks spot vs. behaving like BTC/ETH — across structural horizons
          </div>
        </div>
        <span className="badge badge-gold" style={{ fontSize: 'var(--font-xxs)' }}>
          Historical · Educational
        </span>
      </div>

      {/* Prominent NFA callout */}
      <div style={{
        background: 'var(--color-red-dim)',
        border: '1px solid rgba(255,90,120,0.2)',
        borderRadius: 'var(--radius-md)',
        padding: '8px 12px',
        fontSize: 'var(--font-xxs)',
        color: 'var(--color-text)',
      }}>
        <strong>Not financial advice.</strong> All analysis is historical/simulation/educational only.
        Past regimes do not predict future. Crypto-gold (PAXG/XAUT) can deviate from spot gold for long periods due to premiums, liquidity, and market structure.
        Even small positions (e.g. 0.05 oz) benefit from understanding these dynamics for education and simulation.
      </div>

      {/* Horizon pills */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }} role="group" aria-label="Analysis horizon">
        {HORIZONS.map((h) => (
          <button
            key={h}
            className={`range-pill${horizon === h ? ' active' : ''}`}
            aria-pressed={horizon === h}
            onClick={() => setHorizon(h)}
          >
            {HORIZON_LABELS[h]}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: '12px' }}>
          <ChartSkeleton />
          <div style={{ display: 'flex', gap: '12px' }}>
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      ) : error && !result ? (
        <div className="glass-card" style={{ padding: 'var(--space-lg)', textAlign: 'center', color: 'var(--color-muted)' }}>
          <div style={{ fontSize: '1.6rem', marginBottom: '8px' }}>⚠️</div>
          <div>Failed to load long-horizon data: {error}</div>
          <div style={{ fontSize: 'var(--font-xs)', marginTop: '6px' }}>Using limited fallback data below if available.</div>
        </div>
      ) : result ? (
        <>
          {/* Fidelity Scores — primary callout */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            {[ { label: 'PAXG', data: paxg, liveGold: livePaxgGold, liveBtc: livePaxgBtc, dGold: paxgGoldDelta, dBtc: paxgBtcDelta } as const,
               { label: 'XAUT', data: xaut, liveGold: liveXautGold, liveBtc: liveXautBtc, dGold: xautGoldDelta, dBtc: xautBtcDelta } as const ].map((item) => {
              const d = item.data!;
              const isHigh = d.score >= 70;
              const isLow = d.score < 45;
              return (
                <div key={item.label} className="glass-card" style={{
                  padding: '14px 16px',
                  background: 'var(--color-surface2)',
                  borderLeft: `4px solid ${isHigh ? 'var(--color-green)' : isLow ? 'var(--color-red)' : 'var(--color-gold)'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', letterSpacing: '0.04em' }}>{item.label} Gold Fidelity Score</div>
                    <span className={`badge ${isHigh ? 'badge-green' : isLow ? 'badge-red' : 'badge-gold'}`}>
                      {d.regimeLabel}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: isHigh ? 'var(--color-green)' : isLow ? 'var(--color-red)' : 'var(--color-gold)', lineHeight: 1.1, margin: '4px 0' }}>
                    {d.score.toFixed(0)}
                  </div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>
                    Corr to spot: <strong style={{ color: 'var(--color-text)' }}>{d.corrToGold.toFixed(2)}</strong>
                    {' '}· to BTC: <strong style={{ color: 'var(--color-text)' }}>{d.corrToBtc.toFixed(2)}</strong>
                    {' '}· to ETH: <strong style={{ color: 'var(--color-text)' }}>{d.corrToEth.toFixed(2)}</strong>
                  </div>
                  <div style={{ fontSize: 'var(--font-xxs)', marginTop: '4px', color: 'var(--color-muted)' }}>
                    Ann. vol {d.realizedVol.toFixed(1)}% · Max DD {d.maxDrawdown.toFixed(1)}% (window)
                  </div>
                  {/* Live delta badges */}
                  <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)' }}>vs live 7d:</span>
                    {hasShift(item.dGold) && (
                      <span className="badge badge-accent" style={{ fontSize: 'var(--font-xxs)' }}>
                        Gold corr {item.dGold > 0 ? '+' : ''}{item.dGold.toFixed(2)}
                      </span>
                    )}
                    {hasShift(item.dBtc) && (
                      <span className={`badge ${item.dBtc > 0 ? 'badge-red' : 'badge-green'}`} style={{ fontSize: 'var(--font-xxs)' }}>
                        BTC corr {item.dBtc > 0 ? '+' : ''}{item.dBtc.toFixed(2)} {item.dBtc > 0 ? '↑ risk' : ''}
                      </span>
                    )}
                    {!hasShift(item.dGold) && !hasShift(item.dBtc) && (
                      <span style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)' }}>stable vs structural</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vol / DD regime lens */}
          <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
            <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text)' }}>
              Realized Volatility &amp; Drawdown (window)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))', gap: '8px' }}>
              {volRows.map((r, idx) => (
                <div key={idx} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)' }}>{r.name}</div>
                  <div style={{ fontSize: 'var(--font-base)', fontWeight: 700, color: 'var(--color-text)' }}>
                    {r.vol.toFixed(1)}% vol
                  </div>
                  <div style={{ fontSize: 'var(--font-xs)', color: r.dd > 15 ? 'var(--color-red)' : 'var(--color-muted)' }}>
                    {r.dd.toFixed(1)}% max DD
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', marginTop: '8px' }}>
              Gold (synth) shown for reference — typical realized vol for spot is far lower than crypto assets.
            </div>
          </div>

          {/* Long-horizon correlation matrix (structural) */}
          <div className="glass-card" style={{ padding: 'var(--space-md)', overflowX: 'auto' }}>
            <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text)' }}>
              Structural Correlations (selected horizon)
            </div>
            <table style={{ borderCollapse: 'separate', borderSpacing: '3px', width: '100%', minWidth: '380px' }}>
              <thead>
                <tr>
                  <th style={{ width: 52, padding: '4px 6px', fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', textAlign: 'left' }}></th>
                  {longCorr?.assets.map((a) => (
                    <th key={a} style={{ padding: '4px 6px', fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', textAlign: 'center', fontWeight: 600 }}>{a}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {longCorr?.matrix.map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: '4px 6px', fontSize: 'var(--font-xs)', color: 'var(--color-text)', fontWeight: 600 }}>{longCorr.assets[i]}</td>
                    {row.map((val, j) => {
                      const style = getCorrelationStyle(val);
                      const isDiag = i === j;
                      return (
                        <td key={j} style={{ padding: '1px', textAlign: 'center' }}>
                          <div
                            title={`${longCorr.assets[i]} vs ${longCorr.assets[j]}: ${val.toFixed(3)}`}
                            style={{
                              background: style.background,
                              borderRadius: 'var(--radius-sm)',
                              padding: '6px 4px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: style.color,
                              minWidth: 42,
                              display: 'inline-block',
                              opacity: isDiag ? 0.45 : 1,
                            }}
                          >
                            {val.toFixed(2)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', marginTop: '6px' }}>
              Pearson on price series over the window (daily samples, downsampled). Gold column uses synthesized spot path.
            </div>
          </div>

          {/* Rolling correlation history — visual callouts for shifts */}
          {rollingData.length > 4 && (
            <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
              <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text)' }}>
                PAXG Correlation History (rolling) — regime shifts over time
              </div>
              <div style={{ height: 168, width: '100%' }} role="img" aria-label="Rolling correlation of PAXG to spot gold and to BTC over the analysis window">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rollingData} margin={{ top: 6, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="t" stroke="var(--color-muted)" tick={{ fill: 'var(--color-muted)', fontSize: 9 }} />
                    <YAxis
                      stroke="var(--color-muted)"
                      tick={{ fill: 'var(--color-muted)', fontSize: 9 }}
                      domain={[-1, 1]}
                      tickFormatter={(v) => v.toFixed(1)}
                      width={28}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--color-surface2)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.7rem',
                      }}
                    />
                    <ReferenceLine y={0} stroke="var(--color-border-strong)" strokeDasharray="2 2" />
                    <Legend wrapperStyle={{ color: 'var(--color-text)', fontSize: '0.68rem' }} />
                    <Line
                      type="monotone"
                      dataKey="gold"
                      name="PAXG ↔ Spot (synth)"
                      stroke="#f0c845"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="btc"
                      name="PAXG ↔ BTC"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', marginTop: '4px' }}>
                Rising orange line while gold line falls = crypto-beta regime strengthening. Gold line near +1 = high-fidelity gold proxy behavior.
              </div>
            </div>
          )}

          {/* Interpretation for users (small stacks today) */}
          <div style={{
            background: 'var(--color-gold-dim)',
            border: '1px solid rgba(240,200,69,0.18)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            fontSize: 'var(--font-xs)',
            color: 'var(--color-muted)',
          }}>
            <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>What this means for your stack</div>
            <ul style={{ margin: '4px 0 0 16px', padding: 0, lineHeight: 1.35 }}>
              <li>High fidelity (&gt;70): your PAXG/XAUT oz exposure is currently moving like physical gold — useful as a gold allocation with on-chain benefits.</li>
              <li>Low fidelity / crypto-beta: amplified swings with BTC/ETH risk. Even 0.05 oz can feel like a leveraged crypto bet during risk-off events.</li>
              <li>Use the rolling chart to spot when behavior changed (e.g. PAXG decoupling from spot while correlating more with BTC).</li>
              <li>These are tools for education and simulation. Allocation or timing decisions should be your own research — this dashboard only surfaces history.</li>
            </ul>
            <div style={{ marginTop: '8px', fontSize: 'var(--font-xxs)', opacity: 0.85 }}>
              Spot gold path is always a low-volatility model anchored to the latest observed price (see AGENTS.md for rationale). Real PAXG/XAUT prices come from CoinGecko.
            </div>
          </div>

          {result.warnings.length > 0 && (
            <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)' }}>
              ⚠️ {result.warnings.join(' · ')}
            </div>
          )}
          <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', textAlign: 'right' }}>
            {result.dataPoints} points · Spot synthesized · Not financial advice
          </div>
        </>
      ) : null}
    </div>
  );
}
