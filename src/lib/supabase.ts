import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug: Log environment variable status (remove in production)
console.log('[Supabase] URL exists:', !!supabaseUrl);
console.log('[Supabase] Key exists:', !!supabaseAnonKey);

if (!supabaseUrl) {
  throw new Error(
    'VITE_SUPABASE_URL is not defined.\n' +
    'Make sure .env.local exists with VITE_SUPABASE_URL=your_url\n' +
    'Then restart the dev server: npm run dev'
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_ANON_KEY is not defined.\n' +
    'Make sure .env.local exists with VITE_SUPABASE_ANON_KEY=your_key\n' +
    'Then restart the dev server: npm run dev'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type User = Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'];
