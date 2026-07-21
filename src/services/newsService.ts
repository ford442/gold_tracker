import { supabase, isSupabaseConfigured } from '@lib/supabase';
import { getMockNews } from '@lib/api';
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

  try {
    const { data, error } = await supabase.functions.invoke<FetchNewsResponse>('fetch-news');

    if (error || !data?.items?.length) {
      return mockResult();
    }

    return {
      items: data.items,
      fetchedAt: data.fetchedAt,
      sources: data.sources,
      isMock: false,
      cached: data.cached,
    };
  } catch {
    return mockResult();
  }
}
