import { describe, it, expect } from 'vitest';
import { createMockSupabaseClient } from '@/lib/supabaseMock';

describe('createMockSupabaseClient', () => {
  it('returns null session and disabled auth errors', async () => {
    const client = createMockSupabaseClient();
    const session = await client.auth.getSession();
    expect(session.data.session).toBeNull();

    const signIn = await client.auth.signInWithPassword({ email: 'a@b.c', password: 'x' });
    expect(signIn.error?.message).toMatch(/not configured/i);
  });

  it('rejects edge function invocations', async () => {
    const client = createMockSupabaseClient();
    const { error } = await client.functions.invoke('store-key', { body: {} });
    expect(error?.message).toMatch(/unavailable/i);
  });
});
