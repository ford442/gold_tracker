import { isStablecoin } from '@lib/assets';

export const DEMO_POSITION = {
  symbol: 'PAXG',
  name: 'PAX Gold',
  amount: 5,
  buyPrice: 3200,
};

export function getCurrentPrice(
  id: string,
  prices: Record<string, { price: number }>,
  goldPrice: number | null,
): number {
  if (id === 'gold') return goldPrice ?? 0;
  if (isStablecoin(id)) return 1;
  return prices[id]?.price ?? 0;
}

export interface PortfolioFormState {
  assetId: string;
  amount: string;
  buyPrice: string;
}

export const DEFAULT_FORM: PortfolioFormState = {
  assetId: 'pax-gold',
  amount: '',
  buyPrice: '',
};
