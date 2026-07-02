import { useAuth, type Order } from '@rinse/shared';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function EarningsScreen() {
  const theme = useTheme();
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('orders')
      .select('*')
      .eq('partner_id', profile.id)
      .eq('status', 'delivered')
      .then(({ data }) => {
        setOrders(data ?? []);
        setLoading(false);
      });
  }, [profile]);

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const total = orders.reduce((sum, order) => sum + order.total, 0);

  const byHour = Array.from({ length: 24 }, () => 0);
  orders.forEach((order) => {
    byHour[new Date(order.created_at).getHours()] += 1;
  });
  const maxCount = Math.max(1, ...byHour);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title" style={{ fontSize: 28, marginBottom: 24 }}>
        Earnings
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.totalCard}>
        <ThemedText themeColor="textSecondary" type="smallBold">
          TOTAL EARNED
        </ThemedText>
        <ThemedText type="title" style={{ fontSize: 36 }}>
          R{total.toFixed(2)}
        </ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          {orders.length} completed orders
        </ThemedText>
      </ThemedView>

      <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginBottom: 12 }}>
        BUSY HOURS
      </ThemedText>
      <View style={styles.chart}>
        {byHour.map((count, hour) => (
          <View key={hour} style={styles.barColumn}>
            <View
              style={[
                styles.bar,
                { height: Math.max(4, (count / maxCount) * 80), backgroundColor: theme.tint },
              ]}
            />
            {hour % 6 === 0 && (
              <ThemedText themeColor="textSecondary" style={{ fontSize: 9 }}>
                {hour}h
              </ThemedText>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  totalCard: { borderRadius: 16, padding: 20, gap: 4, marginBottom: 32 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 100 },
  barColumn: { flex: 1, alignItems: 'center', gap: 4 },
  bar: { width: '100%', borderRadius: 3 },
});
