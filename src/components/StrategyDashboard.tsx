import { formatPercent } from '@lib/utils';
import { CostModelSelector } from '@components/strategy/CostModelSelector';
import { useStrategyBacktest } from '@/hooks/useStrategyBacktest';
import { BacktestConfigForm } from '@components/strategy/BacktestConfigForm';
import { ScenarioLabPanel } from '@components/strategy/ScenarioLabPanel';
import { PerformanceStatBoxes } from '@components/strategy/PerformanceStatBoxes';
import { EquityCurveChart } from '@components/strategy/EquityCurveChart';
import { TradeLogTable } from '@components/strategy/TradeLogTable';
import { Field } from '@components/strategy/StrategyFormPrimitives';

export function StrategyDashboard() {
  const {
    isLab,
    scenarioMode,
    setScenarioMode,
    strategyType,
    setStrategyType,
    arbSpreadThreshold,
    arbTradeSize,
    mrAsset,
    mrWindowSize,
    mrBuyThreshold,
    mrSellThreshold,
    mrStopLoss,
    mrTradeSize,
    setArbConfig,
    setMrConfig,
    initialBalance,
    setInitialBalance,
    lastResult,
    lastScenarioResult,
    isRunning,
    handleRunBacktest,
    estimatedTradesPerDay,
    goldPrice,
    selectedScenario,
    setSelectedScenario,
    customShocks,
    setCustomShocks,
    currentScenario,
    seedFromPortfolio,
    setSeedFromPortfolio,
    extraCashUsd,
    setExtraCashUsd,
    dcaUsdPerPeriod,
    dcaPeriodCount,
    setDcaParams,
    costModelPreset,
    setCostModelPreset,
    arbRegimeGateEnabled,
    regimeGateConfig,
    setRegimeGateConfig,
  } = useStrategyBacktest();

  const r = lastResult;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)', marginBottom: 'var(--space-2xl)' }}>
      <div className="glass-card" style={{
        padding: 'var(--space-xl)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
      }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 className="section-heading">
              <span className="heading-icon">⚙️</span> Strategy Engine
            </h2>
            <span style={{
              fontSize: 'var(--font-xs)',
              padding: '3px 10px',
              borderRadius: '999px',
              background: 'var(--color-accent-dim)',
              color: 'var(--color-accent)',
              fontWeight: 700,
              letterSpacing: '0.08em',
            }}
            >
              {isLab ? 'SCENARIO LAB' : 'BACKTEST MODE'}
            </span>
            <div style={{ display: 'flex', gap: '6px', marginLeft: '12px' }}>
              {(['classic', 'lab'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setScenarioMode(m)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-full)',
                    border: scenarioMode === m ? '2px solid var(--color-gold)' : '2px solid var(--color-border)',
                    background: scenarioMode === m ? 'var(--color-gold-dim)' : 'transparent',
                    color: scenarioMode === m ? 'var(--color-gold)' : 'var(--color-muted)',
                    fontSize: 'var(--font-xxs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {m === 'classic' ? 'Classic Backtest' : 'Scenario Lab'}
                </button>
              ))}
            </div>
          </div>
          <p style={{
            margin: '6px 0 0 0',
            fontSize: 'var(--font-sm)',
            color: 'var(--color-muted)',
            maxWidth: '600px',
          }}
          >
            {isLab
              ? 'What-if shocks, gold-sleeve rebalancing, and portfolio-seeded simulations — educational only.'
              : 'Simulate algorithmic strategies over 30 days of synthetic price data — no real funds at risk.'}
          </p>
        </div>
        {r && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span className={`badge ${r.totalReturn >= 0 ? 'badge-green' : 'badge-red'}`}>
              {r.totalReturn >= 0 ? '▲' : '▼'} {formatPercent(r.totalReturn)} return
            </span>
            <span style={{
              fontSize: 'var(--font-xs)',
              padding: '3px 10px',
              borderRadius: '999px',
              background: 'var(--color-accent-dim)',
              color: 'var(--color-accent)',
              fontWeight: 600,
            }}
            >
              {r.totalTrades} trades
            </span>
          </div>
        )}
      </div>

      <div className="glass-card" style={{ padding: 'var(--space-xl)' }}>
        <h3 className="section-heading" style={{ marginBottom: '20px' }}>
          <span className="heading-icon">🔧</span> Strategy Configurator
        </h3>

        {isLab ? (
          <ScenarioLabPanel
            selectedScenario={selectedScenario}
            customShocks={customShocks}
            currentScenario={currentScenario}
            seedFromPortfolio={seedFromPortfolio}
            extraCashUsd={extraCashUsd}
            dcaUsdPerPeriod={dcaUsdPerPeriod}
            dcaPeriodCount={dcaPeriodCount}
            onSelectScenario={(key, shocks) => {
              setSelectedScenario(key);
              setCustomShocks(shocks);
            }}
            onSelectCustom={() => setSelectedScenario('custom')}
            onCustomShockChange={(id, value) => setCustomShocks({ ...customShocks, [id]: value })}
            onSeedFromPortfolioChange={setSeedFromPortfolio}
            onExtraCashChange={setExtraCashUsd}
            onDcaParamsChange={setDcaParams}
            costModelPreset={costModelPreset}
            onCostModelPresetChange={setCostModelPreset}
          />
        ) : (
          <>
            <BacktestConfigForm
            strategyType={strategyType}
            arbSpreadThreshold={arbSpreadThreshold}
            arbTradeSize={arbTradeSize}
            arbRegimeGateEnabled={arbRegimeGateEnabled}
            regimeMinFidelity={regimeGateConfig.minFidelityScore}
            regimeFullSizeFidelity={regimeGateConfig.fullSizeFidelityScore}
            regimeAllowDivergenceOverride={regimeGateConfig.allowDivergenceOverride}
            mrAsset={mrAsset}
            mrWindowSize={mrWindowSize}
            mrBuyThreshold={mrBuyThreshold}
            mrSellThreshold={mrSellThreshold}
            mrStopLoss={mrStopLoss}
            mrTradeSize={mrTradeSize}
            estimatedTradesPerDay={estimatedTradesPerDay}
            onStrategyTypeChange={setStrategyType}
            onArbConfigChange={setArbConfig}
            onRegimeGateChange={setRegimeGateConfig}
            onMrConfigChange={(patch) => setMrConfig(patch)}
            />
            <CostModelSelector costModelPreset={costModelPreset} onChange={setCostModelPreset} />
          </>
        )}

        <div style={{ height: '1px', background: 'var(--color-border)', margin: '24px 0' }} />

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '24px' }}>
          <div style={{ flex: 1, minWidth: 180, maxWidth: 280 }}>
            <Field
              label="Starting Balance"
              labelTooltip="Initial capital for the backtest simulation. Results are calculated based on this starting amount."
              value={initialBalance}
              min={100}
              max={1_000_000}
              step={100}
              onChange={(v) => setInitialBalance(parseFloat(v) || 10_000)}
              validate={(v) => v >= 100 && v <= 1000000}
              validationMessage="Must be between $100 and $1,000,000"
              suffix="$"
            />
          </div>
        </div>

        <button
          onClick={handleRunBacktest}
          disabled={isRunning}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: isRunning ? 'var(--color-border)' : 'var(--color-accent)',
            color: isRunning ? 'var(--color-muted)' : '#fff',
            fontWeight: 700,
            fontSize: 'var(--font-base)',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: isRunning ? 'none' : 'var(--shadow-md)',
          }}
          aria-label="Run back-test over 30 days of synthetic data"
        >
          {isRunning ? (
            <>
              <span style={{
                display: 'inline-block',
                width: 16,
                height: 16,
                border: '2px solid var(--color-muted)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }}
              />
              Running simulation…
            </>
          ) : isLab ? (
            '▶ Run Scenario Simulation'
          ) : (
            '▶ Run Backtest (30 Days)'
          )}
        </button>
      </div>

      {r && (
        <>
          <PerformanceStatBoxes
            result={r}
            isLab={isLab}
            lastScenarioResult={lastScenarioResult}
            goldPrice={goldPrice}
          />
          <EquityCurveChart result={r} isLab={isLab} />
          <TradeLogTable result={r} isLab={isLab} />
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
