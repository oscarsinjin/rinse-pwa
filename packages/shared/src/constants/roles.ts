import type { UserRole } from '../types/database';

export const ROLE_LABELS: Record<UserRole, string> = {
  customer: 'Customer',
  partner: 'Partner',
  driver: 'Driver',
};
