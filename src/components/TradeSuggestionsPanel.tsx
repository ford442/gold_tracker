import { useState } from 'react';
import { useTradeSuggestions } from '../hooks/useTradeSuggestions';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { tradeService } from '../services/tradeService';
import { placeOrder } from '../lib/coinbaseTrader';
import { SettingsModal } from './SettingsModal';
import { toast, Toaster } from 'react-hot-toast';
import type { TradeOrder, OrderResult } from '../lib/coinbaseTrader';

// Info tooltip component
function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  
  return (
    <span 
      style={{ 
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: 'var(--color-surface2)',
        color: 'var(--color-muted)',
        fontSize: '0.7rem',
        cursor: 'help',
        marginLeft: '4px',
        position: 'relative'
      }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      aria-label="More information"
    >
      ℹ️
      {show && (
        <span style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--color-surface2)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 12px',
          fontSize: '0.75rem',
          color: 'var(--color-text)',
          whiteSpace: 'nowrap',
          zIndex: 100,
          boxShadow: 'var(--shadow-md)',
          marginBottom: '6px'
        }}>
          {text}
          <span style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            border: '6px solid transparent',
            borderTopColor: 'var(--color-border)'
          }} />
        </span>
      )}
    </span>
  );
}

// Trend indicator component
function TrendIndicator({ direction, value }: { direction: 'up' | 'down' | 'neutral'; value?: number }) {
  const colors = {
    up: 'var(--color-green)',
    down: 'var(--color-red)',
    neutral: 'var(--color-muted)'
  };
  
  const arrows = {
    up: '↑',
    down: '↓',
    neutral: '→'
  };
  
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '2px',
      color: colors[direction],
      fontSize: '0.75rem',
      fontWeight: 600
    }}>
      {arrows[direction]}
      {value !== undefined && `${value.toFixed(2)}%`}
    </span>
  );
}

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
      const order: TradeOrder = {
        product_id: suggestion.productId,
        side: suggestion.side,
        order_configuration: {
          market_market_ioc: { base_size: maxTradeSize.toString() },
        },
      };

      let result: OrderResult & { message?: string; exchange?: string };

      if (user) {
        result = await tradeService.executeTrade(order, dryRun, selectedExchange);
      } else {
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

  if (suggestions.length === 0) {
    return (
      <>
        <Toaster position="top-right" />
        <div 
          style={{ 
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            border: '1px solid var(--color-border)',
            marginBottom: 'var(--space-2xl)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ 
              margin: 0, 
              fontSize: 'var(--font-xl)', 
              fontWeight: 700, 
              color: 'var(--color-text)',
              letterSpacing: '-0.02em'
            }}>
              💡 Trading Intelligence
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                fontSize: 'var(--font-xs)',
                padding: '4px 10px',
                borderRadius: '999px',
                background: selectedExchange === 'kraken' ? 'rgba(5,150,105,0.1)' : 'rgba(37,99,235,0.1)',
                color: selectedExchange === 'kraken' ? 'var(--color-green)' : 'var(--color-blue)',
                fontWeight: 600
              }}>
                {selectedExchange === 'kraken' ? '🔱 Kraken Mode' : '🔵 Coinbase Mode'}
              </span>
              <button 
                onClick={() => setShowSettings(true)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'transparent',
                  color: 'var(--color-muted)',
                  fontSize: 'var(--font-xs)',
                  cursor: 'pointer'
                }}
                aria-label="Open settings"
              >
                ⚙️
              </button>
            </div>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'var(--color-surface2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              marginBottom: '16px'
            }}>
              🔍
            </div>
            <p style={{ color: 'var(--color-muted)', fontSize: 'var(--font-base)', margin: 0 }}>
              Scanning for arbitrage & opportunities...
            </p>
            <p style={{ color: 'var(--color-muted)', fontSize: 'var(--font-xs)', marginTop: '8px' }}>
              Updates every 30s
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
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
          },
          success: {
            iconTheme: {
              primary: 'var(--color-green)',
              secondary: 'var(--color-surface)',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--color-red)',
              secondary: 'var(--color-surface)',
            },
          },
        }}
      />
      <div style={{ 
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        border: '1px solid var(--color-border)',
        marginBottom: 'var(--space-2xl)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ 
            margin: 0, 
            fontSize: 'var(--font-xl)', 
            fontWeight: 700, 
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            ⚡ Suggested Trades
            <span style={{
              fontSize: 'var(--font-xs)',
              padding: '4px 10px',
              borderRadius: '999px',
              background: 'var(--color-gold-dim)',
              color: 'var(--color-gold)',
              fontWeight: 700
            }}>
              {suggestions.length} Active
            </span>
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 'var(--font-xs)',
              padding: '4px 10px',
              borderRadius: '999px',
              background: selectedExchange === 'kraken' ? 'rgba(5,150,105,0.1)' : 'rgba(37,99,235,0.1)',
              color: selectedExchange === 'kraken' ? 'var(--color-green)' : 'var(--color-blue)',
              fontWeight: 600
            }}>
              {selectedExchange === 'kraken' ? '🔱 Kraken' : '🔵 Coinbase'}
            </span>
            {user && (
              <span style={{
                fontSize: 'var(--font-xs)',
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'rgba(5,150,105,0.1)',
                color: 'var(--color-green)',
                fontWeight: 600
              }}>
                🔒 Server
              </span>
            )}
            {autoTradeEnabled && (
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: 'var(--font-xs)',
                fontWeight: 600,
                color: 'var(--color-red)',
                background: 'rgba(220,38,38,0.1)',
                padding: '4px 10px',
                borderRadius: '999px'
              }}>
                <span className="live-pulse" style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--color-red)'
                }} />
                Auto {dryRun ? '(Dry)' : 'LIVE'}
              </span>
            )}
            <button 
              onClick={() => setShowSettings(true)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-muted)',
                fontSize: 'var(--font-xs)',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              ⚙️ Settings
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="card-hover"
              style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface2)',
                padding: '20px',
                transition: 'all 0.15s ease'
              }}
            >
              {/* Type Badge */}
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                padding: '4px 10px',
                background: 'var(--color-surface)',
                borderBottomLeftRadius: 'var(--radius-md)',
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-muted)'
              }}>
                {suggestion.type}
              </div>

              {/* Kraken Advantage Badge for PAXG/XAUT */}
              {suggestion.id === 'arb-paxg-xaut' && selectedExchange === 'kraken' && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  padding: '4px 10px',
                  background: 'var(--color-green)',
                  borderBottomRightRadius: 'var(--radius-md)',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#fff'
                }}>
                  Direct Pair
                </div>
              )}

              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <h3 style={{ 
                      margin: 0,
                      fontSize: '1.1rem', 
                      fontWeight: 700, 
                      color: 'var(--color-text)' 
                    }}>
                      {suggestion.action}
                    </h3>
                    <span style={{
                      fontSize: 'var(--font-xs)',
                      fontFamily: 'monospace',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-green-dim)',
                      color: 'var(--color-green)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      {suggestion.confidence}% Conf.
                      <InfoTooltip text="Confidence based on spread magnitude, volume, and historical success rate" />
                    </span>
                    {/* Trend indicator */}
                    <TrendIndicator direction="up" value={0.15} />
                  </div>
                  <p style={{ 
                    fontSize: 'var(--font-sm)', 
                    color: 'var(--color-muted)',
                    margin: 0,
                    marginBottom: '12px',
                    lineHeight: 1.5
                  }}>
                    {suggestion.reason}
                  </p>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '20px', 
                    flexWrap: 'wrap',
                    fontSize: 'var(--font-xs)',
                    color: 'var(--color-muted)'
                  }}>
                    <span>
                      <strong style={{ color: 'var(--color-text)' }}>Size:</strong> {suggestion.size}
                    </span>
                    <span>
                      <strong style={{ color: 'var(--color-green)' }}>Exp. Profit:</strong> {suggestion.expectedProfit}
                    </span>
                  </div>
                  
                  {suggestion.id === 'arb-paxg-xaut' && selectedExchange === 'kraken' && (
                    <p style={{ 
                      fontSize: 'var(--font-xs)', 
                      color: 'var(--color-green)',
                      marginTop: '8px',
                      marginBottom: 0
                    }}>
                      ✅ Lower fees with Kraken direct PAXG/XAUT pair!
                    </p>
                  )}
                </div>

                <div style={{ 
                  display: 'flex', 
                  gap: '10px',
                  flexWrap: 'wrap'
                }}>
                  {/* Primary action - Dry Run */}
                  <button
                    onClick={() => handleExecuteTrade(suggestion)}
                    disabled={executingId === suggestion.id}
                    style={{
                      flex: '1 1 200px',
                      padding: '12px 20px',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      background: executingId === suggestion.id 
                        ? 'var(--color-surface)' 
                        : dryRun 
                          ? 'var(--color-accent)' 
                          : 'var(--color-red)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      cursor: executingId === suggestion.id ? 'not-allowed' : 'pointer',
                      opacity: executingId === suggestion.id ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: executingId === suggestion.id ? 'none' : 'var(--shadow-md)'
                    }}
                  >
                    {executingId === suggestion.id ? (
                      <>
                        <span style={{
                          width: '16px',
                          height: '16px',
                          border: '2px solid rgba(255,255,255,0.3)',
                          borderTopColor: '#fff',
                          borderRadius: '50%',
                          animation: 'spin 0.7s linear infinite'
                        }} />
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
                  
                  {/* Secondary action - Manual on Coinbase */}
                  <a
                    href={suggestion.coinbaseDeepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '12px 20px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      background: 'transparent',
                      color: 'var(--color-text)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--color-surface2)';
                      e.currentTarget.style.borderColor = 'var(--color-gold)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                    }}
                  >
                    Manual on Coinbase ↗
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Info */}
        <div style={{
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          fontSize: 'var(--font-xs)',
          color: 'var(--color-muted)'
        }}>
          <span>
            Trading via: <strong style={{ 
              color: selectedExchange === 'kraken' ? 'var(--color-green)' : 'var(--color-blue)'
            }}>
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
