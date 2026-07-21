import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/useAuthStore';
import { tradeService } from '@/services/tradeService';
import { getAdapter, adapterCredentialsFromSettings } from '@lib/exchangeAdapters';
import { AccordionPanel, type AccordionSection } from './settings/SectionHeader';
import { SecurityWarnings } from './settings/SecurityWarnings';
import { AuthPanel } from './settings/AuthPanel';
import { ExchangeSelector, ApiKeysForm } from './settings/ExchangeKeysForm';
import { RiskManagementPanel, AutoTradePanel } from './settings/DryRunToggles';
import { DataFeedPanel } from './settings/DataFeedPanel';
import { AlertRulesSettingsPanel } from './settings/AlertRulesSettingsPanel';
import { describeStoredKey } from '@lib/keyDisplay';

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
    setSelectedExchange,
    setCdpKeyName,
    setCdpPrivateKey,
    setKrakenApiKey,
    setKrakenApiSecret,
    clearExchangeKeys,
    hasLocalExchangeKeys,
  } = useSettingsStore();

  const { user, signOut, init: initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const [cdpKeyName, setLocalCdpKeyName] = useState(storedCdpKeyName);
  const [cdpPrivateKey, setLocalCdpPrivateKey] = useState(storedCdpPrivateKey);
  const [krakenApiKey, setLocalKrakenKey] = useState(storedKrakenKey);
  const [krakenApiSecret, setLocalKrakenSecret] = useState(storedKrakenSecret);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [openSection, setOpenSection] = useState<AccordionSection>('account');
  const [securityDismissed, setSecurityDismissed] = useState(false);

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
        const adapter = getAdapter(selectedExchange);
        const creds = adapterCredentialsFromSettings({
          cdpKeyName,
          cdpPrivateKey,
          krakenApiKey,
          krakenApiSecret,
        });
        const success = (await adapter?.testConnection(creds)) ?? false;
        setTestStatus(success ? 'success' : 'error');
      }
    } catch {
      setTestStatus('error');
    }
  };

  const handleSaveKeys = async () => {
    setSaveStatus('saving');
    try {
      if (user) {
        const keys: Record<string, string> = selectedExchange === 'coinbase'
          ? { cdpKeyName, cdpPrivateKey }
          : { krakenApiKey, krakenApiSecret };
        await tradeService.storeKeys(selectedExchange, keys);
        clearExchangeKeys();
        setLocalCdpKeyName('');
        setLocalCdpPrivateKey('');
        setLocalKrakenKey('');
        setLocalKrakenSecret('');
      } else if (selectedExchange === 'coinbase') {
        setCdpKeyName(cdpKeyName);
        setCdpPrivateKey(cdpPrivateKey);
      } else {
        setKrakenApiKey(krakenApiKey);
        setKrakenApiSecret(krakenApiSecret);
      }

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save keys:', err);
      setSaveStatus('error');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setLocalCdpKeyName('');
    setLocalCdpPrivateKey('');
    setLocalKrakenKey('');
    setLocalKrakenSecret('');
  };

  const handleClearKeys = () => {
    if (!window.confirm('Remove exchange API keys from this browser? Server-encrypted keys (if any) are not deleted.')) {
      return;
    }
    clearExchangeKeys();
    setLocalCdpKeyName('');
    setLocalCdpPrivateKey('');
    setLocalKrakenKey('');
    setLocalKrakenSecret('');
    setTestStatus('idle');
    setSaveStatus('idle');
  };

  const storedKeySummary = user && !hasLocalExchangeKeys()
    ? 'Exchange keys encrypted on server (not stored in this browser)'
    : describeStoredKey(
        selectedExchange,
        {
          cdpKeyName: storedCdpKeyName,
          cdpPrivateKey: storedCdpPrivateKey,
          krakenApiKey: storedKrakenKey,
          krakenApiSecret: storedKrakenSecret,
        },
        user ? 'server' : 'local',
      );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="glass-card settings-modal-shell w-full max-w-lg max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto"
        style={{ padding: '24px' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
            ⚙️ Trading Settings
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 transition-colors"
            style={{ color: 'var(--color-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <SecurityWarnings
          dismissed={securityDismissed}
          onDismiss={() => setSecurityDismissed(true)}
          isSignedIn={!!user}
          hasLocalKeys={hasLocalExchangeKeys()}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <AccordionPanel
            section="account"
            title={`Account ${user ? '(Signed In)' : '(Required for Secure Storage)'}`}
            icon="🔐"
            openSection={openSection}
            onToggle={toggleSection}
            maxHeight="500px"
            contentClassName="accordion-content"
          >
            <AuthPanel onSignOut={handleSignOut} />
          </AccordionPanel>

          <AccordionPanel
            section="exchange"
            title="Preferred Exchange"
            icon="🏦"
            openSection={openSection}
            onToggle={toggleSection}
            maxHeight="200px"
          >
            <ExchangeSelector
              selectedExchange={selectedExchange}
              onExchangeChange={setSelectedExchange}
            />
          </AccordionPanel>

          <AccordionPanel
            section="api"
            title={`${selectedExchange === 'coinbase' ? 'Coinbase CDP' : 'Kraken'} API Keys`}
            icon="🔑"
            openSection={openSection}
            onToggle={toggleSection}
            maxHeight="600px"
          >
            <ApiKeysForm
              selectedExchange={selectedExchange}
              cdpKeyName={cdpKeyName}
              cdpPrivateKey={cdpPrivateKey}
              krakenApiKey={krakenApiKey}
              krakenApiSecret={krakenApiSecret}
              onCdpKeyNameChange={setLocalCdpKeyName}
              onCdpPrivateKeyChange={setLocalCdpPrivateKey}
              onKrakenApiKeyChange={setLocalKrakenKey}
              onKrakenApiSecretChange={setLocalKrakenSecret}
              isSignedIn={!!user}
              testStatus={testStatus}
              saveStatus={saveStatus}
              onTestConnection={handleTestConnection}
              onSaveKeys={handleSaveKeys}
              onClearKeys={handleClearKeys}
              storedKeySummary={storedKeySummary}
              canClearKeys={hasLocalExchangeKeys()}
            />
          </AccordionPanel>

          <AccordionPanel
            section="data"
            title="Price Data Feed"
            icon="📡"
            openSection={openSection}
            onToggle={toggleSection}
            maxHeight="280px"
          >
            <DataFeedPanel />
          </AccordionPanel>

          <AccordionPanel
            section="risk"
            title="Risk Management"
            icon="⚖️"
            openSection={openSection}
            onToggle={toggleSection}
            maxHeight="520px"
          >
            <RiskManagementPanel />
          </AccordionPanel>

          <AccordionPanel
            section="auto"
            title="Auto-Trading Controls"
            icon="🤖"
            openSection={openSection}
            onToggle={toggleSection}
            maxHeight="300px"
          >
            <AutoTradePanel />
          </AccordionPanel>

          <AccordionPanel
            section="alerts"
            title="Alert Rules & Notifications"
            icon="🔔"
            openSection={openSection}
            onToggle={toggleSection}
            maxHeight="700px"
          >
            <AlertRulesSettingsPanel />
          </AccordionPanel>
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
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
