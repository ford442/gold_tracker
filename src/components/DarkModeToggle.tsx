import { useEffect } from 'react';
import { useThemeStore } from '../store/themeStore';

export function DarkModeToggle() {
  const { mode, toggle } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  }, [mode]);

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
      role="switch"
      aria-checked={mode === 'light'}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '6px 12px',
        cursor: 'pointer',
        color: 'var(--color-text)',
        fontSize: '1rem',
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        minHeight: '44px',
        minWidth: '44px',
        transition: 'all 0.18s ease',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      {mode === 'dark' ? '☀️' : '🌙'}
      <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', fontWeight: 500 }}>
        {mode === 'dark' ? 'Light' : 'Dark'}
      </span>
    </button>
  );
}
