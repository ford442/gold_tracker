import { useMemo } from 'react';
import { usePriceStore } from '../store/priceStore';
import { useSettingsStore } from '../store/settingsStore';
import type { TradeSuggestion } from '../types/TradeSuggestion';

export function useTradeSuggestions() {
  const { prices, goldSpot } = usePriceStore();
  const { maxTradeSize } = useSettingsStore();

  const suggestions = useMemo(() => {
    const newSuggestions: TradeSuggestion[] = [];
    const paxg = prices['pax-gold'];
    const xaut = prices['tether-gold'];
    const btc = prices['bitcoin'];

    // Safety check: ensure we have data
    if (!paxg || !xaut || !goldSpot) return [];

    // 1. PAXG/XAUT Arbitrage
    // Formula: ((PAXG - XAUT) / XAUT) * 100
    // Threshold: > 0.55% (covers ~0.4% fees + slippage)
    const spread = ((paxg.price - xaut.price) / xaut.price) * 100;
    const absSpread = Math.abs(spread);

    if (absSpread > 0.55) {
      const isPaxgExpensive = spread > 0;
      const profitEst = (absSpread - 0.45).toFixed(2); // minimal fee deduction est.

      newSuggestions.push({
        id: 'arb-paxg-xaut',
        type: 'arb',
        action: isPaxgExpensive
          ? 'SELL PAXG • BUY XAUT'
          : 'BUY PAXG • SELL XAUT',
        size: `${maxTradeSize} oz equiv`,
        expectedProfit: `${profitEst}% (est. spread ${absSpread.toFixed(2)}%)`,
        reason: isPaxgExpensive
          ? `PAXG is ${spread.toFixed(2)}% more expensive than XAUT.`
          : `PAXG is ${Math.abs(spread).toFixed(2)}% cheaper than XAUT.`,
        confidence: 92, // High confidence for pure arb
        buttonText: 'Execute Swap',
        coinbaseDeepLink: isPaxgExpensive
          ? 'https://www.coinbase.com/advanced-trade/spot/PAXG-USD' // Sell PAXG first
          : 'https://www.coinbase.com/advanced-trade/spot/PAXG-USD' // Buy PAXG first
      });
    }

    // 2. Premium/Discount to Real Gold (Spot)
    // Threshold: > 0.80% deviation
    // Compare PAXG/XAUT vs Gold Spot Price
    const checkPremium = (token: typeof paxg, name: string) => {
      const premium = ((token.price - goldSpot.price) / goldSpot.price) * 100;
      if (Math.abs(premium) > 0.80) {
        const isPremium = premium > 0;
        newSuggestions.push({
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
          coinbaseDeepLink: `https://www.coinbase.com/advanced-trade/spot/${token.symbol}-USD`
        });
      }
    };

    checkPremium(paxg, 'PAXG');
    checkPremium(xaut, 'XAUT');

    // 3. BTC-Gold Rebalance Hedge
    // Logic: If BTC moves > 3x Gold in opposite direction (24h)
    // Example: BTC -5%, Gold +1% -> Rotate BTC to Gold
    if (btc) {
      const btcChange = btc.change24h;
      const goldChange = goldSpot.change24h;

      // Check for opposite directions
      if ((btcChange > 0 && goldChange < 0) || (btcChange < 0 && goldChange > 0)) {
        if (Math.abs(btcChange) > 3 * Math.abs(goldChange)) {
          const isBtcDown = btcChange < 0;
          newSuggestions.push({
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
               ? 'https://www.coinbase.com/advanced-trade/spot/PAXG-BTC' // If supported, or convert via USD
               : 'https://www.coinbase.com/advanced-trade/spot/BTC-USD'
          });
        }
      }
    }

    return newSuggestions;
  }, [prices, goldSpot, maxTradeSize]);

  return suggestions;
}
