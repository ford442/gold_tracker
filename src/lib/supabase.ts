import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug: Log environment variable status
console.log('[Supabase] URL exists:', !!supabaseUrl);
console.log('[Supabase] Key exists:', !!supabaseAnonKey);

// Create a mock client for when env vars are missing (graceful degradation)
const createMockClient = () => {
  console.warn('[Supabase] Running in mock mode - auth features disabled');
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithPassword: async () => ({ data: null, error: { message: 'Auth disabled - no Supabase config' } }),
      signUp: async () => ({ data: null, error: { message: 'Auth disabled - no Supabase config' } }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({ data: null, error: null }),
      insert: () => ({ data: null, error: null }),
      update: () => ({ data: null, error: null }),
      delete: () => ({ data: null, error: null }),
    }),
  } as any;
};

// Create real or mock client based on env vars
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : createMockClient();

export type User = Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'];
