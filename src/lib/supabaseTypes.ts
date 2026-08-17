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

export type PostgrestQueryResult<T = unknown> = {
  data: T | null;
  error: { message: string; code?: string; details?: string; hint?: string } | null;
};

/** Supabase surface area used by GoldTrackr (auth + edge functions + table queries). */
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
  from: <T = unknown>(table: string) => {
    select: (columns?: string) => {
      eq: (column: string, value: unknown) => {
        order: (column: string, options?: { ascending?: boolean }) => {
          limit: (count: number) => Promise<PostgrestQueryResult<T[]>>;
        };
      };
      order: (column: string, options?: { ascending?: boolean }) => {
        limit: (count: number) => Promise<PostgrestQueryResult<T[]>>;
      };
    };
    upsert: (
      values: unknown,
      options?: { onConflict?: string; ignoreDuplicates?: boolean },
    ) => Promise<PostgrestQueryResult<T>>;
    insert: (values: unknown) => Promise<PostgrestQueryResult<T>>;
    update: (values: unknown) => {
      eq: (column: string, value: unknown) => {
        eq: (column2: string, value2: unknown) => Promise<PostgrestQueryResult<T>>;
      } & Promise<PostgrestQueryResult<T>>;
    };
  };
}

export type { User, Session, AuthChangeEvent };
