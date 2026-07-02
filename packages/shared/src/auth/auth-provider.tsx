import { createContext, useContext, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import { useSession, type UseSessionResult } from './use-session';
import type { UserRole } from '../types/database';

const AuthContext = createContext<UseSessionResult | null>(null);

export interface AuthProviderProps {
  supabase: SupabaseClient;
  role: UserRole;
  children: ReactNode;
}

/** Wrap the app once with this so the session/profile listener is shared, not duplicated per-screen. */
export function AuthProvider({ supabase, role, children }: AuthProviderProps) {
  const value = useSession(supabase, role);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): UseSessionResult {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
