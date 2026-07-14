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
  };
}
