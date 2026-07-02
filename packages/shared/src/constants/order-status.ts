import type { OrderStatus } from '../types/database';

/** Customer-visible tracking stages, in order. `pending_match` and `cancelled` are shown separately. */
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'confirmed',
  'pickup_dispatching',
  'picked_up',
  'washing',
  'ready_for_delivery',
  'out_for_delivery',
  'delivered',
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_match: 'Finding a partner',
  confirmed: 'Confirmed',
  pickup_dispatching: 'Finding a driver',
  picked_up: 'Picked up',
  washing: 'Washing',
  ready_for_delivery: 'Ready for delivery',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
