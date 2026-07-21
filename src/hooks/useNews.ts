import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchLiveNews, type FetchNewsResult } from '@/services/newsService';
import type { NewsItem } from '@/types';

const NEWS_INTERVAL = 300000; // 5 min

export function useNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [isMock, setIsMock] = useState(true);
  const [cached, setCached] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLiveRef = useRef<FetchNewsResult | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchLiveNews();

      if (!result.isMock) {
        lastLiveRef.current = result;
      } else if (lastLiveRef.current) {
        setNews(lastLiveRef.current.items);
        setLastFetched(lastLiveRef.current.fetchedAt);
        setSources(lastLiveRef.current.sources);
        setIsMock(false);
        setCached(lastLiveRef.current.cached ?? false);
        return;
      }

      setNews(result.items);
      setLastFetched(result.fetchedAt);
      setSources(result.sources);
      setIsMock(result.isMock);
      setCached(result.cached ?? false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
    timerRef.current = setInterval(() => void fetch(), NEWS_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetch]);

  return { news, loading, refetch: fetch, lastFetched, sources, isMock, cached };
}
