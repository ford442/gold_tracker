import { useState } from 'react';
import { useSettingsStore, type Exchange } from '../store/settingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { tradeService } from '../services/tradeService';
import { testConnection } from '../lib/coinbaseTrader';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AccordionSection = 'account' | 'exchange' | 'api' | 'risk' | 'auto' | null;

// Accordion section header component
interface SectionHeaderProps {
  section: AccordionSection;
  title: string;
  icon: string;
  isOpen: boolean;
  onToggle: (section: AccordionSection) => void;
}

function SectionHeader({ section, title, icon, isOpen, onToggle }: SectionHeaderProps) {
  return (
    <button
      onClick={() => onToggle(section)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        background: isOpen ? 'var(--color-surface2)' : 'transparent',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      aria-expanded={isOpen}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '1.1rem' }}>{icon}</span>
        <span style={{ 
          fontWeight: 600, 
          color: 'var(--color-text)',
          fontSize: '0.95rem'
        }}>
          {title}
        </span>
      </div>
      <span style={{
        fontSize: '0.8rem',
        color: 'var(--color-muted)',
        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease'
      }}>
        ▼
      </span>
    </button>
  );
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
  const [openSection, setOpenSection] = useState<AccordionSection>('account');
  const [securityDismissed, setSecurityDismissed] = useState(false);
  
  // Auth form state
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleSection = (section: AccordionSection) => {
    setOpenSection(openSection === section ? null : section);
  };

  const handleTestConnection = async () => {
    setTestStatus('loading');
    try {
      if (user) {
        const success = await tradeService.testConnectionServerSide(selectedExchange);
        setTestStatus(success ? 'success' : 'error');
      } else {
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
      if (selectedExchange === 'coinbase') {
        setCdpKeyName(cdpKeyName);
        setCdpPrivateKey(cdpPrivateKey);
      } else {
        setKrakenApiKey(krakenApiKey);
        setKrakenApiSecret(krakenApiSecret);
      }

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
      <div 
        className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ padding: '24px' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 
            className="text-xl font-bold"
            style={{ color: 'var(--color-text)' }}
          >
            ⚙️ Trading Settings
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 transition-colors"
            style={{ color: 'var(--color-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Dismissible Security Warning */}
        {!securityDismissed && (
          <div 
            className="mb-6 rounded-lg p-4 border"
            style={{ 
              background: 'rgba(220,38,38,0.1)', 
              borderColor: 'rgba(220,38,38,0.3)' 
            }}
          >
            <div className="flex items-start gap-3">
              <span style={{ color: 'var(--color-red)', fontSize: '1.2rem' }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <h3 style={{ 
                  fontSize: '0.85rem', 
                  fontWeight: 700, 
                  color: 'var(--color-red)',
                  marginBottom: '4px'
                }}>
                  Security Warning
                </h3>
                <p style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--color-text)',
                  lineHeight: 1.5
                }}>
                  {user 
                    ? `API keys will be AES-encrypted on Supabase. Never stored in browser.`
                    : `API keys stored locally in your browser only. Sign in for secure server storage.`}
                  {' '}Ensure your API key has <strong>Trade</strong> permission only (never Withdraw).
                  Use &quot;Dry-Run&quot; mode first to test safely.
                </p>
              </div>
              <button
                onClick={() => setSecurityDismissed(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-muted)',
                  fontSize: '1rem',
                  padding: '4px'
                }}
                aria-label="Dismiss warning"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Account Section */}
          <div>
            <SectionHeader 
              section="account" 
              title={`Account ${user ? '(Signed In)' : '(Required for Secure Storage)'}`}
              icon="🔐"
              isOpen={openSection === 'account'}
              onToggle={toggleSection}
            />
            <div 
              className="accordion-content"
              style={{ 
                maxHeight: openSection === 'account' ? '500px' : '0',
                overflow: 'hidden',
                transition: 'max-height 0.3s ease'
              }}
            >
              <div style={{ padding: '16px', border: '1px solid var(--color-border)', borderTop: 'none', borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}>
                {authLoading ? (
                  <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Loading...</p>
                ) : user ? (
                  <div className="space-y-3">
                    <p style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>
                      Signed in as: <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{user.email}</span>
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-green)' }}>
                      ✅ Keys can be stored encrypted on Supabase
                    </p>
                    <button
                      onClick={handleSignOut}
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--color-red)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleAuth} className="space-y-3">
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      <button
                        type="button"
                        onClick={() => setAuthMode('signin')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: 'none',
                          background: authMode === 'signin' ? 'var(--color-accent)' : 'var(--color-surface2)',
                          color: authMode === 'signin' ? '#fff' : 'var(--color-text)',
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        Sign In
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMode('signup')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: 'none',
                          background: authMode === 'signup' ? 'var(--color-accent)' : 'var(--color-surface2)',
                          color: authMode === 'signup' ? '#fff' : 'var(--color-text)',
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        Sign Up
                      </button>
                    </div>
                    
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface2)',
                        color: 'var(--color-text)',
                        fontSize: '0.9rem'
                      }}
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface2)',
                        color: 'var(--color-text)',
                        fontSize: '0.9rem'
                      }}
                    />
                    
                    {authError && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-red)' }}>{authError}</p>
                    )}
                    
                    <button
                      type="submit"
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: 'var(--color-accent)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {authMode === 'signin' ? 'Sign In' : 'Create Account'}
                    </button>
                    
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textAlign: 'center' }}>
                      Or continue without signing in (keys stored locally only)
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* Exchange Section */}
          <div>
            <SectionHeader 
              section="exchange" 
              title="Preferred Exchange"
              icon="🏦"
              isOpen={openSection === 'exchange'}
              onToggle={toggleSection}
            />
            <div 
              style={{ 
                maxHeight: openSection === 'exchange' ? '200px' : '0',
                overflow: 'hidden',
                transition: 'max-height 0.3s ease'
              }}
            >
              <div style={{ padding: '16px', border: '1px solid var(--color-border)', borderTop: 'none', borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}>
                <select
                  value={selectedExchange}
                  onChange={(e) => setSelectedExchange(e.target.value as Exchange)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface2)',
                    color: 'var(--color-text)',
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="coinbase">Coinbase Advanced</option>
                  <option value="kraken">Kraken Pro (recommended for PAXG/XAUT)</option>
                </select>
                {selectedExchange === 'kraken' && (
                  <p style={{ 
                    marginTop: '10px', 
                    fontSize: '0.8rem', 
                    color: 'var(--color-green)'
                  }}>
                    ✅ Kraken offers direct PAXG/XAUT pair with lower fees!
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* API Keys Section */}
          <div>
            <SectionHeader 
              section="api" 
              title={`${selectedExchange === 'coinbase' ? 'Coinbase CDP' : 'Kraken'} API Keys`}
              icon="🔑"
              isOpen={openSection === 'api'}
              onToggle={toggleSection}
            />
            <div 
              style={{ 
                maxHeight: openSection === 'api' ? '600px' : '0',
                overflow: 'hidden',
                transition: 'max-height 0.3s ease'
              }}
            >
              <div style={{ padding: '16px', border: '1px solid var(--color-border)', borderTop: 'none', borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}>
                {selectedExchange === 'coinbase' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        fontSize: '0.8rem', 
                        color: 'var(--color-muted)', 
                        marginBottom: '6px',
                        fontWeight: 500
                      }}>
                        CDP Key Name
                      </label>
                      <input
                        type="text"
                        value={cdpKeyName}
                        onChange={(e) => setLocalCdpKeyName(e.target.value)}
                        placeholder="organizations/{org_id}/apiKeys/{key_id}"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface2)',
                          color: 'var(--color-text)',
                          fontSize: '0.85rem'
                        }}
                      />
                      <p style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: '4px' }}>
                        Found in your Coinbase Developer Platform dashboard
                      </p>
                    </div>

                    <div>
                      <label style={{ 
                        display: 'block', 
                        fontSize: '0.8rem', 
                        color: 'var(--color-muted)', 
                        marginBottom: '6px',
                        fontWeight: 500
                      }}>
                        CDP Private Key (PEM)
                      </label>
                      <textarea
                        value={cdpPrivateKey}
                        onChange={(e) => setLocalCdpPrivateKey(e.target.value)}
                        placeholder="-----BEGIN EC PRIVATE KEY-----&#10;...&#10;-----END EC PRIVATE KEY-----"
                        rows={4}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface2)',
                          color: 'var(--color-text)',
                          fontSize: '0.8rem',
                          fontFamily: 'monospace',
                          resize: 'vertical'
                        }}
                      />
                      <p style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: '4px' }}>
                        Download this when you create your CDP API key. Keep it secure!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        fontSize: '0.8rem', 
                        color: 'var(--color-muted)', 
                        marginBottom: '6px',
                        fontWeight: 500
                      }}>
                        Kraken API Key
                      </label>
                      <input
                        type="text"
                        value={krakenApiKey}
                        onChange={(e) => setLocalKrakenKey(e.target.value)}
                        placeholder="YOUR_KRAKEN_API_KEY"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface2)',
                          color: 'var(--color-text)',
                          fontSize: '0.85rem'
                        }}
                      />
                      <p style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: '4px' }}>
                        Get from Kraken Pro → Settings → API
                      </p>
                    </div>

                    <div>
                      <label style={{ 
                        display: 'block', 
                        fontSize: '0.8rem', 
                        color: 'var(--color-muted)', 
                        marginBottom: '6px',
                        fontWeight: 500
                      }}>
                        Kraken API Secret
                      </label>
                      <input
                        type="password"
                        value={krakenApiSecret}
                        onChange={(e) => setLocalKrakenSecret(e.target.value)}
                        placeholder="YOUR_KRAKEN_API_SECRET"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface2)',
                          color: 'var(--color-text)',
                          fontSize: '0.85rem'
                        }}
                      />
                      <p style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: '4px' }}>
                        Never share this. Stored encrypted.
                      </p>
                    </div>

                    <div style={{
                      padding: '12px',
                      background: 'rgba(5,150,105,0.1)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(5,150,105,0.3)'
                    }}>
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-green)' }}>
                        <strong>Why Kraken?</strong> Direct PAXG↔XAUT pair means one trade instead of two, 
                        saving ~0.6% in fees compared to Coinbase!
                      </p>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '16px' }}>
                  <button
                    onClick={handleTestConnection}
                    disabled={testStatus === 'loading'}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      background: 'transparent',
                      color: 'var(--color-text)',
                      fontSize: '0.85rem',
                      cursor: testStatus === 'loading' ? 'not-allowed' : 'pointer',
                      opacity: testStatus === 'loading' ? 0.6 : 1
                    }}
                  >
                    {testStatus === 'loading' ? 'Checking...' : `Test ${selectedExchange === 'coinbase' ? 'CDP' : 'API'} Connection`}
                  </button>
                  
                  <button
                    onClick={handleSaveKeys}
                    disabled={saveStatus === 'saving'}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      background: saveStatus === 'success' ? 'var(--color-green)' : 'var(--color-gold)',
                      color: saveStatus === 'success' ? '#fff' : '#000',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                      opacity: saveStatus === 'saving' ? 0.6 : 1
                    }}
                  >
                    {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? '✓ Saved' : user ? 'Save Securely' : 'Save Locally'}
                  </button>
                  
                  {testStatus === 'success' && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-green)', fontWeight: 500 }}>
                      ✓ Connected
                    </span>
                  )}
                  {testStatus === 'error' && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-red)', fontWeight: 500 }}>
                      ✗ Connection Failed
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Risk Management Section */}
          <div>
            <SectionHeader 
              section="risk" 
              title="Risk Management"
              icon="⚖️"
              isOpen={openSection === 'risk'}
              onToggle={toggleSection}
            />
            <div 
              style={{ 
                maxHeight: openSection === 'risk' ? '300px' : '0',
                overflow: 'hidden',
                transition: 'max-height 0.3s ease'
              }}
            >
              <div style={{ padding: '16px', border: '1px solid var(--color-border)', borderTop: 'none', borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '0.8rem', 
                      color: 'var(--color-muted)', 
                      marginBottom: '8px',
                      fontWeight: 500
                    }}>
                      Max Trade Size
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="range"
                        min="0.1"
                        max="2.0"
                        step="0.1"
                        value={maxTradeSize}
                        onChange={(e) => setMaxTradeSize(parseFloat(e.target.value))}
                        style={{ flex: 1 }}
                      />
                      <span style={{ 
                        fontSize: '0.9rem', 
                        fontFamily: 'monospace',
                        color: 'var(--color-text)',
                        minWidth: '50px',
                        textAlign: 'right'
                      }}>
                        {maxTradeSize.toFixed(1)} oz
                      </span>
                    </div>
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '0.8rem', 
                      color: 'var(--color-muted)', 
                      marginBottom: '8px',
                      fontWeight: 500
                    }}>
                      Daily Loss Limit
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number"
                        min="0.5"
                        max="10.0"
                        step="0.5"
                        value={dailyLossLimit}
                        onChange={(e) => setDailyLossLimit(parseFloat(e.target.value))}
                        style={{
                          flex: 1,
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface2)',
                          color: 'var(--color-text)',
                          fontSize: '0.9rem',
                          textAlign: 'right'
                        }}
                      />
                      <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Auto-Trade Section */}
          <div>
            <SectionHeader 
              section="auto" 
              title="Auto-Trading Controls"
              icon="🤖"
              isOpen={openSection === 'auto'}
              onToggle={toggleSection}
            />
            <div 
              style={{ 
                maxHeight: openSection === 'auto' ? '300px' : '0',
                overflow: 'hidden',
                transition: 'max-height 0.3s ease'
              }}
            >
              <div style={{ padding: '16px', border: '1px solid var(--color-border)', borderTop: 'none', borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Dry Run Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ 
                        fontSize: '0.9rem', 
                        fontWeight: 700, 
                        color: 'var(--color-text)',
                        marginBottom: '2px'
                      }}>
                        Dry-Run Mode
                      </h3>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                        Simulate trades without using real funds (logs only)
                      </p>
                    </div>
                    <label style={{ 
                      position: 'relative', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      cursor: 'pointer' 
                    }}>
                      <input
                        type="checkbox"
                        checked={dryRun}
                        onChange={(e) => toggleDryRun(e.target.checked)}
                        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        width: '44px',
                        height: '24px',
                        background: dryRun ? 'var(--color-green)' : 'var(--color-surface2)',
                        borderRadius: '12px',
                        position: 'relative',
                        transition: 'background 0.2s',
                        border: '1px solid var(--color-border)'
                      }}>
                        <span style={{
                          position: 'absolute',
                          top: '2px',
                          left: dryRun ? '22px' : '2px',
                          width: '18px',
                          height: '18px',
                          background: '#fff',
                          borderRadius: '50%',
                          transition: 'left 0.2s'
                        }} />
                      </span>
                    </label>
                  </div>

                  {/* Auto-Trade Toggle */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    paddingTop: '16px',
                    borderTop: '1px solid var(--color-border)'
                  }}>
                    <div>
                      <h3 style={{ 
                        fontSize: '0.9rem', 
                        fontWeight: 700, 
                        color: 'var(--color-text)',
                        marginBottom: '2px'
                      }}>
                        Master Auto-Trade Switch
                      </h3>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                        Allow app to place orders automatically based on rules
                      </p>
                    </div>
                    <label style={{ 
                      position: 'relative', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      cursor: 'pointer' 
                    }}>
                      <input
                        type="checkbox"
                        checked={autoTradeEnabled}
                        onChange={(e) => toggleAutoTrade(e.target.checked)}
                        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        width: '44px',
                        height: '24px',
                        background: autoTradeEnabled ? 'var(--color-red)' : 'var(--color-surface2)',
                        borderRadius: '12px',
                        position: 'relative',
                        transition: 'background 0.2s',
                        border: '1px solid var(--color-border)'
                      }}>
                        <span style={{
                          position: 'absolute',
                          top: '2px',
                          left: autoTradeEnabled ? '22px' : '2px',
                          width: '18px',
                          height: '18px',
                          background: '#fff',
                          borderRadius: '50%',
                          transition: 'left 0.2s'
                        }} />
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              background: 'var(--color-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
