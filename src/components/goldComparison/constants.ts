import type { ChartRange } from '@/types';

export type ComparisonTab = 'overlay' | 'premiums' | 'currencies' | 'portfolio' | 'regimes';

export const TABS: { id: ComparisonTab; label: string; icon: string }[] = [
  { id: 'overlay',    label: 'Price Overlay',  icon: '📊' },
  { id: 'premiums',   label: 'Premiums',       icon: '🏅' },
  { id: 'currencies', label: 'Currencies',     icon: '🌍' },
  { id: 'portfolio',  label: 'Portfolio',      icon: '💼' },
  { id: 'regimes',    label: 'Fidelity & Regimes', icon: '🔬' },
];

export const OVERLAY_INSTRUMENTS = [
  { id: 'spot-gold',    label: 'Spot Gold',  color: '#f0c845', cgId: null           },
  { id: 'pax-gold',     label: 'PAXG',       color: '#10b981', cgId: 'pax-gold'     },
  { id: 'tether-gold',  label: 'XAUT',       color: '#14b8a6', cgId: 'tether-gold'  },
  { id: 'bitcoin',      label: 'BTC',        color: '#f59e0b', cgId: 'bitcoin'      },
  { id: 'ethereum',     label: 'ETH',        color: '#8b5cf6', cgId: 'ethereum'     },
] as const;

export type InstrumentId = typeof OVERLAY_INSTRUMENTS[number]['id'];

export const RANGES: ChartRange[] = ['1D', '1W', '1M', '1Y', 'MAX'];

export const RANGE_PARAMS: Record<string, { days: string; interval: string }> = {
  '1D':  { days: '1',   interval: 'hourly' },
  '1W':  { days: '7',   interval: 'hourly' },
  '1M':  { days: '30',  interval: 'daily'  },
  '1Y':  { days: '365', interval: 'daily'  },
  'MAX': { days: 'max', interval: 'daily'  },
};

export const GOLD_FORMS = [
  {
    id: 'spot',       name: 'Spot Gold (XAU)',          unit: '1 troy oz',
    premiumPct: 0,    premiumNote: 'Reference price',
    icon: '📍',
  },
  {
    id: 'kilo-bar',   name: '1 kg Gold Bar',            unit: '32.15 oz',
    premiumPct: 0.4,  premiumNote: 'LBMA-certified',
    icon: '🔶',
  },
  {
    id: '100g-bar',   name: '100g Gold Bar',            unit: '3.215 oz',
    premiumPct: 1.2,  premiumNote: 'Branded refinery',
    icon: '🟡',
  },
  {
    id: '1oz-bar',    name: '1 oz Gold Bar',            unit: '1 oz',
    premiumPct: 2.5,  premiumNote: 'PAMP / Valcambi',
    icon: '🟧',
  },
  {
    id: 'eagle',      name: 'American Gold Eagle (1oz)', unit: '1 oz',
    premiumPct: 4.5,  premiumNote: 'US Mint coin',
    icon: '🦅',
  },
  {
    id: 'maple',      name: 'Canadian Maple Leaf (1oz)', unit: '1 oz',
    premiumPct: 4.0,  premiumNote: 'Royal Canadian Mint',
    icon: '🍁',
  },
  {
    id: 'krugerrand', name: 'Krugerrand (1oz)',          unit: '1 oz',
    premiumPct: 3.8,  premiumNote: 'South African',
    icon: '🪙',
  },
  {
    id: 'paxg',       name: 'PAXG (Crypto-gold)',        unit: '1 oz equiv.',
    premiumPct: null, premiumNote: 'Market-driven spread',
    icon: '🔐',
  },
  {
    id: 'xaut',       name: 'XAUT (Crypto-gold)',        unit: '1 oz equiv.',
    premiumPct: null, premiumNote: 'Market-driven spread',
    icon: '🔑',
  },
] as const;

export const CURRENCIES = [
  { code: 'USD', name: 'US Dollar',        symbol: '$',  rateToUsd: 1.0    },
  { code: 'EUR', name: 'Euro',             symbol: '€',  rateToUsd: 1.08   },
  { code: 'GBP', name: 'British Pound',    symbol: '£',  rateToUsd: 1.27   },
  { code: 'JPY', name: 'Japanese Yen',     symbol: '¥',  rateToUsd: 0.0067 },
  { code: 'CNY', name: 'Chinese Yuan',     symbol: '¥',  rateToUsd: 0.138  },
  { code: 'CHF', name: 'Swiss Franc',      symbol: 'Fr', rateToUsd: 1.12   },
  { code: 'AUD', name: 'Australian Dollar',symbol: 'A$', rateToUsd: 0.65   },
  { code: 'CAD', name: 'Canadian Dollar',  symbol: 'C$', rateToUsd: 0.74   },
  { code: 'INR', name: 'Indian Rupee',     symbol: '₹',  rateToUsd: 0.012  },
  { code: 'RUB', name: 'Russian Ruble',    symbol: '₽',  rateToUsd: 0.011  },
] as const;

export interface OverlayPoint {
  time: string;
  [key: string]: number | string | undefined;
}

export const PORTFOLIO_COLUMNS: { label: string; align: 'left' | 'right' }[] = [
  { label: 'Asset',       align: 'left'  },
  { label: 'Amount',      align: 'right' },
  { label: 'Buy Price',   align: 'right' },
  { label: 'Current',     align: 'right' },
  { label: 'Value',       align: 'right' },
  { label: 'P&L',         align: 'right' },
  { label: 'Gold Equiv.', align: 'right' },
];
