import type { Exchange } from '@/store/settingsStore';

interface ExchangeSelectorProps {
  selectedExchange: Exchange;
  onExchangeChange: (exchange: Exchange) => void;
}

export function ExchangeSelector({ selectedExchange, onExchangeChange }: ExchangeSelectorProps) {
  return (
    <>
      <select
        value={selectedExchange}
        onChange={(e) => onExchangeChange(e.target.value as Exchange)}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface2)',
          color: 'var(--color-text)',
          fontSize: '0.9rem',
          cursor: 'pointer',
        }}
      >
        <option value="coinbase">Coinbase Advanced</option>
        <option value="kraken">Kraken Pro (recommended for PAXG/XAUT)</option>
      </select>
      {selectedExchange === 'kraken' && (
        <p style={{
          marginTop: '10px',
          fontSize: '0.8rem',
          color: 'var(--color-green)',
        }}>
          ✅ Kraken offers direct PAXG/XAUT pair with lower fees!
        </p>
      )}
    </>
  );
}

interface ApiKeysFormProps {
  selectedExchange: Exchange;
  cdpKeyName: string;
  cdpPrivateKey: string;
  krakenApiKey: string;
  krakenApiSecret: string;
  onCdpKeyNameChange: (value: string) => void;
  onCdpPrivateKeyChange: (value: string) => void;
  onKrakenApiKeyChange: (value: string) => void;
  onKrakenApiSecretChange: (value: string) => void;
  isSignedIn: boolean;
  testStatus: 'idle' | 'loading' | 'success' | 'error';
  saveStatus: 'idle' | 'saving' | 'success' | 'error';
  onTestConnection: () => void;
  onSaveKeys: () => void;
}

export function ApiKeysForm({
  selectedExchange,
  cdpKeyName,
  cdpPrivateKey,
  krakenApiKey,
  krakenApiSecret,
  onCdpKeyNameChange,
  onCdpPrivateKeyChange,
  onKrakenApiKeyChange,
  onKrakenApiSecretChange,
  isSignedIn,
  testStatus,
  saveStatus,
  onTestConnection,
  onSaveKeys,
}: ApiKeysFormProps) {
  return (
    <>
      {selectedExchange === 'coinbase' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.8rem',
              color: 'var(--color-muted)',
              marginBottom: '6px',
              fontWeight: 500,
            }}>
              CDP Key Name
            </label>
            <input
              type="text"
              value={cdpKeyName}
              onChange={(e) => onCdpKeyNameChange(e.target.value)}
              placeholder="organizations/{org_id}/apiKeys/{key_id}"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface2)',
                color: 'var(--color-text)',
                fontSize: '0.85rem',
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
              fontWeight: 500,
            }}>
              CDP Private Key (PEM)
            </label>
            <textarea
              value={cdpPrivateKey}
              onChange={(e) => onCdpPrivateKeyChange(e.target.value)}
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
                resize: 'vertical',
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
              fontWeight: 500,
            }}>
              Kraken API Key
            </label>
            <input
              type="text"
              value={krakenApiKey}
              onChange={(e) => onKrakenApiKeyChange(e.target.value)}
              placeholder="YOUR_KRAKEN_API_KEY"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface2)',
                color: 'var(--color-text)',
                fontSize: '0.85rem',
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
              fontWeight: 500,
            }}>
              Kraken API Secret
            </label>
            <input
              type="password"
              value={krakenApiSecret}
              onChange={(e) => onKrakenApiSecretChange(e.target.value)}
              placeholder="YOUR_KRAKEN_API_SECRET"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface2)',
                color: 'var(--color-text)',
                fontSize: '0.85rem',
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
            border: '1px solid rgba(5,150,105,0.3)',
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
          onClick={onTestConnection}
          disabled={testStatus === 'loading'}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text)',
            fontSize: '0.85rem',
            cursor: testStatus === 'loading' ? 'not-allowed' : 'pointer',
            opacity: testStatus === 'loading' ? 0.6 : 1,
          }}
        >
          {testStatus === 'loading' ? 'Checking...' : `Test ${selectedExchange === 'coinbase' ? 'CDP' : 'API'} Connection`}
        </button>

        <button
          onClick={onSaveKeys}
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
            opacity: saveStatus === 'saving' ? 0.6 : 1,
          }}
        >
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? '✓ Saved' : isSignedIn ? 'Save Securely' : 'Save Locally'}
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
    </>
  );
}
