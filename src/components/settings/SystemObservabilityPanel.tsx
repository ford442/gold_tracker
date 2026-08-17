import { useState, useMemo, useEffect } from 'react';
import { useObservability } from '@/hooks/useObservability';
import { useSettingsStore } from '@/store/settingsStore';
import type { ObservabilityEventKind, EventSeverity } from '@lib/observability';

const FILTER_OPTIONS: Array<{ id: ObservabilityEventKind | 'all'; label: string; icon: string }> = [
  { id: 'all', label: 'All Events', icon: '📋' },
  { id: 'price_fetch', label: 'Price Feeds', icon: '📡' },
  { id: 'ws_status', label: 'WebSockets', icon: '⚡' },
  { id: 'venue_quote', label: 'Venue Quotes', icon: '🌐' },
  { id: 'trade_attempt', label: 'Trades & Risk', icon: '⚖️' },
  { id: 'edge_invoke', label: 'Edge Functions', icon: '☁️' },
  { id: 'cache', label: 'Market Cache', icon: '💾' },
];

function formatAge(ts: number | undefined, now: number): string {
  if (!ts) return 'None';
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toTimeString().slice(0, 8);
}

function getSeverityBadgeStyle(sev: EventSeverity) {
  switch (sev) {
    case 'success':
      return { background: 'var(--color-green-dim, rgba(0, 219, 166, 0.15))', color: 'var(--color-green, #00dba6)' };
    case 'warn':
      return { background: 'var(--color-gold-dim, rgba(240, 200, 69, 0.15))', color: 'var(--color-gold, #f0c845)' };
    case 'error':
      return { background: 'var(--color-red-dim, rgba(255, 90, 120, 0.15))', color: 'var(--color-red, #ff5a78)' };
    case 'info':
    default:
      return { background: 'var(--color-accent-dim, rgba(124, 92, 252, 0.15))', color: 'var(--color-muted, #94a3b8)' };
  }
}

function getHealthBadge(status: string) {
  switch (status) {
    case 'healthy':
    case 'connected':
    case 'success':
      return <span className="badge-green">{status.toUpperCase()}</span>;
    case 'degraded':
    case 'reconnecting':
    case 'fallback_rest':
    case 'warn':
      return <span className="badge-gold">{status.toUpperCase()}</span>;
    case 'error':
    case 'offline':
      return <span className="badge-red">{status.toUpperCase()}</span>;
    default:
      return <span className="badge-accent">{status.toUpperCase()}</span>;
  }
}

export function SystemObservabilityPanel() {
  const { events, summary, kindFilter, setKindFilter, clearEvents, exportJson } = useObservability();
  const priceTransportMode = useSettingsStore((s) => s.priceTransportMode);
  const [searchQuery, setSearchQuery] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const filteredEvents = useMemo(() => {
    let list = events;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.detail.toLowerCase().includes(q) ||
          e.source.toLowerCase().includes(q) ||
          (e.action && e.action.toLowerCase().includes(q)) ||
          (e.exchange && e.exchange.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [events, searchQuery]);

  const totalCacheOps = summary.cacheHits + summary.cacheMisses;
  const cacheHitRate = totalCacheOps > 0 ? Math.round((summary.cacheHits / totalCacheOps) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. System Health Metrics Overview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
        }}
      >
        {/* Price Feed Card */}
        <div
          className="glass-card"
          style={{
            padding: '12px 14px',
            background: 'var(--color-surface2)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-muted)' }}>PRICE FEED</span>
            {getHealthBadge(summary.priceFeedHealth)}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div>Mode: <strong style={{ color: 'var(--color-accent)' }}>{priceTransportMode.toUpperCase()}</strong></div>
            <div>Last REST: <span style={{ color: 'var(--color-muted)' }}>{formatAge(summary.lastRestPriceTs, now)}</span></div>
            <div>Last Tick: <span style={{ color: 'var(--color-muted)' }}>{formatAge(summary.lastWsTickTs, now)}</span></div>
          </div>
        </div>

        {/* WebSocket Stream Card */}
        <div
          className="glass-card"
          style={{
            padding: '12px 14px',
            background: 'var(--color-surface2)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-muted)' }}>WEBSOCKET</span>
            {getHealthBadge(summary.wsState)}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div>State: <strong>{summary.wsState}</strong></div>
            <div>Warns: <span style={{ color: summary.warnCount > 0 ? 'var(--color-gold)' : 'var(--color-muted)' }}>{summary.warnCount}</span></div>
            <div>Errors: <span style={{ color: summary.errorCount > 0 ? 'var(--color-red)' : 'var(--color-muted)' }}>{summary.errorCount}</span></div>
          </div>
        </div>

        {/* Execution & Risk Gate Card */}
        <div
          className="glass-card"
          style={{
            padding: '12px 14px',
            background: 'var(--color-surface2)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-muted)' }}>EXECUTION & RISK</span>
            {getHealthBadge(summary.tradeHealth)}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div>Last Action: <strong>{summary.lastTradeOutcome ?? 'None'}</strong></div>
            <div>Last Attempt: <span style={{ color: 'var(--color-muted)' }}>{formatAge(summary.lastTradeAttemptTs, now)}</span></div>
            <div>Total Events: <strong>{summary.totalEvents}</strong></div>
          </div>
        </div>

        {/* Market Cache Card */}
        <div
          className="glass-card"
          style={{
            padding: '12px 14px',
            background: 'var(--color-surface2)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-muted)' }}>MARKET CACHE</span>
            <span className="badge-accent">{cacheHitRate}% HIT</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div>Hits: <strong style={{ color: 'var(--color-green)' }}>{summary.cacheHits}</strong> / Misses: {summary.cacheMisses}</div>
            <div>In-Flight Dedupes: <strong style={{ color: 'var(--color-gold)' }}>{summary.cacheDedupes}</strong></div>
            <div>Ring Cap: <strong>200 events</strong></div>
          </div>
        </div>
      </div>

      {/* 2. Filter Bar & Search */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {FILTER_OPTIONS.map((f) => {
            const active = kindFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                className="range-pill"
                onClick={() => setKindFilter(f.id)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: active ? 'var(--color-accent)' : 'var(--color-surface)',
                  color: active ? '#fff' : 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-full)',
                  cursor: 'pointer',
                }}
              >
                <span>{f.icon}</span>
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', maxWidth: '300px' }}>
          <input
            type="text"
            placeholder="Search diagnostic events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 12px',
              fontSize: '0.8rem',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
            }}
          />
        </div>
      </div>

      {/* 3. Diagnostic Event Stream Table */}
      <div
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            maxHeight: '320px',
            overflowY: 'auto',
          }}
        >
          {filteredEvents.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.85rem' }}>
              No diagnostic events found for the selected filter.
            </div>
          ) : (
            <table className="table-zebra" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', width: '90px' }}>Time</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', width: '70px' }}>Level</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', width: '100px' }}>Kind</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', width: '120px' }}>Source</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Event Details</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', width: '80px' }}>Latency</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((e) => {
                  const badgeStyle = getSeverityBadgeStyle(e.severity);
                  return (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                        {formatTime(e.ts)}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            ...badgeStyle,
                          }}
                        >
                          {e.severity.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                        <code style={{ fontSize: '0.75rem' }}>{e.kind}</code>
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 500 }}>{e.source}</span>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--color-text)' }}>
                        <div>{e.detail}</div>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                        {e.latencyMs != null ? (
                          <span style={{ color: e.latencyMs > 500 ? 'var(--color-gold)' : 'inherit' }}>
                            {e.latencyMs}ms
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 4. Controls & Disclaimer Footer */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={clearEvents}
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              background: 'transparent',
              color: 'var(--color-muted)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
            }}
          >
            🗑️ Clear History
          </button>
          <button
            type="button"
            onClick={exportJson}
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              background: 'var(--color-surface2)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            📥 Export JSON Diagnostics
          </button>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', maxWidth: '480px', textAlign: 'right' }}>
          Diagnostic telemetry is strictly local in-memory. Zero credentials, API keys, or private identifiers are logged.
          Personal terminal diagnostics only — not financial advice.
        </div>
      </div>
    </div>
  );
}
