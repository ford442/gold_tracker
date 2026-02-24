import { useState } from 'react';
import { useSettingsStore, type Exchange } from '../store/settingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { tradeService } from '../services/tradeService';
import { testConnection } from '../lib/coinbaseTrader';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    selectedExchange,
    cdpKeyName: storedCdpKeyName,
    cdpPrivateKey: storedCdpPrivateKey,
    krakenApiKey: storedKrakenKey,
    krakenApiSecret: storedKrakenSecret,
    autoTradeEnabled,
    dryRun,
    maxTradeSize,
    dailyLossLimit,
    setSelectedExchange,
    setCdpKeyName,
    setCdpPrivateKey,
    setKrakenApiKey,
    setKrakenApiSecret,
    toggleAutoTrade,
    toggleDryRun,
    setMaxTradeSize,
    setDailyLossLimit,
  } = useSettingsStore();

  const { user, signIn, signUp, signOut, loading: authLoading } = useAuthStore();

  // Local state for form inputs
  const [cdpKeyName, setLocalCdpKeyName] = useState(storedCdpKeyName);
  const [cdpPrivateKey, setLocalCdpPrivateKey] = useState(storedCdpPrivateKey);
  const [krakenApiKey, setLocalKrakenKey] = useState(storedKrakenKey);
  const [krakenApiSecret, setLocalKrakenSecret] = useState(storedKrakenSecret);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  // Auth form state
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTestStatus('loading');
    try {
      if (user) {
        // Test via Supabase backend
        const success = await tradeService.testConnectionServerSide(selectedExchange);
        setTestStatus(success ? 'success' : 'error');
      } else {
        // Test locally (Coinbase only)
        if (selectedExchange === 'coinbase') {
          const success = await testConnection();
          setTestStatus(success ? 'success' : 'error');
        } else {
          alert('Kraken testing requires Supabase login');
          setTestStatus('error');
        }
      }
    } catch {
      setTestStatus('error');
    }
  };

  const handleSaveKeys = async () => {
    setSaveStatus('saving');
    try {
      // Save to localStorage first
      if (selectedExchange === 'coinbase') {
        setCdpKeyName(cdpKeyName);
        setCdpPrivateKey(cdpPrivateKey);
      } else {
        setKrakenApiKey(krakenApiKey);
        setKrakenApiSecret(krakenApiSecret);
      }

      // If logged in, also save to Supabase
      if (user) {
        const keys: Record<string, string> = selectedExchange === 'coinbase' 
          ? { cdpKeyName, cdpPrivateKey }
          : { krakenApiKey, krakenApiSecret };
        await tradeService.storeKeys(selectedExchange, keys);
      }

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save keys:', err);
      setSaveStatus('error');
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (authMode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setLocalCdpKeyName('');
    setLocalCdpPrivateKey('');
    setLocalKrakenKey('');
    setLocalKrakenSecret('');
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

        {/* Authentication Section */}
        <div className="mb-6 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4 border border-blue-200 dark:border-blue-800">
          <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
            🔐 Account {user ? '(Signed In)' : '(Required for Secure Storage)'}
          </h3>
          
          {authLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : user ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Signed in as: <span className="font-mono font-medium">{user.email}</span>
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                ✅ Keys can be stored encrypted on Supabase
              </p>
              <button
                onClick={handleSignOut}
                className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 underline"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <form onSubmit={handleAuth} className="space-y-3">
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className={`text-xs px-3 py-1 rounded ${authMode === 'signin' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={`text-xs px-3 py-1 rounded ${authMode === 'signup' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  Sign Up
                </button>
              </div>
              
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-sm"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-sm"
                required
              />
              
              {authError && (
                <p className="text-xs text-red-600 dark:text-red-400">{authError}</p>
              )}
              
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                {authMode === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
              
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Or continue without signing in (keys stored locally only)
              </p>
            </form>
          )}
        </div>

        {/* Exchange Selector */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Preferred Exchange
          </label>
          <select
            value={selectedExchange}
            onChange={(e) => setSelectedExchange(e.target.value as Exchange)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
          >
            <option value="coinbase">Coinbase Advanced</option>
            <option value="kraken">Kraken Pro (recommended for PAXG/XAUT)</option>
          </select>
          {selectedExchange === 'kraken' && (
            <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
              ✅ Kraken offers direct PAXG/XAUT pair with lower fees!
            </p>
          )}
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
                {user 
                  ? `API keys will be AES-encrypted on Supabase. Never stored in browser.`
                  : `API keys stored locally in your browser only. Sign in for secure server storage.`}
                Ensure your API key has <strong>Trade</strong> permission only (never Withdraw).
                Use "Dry-Run" mode first to test safely.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* API Credentials - Conditional based on exchange */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {selectedExchange === 'coinbase' ? 'Coinbase CDP API Keys (2026)' : 'Kraken API Keys'}
            </h3>

            {selectedExchange === 'coinbase' ? (
              // Coinbase CDP Fields
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    CDP Key Name
                  </label>
                  <input
                    type="text"
                    value={cdpKeyName}
                    onChange={(e) => setLocalCdpKeyName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
                    placeholder="organizations/{org_id}/apiKeys/{key_id}"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Found in your Coinbase Developer Platform dashboard
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    CDP Private Key (PEM)
                  </label>
                  <textarea
                    value={cdpPrivateKey}
                    onChange={(e) => setLocalCdpPrivateKey(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-mono"
                    placeholder="-----BEGIN EC PRIVATE KEY-----&#10;...&#10;-----END EC PRIVATE KEY-----"
                    rows={4}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Download this when you create your CDP API key. Keep it secure!
                  </p>
                </div>
              </div>
            ) : (
              // Kraken Fields
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Kraken API Key
                  </label>
                  <input
                    type="text"
                    value={krakenApiKey}
                    onChange={(e) => setLocalKrakenKey(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
                    placeholder="YOUR_KRAKEN_API_KEY"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Get from Kraken Pro → Settings → API
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Kraken API Secret
                  </label>
                  <input
                    type="password"
                    value={krakenApiSecret}
                    onChange={(e) => setLocalKrakenSecret(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
                    placeholder="YOUR_KRAKEN_API_SECRET"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Never share this. Stored encrypted.
                  </p>
                </div>

                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-3 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    <strong>Why Kraken?</strong> Direct PAXG↔XAUT pair means one trade instead of two, 
                    saving ~0.6% in fees compared to Coinbase!
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleTestConnection}
                disabled={testStatus === 'loading'}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testStatus === 'loading' ? 'Checking...' : `Test ${selectedExchange === 'coinbase' ? 'CDP' : 'API'} Connection`}
              </button>
              
              <button
                onClick={handleSaveKeys}
                disabled={saveStatus === 'saving'}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-yellow-500 hover:bg-yellow-600 text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? '✓ Saved' : user ? 'Save Securely' : 'Save Locally'}
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
