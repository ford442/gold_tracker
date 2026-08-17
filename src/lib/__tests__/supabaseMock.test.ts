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

  it('provides safe fallback query builder for tables', async () => {
    const client = createMockSupabaseClient();
    const res = await client
      .from('order_journal')
      .select('*')
      .eq('user_id', '123')
      .order('created_at', { ascending: false })
      .limit(10);
    expect(res.data).toEqual([]);
    expect(res.error).toBeNull();

    const upsertRes = await client.from('order_journal').upsert({ id: '1' });
    expect(upsertRes.error).toBeNull();
  });
});
