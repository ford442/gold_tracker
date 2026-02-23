import { useTradeSuggestions } from '../hooks/useTradeSuggestions';
import { useSettingsStore } from '../store/settingsStore';

export function TradeSuggestionsPanel() {
  const suggestions = useTradeSuggestions();
  const { autoTradeEnabled, dryRun } = useSettingsStore();

  if (suggestions.length === 0) {
    return (
      <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Trading Intelligence
        </h2>
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
    );
  }

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          ⚡ Suggested Trades
          <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-yellow-900 dark:text-yellow-300">
            {suggestions.length} Active
          </span>
        </h2>
        {autoTradeEnabled && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-600 dark:bg-red-400"></span>
            Auto-Trade ON {dryRun ? '(Dry Run)' : ''}
          </span>
        )}
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
              </div>

              <div className="shrink-0">
                <a
                  href={suggestion.coinbaseDeepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-full sm:w-auto px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold rounded-lg transition-colors text-sm shadow-sm"
                >
                  {suggestion.buttonText} ↗
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
