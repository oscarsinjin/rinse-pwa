export * from './types/database';

export { createSupabaseClient } from './supabase/client';
export type { SupabaseClientConfig } from './supabase/client';
export { createSSRSafeStorage } from './supabase/ssr-safe-storage';

export { normalizeSouthAfricanPhone, isValidSouthAfricanPhone } from './auth/phone';
export { requestOtp, verifyOtp } from './auth/otp';
export type { RequestOtpParams } from './auth/otp';
export { useSession } from './auth/use-session';
export type { UseSessionResult } from './auth/use-session';
export { AuthProvider, useAuth } from './auth/auth-provider';

export { ROLE_LABELS } from './constants/roles';
export { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS } from './constants/order-status';
export { BrandColors } from './theme/tokens';

export { PrimaryButton } from './components/primary-button';
export type { PrimaryButtonProps } from './components/primary-button';
export { OrderStatusBadge } from './components/order-status-badge';
