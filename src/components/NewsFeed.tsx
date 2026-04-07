import { useState, useMemo } from 'react';
import { useNews } from '../hooks/useNews';
import { formatTimeAgo } from '../lib/utils';

const COLLAPSED_KEY = 'goldtrackr-news-collapsed';

// Keywords to categorize news
const CATEGORIES: Record<string, { label: string; color: string; keywords: string[] }> = {
  fed: {
    label: 'Fed',
    color: '#8b5cf6',
    keywords: ['fed', 'federal reserve', 'powell', 'interest rate', 'fomc', 'monetary policy']
  },
  arbitrage: {
    label: 'Arbitrage',
    color: '#f59e0b',
    keywords: ['arbitrage', 'spread', 'premium', 'discount', 'etf', 'gld', 'iah']
  },
  china: {
    label: 'China',
    color: '#ef4444',
    keywords: ['china', 'chinese', 'sge', 'shanghai', 'pboc', 'yuan', 'asia']
  },
  mining: {
    label: 'Mining',
    color: '#10b981',
    keywords: ['mining', 'miner', 'production', 'output', 'supply', 'extraction']
  },
  central_bank: {
    label: 'CB',
    color: '#3b82f6',
    keywords: ['central bank', 'reserve', 'gold reserve', 'purchases', 'buying gold']
  },
  price: {
    label: 'Price',
    color: '#f5c842',
    keywords: ['price', 'rally', 'surge', 'drop', 'fall', 'record high', 'all-time']
  }
};

function categorizeNews(title: string): string | null {
  const lowerTitle = title.toLowerCase();
  for (const [key, category] of Object.entries(CATEGORIES)) {
    if (category.keywords.some(kw => lowerTitle.includes(kw))) {
      return key;
    }
  }
  return null;
}

interface NewsItem {
  id: string;
  title: string;
  snippet?: string;
  source: string;
  publishedAt: string;
  url: string;
  category?: string | null;
}

export function NewsFeed() {
  const { news, loading, refetch } = useNews();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === 'true');
  const [readItems, setReadItems] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('goldtrackr-news-read');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  // Categorize news items
  const categorizedNews = useMemo(() => {
    return news.map(item => ({
      ...item,
      category: categorizeNews(item.title)
    }));
  }, [news]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, String(next));
      return next;
    });
  };

  const markAsRead = (id: string) => {
    setReadItems(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem('goldtrackr-news-read', JSON.stringify([...next]));
      return next;
    });
  };

  const isRead = (id: string) => readItems.has(id);

  return (
    <section style={{ marginBottom: 'var(--space-2xl)' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: collapsed ? '0' : 'var(--space-lg)' 
      }}>
        <button
          onClick={toggleCollapsed}
          style={{
            margin: 0, 
            fontSize: 'var(--font-xl)', 
            color: 'var(--color-text)',
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            padding: 0,
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            fontWeight: 700,
            letterSpacing: '-0.025em'
          }}
          aria-expanded={!collapsed}
        >
          <span style={{
            display: 'inline-block',
            transition: 'transform 0.2s ease',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            fontSize: '0.7rem',
            color: 'var(--color-muted)'
          }}>
            ▼
          </span>
          📰 Gold News
          {collapsed && news.length > 0 && (
            <span style={{ 
              fontSize: 'var(--font-xs)', 
              color: 'var(--color-muted)', 
              fontWeight: 500,
              background: 'var(--color-surface2)',
              padding: '2px 8px',
              borderRadius: '999px'
            }}>
              {news.length} articles
            </span>
          )}
        </button>
        {!collapsed && (
          <button
            onClick={refetch}
            disabled={loading}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-muted)',
              cursor: loading ? 'default' : 'pointer',
              fontSize: 'var(--font-xs)',
              opacity: loading ? 0.5 : 1,
              fontWeight: 500
            }}
          >
            {loading ? '⏳ Loading...' : '🔄 Refresh'}
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          {news.length === 0 ? (
            <div className="glass-card" style={{
              padding: '32px',
              textAlign: 'center',
              color: 'var(--color-muted)',
              fontSize: 'var(--font-base)',
            }}>
              {loading ? (
                <>
                  <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⏳</div>
                  Loading news...
                </>
              ) : (
                <>
                  <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📭</div>
                  No relevant news found
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {categorizedNews.map((item: NewsItem) => {
                const read = isRead(item.id);
                const category = item.category ? CATEGORIES[item.category] : null;
                
                return (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => markAsRead(item.id)}
                    className="card-hover glass-card"
                    style={{
                      display: 'block',
                      padding: '16px',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'all 0.18s ease',
                      opacity: read ? 0.65 : 1,
                    }}
                  >
                    {/* Category badge */}
                    {category && (
                      <span style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        background: `${category.color}20`,
                        color: category.color,
                        border: `1px solid ${category.color}40`
                      }}>
                        {category.label}
                      </span>
                    )}
                    
                    <div style={{ 
                      fontSize: '0.95rem', 
                      fontWeight: read ? 500 : 600, 
                      color: 'var(--color-text)', 
                      marginBottom: '6px', 
                      lineHeight: 1.4,
                      paddingRight: category ? '60px' : '0'
                    }}>
                      {item.title}
                      {read && (
                        <span style={{
                          fontSize: '0.7rem',
                          color: 'var(--color-muted)',
                          marginLeft: '8px',
                          fontWeight: 400
                        }}>
                          (read)
                        </span>
                      )}
                    </div>
                    
                    {item.snippet && (
                      <div style={{ 
                        fontSize: '0.8rem', 
                        color: 'var(--color-muted)', 
                        lineHeight: 1.5, 
                        marginBottom: '10px' 
                      }}>
                        {item.snippet.length > 120 
                          ? item.snippet.substring(0, 120) + '...' 
                          : item.snippet}
                      </div>
                    )}
                    
                    <div style={{ 
                      display: 'flex', 
                      gap: '12px', 
                      fontSize: '0.75rem', 
                      color: 'var(--color-muted)',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontWeight: 500 }}>{item.source}</span>
                      <span>·</span>
                      <span>{formatTimeAgo(item.publishedAt)}</span>
                      <span style={{ marginLeft: 'auto' }}>↗</span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
