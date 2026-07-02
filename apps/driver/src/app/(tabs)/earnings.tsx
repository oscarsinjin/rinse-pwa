import { useAuth, type DriverProfile, type OrderTrip } from '@rinse/shared';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

// Placeholder flat rate per completed leg until a real per-km payout schedule is wired up.
const RATE_PER_TRIP = 35;

export default function DriverEarningsScreen() {
  const { profile } = useAuth();
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [trips, setTrips] = useState<OrderTrip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    Promise.all([
      supabase.from('driver_profiles').select('*').eq('user_id', profile.id).single(),
      supabase.from('order_trips').select('*').eq('driver_id', profile.id).eq('status', 'completed'),
    ]).then(([driverRes, tripsRes]) => {
      setDriverProfile(driverRes.data);
      setTrips(tripsRes.data ?? []);
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

  const total = trips.length * RATE_PER_TRIP;

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
          {trips.length} completed legs
        </ThemedText>
      </ThemedView>

      <View style={styles.statsRow}>
        <Stat label="Rating" value={driverProfile?.rating_avg.toFixed(1) ?? '—'} />
        <Stat label="Acceptance rate" value={`${Math.round((driverProfile?.acceptance_rate ?? 0) * 100)}%`} />
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.statCard}>
      <ThemedText type="title" style={{ fontSize: 22 }}>
        {value}
      </ThemedText>
      <ThemedText themeColor="textSecondary" type="small">
        {label}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  totalCard: { borderRadius: 16, padding: 20, gap: 4, marginBottom: 24 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, borderRadius: 14, padding: 16, gap: 2 },
});
