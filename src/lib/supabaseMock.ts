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
      getUser: async (): Promise<AuthUserResult> => ({
        data: { user: null },
        error: null,
      }),
      getSession: async (): Promise<AuthSessionResult> => ({
        data: { session: null },
        error: null,
      }),
      signInWithPassword: async (): Promise<AuthCredentialsResult> => authDisabledResult(),
      signUp: async (): Promise<AuthCredentialsResult> => authDisabledResult(),
      signOut: async () => ({ error: null }),
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
      invoke: async <T = unknown>(): Promise<FunctionsInvokeResult<T>> => functionsDisabledResult<T>(),
    },
    from: <T = unknown>(_table: string) => ({
      select: (_columns?: string) => ({
        eq: (_column: string, _value: unknown) => ({
          order: (_col: string, _options?: { ascending?: boolean }) => ({
            limit: async (_count: number) => ({ data: [] as T[], error: null }),
          }),
        }),
        order: (_col: string, _options?: { ascending?: boolean }) => ({
          limit: async (_count: number) => ({ data: [] as T[], error: null }),
        }),
      }),
      upsert: async (_values: unknown, _options?: { onConflict?: string; ignoreDuplicates?: boolean }) => ({
        data: null as T | null,
        error: null,
      }),
      insert: async (_values: unknown) => ({
        data: null as T | null,
        error: null,
      }),
      update: (_values: unknown) => {
        const updatePromise = Promise.resolve({ data: null as T | null, error: null });
        return {
          eq: (_column: string, _value: unknown) => ({
            ...updatePromise,
            eq: async (_col2: string, _val2: unknown) => ({ data: null as T | null, error: null }),
            then: updatePromise.then.bind(updatePromise),
            catch: updatePromise.catch.bind(updatePromise),
            finally: updatePromise.finally.bind(updatePromise),
          }),
        };
      },
    }),
  };
}
