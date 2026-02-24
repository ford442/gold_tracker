// supabase/functions/place-trade/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as jose from 'https://esm.sh/jose@4.15.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const COINBASE_BASE_URL = 'https://api.coinbase.com'
const KRAKEN_BASE_URL = 'https://api.kraken.com'

// Supported trading pairs mapping
const PAIR_MAP: Record<string, Record<string, string>> = {
  coinbase: {
    'PAXG-USD': 'PAXG-USD',
    'XAUT-USD': 'XAUT-USD',
    'BTC-USD': 'BTC-USD',
    'ETH-USD': 'ETH-USD',
  },
  kraken: {
    'PAXG-USD': 'PAXGUSD',
    'XAUT-USD': 'XAUTUSD',
    'BTC-USD': 'XXBTZUSD',
    'ETH-USD': 'XETHZUSD',
    'PAXG-XAUT': 'PAXGXAUT', // Direct pair on Kraken!
  },
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const authHeader = req.headers.get('Authorization')!
  const token = authHeader.replace('Bearer ', '')

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const body = await req.json()
  const { order, dryRun = true, testOnly = false, exchange = 'coinbase' } = body

  // Validate exchange
  if (!['coinbase', 'kraken'].includes(exchange)) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid exchange. Use "coinbase" or "kraken"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Fetch encrypted keys for the selected exchange
  const { data: keyData, error: keyError } = await supabase
    .from('user_exchange_keys')
    .select('encrypted_payload')
    .eq('user_id', user.id)
    .eq('exchange', exchange)
    .single()

  if (keyError || !keyData?.encrypted_payload) {
    return new Response(
      JSON.stringify({ success: false, error: `No ${exchange} API keys found. Add them in Settings.` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Decrypt
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY')!
  if (!encryptionKey) throw new Error('ENCRYPTION_KEY secret not set')

  const [encryptedB64, ivB64] = keyData.encrypted_payload.split('.')

  const encryptedData = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0))
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0))

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(encryptionKey),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    encryptedData
  )

  const decrypted = JSON.parse(new TextDecoder().decode(decryptedBuffer))

  // TEST CONNECTION
  if (testOnly) {
    const success = exchange === 'kraken'
      ? await testKrakenConnection(decrypted.krakenApiKey, decrypted.krakenApiSecret)
      : await testCoinbaseConnection(decrypted.cdpKeyName, decrypted.cdpPrivateKey)
    return new Response(JSON.stringify({ success }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // EXECUTE TRADE
  let result
  if (dryRun) {
    result = {
      success: true,
      order_id: `dry-run-${Date.now()}`,
      message: `DRY RUN on ${exchange.toUpperCase()} — no real order was placed`,
      exchange,
      order: {
        ...order,
        pair: PAIR_MAP[exchange][order.product_id] || order.product_id,
      }
    }
  } else {
    result = exchange === 'kraken'
      ? await placeKrakenOrder(order, decrypted.krakenApiKey, decrypted.krakenApiSecret)
      : await placeCoinbaseOrder(order, decrypted.cdpKeyName, decrypted.cdpPrivateKey)
    result.exchange = exchange
  }

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})

// ============== COINBASE FUNCTIONS ==============

async function createCoinbaseJWT(keyName: string, privateKeyPem: string, method: string, path: string) {
  const now = Math.floor(Date.now() / 1000)
  const uri = `${method} api.coinbase.com${path}`

  const payload = {
    sub: keyName,
    iss: 'cdp',
    nbf: now,
    exp: now + 120,
    uri,
  }

  const privateKey = await jose.importPKCS8(privateKeyPem, 'ES256')

  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: keyName })
    .sign(privateKey)
}

async function testCoinbaseConnection(keyName: string, privateKeyPem: string): Promise<boolean> {
  try {
    const jwt = await createCoinbaseJWT(keyName, privateKeyPem, 'GET', '/api/v3/brokerage/accounts')
    const res = await fetch(`${COINBASE_BASE_URL}/api/v3/brokerage/accounts`, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    return res.ok
  } catch {
    return false
  }
}

async function placeCoinbaseOrder(order: Record<string, unknown>, keyName: string, privateKeyPem: string) {
  try {
    const jwt = await createCoinbaseJWT(keyName, privateKeyPem, 'POST', '/api/v3/brokerage/orders')

    const response = await fetch(`${COINBASE_BASE_URL}/api/v3/brokerage/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(order),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.message || data.error || 'Order failed' }
    }

    return { 
      success: true, 
      order_id: data.order_id || data.success_response?.order_id,
      message: 'Order placed on Coinbase'
    }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ============== KRAKEN FUNCTIONS ==============

function createKrakenSignature(apiSecret: string, path: string, nonce: string, postData: Record<string, unknown>) {
  // Full HMAC-SHA512 implementation needed for production
  // Kraken: HMAC-SHA512(path + SHA256(nonce + postData))
  const message = nonce + JSON.stringify(postData)
  const secret = Uint8Array.from(atob(apiSecret), c => c.charCodeAt(0))
  
  // Placeholder - production should implement proper HMAC-SHA512
  void message;
  void secret;
  void path;
  
  return btoa(String.fromCharCode(...new Uint8Array(64)))
}

async function testKrakenConnection(apiKey: string, apiSecret: string): Promise<boolean> {
  try {
    const nonce = Date.now().toString()
    const path = '/0/private/Balance'
    
    // For testing, just check if we can get account balance
    const response = await fetch(`${KRAKEN_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'API-Key': apiKey,
        'API-Sign': createKrakenSignature(apiSecret, path, nonce, { nonce }),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ nonce }),
    })
    
    const data = await response.json()
    return !data.error || data.error.length === 0
  } catch {
    return false
  }
}

async function placeKrakenOrder(
  order: Record<string, unknown>, 
  apiKey: string, 
  apiSecret: string
) {
  try {
    const nonce = Date.now().toString()
    const path = '/0/private/AddOrder'
    
    // Map product_id to Kraken pair format
    const krakenPair = PAIR_MAP.kraken[order.product_id as string] || order.product_id
    
    const postData: Record<string, string> = {
      nonce,
      ordertype: 'market',
      type: (order.side as string).toLowerCase(),
      volume: (order.order_configuration as Record<string, { base_size: string }>)?.market_market_ioc?.base_size || '0.1',
      pair: krakenPair as string,
    }

    // Kraken supports direct PAXG/XAUT pair!
    if (order.product_id === 'PAXG-XAUT') {
      postData.pair = 'PAXGXAUT'
    }

    const response = await fetch(`${KRAKEN_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'API-Key': apiKey,
        'API-Sign': createKrakenSignature(apiSecret, path, nonce, postData),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(postData),
    })

    const data = await response.json()

    if (data.error && data.error.length > 0) {
      return { success: false, error: data.error.join(', ') }
    }

    return { 
      success: true, 
      order_id: data.result?.txid?.[0],
      message: `Order placed on Kraken (${postData.pair})`,
      pair: postData.pair,
      description: data.result?.descr?.order
    }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
