/** Mask a secret string — shows only the last `tail` characters. */
export function maskSecret(value: string, tail = 4): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length <= tail) return '••••';
  return `••••${trimmed.slice(-tail)}`;
}

/**
 * Mask a Coinbase CDP key name path:
 * `organizations/{org}/apiKeys/{id}` → `organizations/…/apiKeys/••••{tail}`
 */
export function maskCdpKeyName(keyName: string): string {
  const trimmed = keyName.trim();
  if (!trimmed) return '';

  const apiKeysIdx = trimmed.lastIndexOf('/apiKeys/');
  if (apiKeysIdx >= 0) {
    const idPart = trimmed.slice(apiKeysIdx + '/apiKeys/'.length);
    return `organizations/…/apiKeys/${maskSecret(idPart, 6)}`;
  }

  if (trimmed.startsWith('organizations/')) {
    const last = trimmed.split('/').pop() ?? '';
    return `organizations/…/${maskSecret(last, 6)}`;
  }

  return maskSecret(trimmed, 6);
}

/** Human-readable storage status for settings UI. */
export function describeStoredKey(
  exchange: 'coinbase' | 'kraken',
  keys: { cdpKeyName?: string; cdpPrivateKey?: string; krakenApiKey?: string; krakenApiSecret?: string },
  storage: 'local' | 'server',
): string | null {
  if (exchange === 'coinbase') {
    const hasName = Boolean(keys.cdpKeyName?.trim());
    const hasPrivate = Boolean(keys.cdpPrivateKey?.trim());
    if (!hasName && !hasPrivate) return null;
    const where = storage === 'server' ? 'encrypted on server' : 'stored in this browser only';
    const namePart = hasName ? `Key name ${maskCdpKeyName(keys.cdpKeyName!)}` : 'Key name missing';
    const pemPart = hasPrivate ? 'private key on file' : 'private key missing';
    return `${namePart}, ${pemPart} (${where})`;
  }

  const hasKey = Boolean(keys.krakenApiKey?.trim());
  const hasSecret = Boolean(keys.krakenApiSecret?.trim());
  if (!hasKey && !hasSecret) return null;
  const where = storage === 'server' ? 'encrypted on server' : 'stored in this browser only';
  return `API key ${maskSecret(keys.krakenApiKey ?? '', 4)}, secret ${hasSecret ? 'on file' : 'missing'} (${where})`;
}
