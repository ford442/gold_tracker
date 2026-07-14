import { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

interface AuthPanelProps {
  onSignOut: () => void | Promise<void>;
}

export function AuthPanel({ onSignOut }: AuthPanelProps) {
  const { user, signIn, signUp, loading: authLoading } = useAuthStore();

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (authMode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  if (authLoading) {
    return <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Loading...</p>;
  }

  if (user) {
    return (
      <div className="space-y-3">
        <p style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>
          Signed in as: <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{user.email}</span>
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-green)' }}>
          ✅ Keys can be stored encrypted on Supabase
        </p>
        <button
          onClick={onSignOut}
          style={{
            fontSize: '0.85rem',
            color: 'var(--color-red)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleAuth} className="space-y-3">
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button
          type="button"
          onClick={() => setAuthMode('signin')}
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: authMode === 'signin' ? 'var(--color-accent)' : 'var(--color-surface2)',
            color: authMode === 'signin' ? '#fff' : 'var(--color-text)',
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => setAuthMode('signup')}
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: authMode === 'signup' ? 'var(--color-accent)' : 'var(--color-surface2)',
            color: authMode === 'signup' ? '#fff' : 'var(--color-text)',
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          Sign Up
        </button>
      </div>

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface2)',
          color: 'var(--color-text)',
          fontSize: '0.9rem',
        }}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface2)',
          color: 'var(--color-text)',
          fontSize: '0.9rem',
        }}
      />

      {authError && (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-red)' }}>{authError}</p>
      )}

      <button
        type="submit"
        style={{
          width: '100%',
          padding: '10px',
          background: 'var(--color-accent)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.9rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {authMode === 'signin' ? 'Sign In' : 'Create Account'}
      </button>

      <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textAlign: 'center' }}>
        Or continue without signing in (keys stored locally only)
      </p>
    </form>
  );
}
