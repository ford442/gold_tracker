import { supabase, isSupabaseConfigured } from '@lib/supabase';
import { getMockNews } from '@lib/api';
import { recordObservabilityEvent } from '@lib/observability';
import type { NewsItem } from '@/types';

export interface FetchNewsResponse {
  items: NewsItem[];
  fetchedAt: string;
  sources: string[];
  cached: boolean;
  error?: string;
}

export interface FetchNewsResult {
  items: NewsItem[];
  fetchedAt: string;
  sources: string[];
  isMock: boolean;
  cached?: boolean;
}

function mockResult(): FetchNewsResult {
  return {
    items: getMockNews(),
    fetchedAt: new Date().toISOString(),
    sources: ['Demo'],
    isMock: true,
  };
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export async function fetchLiveNews(): Promise<FetchNewsResult> {
  if (!isSupabaseConfigured || !isOnline()) {
    return mockResult();
  }

  const start = performance.now();
  try {
    const { data, error } = await supabase.functions.invoke<FetchNewsResponse>('fetch-news');
    const latencyMs = performance.now() - start;

    if (error || !data?.items?.length) {
      recordObservabilityEvent({
        kind: 'edge_invoke',
        severity: 'warn',
        ok: false,
        source: 'edge:fetch-news',
        action: 'fetch_news',
        latencyMs,
        detail: `fetch-news Edge Function returned error or empty (${error?.message ?? 'no items'}); using mock fallback`,
      });
      return mockResult();
    }

    recordObservabilityEvent({
      kind: 'edge_invoke',
      severity: 'info',
      ok: true,
      source: 'edge:fetch-news',
      action: 'fetch_news',
      latencyMs,
      detail: `fetch-news: received ${data.items.length} items from ${data.sources.join(', ')} (${data.cached ? 'cached' : 'live'})`,
      meta: { count: data.items.length, cached: data.cached },
    });

    return {
      items: data.items,
      fetchedAt: data.fetchedAt,
      sources: data.sources,
      isMock: false,
      cached: data.cached,
    };
  } catch (err) {
    const latencyMs = performance.now() - start;
    recordObservabilityEvent({
      kind: 'edge_invoke',
      severity: 'warn',
      ok: false,
      source: 'edge:fetch-news',
      action: 'fetch_news',
      latencyMs,
      detail: `fetch-news failed: ${err instanceof Error ? err.message : 'Network error'}; using mock fallback`,
    });
    return mockResult();
  }
}
