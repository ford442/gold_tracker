import { useState } from 'react';
import { useAlertRulesStore } from '@/store/alertRulesStore';
import { describeRule, type AlertRule } from '@lib/alertRules';
import { AlertRuleForm } from './AlertRuleForm';

export function AlertRulesManager() {
  const { rules, addRule, updateRule, removeRule, toggleRule } = useAlertRulesStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const handleSave = (rule: AlertRule) => {
    const exists = rules.some((r) => r.id === rule.id);
    if (exists) updateRule(rule.id, rule);
    else addRule(rule);
    setEditingId(null);
    setShowCreate(false);
  };

  return (
    <div style={{ marginBottom: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 600, margin: 0, color: 'var(--color-text)' }}>
          Alert rules
        </h3>
        {!showCreate && !editingId && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'var(--color-accent)',
              color: '#fff',
              fontSize: 'var(--font-xs)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Add rule
          </button>
        )}
      </div>

      {showCreate && (
        <AlertRuleForm onSave={handleSave} onCancel={() => setShowCreate(false)} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {rules.map((rule) =>
          editingId === rule.id ? (
            <AlertRuleForm
              key={rule.id}
              initial={rule}
              onSave={handleSave}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div
              key={rule.id}
              className="glass-card card-hover"
              style={{
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                opacity: rule.enabled ? 1 : 0.55,
              }}
            >
              <button
                type="button"
                onClick={() => toggleRule(rule.id)}
                aria-label={rule.enabled ? 'Disable rule' : 'Enable rule'}
                style={{
                  width: '36px',
                  height: '20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: rule.enabled ? 'var(--color-green)' : 'var(--color-border)',
                  cursor: 'pointer',
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '2px',
                    left: rule.enabled ? '18px' : '2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.15s',
                  }}
                />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: 'var(--color-text)' }}>
                  {rule.name}
                </div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', marginTop: '2px' }}>
                  {describeRule(rule)} · cooldown {rule.cooldownMinutes}m
                  {rule.quietHours ? ` · quiet ${rule.quietHours.start}–${rule.quietHours.end}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setEditingId(rule.id); }}
                  aria-label="Edit rule"
                  style={{
                    padding: '4px 10px',
                    fontSize: 'var(--font-xs)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'transparent',
                    color: 'var(--color-muted)',
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  aria-label="Delete rule"
                  style={{
                    padding: '4px 10px',
                    fontSize: 'var(--font-xs)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'transparent',
                    color: 'var(--color-red)',
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
