import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeSouthAfricanPhone } from './phone';
import type { UserRole, VehicleType } from '../types/database';

export interface RequestOtpParams {
  phone: string;
  role: UserRole;
  fullName?: string;
  /** Only used for role: 'driver', captured at signup per the product spec. */
  vehicleType?: VehicleType;
}

/** Sends an OTP via SMS. `role`/`fullName`/`vehicleType` are only used the first time this phone signs up. */
export async function requestOtp(supabase: SupabaseClient, { phone, role, fullName, vehicleType }: RequestOtpParams) {
  const { error } = await supabase.auth.signInWithOtp({
    phone: normalizeSouthAfricanPhone(phone),
    options: {
      data: { role, full_name: fullName, vehicle_type: vehicleType },
    },
  });

  if (error) throw error;
}

export async function verifyOtp(supabase: SupabaseClient, phone: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    phone: normalizeSouthAfricanPhone(phone),
    token,
    type: 'sms',
  });

  if (error) throw error;
  return data;
}
