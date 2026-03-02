import * as jose from 'jose';

export interface CoinbaseAccount {
  id: string;
  name: string;
  currency: { code: string; name: string };
  balance: { amount: string; currency: string };
}

// Map Coinbase currency codes to internal CoinGecko-style asset IDs
export const COINBASE_CURRENCY_TO_ASSET_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  PAXG: 'pax-gold',
  XAUT: 'tether-gold',
  USDC: 'usd-coin',
  XAU: 'gold',
};

async function importPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
  const isPkcs8 = privateKeyPem.includes('-----BEGIN PRIVATE KEY-----');

  if (isPkcs8) {
    // PKCS#8 — jose.importPKCS8 returns a CryptoKey in the browser
    const key = await jose.importPKCS8(privateKeyPem, 'ES256');
    return key as CryptoKey;
  }

  // SEC1 EC key (-----BEGIN EC PRIVATE KEY-----).
  // Coinbase CDP keys use this label; strip the header and import as pkcs8
  // (Coinbase wraps the key in PKCS#8 internally despite the SEC1 header label).
  const pemBody = privateKeyPem
    .replace(/-----BEGIN EC PRIVATE KEY-----/, '')
    .replace(/-----END EC PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

export async function getCoinbaseAccounts(
  keyName: string,
  privateKeyPem: string
): Promise<CoinbaseAccount[]> {
  const path = '/api/v3/brokerage/accounts';
  const method = 'GET';
  const now = Math.floor(Date.now() / 1000);

  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const privateKey = await importPrivateKey(privateKeyPem);

  const jwt = await new jose.SignJWT({
    sub: keyName,
    iss: 'cdp',
    nbf: now,
    exp: now + 120,
    uri: `${method} api.coinbase.com${path}`,
  })
    .setProtectedHeader({ alg: 'ES256', kid: keyName, nonce })
    .sign(privateKey);

  const res = await fetch(`https://api.coinbase.com${path}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });

  if (!res.ok) {
    throw new Error(`Coinbase API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return (data.accounts ?? []) as CoinbaseAccount[];
}
