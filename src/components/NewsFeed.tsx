import { useNews } from '../hooks/useNews';
import { formatTimeAgo } from '../lib/utils';

export function NewsFeed() {
  const { news, loading, refetch } = useNews();

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text)' }}>
          📰 Gold News
        </h2>
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
      </div>

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
    </section>
  );
}
