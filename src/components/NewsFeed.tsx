import { useState } from 'react';
import { useNews } from '../hooks/useNews';
import { formatTimeAgo } from '../lib/utils';

const COLLAPSED_KEY = 'goldtrackr-news-collapsed';

export function NewsFeed() {
  const { news, loading, refetch } = useNews();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === 'true');

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, String(next));
      return next;
    });
  };

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: collapsed ? '0' : '16px' }}>
        <button
          onClick={toggleCollapsed}
          style={{
            margin: 0, fontSize: '1.1rem', color: 'var(--color-text)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700,
          }}
          aria-expanded={!collapsed}
        >
          <span style={{
            display: 'inline-block',
            transition: 'transform 0.15s',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            fontSize: '0.8rem',
          }}>
            ▼
          </span>
          📰 Gold News
          {collapsed && news.length > 0 && (
            <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)', fontWeight: 400 }}>
              ({news.length} articles)
            </span>
          )}
        </button>
        {!collapsed && (
          <button
            onClick={refetch}
            disabled={loading}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-muted)',
              cursor: loading ? 'default' : 'pointer',
              fontSize: '0.75rem',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? '⏳ Loading...' : '🔄 Refresh'}
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          {news.length === 0 ? (
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center',
              color: 'var(--color-muted)',
              fontSize: '0.875rem',
            }}>
              {loading ? '⏳ Loading news...' : 'No relevant news found.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {news.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-gold)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                >
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px', lineHeight: 1.4 }}>
                    {item.title}
                  </div>
                  {item.snippet && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', lineHeight: 1.4, marginBottom: '6px' }}>
                      {item.snippet}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px', fontSize: '0.7rem', color: 'var(--color-muted)' }}>
                    <span>{item.source}</span>
                    <span>·</span>
                    <span>{formatTimeAgo(item.publishedAt)}</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
