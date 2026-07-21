import { useSettingsStore } from '@/store/settingsStore';
import type { PriceTransportMode } from '@lib/priceTransport';

const MODES: { id: PriceTransportMode; label: string; hint: string }[] = [
  {
    id: 'auto',
    label: 'Auto',
    hint: 'Public exchange WebSockets with automatic fallback to 60s REST polling.',
  },
  {
    id: 'poll',
    label: 'Poll',
    hint: 'REST only — CoinGecko + MetalPrice every 60 seconds.',
  },
  {
    id: 'stream',
    label: 'Stream',
    hint: 'Live crypto ticks via Coinbase + Kraken public feeds; metals stay on REST.',
  },
];

export function DataFeedPanel() {
  const { priceTransportMode, setPriceTransportMode } = useSettingsStore();
  const active = MODES.find((m) => m.id === priceTransportMode) ?? MODES[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', lineHeight: 1.5, margin: 0 }}>
        Public market-data feeds — no API keys required for streaming. Mock and offline snapshot
        behavior is unchanged when REST fails or the network is unavailable.
      </p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={`range-pill ${priceTransportMode === mode.id ? 'active' : ''}`}
            onClick={() => setPriceTransportMode(mode.id)}
            aria-pressed={priceTransportMode === mode.id}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <p style={{
        fontSize: '0.72rem',
        color: 'var(--color-muted)',
        margin: 0,
        padding: '10px 12px',
        background: 'var(--color-surface2)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        lineHeight: 1.45,
      }}>
        {active.hint}
      </p>
    </div>
  );
}
