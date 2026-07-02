import { PrimaryButton, type Order, type PartnerProfile } from '@rinse/shared';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type MatchedPartner = Pick<PartnerProfile, 'user_id' | 'business_name' | 'rating_avg' | 'rating_count'>;

export default function MatchingScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [partner, setPartner] = useState<MatchedPartner | null>(null);
  const [status, setStatus] = useState<'matching' | 'matched' | 'none' | 'paying'>('matching');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    findMatch();
  }, [orderId]);

  async function findMatch() {
    setStatus('matching');

    const { data: orderRow } = await supabase
      .from('orders')
      .select('*, service_tiers(category)')
      .eq('id', orderId)
      .single();
    if (!orderRow) return;
    setOrder(orderRow);

    // Simplified matching stub: best-rated approved partner of the right type.
    // TODO: replace with the nearest-first dispatch edge function (distance + timed accept/decline).
    const partnerType = orderRow.service_tiers?.category === 'everyday' ? 'home' : 'laundromat';
    const { data: matched } = await supabase
      .from('partner_public')
      .select('user_id, business_name, rating_avg, rating_count')
      .eq('partner_type', partnerType)
      .order('rating_avg', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!matched) {
      setStatus('none');
      return;
    }
    setPartner(matched);
    setStatus('matched');
  }

  async function handleConfirmAndPay() {
    if (!order || !partner) return;
    setStatus('paying');
    setError(null);
    try {
      await supabase.from('orders').update({ partner_id: partner.user_id, status: 'confirmed' }).eq('id', order.id);

      const { data, error: fnError } = await supabase.functions.invoke('payfast-checkout', {
        body: { orderId: order.id },
      });
      if (fnError) throw fnError;

      if (data?.redirectUrl) {
        await WebBrowser.openBrowserAsync(data.redirectUrl);
      }

      router.replace({ pathname: '/order/[id]', params: { id: order.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start payment. Try again.');
      setStatus('matched');
    }
  }

  if (status === 'matching') {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" />
        <ThemedText style={{ marginTop: 16 }}>Finding your partner...</ThemedText>
      </ThemedView>
    );
  }

  if (status === 'none') {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle" style={{ fontSize: 20, marginBottom: 8 }}>
          No partners available right now
        </ThemedText>
        <ThemedText themeColor="textSecondary">Please try again shortly.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={{ fontSize: 24, marginBottom: 24 }}>
        You&apos;re matched!
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          PARTNER
        </ThemedText>
        <ThemedText type="subtitle" style={{ fontSize: 22 }}>
          {partner?.business_name || 'Rinse partner'}
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          ⭐ {partner?.rating_avg.toFixed(1) ?? '—'} ({partner?.rating_count ?? 0} ratings)
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={{ marginTop: 8 }}>
          Estimated turnaround: 24-48 hours
        </ThemedText>
      </ThemedView>

      {order && (
        <ThemedText style={{ marginBottom: 16 }}>Total to pay: R{order.total.toFixed(2)}</ThemedText>
      )}

      {error && <ThemedText style={{ color: '#E5484D', marginBottom: 12 }}>{error}</ThemedText>}

      <PrimaryButton label="Confirm & Pay" onPress={handleConfirmAndPay} loading={status === 'paying'} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { borderRadius: 16, padding: 20, gap: 6, marginBottom: 24 },
});
