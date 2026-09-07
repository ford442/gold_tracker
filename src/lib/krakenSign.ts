/**
 * Kraken Spot REST private API signing (HMAC-SHA512 + SHA256).
 * @see https://docs.kraken.com/api/docs/guides/spot-rest-auth
 */

function decodeBase64Secret(apiSecret: string): Uint8Array {
  try {
    const binary = atob(apiSecret);
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    throw new Error('Invalid Kraken API secret: expected base64-encoded key');
  }
}

function encodeBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

/** Build the exact x-www-form-urlencoded body string sent to Kraken. */
export function buildKrakenFormBody(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

/**
 * Sign a Kraken private REST request.
 * `postBody` MUST be the exact string sent as the fetch body (use `buildKrakenFormBody`).
 */
export async function signKrakenPrivateRequest(
  apiSecret: string,
  path: string,
  nonce: string,
  postBody: string,
): Promise<string> {
  const secretKey = decodeBase64Secret(apiSecret);
  const encoded = new TextEncoder().encode(nonce + postBody);

  const sha256Digest = await crypto.subtle.digest('SHA-256', encoded);
  const pathBytes = new TextEncoder().encode(path);
  const message = new Uint8Array(pathBytes.length + sha256Digest.byteLength);
  message.set(pathBytes, 0);
  message.set(new Uint8Array(sha256Digest), pathBytes.length);

  const hmacKey = await crypto.subtle.importKey(
    'raw',
    secretKey,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', hmacKey, message);
  return encodeBase64(signature);
}
