import type {
  AppSupabaseClient,
  AuthCredentialsResult,
  AuthSessionResult,
  AuthStateChangeCallback,
  AuthUserResult,
  FunctionsInvokeResult,
} from './supabaseTypes';

const AUTH_DISABLED_MESSAGE = 'Auth disabled — Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)';

function authDisabledResult(): AuthCredentialsResult {
  return {
    data: { user: null, session: null },
    error: { message: AUTH_DISABLED_MESSAGE, name: 'AuthApiError', status: 503 } as AuthCredentialsResult['error'],
  };
}

function functionsDisabledResult<T>(): FunctionsInvokeResult<T> {
  return {
    data: null,
    error: {
      message: 'Edge Functions unavailable — configure Supabase or sign in after deployment',
      name: 'FunctionsRelayError',
      context: {},
    } as FunctionsInvokeResult<T>['error'],
  };
}

/**
 * Typed offline stub when env vars are absent. Implements only methods the app calls.
 */
export function createMockSupabaseClient(): AppSupabaseClient {
  const listeners = new Set<AuthStateChangeCallback>();

  return {
    auth: {
      getUser: (): Promise<AuthUserResult> => Promise.resolve({
        data: { user: null },
        error: null,
      }),
      getSession: (): Promise<AuthSessionResult> => Promise.resolve({
        data: { session: null },
        error: null,
      }),
      signInWithPassword: (): Promise<AuthCredentialsResult> => Promise.resolve(authDisabledResult()),
      signUp: (): Promise<AuthCredentialsResult> => Promise.resolve(authDisabledResult()),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: (callback: AuthStateChangeCallback) => {
        listeners.add(callback);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                listeners.delete(callback);
              },
            },
          },
        };
      },
    },
    functions: {
      invoke: <T = unknown>(): Promise<FunctionsInvokeResult<T>> => Promise.resolve(functionsDisabledResult<T>()),
    },
    from: <T = unknown>(_table: string) => ({
      select: (_columns?: string) => ({
        eq: (_column: string, _value: unknown) => ({
          order: (_col: string, _options?: { ascending?: boolean }) => ({
            limit: (_count: number) => Promise.resolve({ data: [] as T[], error: null }),
          }),
        }),
        order: (_col: string, _options?: { ascending?: boolean }) => ({
          limit: (_count: number) => Promise.resolve({ data: [] as T[], error: null }),
        }),
      }),
      upsert: (_values: unknown, _options?: { onConflict?: string; ignoreDuplicates?: boolean }) =>
        Promise.resolve({
          data: null as T | null,
          error: null,
        }),
      insert: (_values: unknown) =>
        Promise.resolve({
          data: null as T | null,
          error: null,
        }),
      update: (_values: unknown) => ({
        eq: (_column: string, _value: unknown) => {
          const result = Promise.resolve({ data: null as T | null, error: null });
          return Object.assign(result, {
            eq: (_col2: string, _val2: unknown) =>
              Promise.resolve({ data: null as T | null, error: null }),
          });
        },
      }),
    }),
  };
}
