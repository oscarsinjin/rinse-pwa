import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseClientConfig {
  url: string;
  anonKey: string;
  /** Pass AsyncStorage from the app so sessions persist across launches. */
  storage: unknown;
}

export function createSupabaseClient({ url, anonKey, storage }: SupabaseClientConfig): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase config. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in this app\'s .env file.'
    );
  }

  return createClient(url, anonKey, {
    auth: {
      storage: storage as never,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
