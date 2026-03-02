import { useState, useEffect, useCallback, useRef } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { getCoinbaseAccounts, type CoinbaseAccount } from '../lib/coinbase';

const POLL_INTERVAL = 60000; // 60 seconds, same as price polling

interface UseCoinbaseBalancesResult {
  accounts: CoinbaseAccount[];
  isLoading: boolean;
  error: string | null;
  syncNow: () => Promise<void>;
  lastSynced: number | null;
}

export function useCoinbaseBalances(enabled: boolean): UseCoinbaseBalancesResult {
  const { cdpKeyName, cdpPrivateKey } = useSettingsStore();
  const [accounts, setAccounts] = useState<CoinbaseAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAccounts = useCallback(async () => {
    if (!cdpKeyName || !cdpPrivateKey) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCoinbaseAccounts(cdpKeyName, cdpPrivateKey);
      setAccounts(data);
      setLastSynced(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Coinbase balances');
    } finally {
      setIsLoading(false);
    }
  }, [cdpKeyName, cdpPrivateKey]);

  useEffect(() => {
    if (!enabled || !cdpKeyName || !cdpPrivateKey) {
      setAccounts([]);
      setError(null);
      return;
    }

    fetchAccounts();
    timerRef.current = setInterval(fetchAccounts, POLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, cdpKeyName, cdpPrivateKey, fetchAccounts]);

  return { accounts, isLoading, error, syncNow: fetchAccounts, lastSynced };
}
