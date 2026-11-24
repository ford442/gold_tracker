import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  buildUpstreamUrl,
  createProxyEngine,
  parseProxyRequest,
  type ProxyRoute,
  type UpstreamResult,
} from '../_shared/coingeckoProxy.ts'

/**
 * Read-through cache for the two CoinGecko endpoints GoldTrackr uses:
 *   GET …/coingecko-proxy/coins/markets?ids=…&sparkline=…&price_change_percentage=…
 *   GET …/coingecko-proxy/coins/{id}/market_chart?days=…&interval=…
 *
 * The optional `COINGECKO_API_KEY` secret (a free CoinGecko *demo* key) is added
 * server-side, so it never ships in the browser bundle. Validation, caching,
 * stale-on-error and 429 cooldown live in `shared/coingeckoProxy.ts` (unit-tested).
 */

// CORS must be on EVERY response — including 4xx/5xx — otherwise the browser
// reports a plain "CORS error" and hides the real status from the client.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
  // Not CORS-safelisted, so the client can only read them if exposed.
  'Access-Control-Expose-Headers': 'retry-after, x-gt-cache, x-gt-proxy',
}

const UPSTREAM_TIMEOUT_MS = 10_000
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const RATE_LIMIT_MAX = 600
const RATE_LIMIT_SWEEP_AT = 1000

interface RateLimitEntry {
  count: number
  windowStart: number
}

const engine = createProxyEngine()
const rateLimits = new Map<string, RateLimitEntry>()

function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()

  if (rateLimits.size > RATE_LIMIT_SWEEP_AT) {
    for (const [key, entry] of rateLimits) {
      if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) rateLimits.delete(key)
    }
  }

  const entry = rateLimits.get(ip)
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimits.set(ip, { count: 1, windowStart: now })
    return false
  }
  if (entry.count >= RATE_LIMIT_MAX) return true
  entry.count += 1
  return false
}

async function fetchUpstream(route: ProxyRoute): Promise<UpstreamResult> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const apiKey = Deno.env.get('COINGECKO_API_KEY')
  if (apiKey) headers['x-cg-demo-api-key'] = apiKey

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    const res = await fetch(buildUpstreamUrl(route), { headers, signal: controller.signal })
    const body = await res.text()
    const retryAfter = Number(res.headers.get('retry-after'))
    return {
      status: res.status,
      body,
      retryAfterSec: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    }
  } catch {
    return { status: 0, body: '' }
  } finally {
    clearTimeout(timeout)
  }
}

function jsonResponse(body: string, status: number, extra: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-GT-Proxy': '1', // lets the client tell "our proxy answered" from "gateway/404"
      ...extra,
    },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return jsonResponse(JSON.stringify({ error: 'Method not allowed' }), 405)
  }

  const url = new URL(req.url)
  const parsed = parseProxyRequest(url.pathname, url.searchParams)
  if (!parsed.ok) {
    return jsonResponse(JSON.stringify({ error: parsed.error }), parsed.status)
  }

  if (isRateLimited(getClientIp(req))) {
    return jsonResponse(
      JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
      429,
      { 'Retry-After': '300' },
    )
  }

  const outcome = await engine.handle(parsed.route, fetchUpstream)

  const extra: Record<string, string> = { 'X-GT-Cache': outcome.cache }
  if (outcome.maxAgeSec > 0) extra['Cache-Control'] = `public, max-age=${outcome.maxAgeSec}`
  if (outcome.retryAfterSec !== undefined) extra['Retry-After'] = String(outcome.retryAfterSec)

  return jsonResponse(outcome.body, outcome.status, extra)
})
