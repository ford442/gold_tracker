import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { mergeNewsFeeds, parseRssItems } from '../_shared/newsParser.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CACHE_TTL_MS = 10 * 60 * 1000
const FETCH_TIMEOUT_MS = 8_000
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const RATE_LIMIT_MAX = 60

interface NewsFeedSource {
  url: string
  name: string
}

interface CachedNews {
  items: ReturnType<typeof mergeNewsFeeds>
  fetchedAt: string
  sources: string[]
}

interface RateLimitEntry {
  count: number
  windowStart: number
}

const RSS_SOURCES: NewsFeedSource[] = [
  { url: 'https://www.kitco.com/news/category/commodities/gold/rss', name: 'Kitco' },
  { url: 'https://www.kitco.com/news/category/news/rss', name: 'Kitco' },
  { url: 'https://www.mining.com/feed/', name: 'MINING.com' },
]

let cache: CachedNews | null = null
const rateLimits = new Map<string, RateLimitEntry>()

function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimits.get(ip)

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimits.set(ip, { count: 1, windowStart: now })
    return false
  }

  if (entry.count >= RATE_LIMIT_MAX) return true
  entry.count += 1
  return false
}

function isCacheFresh(cached: CachedNews): boolean {
  return Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS
}

async function fetchRssFeed(source: NewsFeedSource): Promise<ReturnType<typeof parseRssItems>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
        'User-Agent': 'GoldTrackr/1.0 (news aggregator)',
      },
    })
    if (!response.ok) return []
    const xml = await response.text()
    return parseRssItems(xml, source.name)
  } catch {
    return []
  } finally {
    clearTimeout(timeout)
  }
}

function uniqueSources(items: ReturnType<typeof parseRssItems>): string[] {
  return [...new Set(items.map((item) => item.source))]
}

function jsonResponse(body: Record<string, unknown>, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      ...extraHeaders,
    },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const clientIp = getClientIp(req)
  if (isRateLimited(clientIp)) {
    return jsonResponse(
      { error: 'Rate limit exceeded. Try again later.' },
      429,
      { 'Retry-After': '3600' },
    )
  }

  if (cache && isCacheFresh(cache)) {
    return jsonResponse({
      items: cache.items,
      fetchedAt: cache.fetchedAt,
      sources: cache.sources,
      cached: true,
    })
  }

  const results = await Promise.all(RSS_SOURCES.map((source) => fetchRssFeed(source)))
  const successfulSources = RSS_SOURCES
    .map((source, index) => (results[index].length > 0 ? source.name : null))
    .filter((name): name is string => name !== null)
  const uniqueSuccessfulSources = [...new Set(successfulSources)]

  const items = mergeNewsFeeds(results)

  if (items.length > 0) {
    const fetchedAt = new Date().toISOString()
    const sources = uniqueSources(items)
    cache = { items, fetchedAt, sources }
    return jsonResponse({ items, fetchedAt, sources, cached: false })
  }

  if (cache) {
    return jsonResponse({
      items: cache.items,
      fetchedAt: cache.fetchedAt,
      sources: cache.sources,
      cached: true,
    })
  }

  return jsonResponse(
    {
      items: [],
      fetchedAt: new Date().toISOString(),
      sources: uniqueSuccessfulSources,
      cached: false,
      error: 'All news feeds failed',
    },
    502,
  )
})
