import { useMemo } from 'react';
import { usePriceStore } from '@/store/priceStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useStrategyStore } from '@/store/strategyStore';
import {
  evaluateArbRegimeGate,
  formatRegimeTagForUi,
} from '@lib/regime';
import { useFidelityScores } from '@/hooks/useFidelityScores';
import type { TradeSuggestion } from '@/types/TradeSuggestion';

export function useTradeSuggestions() {
  const { prices, goldSpot } = usePriceStore();
  const { maxTradeSize } = useSettingsStore();
  const {
    regimeGateConfig,
    arbRegimeGateEnabled,
  } = useStrategyStore();
  const fidelity = useFidelityScores();

  const suggestions = useMemo(() => {
    const newSuggestions: TradeSuggestion[] = [];
    const paxg = prices['pax-gold'];
    const xaut = prices['tether-gold'];
    const btc = prices['bitcoin'];

    if (!paxg || !xaut || !goldSpot) return [];

    const regimeUi = fidelity
      ? formatRegimeTagForUi(
          evaluateArbRegimeGate(fidelity.paxg, fidelity.xaut, regimeGateConfig),
          fidelity.isEstimatedSpot,
        )
      : null;

    const attachRegime = (
      suggestion: TradeSuggestion,
      tokenScore?: number,
      tokenLabel?: string,
    ): TradeSuggestion => {
      if (!regimeUi || !fidelity) return suggestion;
      const score = tokenScore ?? Math.round((fidelity.paxg.score + fidelity.xaut.score) / 2);
      const tag = tokenLabel ?? regimeUi.tag;
      return {
        ...suggestion,
        regimeTag: tag,
        regimeScore: score,
        regimeReason: regimeUi.reason,
        regimeDisclaimer: regimeUi.disclaimer,
      };
    };

    // 1. PAXG/XAUT Arbitrage
    const spread = ((paxg.price - xaut.price) / xaut.price) * 100;
    const absSpread = Math.abs(spread);

    if (absSpread > 0.55) {
      const isPaxgExpensive = spread > 0;
      const profitEst = (absSpread - 0.45).toFixed(2);

      let arbGateBlocked = false;
      let sizeLabel = `${maxTradeSize} oz equiv`;
      let regimeReason = regimeUi?.reason;
      let regimeTag = regimeUi?.tag;

      if (fidelity && arbRegimeGateEnabled) {
        const gate = evaluateArbRegimeGate(fidelity.paxg, fidelity.xaut, regimeGateConfig);
        arbGateBlocked = !gate.allowed;
        if (gate.allowed) {
          sizeLabel = `${maxTradeSize} oz equiv (${Math.round(gate.sizeMultiplier * 100)}% regime size)`;
        }
        regimeReason = gate.reason;
        regimeTag = gate.regimeTag;
      }

      newSuggestions.push({
        id: 'arb-paxg-xaut',
        type: 'arb',
        action: isPaxgExpensive
          ? 'SELL PAXG • BUY XAUT'
          : 'BUY PAXG • SELL XAUT',
        size: sizeLabel,
        expectedProfit: `${profitEst}% (est. spread ${absSpread.toFixed(2)}%)`,
        reason: isPaxgExpensive
          ? `PAXG is ${spread.toFixed(2)}% more expensive than XAUT.`
          : `PAXG is ${Math.abs(spread).toFixed(2)}% cheaper than XAUT.`,
        confidence: arbGateBlocked ? 55 : 92,
        buttonText: arbGateBlocked ? 'Regime gated — review' : 'Execute Swap',
        coinbaseDeepLink: 'https://www.coinbase.com/advanced-trade/spot/PAXG-USD',
        productId: 'PAXG-USD',
        side: isPaxgExpensive ? 'SELL' : 'BUY',
        regimeTag,
        regimeScore: fidelity ? Math.round((fidelity.paxg.score + fidelity.xaut.score) / 2) : undefined,
        regimeReason,
        regimeDisclaimer: regimeUi?.disclaimer,
        regimeBlocked: arbGateBlocked,
      });
    }

    // 2. Premium/Discount to Real Gold (Spot)
    const checkPremium = (token: typeof paxg, name: string) => {
      const premium = ((token.price - goldSpot.price) / goldSpot.price) * 100;
      if (Math.abs(premium) > 0.80) {
        const isPremium = premium > 0;
        const tokenScore = token.id === 'pax-gold' ? fidelity?.paxg.score : fidelity?.xaut.score;
        const tokenRegime = token.id === 'pax-gold' ? fidelity?.paxg.regimeLabel : fidelity?.xaut.regimeLabel;
        newSuggestions.push(
          attachRegime(
            {
              id: `premium-${token.id}`,
              type: 'premium',
              action: isPremium
                ? `SELL ${token.symbol} (Premium)`
                : `BUY ${token.symbol} (Discount)`,
              size: `${maxTradeSize} oz`,
              expectedProfit: `${Math.abs(premium).toFixed(2)}% deviation`,
              reason: `${name} is trading at a ${premium.toFixed(2)}% ${isPremium ? 'premium' : 'discount'} to spot gold.`,
              confidence: 85,
              buttonText: 'Go to Trade',
              coinbaseDeepLink: `https://www.coinbase.com/advanced-trade/spot/${token.symbol}-USD`,
              productId: `${token.symbol}-USD`,
              side: isPremium ? 'SELL' : 'BUY',
            },
            tokenScore,
            tokenRegime,
          ),
        );
      }
    };

    checkPremium(paxg, 'PAXG');
    checkPremium(xaut, 'XAUT');

    // 3. BTC-Gold Rebalance Hedge
    if (btc) {
      const btcChange = btc.change24h;
      const goldChange = goldSpot.change24h;

      if ((btcChange > 0 && goldChange < 0) || (btcChange < 0 && goldChange > 0)) {
        if (Math.abs(btcChange) > 3 * Math.abs(goldChange)) {
          const isBtcDown = btcChange < 0;
          newSuggestions.push(
            attachRegime(
              {
                id: 'hedge-btc-gold',
                type: 'hedge',
                action: isBtcDown
                  ? 'Rotate BTC → PAXG (Safety)'
                  : 'Rotate PAXG → BTC (Growth)',
                size: '20% of holdings',
                expectedProfit: 'Risk Management',
                reason: isBtcDown
                  ? `BTC dropped ${btcChange.toFixed(1)}% while Gold held up. Good time to hedge.`
                  : `BTC rallying ${btcChange.toFixed(1)}% vs Gold. Consider taking profits into crypto.`,
                confidence: 75,
                buttonText: 'Rebalance',
                coinbaseDeepLink: isBtcDown
                  ? 'https://www.coinbase.com/advanced-trade/spot/PAXG-BTC'
                  : 'https://www.coinbase.com/advanced-trade/spot/BTC-USD',
                productId: isBtcDown ? 'PAXG-USD' : 'BTC-USD',
                side: 'BUY',
              },
              fidelity?.paxg.score,
              fidelity?.paxg.regimeLabel,
            ),
          );
        }
      }
    }

    return newSuggestions;
  }, [prices, goldSpot, maxTradeSize, fidelity, regimeGateConfig, arbRegimeGateEnabled]);

  return suggestions;
}
