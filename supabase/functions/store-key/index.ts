// supabase/functions/store-key/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
  const { exchange = 'coinbase', ...keys } = body

  // Validate exchange
  if (!['coinbase', 'kraken'].includes(exchange)) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid exchange. Use "coinbase" or "kraken"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Validate required keys based on exchange
  if (exchange === 'coinbase' && (!keys.cdpKeyName || !keys.cdpPrivateKey)) {
    return new Response(
      JSON.stringify({ success: false, error: 'Missing required fields: cdpKeyName and cdpPrivateKey' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (exchange === 'kraken' && (!keys.krakenApiKey || !keys.krakenApiSecret)) {
    return new Response(
      JSON.stringify({ success: false, error: 'Missing required fields: krakenApiKey and krakenApiSecret' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Encrypt with AES-GCM
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY')
  if (!encryptionKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'Server configuration error: ENCRYPTION_KEY not set' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(encryptionKey.padEnd(32).slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    encoder.encode(JSON.stringify(keys))
  )

  const encryptedPayload = 
    btoa(String.fromCharCode(...new Uint8Array(encrypted))) + '.' + 
    btoa(String.fromCharCode(...iv))

  const { error: dbError } = await supabase
    .from('user_exchange_keys')
    .upsert({
      user_id: user.id,
      exchange: exchange,
      encrypted_payload: encryptedPayload,
    }, { 
      onConflict: 'user_id,exchange',
      ignoreDuplicates: false 
    })

  if (dbError) {
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to store keys: ' + dbError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: `${exchange} keys stored securely`,
      exchange 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
