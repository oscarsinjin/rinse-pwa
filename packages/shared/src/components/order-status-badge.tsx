import { StyleSheet, Text, View } from 'react-native';

import { ORDER_STATUS_LABELS } from '../constants/order-status';
import { BrandColors } from '../theme/tokens';
import type { OrderStatus } from '../types/database';

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending_match: BrandColors.warning,
  confirmed: BrandColors.primary,
  pickup_dispatching: BrandColors.primary,
  picked_up: BrandColors.primary,
  washing: BrandColors.primary,
  ready_for_delivery: BrandColors.primary,
  out_for_delivery: BrandColors.primary,
  delivered: BrandColors.success,
  cancelled: BrandColors.danger,
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const color = STATUS_COLORS[status];

  return (
    <View style={[styles.badge, { backgroundColor: `${color}1A`, borderColor: color }]}>
      <Text style={[styles.label, { color }]}>{ORDER_STATUS_LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: { fontSize: 12, fontWeight: '600' },
});
