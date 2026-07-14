import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { useTradeSuggestions } from '@/hooks/useTradeSuggestions';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/useAuthStore';
import { SettingsModal } from './SettingsModal';
import { TradeSuggestionCard } from '@components/tradeSuggestions/TradeSuggestionCard';
import { TradeSuggestionsEmptyState } from '@components/tradeSuggestions/TradeSuggestionsEmptyState';
import {
  TradeSuggestionsFooter,
  TradeSuggestionsHeader,
} from '@components/tradeSuggestions/TradeSuggestionsHeader';
import { useTradeExecution } from '@components/tradeSuggestions/useTradeExecution';

const TOASTER_OPTIONS = {
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
};

export function TradeSuggestionsPanel() {
  const suggestions = useTradeSuggestions();
  const { autoTradeEnabled, dryRun, selectedExchange } = useSettingsStore();
  const { user, init: initAuth } = useAuthStore();
  const [showSettings, setShowSettings] = useState(false);

  const { executingId, handleExecuteTrade, dryRun: execDryRun, selectedExchange: execExchange } =
    useTradeExecution({ onKrakenAuthRequired: () => setShowSettings(true) });

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  if (suggestions.length === 0) {
    return (
      <>
        <Toaster position="top-right" />
        <TradeSuggestionsEmptyState
          selectedExchange={selectedExchange}
          onOpenSettings={() => setShowSettings(true)}
        />
        <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      </>
    );
  }

  return (
    <>
      <Toaster position="top-right" toastOptions={TOASTER_OPTIONS} />
      <div
        className="glass-card"
        style={{
          padding: '24px',
          marginBottom: 'var(--space-2xl)',
        }}
      >
        <TradeSuggestionsHeader
          count={suggestions.length}
          selectedExchange={selectedExchange}
          user={user}
          autoTradeEnabled={autoTradeEnabled}
          dryRun={dryRun}
          onOpenSettings={() => setShowSettings(true)}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {suggestions.map((suggestion) => (
            <TradeSuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              selectedExchange={execExchange}
              executingId={executingId}
              dryRun={execDryRun}
              onExecute={handleExecuteTrade}
            />
          ))}
        </div>

        <TradeSuggestionsFooter selectedExchange={selectedExchange} user={user} />
      </div>
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
