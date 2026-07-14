import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  createDefaultSpreadRule,
  exportRulesJson,
  parseRulesImport,
  type AlertRule,
  type FidelityAlertRule,
} from '@lib/alertRules';

interface AlertRulesState {
  rules: AlertRule[];
  /** Per-rule last fire timestamp for cooldown tracking. */
  lastFiredAt: Record<string, number>;
  /** Whether we already prompted for browser notification permission. */
  notificationPromptDismissed: boolean;

  addRule: (rule: AlertRule) => void;
  updateRule: (id: string, patch: Partial<AlertRule>) => void;
  removeRule: (id: string) => void;
  toggleRule: (id: string) => void;
  setLastFired: (ruleId: string, timestamp: number) => void;
  exportRules: () => string;
  importRules: (json: string, mode: 'merge' | 'replace') => { ok: true } | { ok: false; error: string };
  dismissNotificationPrompt: () => void;
  resetToDefaults: () => void;
}

function createDefaultFidelityRule(): FidelityAlertRule {
  const now = Date.now();
  return {
    ...createDefaultSpreadRule(),
    id: `rule-${now}-default-fidelity`,
    name: 'PAXG tracking error (fidelity < 45)',
    type: 'fidelity',
    asset: 'pax-gold',
    threshold: 45,
    horizon: '30d',
    cooldownMinutes: 30,
    createdAt: now,
    updatedAt: now,
  };
}

function seedRules(): AlertRule[] {
  return [createDefaultSpreadRule(), createDefaultFidelityRule()];
}

export const useAlertRulesStore = create<AlertRulesState>()(
  persist(
    (set, get) => ({
      rules: seedRules(),
      lastFiredAt: {},
      notificationPromptDismissed: false,

      addRule: (rule) =>
        set((state) => ({
          rules: [...state.rules, rule],
        })),

      updateRule: (id, patch) =>
        set((state) => ({
          rules: state.rules.map((r) =>
            r.id === id ? ({ ...r, ...patch, updatedAt: Date.now() } as AlertRule) : r,
          ),
        })),

      removeRule: (id) =>
        set((state) => {
          const nextFired = { ...state.lastFiredAt };
          delete nextFired[id];
          return {
            rules: state.rules.filter((r) => r.id !== id),
            lastFiredAt: nextFired,
          };
        }),

      toggleRule: (id) =>
        set((state) => ({
          rules: state.rules.map((r) =>
            r.id === id ? { ...r, enabled: !r.enabled, updatedAt: Date.now() } : r,
          ),
        })),

      setLastFired: (ruleId, timestamp) =>
        set((state) => ({
          lastFiredAt: { ...state.lastFiredAt, [ruleId]: timestamp },
        })),

      exportRules: () => exportRulesJson(get().rules),

      importRules: (json, mode) => {
        const result = parseRulesImport(json);
        if (!result.ok) return result;
        set((state) => ({
          rules:
            mode === 'replace'
              ? result.rules
              : [
                  ...state.rules,
                  ...result.rules.filter((incoming) => !state.rules.some((r) => r.id === incoming.id)),
                ],
        }));
        return { ok: true };
      },

      dismissNotificationPrompt: () => set({ notificationPromptDismissed: true }),

      resetToDefaults: () => set({ rules: seedRules(), lastFiredAt: {} }),
    }),
    {
      name: 'goldtrackr-alert-rules',
      version: 1,
    },
  ),
);
