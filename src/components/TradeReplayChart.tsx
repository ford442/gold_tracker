import { useState, useCallback } from 'react';
import type { ChartRange, ScenarioMode } from '@/types';
import { TRADE_REPLAY_OPTIONS } from '@components/tradeReplay/constants';
import { ProjectionControlsPanel } from '@components/tradeReplay/ProjectionControlsPanel';
import { ReplayChart } from '@components/tradeReplay/ReplayChart';
import { useContainerWidth, useTradeReplayData } from '@components/tradeReplay/useTradeReplayData';

export function TradeReplayChart() {
  const [range, setRange] = useState<ChartRange>('1W');
  const [scenario, setScenario] = useState<ScenarioMode>('both');
  const [showBaseline, setShowBaseline] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('pax-gold');

  const { containerRef, isMobile } = useContainerWidth();
  const { sparkline, chartData, trades, entryPrice, stats, isLoadingHistory } = useTradeReplayData(
    selectedAssetId,
    range,
    scenario,
  );

  const handleRangeChange = useCallback((r: ChartRange) => setRange(r), []);

  const selectedAssetLabel =
    TRADE_REPLAY_OPTIONS.find((a) => a.id === selectedAssetId)?.label ?? 'PAXG';

  if (!isLoadingHistory && sparkline.length < 2) {
    return (
      <section aria-label="Trade Replay and Projections">
        <div
          className="glass-card"
          style={{
            padding: 'var(--space-xl)',
            textAlign: 'center',
            color: 'var(--color-muted)',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📊</div>
          <div style={{ fontSize: 'var(--font-base)' }}>
            Waiting for price data to build trade replay chart...
          </div>
          <div style={{ fontSize: 'var(--font-xs)', marginTop: '4px' }}>
            Data refreshes every 60 seconds
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Trade Replay and Projections">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <h2 className="section-heading">
          <span className="heading-icon">📈</span> Trade Replay &amp; Projections
        </h2>

        <select
          value={selectedAssetId}
          onChange={(e) => setSelectedAssetId(e.target.value)}
          aria-label="Select asset to focus"
          style={{
            background: 'var(--color-surface2)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 12px',
            fontSize: 'var(--font-sm)',
            fontWeight: 600,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {TRADE_REPLAY_OPTIONS.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.label} / Spot Gold
            </option>
          ))}
        </select>
      </div>

      <div
        ref={containerRef}
        className="glass-card"
        style={{
          padding: 'var(--space-lg)',
        }}
      >
        <ProjectionControlsPanel
          range={range}
          scenario={scenario}
          showBaseline={showBaseline}
          onRangeChange={handleRangeChange}
          onScenarioChange={setScenario}
          onShowBaselineChange={setShowBaseline}
        />

        <ReplayChart
          chartData={chartData}
          trades={trades}
          entryPrice={entryPrice}
          stats={stats}
          scenario={scenario}
          showBaseline={showBaseline}
          isMobile={isMobile}
          isLoadingHistory={isLoadingHistory}
          selectedAssetLabel={selectedAssetLabel}
        />
      </div>
    </section>
  );
}
