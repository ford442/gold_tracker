import { TRADE_REPLAY_ASSET_IDS, toSymbol } from '@lib/assets';
import type { ChartRange, ScenarioMode } from '@/types';

export const RANGES: ChartRange[] = ['1D', '1W', '1M', '3M', '1Y', 'MAX'];

export const SCENARIOS: { value: ScenarioMode; label: string }[] = [
  { value: 'realized', label: 'Realized' },
  { value: 'forecast', label: 'Forecast' },
  { value: 'both', label: 'Both' },
];

export const TRADE_REPLAY_OPTIONS = TRADE_REPLAY_ASSET_IDS.map((id) => ({
  id,
  label: toSymbol(id),
}));

export const RANGE_PARAMS: Record<ChartRange, { days: string; interval: string }> = {
  '1D': { days: '1', interval: 'hourly' },
  '1W': { days: '7', interval: 'hourly' },
  '1M': { days: '30', interval: 'daily' },
  '3M': { days: '90', interval: 'daily' },
  '1Y': { days: '365', interval: 'daily' },
  MAX: { days: 'max', interval: 'daily' },
  SINCE_TRADE: { days: '7', interval: 'hourly' },
};
