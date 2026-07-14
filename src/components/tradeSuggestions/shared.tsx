import { useState } from 'react';

export function InfoTooltip({ text }: { text: string }) {
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
        position: 'relative',
      }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      aria-label="More information"
    >
      ℹ️
      {show && (
        <span
          style={{
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
            marginBottom: '6px',
          }}
        >
          {text}
          <span
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              border: '6px solid transparent',
              borderTopColor: 'var(--color-border)',
            }}
          />
        </span>
      )}
    </span>
  );
}

export function TrendIndicator({
  direction,
  value,
}: {
  direction: 'up' | 'down' | 'neutral';
  value?: number;
}) {
  const colors = {
    up: 'var(--color-green)',
    down: 'var(--color-red)',
    neutral: 'var(--color-muted)',
  };

  const arrows = {
    up: '↑',
    down: '↓',
    neutral: '→',
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        color: colors[direction],
        fontSize: '0.75rem',
        fontWeight: 600,
      }}
    >
      {arrows[direction]}
      {value !== undefined && `${value.toFixed(2)}%`}
    </span>
  );
}
