import { OrderStatusBadge, useAuth, type Order } from '@rinse/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

export default function OrdersScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false });
    setOrders(data ?? []);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onRefresh={loadOrders}
        refreshing={false}
        ListEmptyComponent={
          <ThemedView style={styles.centered}>
            <ThemedText themeColor="textSecondary">No orders yet.</ThemedText>
          </ThemedView>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/order/[id]', params: { id: item.id } })}>
            <ThemedView type="backgroundElement" style={styles.row}>
              <ThemedView style={{ gap: 4 }}>
                <ThemedText type="smallBold">
                  {new Date(item.created_at).toLocaleDateString('en-ZA', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                  R{item.total.toFixed(2)}
                </ThemedText>
              </ThemedView>
              <OrderStatusBadge status={item.status} />
            </ThemedView>
          </Pressable>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  list: { padding: 24, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    padding: 16,
  },
});
