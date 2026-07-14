interface Props {
  label: string;
  color: string;
  active: boolean;
  onToggle: () => void;
}

/** A styled toggle pill for showing/hiding overlay instruments */
export function InstrumentToggle({ label, color, active, onToggle }: Props) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={active}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        padding: '4px 10px',
        borderRadius: 'var(--radius-full)',
        border: `1px solid ${active ? color : 'var(--color-border)'}`,
        background: active ? `${color}18` : 'transparent',
        color: active ? color : 'var(--color-muted)',
        fontSize: 'var(--font-xs)',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: active ? color : 'var(--color-muted)',
        flexShrink: 0,
        transition: 'background 0.18s ease',
      }} />
      {label}
    </button>
  );
}
