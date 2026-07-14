import { useSettingsStore } from '@/store/settingsStore';

export function RiskManagementPanel() {
  const { maxTradeSize, dailyLossLimit, setMaxTradeSize, setDailyLossLimit } = useSettingsStore();

  return (
    <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      <div>
        <label style={{
          display: 'block',
          fontSize: '0.8rem',
          color: 'var(--color-muted)',
          marginBottom: '8px',
          fontWeight: 500,
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
            textAlign: 'right',
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
          fontWeight: 500,
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
              textAlign: 'right',
            }}
          />
          <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>%</span>
        </div>
      </div>
    </div>
  );
}

export function AutoTradePanel() {
  const { autoTradeEnabled, dryRun, toggleAutoTrade, toggleDryRun } = useSettingsStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{
            fontSize: '0.9rem',
            fontWeight: 700,
            color: 'var(--color-text)',
            marginBottom: '2px',
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
          cursor: 'pointer',
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
            border: '1px solid var(--color-border)',
          }}>
            <span style={{
              position: 'absolute',
              top: '2px',
              left: dryRun ? '22px' : '2px',
              width: '18px',
              height: '18px',
              background: '#fff',
              borderRadius: '50%',
              transition: 'left 0.2s',
            }} />
          </span>
        </label>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: '16px',
        borderTop: '1px solid var(--color-border)',
      }}>
        <div>
          <h3 style={{
            fontSize: '0.9rem',
            fontWeight: 700,
            color: 'var(--color-text)',
            marginBottom: '2px',
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
          cursor: 'pointer',
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
            border: '1px solid var(--color-border)',
          }}>
            <span style={{
              position: 'absolute',
              top: '2px',
              left: autoTradeEnabled ? '22px' : '2px',
              width: '18px',
              height: '18px',
              background: '#fff',
              borderRadius: '50%',
              transition: 'left 0.2s',
            }} />
          </span>
        </label>
      </div>
    </div>
  );
}
