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
      aria-label="Toggle dark/light mode"
      style={{
        background: 'var(--color-surface2)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        padding: '6px 12px',
        cursor: 'pointer',
        color: 'var(--color-text)',
        fontSize: '1.1rem',
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      {mode === 'dark' ? '☀️' : '🌙'}
      <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
        {mode === 'dark' ? 'Light' : 'Dark'}
      </span>
    </button>
  );
}
