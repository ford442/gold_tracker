import { useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import {
  applyShocksToTicks,
  generateBaseScenarioTicks,
  EXCHANGE_COST_PRESETS,
  type BacktestTick,
  type RebalanceConfig,
} from '@lib/strategyEngine';
import { runBacktestAsync } from '@lib/workerClient';
import type { StrategyPayload } from '@lib/analyticsWorkerProtocol';
import { generateMockTicks } from '@lib/strategyMockTicks';
import { fetchHistoricalBacktestTicks } from '@lib/historicalTicks';
import { formatPercent, formatPrice } from '@lib/utils';
import { useStrategyStore } from '@/store/strategyStore';
import { usePortfolioStore } from '@/store/portfolioStore';
import { usePriceStore } from '@/store/priceStore';
import { useFidelityScores } from '@/hooks/useFidelityScores';
import { BUILT_IN_SCENARIOS } from '@components/strategy/constants';

function withRegimeOnTicks(
  ticks: BacktestTick[],
  regime: BacktestTick['regime'],
): BacktestTick[] {
  if (!regime) return ticks;
  return ticks.map((t) => ({ ...t, regime }));
}

export function useStrategyBacktest() {
  const {
    strategyType,
    arbSpreadThreshold, arbTradeSize, arbAsset1, arbAsset2,
    mrAsset, mrWindowSize, mrBuyThreshold, mrSellThreshold, mrStopLoss, mrTradeSize,
    initialBalance, setInitialBalance,
    lastResult, setLastResult,
    isRunning, setIsRunning,
    scenarioMode,
    selectedScenario, setSelectedScenario,
    customShocks, setCustomShocks,
    seedFromPortfolio, setSeedFromPortfolio,
    extraCashUsd, setExtraCashUsd,
    dcaUsdPerPeriod, dcaPeriodCount, setDcaParams,
    lastScenarioResult, setLastScenarioResult,
    setStrategyType, setArbConfig, setMrConfig,
    setScenarioMode,
    costModelPreset, setCostModelPreset,
    arbRegimeGateEnabled,
    regimeGateConfig,
    setRegimeGateConfig,
    tickSource,
    setTickSource,
    historicalRange,
    setHistoricalRange,
    historicalFallbackNotice,
    setHistoricalFallbackNotice,
  } = useStrategyStore();

  const { entries: portfolioEntries } = usePortfolioStore();
  const { prices: priceMap, goldSpot } = usePriceStore();
  const fidelitySnapshot = useFidelityScores();
  const goldPrice = goldSpot?.price ?? null;

  const isLab = scenarioMode === 'lab';
  const activeCostModel = EXCHANGE_COST_PRESETS[costModelPreset];

  const currentScenario = useMemo(() => {
    if (!isLab) return null;
    return BUILT_IN_SCENARIOS[selectedScenario] ?? {
      label: 'Custom',
      shocks: customShocks || {},
      description: 'User shocks',
    };
  }, [isLab, selectedScenario, customShocks]);

  function getCurrentPriceForId(assetId: string): number {
    if (assetId === 'gold' || assetId === 'XAU') return goldPrice || 3290;
    if (assetId === 'usd-coin' || assetId === 'USDC') return 1;
    return priceMap[assetId]?.price ?? 0;
  }

  const portfolioSnapshot = useMemo(() => {
    if (!seedFromPortfolio || portfolioEntries.length === 0) {
      return { initialPositions: {} as Record<string, { units: number; avgCost: number }>, portfolioValue: 0, goldOz: 0 };
    }
    const initPos: Record<string, { units: number; avgCost: number }> = {};
    let totalVal = extraCashUsd;
    let gOz = 0;
    const goldIds = ['pax-gold', 'tether-gold', 'gold'];

    for (const e of portfolioEntries) {
      const id = e.symbol === 'XAU' ? 'gold' : (e.symbol.toLowerCase() === 'paxg' ? 'pax-gold' : e.symbol.toLowerCase() === 'xaut' ? 'tether-gold' : e.symbol.toLowerCase());
      const curP = getCurrentPriceForId(id) || e.buyPrice || 1;
      const units = e.amount;
      initPos[id] = { units, avgCost: curP };
      totalVal += units * curP;
      if (goldIds.includes(id)) gOz += units;
    }
    return { initialPositions: initPos, portfolioValue: totalVal, goldOz: gOz };
  }, [seedFromPortfolio, portfolioEntries, extraCashUsd, priceMap, goldPrice]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRunBacktest = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);

    await new Promise<void>((r) => setTimeout(r, 60));

    try {
      if (!isLab) {
        let ticks: BacktestTick[];
        if (tickSource === 'historical') {
          const fetchRes = await fetchHistoricalBacktestTicks({
            range: historicalRange,
            strategyType,
            arbAssets: [arbAsset1, arbAsset2],
            mrAsset,
            apiKey: import.meta.env.VITE_COINGECKO_API_KEY as string | undefined,
          });
          ticks = fetchRes.ticks;
          if (fetchRes.isMock || fetchRes.source === 'synthetic_fallback') {
            setHistoricalFallbackNotice(
              fetchRes.error || 'Using synthetic data (CoinGecko unavailable or rate-limited)',
            );
            toast('Historical data unavailable — fell back to synthetic ticks', { icon: '⚠️' });
          } else {
            setHistoricalFallbackNotice(null);
          }
        } else {
          ticks = generateMockTicks(strategyType, mrAsset);
          setHistoricalFallbackNotice(null);
        }

        const liveRegime = fidelitySnapshot
          ? { paxg: fidelitySnapshot.paxg, xaut: fidelitySnapshot.xaut }
          : undefined;
        if (strategyType === 'arbitrage' && arbRegimeGateEnabled && liveRegime) {
          ticks = withRegimeOnTicks(ticks, liveRegime);
        }
        const strategyPayload: StrategyPayload = strategyType === 'arbitrage'
          ? {
              kind: 'arbitrage',
              config: {
                asset1: arbAsset1,
                asset2: arbAsset2,
                spreadThreshold: arbSpreadThreshold,
                tradeSize: arbTradeSize,
                regimeGate: arbRegimeGateEnabled
                  ? { enabled: true, config: regimeGateConfig }
                  : undefined,
              },
            }
          : {
              kind: 'meanReversion',
              config: {
                asset: mrAsset,
                windowSize: mrWindowSize,
                buyThreshold: mrBuyThreshold,
                sellThreshold: mrSellThreshold,
                tradeSize: mrTradeSize,
                stopLoss: mrStopLoss,
              },
            };

        const result = await runBacktestAsync({
          ticks,
          strategy: strategyPayload,
          initialBalance,
          costModel: activeCostModel,
        });
        setLastResult(result);
        const feeNote = result.totalFeesUsd > 0 ? `, fees ${formatPrice(result.totalFeesUsd)}` : '';
        const sourceLabel = tickSource === 'historical' && !historicalFallbackNotice ? ` (${historicalRange} real)` : ' (synthetic)';
        toast.success(`Backtest complete${sourceLabel} — ${result.totalTrades} trades, ${formatPercent(result.totalReturn)} net return${feeNote}`, { duration: 4000 });
      } else {
        let baseTicks: BacktestTick[];

        if (tickSource === 'historical') {
          const fetchRes = await fetchHistoricalBacktestTicks({
            range: historicalRange,
            strategyType: 'arbitrage',
            scenarioLabAssets: ['pax-gold', 'tether-gold', 'bitcoin', 'ethereum'],
            apiKey: import.meta.env.VITE_COINGECKO_API_KEY as string | undefined,
          });
          if (fetchRes.isMock || fetchRes.source === 'synthetic_fallback') {
            setHistoricalFallbackNotice(
              fetchRes.error || 'Using synthetic base scenario ticks (CoinGecko unavailable)',
            );
          } else {
            setHistoricalFallbackNotice(null);
          }
          const goldBase = goldPrice || 3290;
          baseTicks = fetchRes.ticks.map((t) => ({
            ...t,
            prices: {
              ...t.prices,
              gold: t.prices['pax-gold'] || goldBase,
            },
          }));
        } else {
          baseTicks = generateBaseScenarioTicks(720);
          setHistoricalFallbackNotice(null);
        }

        const shocks = selectedScenario === 'custom' ? customShocks : (currentScenario?.shocks ?? customShocks);
        const shockedTicks = applyShocksToTicks(baseTicks, shocks);

        const initPos = seedFromPortfolio ? portfolioSnapshot.initialPositions : {};
        const startCash = seedFromPortfolio
          ? (portfolioSnapshot.portfolioValue + extraCashUsd)
          : (initialBalance + extraCashUsd);

        const rebalCfg: RebalanceConfig = {
          goldAssetIds: ['pax-gold', 'tether-gold'],
          targetGoldPct: 0.55,
          rebalanceBandPct: 0.05,
        };
        const rebalPayload: StrategyPayload = {
          kind: 'goldExposureRebalancer',
          config: rebalCfg,
        };

        if (dcaUsdPerPeriod > 0 && dcaPeriodCount > 0) {
          // DCA approximated via extra cash + rebal target for demo
        }

        const primary = await runBacktestAsync({
          ticks: shockedTicks,
          strategy: rebalPayload,
          initialBalance: Math.max(0, startCash),
          initialPositions: initPos,
          costModel: activeCostModel,
        });
        const hold = await runBacktestAsync({
          ticks: shockedTicks,
          strategy: { kind: 'hold' },
          initialBalance: Math.max(0, startCash),
          initialPositions: initPos,
          costModel: activeCostModel,
        });

        setLastScenarioResult(primary);
        setLastResult(primary);

        toast.success(`Scenario complete — ${primary.totalTrades} rebal trades, ${formatPercent(primary.totalReturn)} vs hold ${formatPercent(hold.totalReturn)}`, { duration: 5000 });
      }
    } catch (err) {
      console.error('[StrategyDashboard] backtest/scenario error:', err);
      toast.error('Simulation failed — check console');
    } finally {
      setIsRunning(false);
    }
  }, [
    isRunning, isLab, strategyType, arbAsset1, arbAsset2, arbSpreadThreshold, arbTradeSize,
    arbRegimeGateEnabled, regimeGateConfig,
    mrAsset, mrWindowSize, mrBuyThreshold, mrSellThreshold, mrTradeSize, mrStopLoss,
    initialBalance, setLastResult, setIsRunning, setLastScenarioResult,
    selectedScenario, customShocks, currentScenario, extraCashUsd, seedFromPortfolio,
    portfolioSnapshot, dcaUsdPerPeriod, dcaPeriodCount, goldPrice,
    activeCostModel, fidelitySnapshot,
    tickSource, historicalRange, historicalFallbackNotice, setHistoricalFallbackNotice,
  ]);

  const estimatedTradesPerDay = strategyType === 'arbitrage'
    ? Math.round((0.08 * 24 * (0.25 / arbSpreadThreshold)) * 10) / 10
    : Math.round((24 / mrWindowSize) * 10) / 10;

  return {
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
    activeCostModel,
    arbRegimeGateEnabled,
    regimeGateConfig,
    setRegimeGateConfig,
    tickSource,
    setTickSource,
    historicalRange,
    setHistoricalRange,
    historicalFallbackNotice,
  };
}
