export type UserRole = 'customer' | 'partner' | 'driver';
export type ApprovalStatus = 'pending' | 'approved' | 'suspended' | 'rejected';
export type PartnerType = 'home' | 'laundromat';
export type VehicleType = 'bike' | 'car' | 'van' | 'bakkie';
export type ServiceCategory = 'everyday' | 'formal_delicate';

export type OrderStatus =
  | 'pending_match'
  | 'confirmed'
  | 'pickup_dispatching'
  | 'picked_up'
  | 'washing'
  | 'ready_for_delivery'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type TripLeg = 'pickup' | 'delivery';
export type TripStatus = 'pending' | 'offered' | 'accepted' | 'en_route' | 'completed' | 'cancelled';
export type OfferStatus = 'offered' | 'accepted' | 'declined' | 'expired';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod = 'card' | 'eft';
export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';
export type RatingTarget = 'partner' | 'driver' | 'service';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  customer_id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  suburb: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  lat: number;
  lng: number;
  is_default: boolean;
  created_at: string;
}

export interface PartnerProfile {
  user_id: string;
  business_name: string | null;
  partner_type: PartnerType;
  status: ApprovalStatus;
  lat: number | null;
  lng: number | null;
  service_radius_km: number;
  rating_avg: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
}

export interface PartnerAvailability {
  id: string;
  partner_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface DriverProfile {
  user_id: string;
  vehicle_type: VehicleType | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  status: ApprovalStatus;
  is_online: boolean;
  current_lat: number | null;
  current_lng: number | null;
  rating_avg: number;
  rating_count: number;
  acceptance_rate: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceTier {
  id: string;
  name: string;
  description: string | null;
  category: ServiceCategory;
  base_price: number;
  price_per_kg: number | null;
  turnaround_hours: number;
  is_active: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  address_id: string;
  service_tier_id: string;
  partner_id: string | null;
  status: OrderStatus;
  scheduled_for: string | null;
  subtotal: number;
  service_fee: number;
  total: number;
  payment_status: PaymentStatus;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  category: string;
  quantity: number;
  notes: string | null;
  photo_url: string | null;
}

export interface OrderTrip {
  id: string;
  order_id: string;
  leg: TripLeg;
  driver_id: string | null;
  status: TripStatus;
  pickup_photo_url: string | null;
  pickup_pin: string | null;
  picked_up_at: string | null;
  delivery_photo_url: string | null;
  delivered_at: string | null;
  dispatched_at: string | null;
  accepted_at: string | null;
  created_at: string;
}

export interface DispatchOffer {
  id: string;
  order_id: string | null;
  order_trip_id: string | null;
  candidate_id: string;
  distance_km: number | null;
  status: OfferStatus;
  offered_at: string;
  expires_at: string;
  responded_at: string | null;
}

export interface Rating {
  id: string;
  order_id: string;
  rater_id: string;
  target: RatingTarget;
  ratee_id: string | null;
  stars: number;
  comment: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  provider: string;
  provider_reference: string | null;
  method: PaymentMethod | null;
  amount: number;
  status: PaymentStatus;
  created_at: string;
}

export interface BankAccount {
  id: string;
  owner_id: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  branch_code: string;
  created_at: string;
}

export interface Payout {
  id: string;
  owner_id: string;
  bank_account_id: string;
  amount: number;
  status: PayoutStatus;
  requested_at: string;
  paid_at: string | null;
}
