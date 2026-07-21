import { useSettingsStore } from '@/store/settingsStore';
import type { TradeOrder, OrderResult, OrderStatusResult, CancelOrderResult } from './orderTypes';
import {
  parseCoinbaseApiErrorBody,
  parseCoinbaseOrderStatusResponse,
  parseCoinbasePlaceOrderResponse,
  resolveCoinbaseOrder,
} from './coinbaseApiTypes';

export type { TradeOrder, OrderResult } from './orderTypes';

function mapCoinbaseStatus(status: string): OrderStatusResult['status'] {
  const s = status.toUpperCase();
  if (s === 'FILLED' || s === 'DONE') return 'filled';
  if (s === 'CANCELLED' || s === 'CANCELED') return 'cancelled';
  if (s === 'OPEN' || s === 'PENDING' || s === 'QUEUED') return 'open';
  if (s.includes('PARTIAL')) return 'partially_filled';
  return 'unknown';
}

export async function getCoinbaseOrderStatus(
  orderId: string,
  _productId: string,
  creds: { cdpKeyName?: string; cdpPrivateKey?: string },
): Promise<OrderStatusResult> {
  if (orderId.startsWith('dry-run-') || orderId.startsWith('paper-')) {
    return { status: 'filled', venueOrderId: orderId, filledQty: 0 };
  }

  const cdpKeyName = creds.cdpKeyName ?? useSettingsStore.getState().cdpKeyName;
  const cdpPrivateKey = creds.cdpPrivateKey ?? useSettingsStore.getState().cdpPrivateKey;
  if (!cdpKeyName || !cdpPrivateKey) {
    return { status: 'unknown', error: 'Coinbase CDP keys not configured' };
  }

  try {
    const path = `/api/v3/brokerage/orders/historical/${orderId}`;
    const jwt = await createJWT(cdpKeyName, cdpPrivateKey, 'GET', path);
    const res = await fetch(BASE_URL + path, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const data = parseCoinbaseOrderStatusResponse(await res.json());
    if (!res.ok) {
      return { status: 'unknown', error: data.message || 'Status fetch failed' };
    }

    const order = resolveCoinbaseOrder(data);
    const filled = parseFloat(order.filled_size ?? order.filled_value ?? '0') || 0;
    const requested = parseFloat(order.order_configuration?.market_market_ioc?.base_size ?? '0') || filled;

    return {
      status: mapCoinbaseStatus(order.status ?? 'UNKNOWN'),
      venueOrderId: orderId,
      filledQty: filled,
      requestedQty: requested,
      avgFillPrice: parseFloat(order.average_filled_price ?? '0') || undefined,
    };
  } catch (err) {
    return {
      status: 'unknown',
      error: err instanceof Error ? err.message : 'Status fetch failed',
    };
  }
}

export async function cancelCoinbaseOrder(
  orderId: string,
  _productId: string,
  creds: { cdpKeyName?: string; cdpPrivateKey?: string },
): Promise<CancelOrderResult> {
  if (orderId.startsWith('dry-run-') || orderId.startsWith('paper-')) {
    return { success: true };
  }

  const cdpKeyName = creds.cdpKeyName ?? useSettingsStore.getState().cdpKeyName;
  const cdpPrivateKey = creds.cdpPrivateKey ?? useSettingsStore.getState().cdpPrivateKey;
  if (!cdpKeyName || !cdpPrivateKey) {
    return { success: false, error: 'Coinbase CDP keys not configured' };
  }

  try {
    const path = '/api/v3/brokerage/orders/batch_cancel';
    const jwt = await createJWT(cdpKeyName, cdpPrivateKey, 'POST', path);
    const res = await fetch(BASE_URL + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ order_ids: [orderId] }),
    });
    const data = parseCoinbaseApiErrorBody(await res.json());
    if (!res.ok) {
      return { success: false, error: data.message || data.error || 'Cancel failed' };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Cancel failed',
    };
  }
}

const BASE_URL = 'https://api.coinbase.com';

async function createJWT(keyName: string, privateKeyPem: string, method: string, path: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const uri = `${method} api.coinbase.com${path}`;

  const payload = {
    sub: keyName,
    iss: 'cdp',
    nbf: now,
    exp: now + 120,
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

  const data = parseCoinbasePlaceOrderResponse(await response.json());

  if (!response.ok) {
    return { success: false, error: data.message || 'Unknown error' };
  }

  return { success: true, order_id: data.order_id };
}

export async function testCoinbaseConnection(creds: {
  cdpKeyName?: string;
  cdpPrivateKey?: string;
}): Promise<boolean> {
  const cdpKeyName = creds.cdpKeyName;
  const cdpPrivateKey = creds.cdpPrivateKey;

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

/** @deprecated Use adapter.testConnection or testCoinbaseConnection with explicit creds */
export async function testConnection(): Promise<boolean> {
  const { cdpKeyName, cdpPrivateKey } = useSettingsStore.getState();
  return testCoinbaseConnection({ cdpKeyName, cdpPrivateKey });
}
