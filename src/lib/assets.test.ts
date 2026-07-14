import { describe, expect, it } from 'vitest';
import {
  ASSETS,
  COINBASE_CURRENCY_TO_ASSET_ID,
  COINGECKO_MARKET_IDS,
  CORRELATION_ASSET_IDS,
  fromCoinbaseCode,
  fromSymbol,
  isGoldToken,
  resolvePortfolioAssetId,
  toSymbol,
} from './assets';

describe('assets registry', () => {
  it('maps Coinbase codes to asset ids', () => {
    expect(COINBASE_CURRENCY_TO_ASSET_ID.PAXG).toBe('pax-gold');
    expect(COINBASE_CURRENCY_TO_ASSET_ID.XAU).toBe('gold');
    expect(fromCoinbaseCode('USDC')?.id).toBe('usd-coin');
  });

  it('resolves symbols and tickers', () => {
    expect(fromSymbol('PAXG')?.id).toBe('pax-gold');
    expect(toSymbol('tether-gold')).toBe('XAUT');
    expect(resolvePortfolioAssetId('XAU')).toBe('gold');
    expect(resolvePortfolioAssetId('BTC')).toBe('bitcoin');
  });

  it('builds CoinGecko market id list from dashboard assets', () => {
    expect(COINGECKO_MARKET_IDS.split(',')).toEqual([
      'pax-gold',
      'tether-gold',
      'bitcoin',
      'ethereum',
      'bitcoin-cash',
    ]);
  });

  it('identifies gold-backed tokens', () => {
    expect(isGoldToken('pax-gold')).toBe(true);
    expect(isGoldToken('bitcoin')).toBe(false);
  });

  it('exposes correlation universe with labels', () => {
    expect(CORRELATION_ASSET_IDS).toContain('gold');
    expect(ASSETS.gold.correlationLabel).toBe('Gold');
  });
});
