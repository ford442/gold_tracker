import type {
  AuthChangeEvent,
  AuthError,
  FunctionsError,
  Session,
  User,
} from '@supabase/supabase-js';

export type AuthSessionResult = { data: { session: Session | null }; error: AuthError | null };
export type AuthUserResult = { data: { user: User | null }; error: AuthError | null };
export type AuthCredentialsResult = {
  data: { user: User | null; session: Session | null };
  error: AuthError | null;
};
export type FunctionsInvokeResult<T = unknown> = { data: T | null; error: FunctionsError | null };

export type AuthStateChangeCallback = (
  event: AuthChangeEvent,
  session: Session | null,
) => void;

/** Supabase surface area used by GoldTrackr (auth + edge functions). */
export interface AppSupabaseClient {
  auth: {
    getUser: () => Promise<AuthUserResult>;
    getSession: () => Promise<AuthSessionResult>;
    signInWithPassword: (credentials: {
      email: string;
      password: string;
    }) => Promise<AuthCredentialsResult>;
    signUp: (credentials: {
      email: string;
      password: string;
    }) => Promise<AuthCredentialsResult>;
    signOut: () => Promise<{ error: AuthError | null }>;
    onAuthStateChange: (
      callback: AuthStateChangeCallback,
    ) => { data: { subscription: { unsubscribe: () => void } } };
  };
  functions: {
    invoke: <T = unknown>(
      name: string,
      options?: { body?: Record<string, unknown> },
    ) => Promise<FunctionsInvokeResult<T>>;
  };
}

export type { User, Session, AuthChangeEvent };
