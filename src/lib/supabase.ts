import { createClient } from '@supabase/supabase-js';
import { createMockSupabaseClient } from './supabaseMock';
import type { AppSupabaseClient } from './supabaseTypes';

export type { User } from './supabaseTypes';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl?.trim() && supabaseAnonKey?.trim(),
);

if (import.meta.env.DEV) {
  console.debug('[Supabase] configured:', isSupabaseConfigured);
}

function createAppClient(): AppSupabaseClient {
  if (!isSupabaseConfigured) {
    if (import.meta.env.DEV) {
      console.warn('[Supabase] Mock client active — auth and edge functions disabled');
    }
    return createMockSupabaseClient();
  }

  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }) as AppSupabaseClient;
}

export const supabase: AppSupabaseClient = createAppClient();
