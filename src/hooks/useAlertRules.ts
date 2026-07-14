import { useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { usePriceStore } from '@/store/priceStore';
import { useAlertStore } from '@/store/alertStore';
import { useAlertRulesStore } from '@/store/alertRulesStore';
import {
  evaluateRule,
  shouldFireRule,
  type AlertEvalContext,
} from '@lib/alertRules';
import { showBrowserNotification } from '@lib/alertNotifications';
import { useFidelityScores } from '@/hooks/useFidelityScores';

/**
 * Evaluates persisted user alert rules against live price/regime data.
 * Handles per-rule cooldown, quiet hours, and multi-channel delivery.
 */
export function useAlertRules() {
  const { prices, goldSpot } = usePriceStore();
  const { rules, lastFiredAt, setLastFired } = useAlertRulesStore();
  const { addAlert } = useAlertStore();
  const prevPricesRef = useRef<Record<string, number>>({});
  const fidelitySnapshot = useFidelityScores();

  useEffect(() => {
    const enabledRules = rules.filter((r) => r.enabled);
    if (enabledRules.length === 0) return;

    const fidelityScores = fidelitySnapshot
      ? { 'pax-gold': fidelitySnapshot.paxg, 'tether-gold': fidelitySnapshot.xaut }
      : undefined;

    const now = Date.now();
    const ctx: AlertEvalContext = {
      prices,
      goldSpot,
      fidelityScores,
      previousPrices: { ...prevPricesRef.current },
      now,
    };

    for (const rule of enabledRules) {
      const evalResult = evaluateRule(rule, ctx);
      const state = { lastFiredAt: lastFiredAt[rule.id] };
      if (!shouldFireRule(rule, evalResult, state, now)) continue;

      setLastFired(rule.id, now);

      if (rule.delivery.inApp) {
        addAlert({
          type: evalResult.alertType,
          message: evalResult.message,
          spread: evalResult.alertType === 'arbitrage' ? evalResult.value : undefined,
          value: evalResult.value,
          ruleId: rule.id,
          ruleName: rule.name,
        });
      }

      if (rule.delivery.toast) {
        toast(evalResult.message, {
          icon: evalResult.alertType === 'arbitrage' ? '⚡' : '🔔',
          duration: 5000,
        });
      }

      if (rule.delivery.browser) {
        showBrowserNotification(`GoldTrackr: ${rule.name}`, evalResult.message, rule.id);
      }
    }

    const nextPrev: Record<string, number> = { ...prevPricesRef.current };
    if (goldSpot?.price) nextPrev.gold = goldSpot.price;
    for (const [id, data] of Object.entries(prices)) {
      if (data?.price) nextPrev[id] = data.price;
    }
    prevPricesRef.current = nextPrev;
  }, [prices, goldSpot, fidelitySnapshot, rules, lastFiredAt, setLastFired, addAlert]);
}
