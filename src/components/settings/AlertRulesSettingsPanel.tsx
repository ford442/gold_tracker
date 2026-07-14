import { useState } from 'react';
import { useAlertRulesStore } from '@/store/alertRulesStore';
import {
  getNotificationPermission,
  permissionStatusLabel,
  requestNotificationPermission,
  type NotificationPermissionState,
} from '@lib/alertNotifications';

export function AlertRulesSettingsPanel() {
  const { exportRules, importRules, resetToDefaults, notificationPromptDismissed, dismissNotificationPrompt } =
    useAlertRulesStore();
  const [perm, setPerm] = useState<NotificationPermissionState>(() => getNotificationPermission());
  const [importText, setImportText] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [status, setStatus] = useState<string | null>(null);

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission();
    setPerm(result);
    dismissNotificationPrompt();
  };

  const handleExport = () => {
    const json = exportRules();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `goldtrackr-alert-rules-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Rules exported.');
  };

  const handleImport = () => {
    const result = importRules(importText, importMode);
    if (result.ok) {
      setStatus(`Rules imported (${importMode}).`);
      setImportText('');
    } else {
      setStatus(`Import failed: ${result.error}`);
    }
  };

  const showPermissionBanner =
    perm !== 'granted' && perm !== 'unsupported' && !notificationPromptDismissed;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {showPermissionBanner && (
        <div
          className="glass-card"
          style={{
            padding: '14px',
            borderColor: 'rgba(240,200,69,0.35)',
            background: 'var(--color-gold-dim)',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)', marginBottom: '6px' }}>
            Browser notifications
          </div>
          <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', margin: '0 0 10px' }}>
            Enable desktop alerts for rules that use the browser channel. Status: {permissionStatusLabel(perm)}.
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            {perm === 'default' && (
              <button
                type="button"
                onClick={handleRequestPermission}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: 'var(--color-gold)',
                  color: '#1a1a1a',
                  fontWeight: 600,
                  fontSize: 'var(--font-xs)',
                  cursor: 'pointer',
                }}
              >
                Allow notifications
              </button>
            )}
            <button
              type="button"
              onClick={dismissNotificationPrompt}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-muted)',
                fontSize: 'var(--font-xs)',
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {perm === 'granted' && (
        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-green)', margin: 0 }}>
          Browser notifications enabled.
        </p>
      )}

      <div>
        <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)', marginBottom: '8px' }}>Export / import</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
          <button
            type="button"
            onClick={handleExport}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface2)',
              color: 'var(--color-text)',
              fontSize: 'var(--font-xs)',
              cursor: 'pointer',
            }}
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm('Reset all rules to the default PAXG/XAUT spread rule?')) resetToDefaults();
            }}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-red)',
              fontSize: 'var(--font-xs)',
              cursor: 'pointer',
            }}
          >
            Reset defaults
          </button>
        </div>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder='Paste exported JSON or { "version": 1, "rules": [...] }'
          rows={4}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface2)',
            color: 'var(--color-text)',
            fontSize: 'var(--font-xs)',
            fontFamily: 'monospace',
            marginBottom: '8px',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>
            <select
              value={importMode}
              onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')}
              style={{
                marginLeft: '6px',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface2)',
                color: 'var(--color-text)',
              }}
            >
              <option value="merge">Merge</option>
              <option value="replace">Replace all</option>
            </select>
          </label>
          <button
            type="button"
            onClick={handleImport}
            disabled={!importText.trim()}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'var(--color-accent)',
              color: '#fff',
              fontSize: 'var(--font-xs)',
              fontWeight: 600,
              cursor: importText.trim() ? 'pointer' : 'not-allowed',
              opacity: importText.trim() ? 1 : 0.5,
            }}
          >
            Import
          </button>
        </div>
      </div>

      {status && (
        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', margin: 0 }}>{status}</p>
      )}

      <p style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', margin: 0 }}>
        Manage individual rules from the Alerts panel on Overview. Fidelity thresholds for suggestions & backtests are in Strategy → Arbitrage config. Webhook delivery is planned for a future release.
      </p>
    </div>
  );
}
