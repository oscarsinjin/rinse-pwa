import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS, PrimaryButton, type Order, type RatingTarget } from '@rinse/shared';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const RATING_TARGETS: { target: RatingTarget; label: string }[] = [
  { target: 'partner', label: 'Partner' },
  { target: 'driver', label: 'Driver' },
  { target: 'service', label: 'Overall service' },
];

export default function OrderDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [ratedTargets, setRatedTargets] = useState<Set<RatingTarget>>(new Set());

  const load = useCallback(async () => {
    const { data } = await supabase.from('orders').select('*').eq('id', id).single();
    setOrder(data);

    const { data: ratings } = await supabase.from('ratings').select('target').eq('order_id', id);
    setRatedTargets(new Set((ratings ?? []).map((r) => r.target as RatingTarget)));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`order-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  async function submitRating(target: RatingTarget, stars: number) {
    if (!order) return;
    const { data: session } = await supabase.auth.getUser();
    if (!session.user) return;
    const ratee_id = target === 'partner' ? order.partner_id : target === 'driver' ? null : null;
    await supabase.from('ratings').insert({ order_id: order.id, rater_id: session.user.id, target, ratee_id, stars });
    setRatedTargets((prev) => new Set(prev).add(target));
  }

  if (loading || !order) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const currentStageIndex = ORDER_STATUS_FLOW.indexOf(order.status);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title" style={{ fontSize: 24, marginBottom: 24 }}>
        Order tracking
      </ThemedText>

      {order.status === 'cancelled' ? (
        <ThemedText style={{ color: '#E5484D' }}>This order was cancelled.</ThemedText>
      ) : (
        <View style={{ gap: 0, marginBottom: 32 }}>
          {ORDER_STATUS_FLOW.map((stage, index) => {
            const isDone = currentStageIndex >= index;
            return (
              <View key={stage} style={styles.stageRow}>
                <View
                  style={[
                    styles.stageDot,
                    { backgroundColor: isDone ? theme.tint : theme.backgroundSelected },
                  ]}
                />
                <ThemedText
                  themeColor={isDone ? 'text' : 'textSecondary'}
                  type={isDone ? 'smallBold' : 'small'}>
                  {ORDER_STATUS_LABELS[stage]}
                </ThemedText>
              </View>
            );
          })}
        </View>
      )}

      <ThemedText style={{ marginBottom: 8 }}>Total: R{order.total.toFixed(2)}</ThemedText>
      <ThemedText themeColor="textSecondary" style={{ marginBottom: 32 }}>
        Payment: {order.payment_status}
      </ThemedText>

      {order.status === 'delivered' && (
        <ThemedView type="backgroundElement" style={styles.ratingCard}>
          <ThemedText type="smallBold" style={{ marginBottom: 12 }}>
            Rate your order
          </ThemedText>
          {RATING_TARGETS.map(({ target, label }) => (
            <RatingRow
              key={target}
              label={label}
              rated={ratedTargets.has(target)}
              onRate={(stars) => submitRating(target, stars)}
            />
          ))}
        </ThemedView>
      )}
    </ScrollView>
  );
}

function RatingRow({
  label,
  rated,
  onRate,
}: {
  label: string;
  rated: boolean;
  onRate: (stars: number) => void;
}) {
  const [stars, setStars] = useState(0);

  return (
    <View style={styles.ratingRow}>
      <ThemedText style={{ flex: 1 }}>{label}</ThemedText>
      {rated ? (
        <ThemedText themeColor="textSecondary">Rated ✓</ThemedText>
      ) : (
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable
              key={value}
              onPress={() => {
                setStars(value);
                onRate(value);
              }}>
              <ThemedText style={{ fontSize: 20 }}>{value <= stars ? '★' : '☆'}</ThemedText>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  stageDot: { width: 10, height: 10, borderRadius: 5 },
  ratingCard: { borderRadius: 16, padding: 20, gap: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
});
