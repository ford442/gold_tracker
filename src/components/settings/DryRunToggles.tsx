import { useSettingsStore } from '@/store/settingsStore';
import { RISK_ENGINE_NFA_COPY } from '@lib/riskEngine';

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  activeColor = 'var(--color-green)',
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  activeColor?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <h3 style={{
          fontSize: '0.9rem',
          fontWeight: 700,
          color: 'var(--color-text)',
          marginBottom: '2px',
        }}>
          {title}
        </h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{description}</p>
      </div>
      <label style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        cursor: 'pointer',
      }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
        />
        <span style={{
          width: '44px',
          height: '24px',
          background: checked ? activeColor : 'var(--color-surface2)',
          borderRadius: '12px',
          position: 'relative',
          transition: 'background 0.2s',
          border: '1px solid var(--color-border)',
        }}>
          <span style={{
            position: 'absolute',
            top: '2px',
            left: checked ? '22px' : '2px',
            width: '18px',
            height: '18px',
            background: '#fff',
            borderRadius: '50%',
            transition: 'left 0.2s',
          }} />
        </span>
      </label>
    </div>
  );
}

export function RiskManagementPanel() {
  const {
    maxTradeSize,
    dailyLossLimit,
    killSwitch,
    allowPaperDespiteKillSwitch,
    maxGoldSleevePct,
    maxSingleTradeNotionalUsd,
    maxOpenOrders,
    setMaxTradeSize,
    setDailyLossLimit,
    setKillSwitch,
    setAllowPaperDespiteKillSwitch,
    setMaxGoldSleevePct,
    setMaxSingleTradeNotionalUsd,
    setMaxOpenOrders,
  } = useSettingsStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <ToggleRow
        title="Trading Kill Switch"
        description="Block all live orders immediately (paper can still practice when enabled below)"
        checked={killSwitch}
        onChange={setKillSwitch}
        activeColor="var(--color-red)"
      />

      {killSwitch && (
        <ToggleRow
          title="Practice Despite Kill Switch"
          description="Allow paper / dry-run trades while kill switch is on"
          checked={allowPaperDespiteKillSwitch}
          onChange={setAllowPaperDespiteKillSwitch}
        />
      )}

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

        <div>
          <label style={{
            display: 'block',
            fontSize: '0.8rem',
            color: 'var(--color-muted)',
            marginBottom: '8px',
            fontWeight: 500,
          }}>
            Max Gold Sleeve
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="range"
              min="50"
              max="100"
              step="5"
              value={maxGoldSleevePct}
              onChange={(e) => setMaxGoldSleevePct(parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{
              fontSize: '0.9rem',
              fontFamily: 'monospace',
              color: 'var(--color-gold)',
              minWidth: '50px',
              textAlign: 'right',
            }}>
              {maxGoldSleevePct.toFixed(0)}%
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
            Max Open Live Orders
          </label>
          <input
            type="number"
            min="1"
            max="10"
            step="1"
            value={maxOpenOrders}
            onChange={(e) => setMaxOpenOrders(parseInt(e.target.value, 10) || 1)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface2)',
              color: 'var(--color-text)',
              fontSize: '0.9rem',
            }}
          />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{
            display: 'block',
            fontSize: '0.8rem',
            color: 'var(--color-muted)',
            marginBottom: '8px',
            fontWeight: 500,
          }}>
            Max Trade Notional (USD)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="number"
              min="0"
              max="100000"
              step="100"
              value={maxSingleTradeNotionalUsd}
              onChange={(e) => setMaxSingleTradeNotionalUsd(parseFloat(e.target.value) || 0)}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface2)',
                color: 'var(--color-text)',
                fontSize: '0.9rem',
              }}
            />
            <span style={{ color: 'var(--color-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
              0 = off
            </span>
          </div>
        </div>
      </div>

      <div style={{
        padding: '12px 14px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface2)',
        fontSize: '0.75rem',
        color: 'var(--color-muted)',
        lineHeight: 1.5,
      }}>
        {RISK_ENGINE_NFA_COPY}
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
