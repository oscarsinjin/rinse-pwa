import { PrimaryButton, useAuth, type Order, type OrderItem, type PartnerAvailability } from '@rinse/shared';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type OrderWithItems = Order & { order_items: OrderItem[] };

export default function PartnerHomeScreen() {
  const theme = useTheme();
  const { profile } = useAuth();
  const [availability, setAvailability] = useState<PartnerAvailability[]>([]);
  const [incoming, setIncoming] = useState<OrderWithItems[]>([]);
  const [inProgress, setInProgress] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    const [availabilityRes, incomingRes, inProgressRes] = await Promise.all([
      supabase.from('partner_availability').select('*').eq('partner_id', profile.id),
      supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('partner_id', profile.id)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: true }),
      supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('partner_id', profile.id)
        .eq('status', 'washing')
        .order('created_at', { ascending: true }),
    ]);
    setAvailability(availabilityRes.data ?? []);
    setIncoming((incomingRes.data as OrderWithItems[]) ?? []);
    setInProgress((inProgressRes.data as OrderWithItems[]) ?? []);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
    if (!profile) return;
    const channel = supabase
      .channel(`partner-orders-${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `partner_id=eq.${profile.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, load]);

  async function toggleDay(weekday: number) {
    if (!profile) return;
    const existing = availability.find((a) => a.weekday === weekday);
    if (existing) {
      await supabase.from('partner_availability').delete().eq('id', existing.id);
    } else {
      await supabase
        .from('partner_availability')
        .insert({ partner_id: profile.id, weekday, start_time: '00:00', end_time: '23:59', is_active: true });
    }
    load();
  }

  async function handleAccept(order: OrderWithItems) {
    // TODO: also insert the pickup-leg order_trip row here once the driver-dispatch edge function exists.
    await supabase.from('orders').update({ status: 'pickup_dispatching' }).eq('id', order.id);
  }

  async function handleDecline(order: OrderWithItems) {
    await supabase.from('orders').update({ status: 'pending_match', partner_id: null }).eq('id', order.id);
  }

  async function handleMarkDone(order: OrderWithItems) {
    // TODO: trigger the delivery-leg driver dispatch edge function here.
    await supabase.from('orders').update({ status: 'ready_for_delivery' }).eq('id', order.id);
  }

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      contentContainerStyle={styles.container}>
      <ThemedText type="title" style={{ fontSize: 28, marginBottom: 16 }}>
        Today
      </ThemedText>

      <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginBottom: 8 }}>
        AVAILABILITY
      </ThemedText>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((label, weekday) => {
          const isActive = availability.some((a) => a.weekday === weekday && a.is_active);
          return (
            <Pressable key={label} onPress={() => toggleDay(weekday)}>
              <View
                style={[
                  styles.dayChip,
                  { backgroundColor: isActive ? theme.tint : theme.backgroundElement },
                ]}>
                <ThemedText style={isActive ? { color: '#fff' } : undefined} type="small">
                  {label}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>

      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
        INCOMING ORDERS ({incoming.length})
      </ThemedText>
      {incoming.length === 0 && (
        <ThemedText themeColor="textSecondary" style={{ marginBottom: 16 }}>
          No new orders right now.
        </ThemedText>
      )}
      {incoming.map((order) => (
        <ThemedView key={order.id} type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Order #{order.id.slice(0, 8)}</ThemedText>
          {order.order_items.map((item) => (
            <ThemedText key={item.id} themeColor="textSecondary" type="small">
              {item.quantity}x {item.category}
            </ThemedText>
          ))}
          <ThemedText style={{ marginVertical: 8 }}>R{order.total.toFixed(2)}</ThemedText>
          <View style={styles.actionRow}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Decline" variant="outline" onPress={() => handleDecline(order)} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Accept" onPress={() => handleAccept(order)} />
            </View>
          </View>
        </ThemedView>
      ))}

      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
        IN PROGRESS ({inProgress.length})
      </ThemedText>
      {inProgress.map((order) => (
        <ThemedView key={order.id} type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Order #{order.id.slice(0, 8)}</ThemedText>
          {order.order_items.map((item) => (
            <ThemedText key={item.id} themeColor="textSecondary" type="small">
              {item.quantity}x {item.category}
            </ThemedText>
          ))}
          <View style={{ marginTop: 8 }}>
            <PrimaryButton label="Mark done" onPress={() => handleMarkDone(order)} />
          </View>
        </ThemedView>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  weekRow: { flexDirection: 'row', gap: 6, marginBottom: 24 },
  dayChip: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { marginBottom: 8, marginTop: 8 },
  card: { borderRadius: 14, padding: 16, marginBottom: 12, gap: 2 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
});
