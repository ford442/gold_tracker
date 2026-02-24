import { useSettingsStore } from '../store/settingsStore';

export interface TradeOrder {
  product_id: string;           // e.g. "PAXG-USD"
  side: 'BUY' | 'SELL';
  order_configuration: {
    market_market_ioc?: { base_size: string };
    limit_limit_gtc?: { base_size: string; limit_price: string };
  };
}

export interface OrderResult {
  success: boolean;
  order_id?: string;
  error?: string;
}

const BASE_URL = 'https://api.coinbase.com';

async function createJWT(keyName: string, privateKeyPem: string, method: string, path: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const uri = `${method} api.coinbase.com${path}`;

  const payload = {
    sub: keyName,
    iss: 'cdp',
    nbf: now,
    exp: now + 120,           // 2 minutes max
    uri: uri,
  };

  const header = {
    alg: 'ES256',
    typ: 'JWT',
    kid: keyName,
    nonce: Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
  };

  // Convert PEM → CryptoKey (browser Web Crypto)
  const pemHeader = '-----BEGIN EC PRIVATE KEY-----';
  const pemFooter = '-----END EC PRIVATE KEY-----';
  const pemContents = privateKeyPem
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\n/g, '');

  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const encoder = new TextEncoder();
  const data = encoder.encode(
    btoa(JSON.stringify(header)) + '.' + btoa(JSON.stringify(payload))
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    data
  );

  const sigArray = new Uint8Array(signature);
  const sigBase64 = btoa(String.fromCharCode(...sigArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${btoa(JSON.stringify(header))}.${btoa(JSON.stringify(payload))}.${sigBase64}`;
}

export async function placeOrder(order: TradeOrder, dryRun = true): Promise<OrderResult> {
  const { cdpKeyName, cdpPrivateKey } = useSettingsStore.getState();

  if (!cdpKeyName || !cdpPrivateKey) {
    throw new Error('Coinbase CDP keys not configured');
  }

  if (dryRun) {
    console.log('🔒 DRY RUN — would have placed order:', order);
    return { success: true, order_id: 'dry-run-' + Date.now() };
  }

  const path = '/api/v3/brokerage/orders';
  const jwt = await createJWT(cdpKeyName, cdpPrivateKey, 'POST', path);

  const response = await fetch(BASE_URL + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`,
    },
    body: JSON.stringify(order),
  });

  const data = await response.json();

  if (!response.ok) {
    return { success: false, error: data.message || 'Unknown error' };
  }

  return { success: true, order_id: data.order_id };
}

export async function testConnection(): Promise<boolean> {
  const { cdpKeyName, cdpPrivateKey } = useSettingsStore.getState();

  if (!cdpKeyName || !cdpPrivateKey) return false;

  try {
    const path = '/api/v3/brokerage/accounts';
    const jwt = await createJWT(cdpKeyName, cdpPrivateKey, 'GET', path);

    const res = await fetch(BASE_URL + path, {
      headers: { Authorization: `Bearer ${jwt}` },
    });

    return res.ok;
  } catch {
    return false;
  }
}
