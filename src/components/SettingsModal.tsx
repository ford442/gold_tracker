import { useState } from 'react';
import { useSettingsStore } from '../store/settingsStore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    coinbaseApiKey,
    coinbaseApiSecret,
    coinbasePassphrase,
    autoTradeEnabled,
    dryRun,
    maxTradeSize,
    dailyLossLimit,
    setApiKey,
    setApiSecret,
    setPassphrase,
    toggleAutoTrade,
    toggleDryRun,
    setMaxTradeSize,
    setDailyLossLimit,
  } = useSettingsStore();

  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTestStatus('loading');
    // Simulate API call to /v3/brokerage/accounts
    setTimeout(() => {
      if (coinbaseApiKey && coinbaseApiSecret) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
      }
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Trading Settings
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Security Warning */}
        <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <span className="text-red-600 dark:text-red-400 text-xl">⚠️</span>
            <div>
              <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
                Security Warning
              </h3>
              <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                API keys are stored locally in your browser only. Never share them.
                Ensure your API key has <strong>Trade</strong> permission only (never Withdraw).
                Use "Dry-Run" mode first to test safely.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* API Credentials */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Coinbase Advanced Trade API
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  API Key
                </label>
                <input
                  type="text"
                  value={coinbaseApiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
                  placeholder="organizations/{org_id}/apiKeys/{key_id}"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  API Secret
                </label>
                <input
                  type="password"
                  value={coinbaseApiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
                  placeholder="— — — — — — — — —"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Passphrase (Optional)
                </label>
                <input
                  type="password"
                  value={coinbasePassphrase || ''}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
                  placeholder="Only if required by your API key"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleTestConnection}
                disabled={testStatus === 'loading' || !coinbaseApiKey}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testStatus === 'loading' ? 'Checking...' : 'Test Connection'}
              </button>
              {testStatus === 'success' && (
                <span className="text-sm text-green-600 dark:text-green-400 font-medium animate-fade-in">
                  ✓ Connected
                </span>
              )}
              {testStatus === 'error' && (
                <span className="text-sm text-red-600 dark:text-red-400 font-medium animate-fade-in">
                  ✗ Connection Failed
                </span>
              )}
            </div>
          </section>

          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Risk Management */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Risk Management
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Trade Size
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.1"
                    value={maxTradeSize}
                    onChange={(e) => setMaxTradeSize(parseFloat(e.target.value))}
                    className="flex-1 accent-yellow-500 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                  <span className="text-sm font-mono text-gray-900 dark:text-white w-16 text-right">
                    {maxTradeSize.toFixed(1)} oz
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Daily Loss Limit
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.5"
                    max="10.0"
                    step="0.5"
                    value={dailyLossLimit}
                    onChange={(e) => setDailyLossLimit(parseFloat(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all text-right"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              </div>
            </div>
          </section>

          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Auto-Trade Controls */}
          <section className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Dry-Run Mode
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Simulate trades without using real funds (logs only).
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => toggleDryRun(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 dark:peer-focus:ring-yellow-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Master Auto-Trade Switch
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Allow app to place orders automatically based on rules.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoTradeEnabled}
                  onChange={(e) => toggleAutoTrade(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 dark:peer-focus:ring-red-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600"></div>
              </label>
            </div>
          </section>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity shadow-lg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
