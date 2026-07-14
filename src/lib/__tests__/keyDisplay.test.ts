import { describe, it, expect } from 'vitest';
import { maskCdpKeyName, maskSecret } from '../keyDisplay';

describe('keyDisplay', () => {
  it('masks generic secrets', () => {
    expect(maskSecret('abcdefghij', 4)).toBe('••••ghij');
    expect(maskSecret('ab', 4)).toBe('••••');
  });

  it('masks CDP key name paths', () => {
    const path = 'organizations/org-uuid/apiKeys/key-uuid-123456';
    expect(maskCdpKeyName(path)).toBe('organizations/…/apiKeys/••••123456');
  });
});
