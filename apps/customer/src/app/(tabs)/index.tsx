import { OrderStatusBadge, PrimaryButton, useAuth, type Order } from '@rinse/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const loadActiveOrder = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', profile.id)
      .not('status', 'in', '(delivered,cancelled)')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveOrder(data);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadActiveOrder();
    if (!profile) return;

    const channel = supabase
      .channel(`home-orders-${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${profile.id}` },
        () => loadActiveOrder()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, loadActiveOrder]);

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={false} onRefresh={loadActiveOrder} />}
      contentContainerStyle={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Hi{profile?.full_name ? `, ${profile.full_name}` : ''}</ThemedText>
        <ThemedText themeColor="textSecondary">What needs washing today?</ThemedText>
      </ThemedView>

      {activeOrder ? (
        <Pressable
          onPress={() => router.push({ pathname: '/order/[id]', params: { id: activeOrder.id } })}>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              ACTIVE ORDER
            </ThemedText>
            <OrderStatusBadge status={activeOrder.status} />
            <ThemedText style={{ marginTop: 8 }}>Tap to view live tracking</ThemedText>
          </ThemedView>
        </Pressable>
      ) : (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle" style={{ fontSize: 20 }}>
            No active order
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={{ marginBottom: 16 }}>
            Schedule a pickup and we&apos;ll match you with a nearby partner.
          </ThemedText>
          <PrimaryButton label="Schedule a pickup" onPress={() => router.push('/booking/new')} />
        </ThemedView>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { gap: 4, marginBottom: 8 },
  card: { borderRadius: 16, padding: 20, gap: 8 },
});
