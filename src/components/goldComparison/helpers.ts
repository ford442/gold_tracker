export function generateMockGoldHistory(basePrice: number, points: number): [number, number][] {
  const now = Date.now();
  const msPerPoint = (points <= 24 ? 3600000 : 86400000);
  let price = basePrice;
  return Array.from({ length: points }, (_, i) => {
    price = price * (1 + (Math.random() - 0.485) * 0.008);
    return [now - (points - i) * msPerPoint, Math.round(price * 100) / 100];
  });
}

export function normalizeSeries(prices: number[]): number[] {
  const base = prices[0];
  if (!base) return prices;
  return prices.map((p) => Math.round(((p - base) / base) * 10000) / 100);
}

export function formatCurrencyAmount(usdAmount: number, rate: number, symbol: string): string {
  const val = usdAmount / rate;
  if (val >= 1000) return `${symbol}${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
