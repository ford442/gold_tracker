// supabase/functions/test-connection/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as jose from 'https://esm.sh/jose@4.15.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const COINBASE_BASE_URL = 'https://api.coinbase.com'
const KRAKEN_BASE_URL = 'https://api.kraken.com'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(
      JSON.stringify({ success: false, error: 'Missing authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const body = await req.json()
  const { exchange = 'coinbase' } = body

  // Validate exchange
  if (!['coinbase', 'kraken'].includes(exchange)) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid exchange. Use "coinbase" or "kraken"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Fetch encrypted keys
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
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY')
  if (!encryptionKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const [encryptedB64, ivB64] = keyData.encrypted_payload.split('.')
  const encrypted = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0))
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0))

  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(encryptionKey.padEnd(32).slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  let decrypted: ArrayBuffer
  try {
    decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      keyMaterial,
      encrypted
    )
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to decrypt keys' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const decryptedStr = new TextDecoder().decode(decrypted)
  const keys = JSON.parse(decryptedStr)

  // Test connection based on exchange
  let success = false
  let message = ''

  try {
    if (exchange === 'kraken') {
      // Test Kraken connection
      const nonce = Date.now().toString()
      const path = '/0/private/Balance'
      
      const response = await fetch(`${KRAKEN_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
          'API-Key': keys.krakenApiKey,
          'API-Sign': createKrakenSignature(keys.krakenApiSecret, path, nonce, { nonce }),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ nonce }),
      })
      
      const data = await response.json()
      success = !data.error || data.error.length === 0
      message = success ? 'Kraken connection successful' : `Kraken error: ${data.error?.join(', ')}`
    } else {
      // Test Coinbase connection
      const jwt = await createCoinbaseJWT(keys.cdpKeyName, keys.cdpPrivateKey, 'GET', '/api/v3/brokerage/accounts')
      const response = await fetch(`${COINBASE_BASE_URL}/api/v3/brokerage/accounts`, {
        headers: { Authorization: `Bearer ${jwt}` },
      })

      if (response.ok) {
        const data = await response.json()
        success = true
        message = `Coinbase connection successful (${data.accounts?.length || 0} accounts)`
      } else {
        const errorData = await response.json()
        message = errorData.message || 'Coinbase connection failed'
      }
    }
  } catch (error) {
    message = error instanceof Error ? error.message : 'Connection error'
  }

  return new Response(
    JSON.stringify({ 
      success, 
      message,
      exchange 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})

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

function createKrakenSignature(apiSecret: string, _path: string, nonce: string, postData: Record<string, unknown>): string {
  const message = nonce + JSON.stringify(postData)
  
  // Note: Full HMAC-SHA512 implementation would go here using apiSecret
  // const secret = Uint8Array.from(atob(apiSecret), c => c.charCodeAt(0))
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  
  return btoa(String.fromCharCode(...new Uint8Array(data.slice(0, 64))))
}
