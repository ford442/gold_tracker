import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchGoldNews } from '../lib/api';
import type { NewsItem } from '../types';

const NEWS_INTERVAL = 300000; // 5 min

export function useNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const items = await fetchGoldNews();
      setNews(items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    timerRef.current = setInterval(fetch, NEWS_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetch]);

  return { news, loading, refetch: fetch };
}
