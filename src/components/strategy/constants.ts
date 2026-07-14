export const BUILT_IN_SCENARIOS: Record<string, {
  label: string;
  shocks: Record<string, number>;
  description: string;
}> = {
  'flight-to-gold': {
    label: 'Flight to Gold (safe haven)',
    shocks: { gold: 1.12, 'pax-gold': 1.105, 'tether-gold': 1.09, bitcoin: 0.75, ethereum: 0.72 },
    description: 'Spot +12%, crypto-gold follows closely, BTC/ETH −25% (classic diversification stress)',
  },
  'crypto-meltup': {
    label: 'Crypto Risk-On melt-up',
    shocks: { gold: 0.97, 'pax-gold': 0.96, 'tether-gold': 0.95, bitcoin: 1.35, ethereum: 1.40 },
    description: 'Gold lags or dips, BTC/ETH surge (crypto-gold behaves more like risk asset)',
  },
  'stagflation': {
    label: 'Stagflation / Inflation hedge',
    shocks: { gold: 1.08, 'pax-gold': 1.07, 'tether-gold': 1.06, bitcoin: 0.95, ethereum: 0.93 },
    description: 'Gold +8% as inflation hedge, crypto mostly flat to slightly down',
  },
  'corr-spike': {
    label: 'Risk-off correlation spike',
    shocks: { gold: 0.85, 'pax-gold': 0.84, 'tether-gold': 0.83, bitcoin: 0.85, ethereum: 0.82 },
    description: 'All assets down together (~−15–18%) — high correlation stress',
  },
  'premium-squeeze': {
    label: 'Gold premium squeeze + normalize',
    shocks: { gold: 1.04, 'pax-gold': 0.985, 'tether-gold': 0.99, bitcoin: 1.0, ethereum: 1.0 },
    description: 'Spot rises while PAXG/XAUT temporarily lag (premium compresses then recovers)',
  },
};

export const MR_ASSET_OPTIONS = [
  { id: 'bitcoin', label: 'BTC — Bitcoin' },
  { id: 'ethereum', label: 'ETH — Ethereum' },
  { id: 'pax-gold', label: 'PAXG — PAX Gold' },
  { id: 'tether-gold', label: 'XAUT — Tether Gold' },
] as const;

export const SCENARIO_SHOCK_ASSETS = ['gold', 'pax-gold', 'tether-gold', 'bitcoin', 'ethereum'] as const;

/** Fee profiles for backtest / scenario simulations (per-leg bps). */
export const COST_MODEL_OPTIONS = [
  { id: 'none' as const, label: 'No fees (gross)', feeLabel: '0 bps', description: 'Educational gross returns — no exchange drag' },
  { id: 'coinbase' as const, label: 'Coinbase', feeLabel: '60 bps/leg', description: '~0.6% per leg (~1.2% round-trip PAXG→USD→XAUT)' },
  { id: 'kraken' as const, label: 'Kraken', feeLabel: '26 bps/leg', description: '~0.26% per leg (direct PAXG/XAUT)' },
];
