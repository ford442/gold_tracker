import { useState } from 'react';
import { useTradeSuggestions } from '../hooks/useTradeSuggestions';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { tradeService } from '../services/tradeService';
import { placeOrder } from '../lib/coinbaseTrader';
import { SettingsModal } from './SettingsModal';
import { toast, Toaster } from 'react-hot-toast';
import type { TradeOrder, OrderResult } from '../lib/coinbaseTrader';

export function TradeSuggestionsPanel() {
  const suggestions = useTradeSuggestions();
  const { 
    autoTradeEnabled, 
    dryRun, 
    maxTradeSize, 
    selectedExchange 
  } = useSettingsStore();
  const { user } = useAuthStore();
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const handleExecuteTrade = async (suggestion: typeof suggestions[0]) => {
    if (executingId) return;

    setExecutingId(suggestion.id);

    const toastId = toast.loading(
      `Executing ${suggestion.action} on ${selectedExchange.toUpperCase()}...`,
      { duration: 30000 }
    );

    try {
      // Build the order
      const order: TradeOrder = {
        product_id: suggestion.productId,
        side: suggestion.side,
        order_configuration: {
          market_market_ioc: { base_size: maxTradeSize.toString() },
        },
      };

      let result: OrderResult & { message?: string; exchange?: string };

      if (user) {
        // Use Supabase backend (server-side, encrypted keys)
        result = await tradeService.executeTrade(order, dryRun, selectedExchange);
      } else {
        // Use local client-side keys
        if (selectedExchange === 'kraken') {
          toast.error('Kraken trading requires Supabase login. Please sign in in Settings.', { id: toastId });
          setExecutingId(null);
          setShowSettings(true);
          return;
        }
        result = await placeOrder(order, dryRun);
      }

      if (result.success) {
        const message = result.message || `Trade executed on ${result.exchange || selectedExchange}`;
        toast.success(
          <div className="flex flex-col">
            <span className="font-semibold">✅ {dryRun ? 'DRY RUN' : 'Success'}!</span>
            <span className="text-sm">{message}</span>
            {result.order_id && (
              <span className="text-xs text-gray-500 font-mono mt-1">
                Order: {result.order_id.slice(0, 20)}...
              </span>
            )}
          </div>,
          { 
            id: toastId,
            duration: 5000,
            icon: dryRun ? '🔒' : '✅',
          }
        );
      } else {
        toast.error(
          <div className="flex flex-col">
            <span className="font-semibold">❌ Trade Failed</span>
            <span className="text-sm">{result.error || 'Unknown error'}</span>
          </div>,
          { 
            id: toastId,
            duration: 6000,
          }
        );
      }
    } catch (err) {
      toast.error(
        <div className="flex flex-col">
          <span className="font-semibold">❌ Execution Error</span>
          <span className="text-sm">{err instanceof Error ? err.message : 'Unknown error'}</span>
        </div>,
        { 
          id: toastId,
          duration: 6000,
        }
      );
    } finally {
      setExecutingId(null);
    }
  };

  // Auto-execute if enabled (dry-run safety)
  // This would be triggered by useEffect when conditions are met
  // For now, manual execution only

  if (suggestions.length === 0) {
    return (
      <>
        <Toaster position="top-right" />
        <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              💡 Trading Intelligence
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 px-2 py-1 rounded">
                {selectedExchange === 'kraken' ? '🔱 Kraken Mode' : '🔵 Coinbase Mode'}
              </span>
              <button 
                onClick={() => setShowSettings(true)}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ⚙️
              </button>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-gray-100 dark:bg-gray-700 p-3 mb-3">
              <span className="text-2xl">🔍</span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Scanning for arbitrage & opportunities...
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              (Updates every 30s)
            </p>
          </div>
        </div>
        <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      </>
    );
  }

  return (
    <>
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#1f2937',
            color: '#fff',
            border: '1px solid #374151',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#1f2937',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#1f2937',
            },
          },
        }}
      />
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            ⚡ Suggested Trades
            <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-yellow-900 dark:text-yellow-300">
              {suggestions.length} Active
            </span>
          </h2>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-1 rounded ${
              selectedExchange === 'kraken' 
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300' 
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
            }`}>
              {selectedExchange === 'kraken' ? '🔱 Kraken' : '🔵 Coinbase'}
            </span>
            {user && (
              <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded">
                🔒 Server
              </span>
            )}
            {autoTradeEnabled && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-600 dark:bg-red-400"></span>
                Auto {dryRun ? '(Dry)' : 'LIVE'}
              </span>
            )}
            <button 
              onClick={() => setShowSettings(true)}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              ⚙️ Settings
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="group relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-4 transition-all hover:shadow-md hover:border-yellow-400 dark:hover:border-yellow-600"
            >
              {/* Type Badge */}
              <div className="absolute top-0 right-0 rounded-bl-lg bg-gray-200 dark:bg-gray-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                {suggestion.type}
              </div>

              {/* Kraken Advantage Badge for PAXG/XAUT */}
              {suggestion.id === 'arb-paxg-xaut' && selectedExchange === 'kraken' && (
                <div className="absolute top-0 left-0 rounded-br-lg bg-emerald-500 text-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider">
                  Direct Pair
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 dark:text-white text-base">
                      {suggestion.action}
                    </h3>
                    <span className="text-xs font-mono bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 px-1.5 py-0.5 rounded">
                      {suggestion.confidence}% Conf.
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {suggestion.reason}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-2">
                    <span className="flex items-center gap-1">
                      ⚖️ Size: <span className="font-medium text-gray-900 dark:text-gray-200">{suggestion.size}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      💰 Exp. Profit: <span className="font-medium text-green-600 dark:text-green-400">{suggestion.expectedProfit}</span>
                    </span>
                  </div>
                  
                  {suggestion.id === 'arb-paxg-xaut' && selectedExchange === 'kraken' && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                      ✅ Lower fees with Kraken direct PAXG/XAUT pair!
                    </p>
                  )}
                </div>

                <div className="shrink-0 flex flex-col gap-2">
                  <button
                    onClick={() => handleExecuteTrade(suggestion)}
                    disabled={executingId === suggestion.id}
                    className={`flex items-center justify-center w-full sm:w-auto px-4 py-2 font-bold rounded-lg transition-colors text-sm shadow-sm ${
                      executingId === suggestion.id
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : dryRun
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                    }`}
                  >
                    {executingId === suggestion.id ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Executing...
                      </>
                    ) : dryRun ? (
                      <>
                        🔒 DRY RUN on {selectedExchange.toUpperCase()}
                      </>
                    ) : (
                      <>
                        🚀 LIVE EXECUTE on {selectedExchange.toUpperCase()}
                      </>
                    )}
                  </button>
                  
                  <a
                    href={suggestion.coinbaseDeepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-full sm:w-auto px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold rounded-lg transition-colors text-sm shadow-sm"
                  >
                    Manual on Coinbase ↗
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Info */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            Trading via: <strong className={selectedExchange === 'kraken' ? 'text-emerald-500' : 'text-blue-500'}>
              {selectedExchange === 'kraken' ? '🔱 Kraken Pro' : '🔵 Coinbase Advanced'}
            </strong>
          </span>
          <span>
            {user ? '🔒 Keys stored securely on Supabase' : '⚠️ Keys stored locally (sign in for security)'}
          </span>
        </div>
      </div>
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
