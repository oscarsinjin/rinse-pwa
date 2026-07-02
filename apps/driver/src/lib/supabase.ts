import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSSRSafeStorage, createSupabaseClient } from '@rinse/shared';

export const supabase = createSupabaseClient({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  storage: createSSRSafeStorage(AsyncStorage),
});
