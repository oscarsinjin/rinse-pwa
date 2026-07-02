import {
  PrimaryButton,
  useAuth,
  type Address,
  type DispatchOffer,
  type Order,
  type OrderTrip,
} from '@rinse/shared';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { captureAndUploadPhoto } from '@/lib/upload-photo';
import { supabase } from '@/lib/supabase';

type OfferWithDetails = DispatchOffer & {
  order_trips: OrderTrip & { orders: Order & { addresses: Address } };
};

type ActiveTrip = OrderTrip & { orders: Order & { addresses: Address } };

function openInMaps(lat: number, lng: number) {
  const url = Platform.select({
    ios: `maps:0,0?q=${lat},${lng}`,
    android: `geo:0,0?q=${lat},${lng}`,
    default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  });
  Linking.openURL(url ?? '');
}

export default function DriverHomeScreen() {
  const theme = useTheme();
  const { profile } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [offers, setOffers] = useState<OfferWithDetails[]>([]);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [partnerLocation, setPartnerLocation] = useState<{ lat: number; lng: number; business_name: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const [driverRes, offersRes, tripRes] = await Promise.all([
      supabase.from('driver_profiles').select('is_online').eq('user_id', profile.id).single(),
      supabase
        .from('dispatch_offers')
        .select('*, order_trips(*, orders(*, addresses(*)))')
        .eq('candidate_id', profile.id)
        .eq('status', 'offered')
        .gt('expires_at', new Date().toISOString()),
      supabase
        .from('order_trips')
        .select('*, orders(*, addresses(*))')
        .eq('driver_id', profile.id)
        .in('status', ['accepted', 'en_route'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    setIsOnline(driverRes.data?.is_online ?? false);
    setOffers((offersRes.data as OfferWithDetails[]) ?? []);
    setActiveTrip(tripRes.data as ActiveTrip | null);

    const trip = tripRes.data as ActiveTrip | null;
    if (trip?.orders.partner_id) {
      const { data: partner } = await supabase
        .from('partner_public')
        .select('business_name')
        .eq('user_id', trip.orders.partner_id)
        .maybeSingle();
      const { data: partnerLoc } = await supabase
        .from('partner_profiles')
        .select('lat, lng')
        .eq('user_id', trip.orders.partner_id)
        .maybeSingle();
      if (partnerLoc?.lat && partnerLoc?.lng) {
        setPartnerLocation({ lat: partnerLoc.lat, lng: partnerLoc.lng, business_name: partner?.business_name ?? null });
      }
    } else {
      setPartnerLocation(null);
    }

    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
    if (!profile) return;
    const channel = supabase
      .channel(`driver-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_offers', filter: `candidate_id=eq.${profile.id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_trips', filter: `driver_id=eq.${profile.id}` }, () => load())
      .subscribe();

    const interval = setInterval(load, 15000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [profile, load]);

  async function handleToggleOnline(next: boolean) {
    if (!profile) return;
    setIsOnline(next);
    await supabase.from('driver_profiles').update({ is_online: next }).eq('user_id', profile.id);
  }

  async function handleAcceptOffer(offer: OfferWithDetails) {
    setBusy(true);
    try {
      await supabase
        .from('dispatch_offers')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', offer.id);
      await supabase
        .from('order_trips')
        .update({ driver_id: profile?.id, status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', offer.order_trip_id);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function handleDeclineOffer(offer: OfferWithDetails) {
    // TODO: a server-side dispatch function should re-offer this trip to the next-nearest driver.
    await supabase.from('dispatch_offers').update({ status: 'declined', responded_at: new Date().toISOString() }).eq('id', offer.id);
    load();
  }

  async function handleConfirmPickup() {
    if (!activeTrip) return;
    setError(null);
    setBusy(true);
    try {
      const photoUrl = await captureAndUploadPhoto(`${activeTrip.id}-pickup`);
      if (!photoUrl) return;

      await supabase
        .from('order_trips')
        .update({ status: 'en_route', picked_up_at: new Date().toISOString(), pickup_photo_url: photoUrl, pickup_pin: pin || null })
        .eq('id', activeTrip.id);

      const nextOrderStatus = activeTrip.leg === 'pickup' ? 'picked_up' : 'out_for_delivery';
      await supabase.from('orders').update({ status: nextOrderStatus }).eq('id', activeTrip.order_id);
      setPin('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm pickup.');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmDelivery() {
    if (!activeTrip) return;
    setError(null);
    setBusy(true);
    try {
      const photoUrl = await captureAndUploadPhoto(`${activeTrip.id}-delivery`);
      if (!photoUrl) return;

      await supabase
        .from('order_trips')
        .update({ status: 'completed', delivered_at: new Date().toISOString(), delivery_photo_url: photoUrl })
        .eq('id', activeTrip.id);

      const nextOrderStatus = activeTrip.leg === 'pickup' ? 'washing' : 'delivered';
      await supabase.from('orders').update({ status: nextOrderStatus }).eq('id', activeTrip.order_id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm delivery.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const destination =
    activeTrip?.status === 'accepted'
      ? activeTrip.leg === 'pickup'
        ? { lat: activeTrip.orders.addresses.lat, lng: activeTrip.orders.addresses.lng, label: activeTrip.orders.addresses.line1 }
        : partnerLocation
          ? { lat: partnerLocation.lat, lng: partnerLocation.lng, label: partnerLocation.business_name ?? 'Partner' }
          : null
      : activeTrip?.leg === 'pickup'
        ? partnerLocation
          ? { lat: partnerLocation.lat, lng: partnerLocation.lng, label: partnerLocation.business_name ?? 'Partner' }
          : null
        : activeTrip
          ? { lat: activeTrip.orders.addresses.lat, lng: activeTrip.orders.addresses.lng, label: activeTrip.orders.addresses.line1 }
          : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.goRow}>
        <ThemedText type="title" style={{ fontSize: 28 }}>
          {isOnline ? "You're online" : 'Offline'}
        </ThemedText>
        <Switch value={isOnline} onValueChange={handleToggleOnline} disabled={!!activeTrip} />
      </View>

      {error && <ThemedText style={{ color: '#E5484D', marginBottom: 12 }}>{error}</ThemedText>}

      {activeTrip ? (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {activeTrip.leg === 'pickup' ? 'PICKUP LEG' : 'DELIVERY LEG'} · ORDER #{activeTrip.order_id.slice(0, 8)}
          </ThemedText>

          {destination && (
            <>
              <ThemedText type="subtitle" style={{ fontSize: 18, marginTop: 8 }}>
                {destination.label}
              </ThemedText>
              <PrimaryButton
                label="Open in Maps"
                variant="outline"
                onPress={() => openInMaps(destination.lat, destination.lng)}
              />
            </>
          )}

          <View style={{ height: 16 }} />

          {activeTrip.status === 'accepted' ? (
            <>
              <TextInput
                value={pin}
                onChangeText={setPin}
                placeholder="PIN from customer (optional)"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
              />
              <PrimaryButton label="Confirm pickup (photo required)" onPress={handleConfirmPickup} loading={busy} />
            </>
          ) : (
            <PrimaryButton label="Confirm delivery (photo required)" onPress={handleConfirmDelivery} loading={busy} />
          )}
        </ThemedView>
      ) : isOnline ? (
        <>
          <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginBottom: 8 }}>
            JOB OFFERS
          </ThemedText>
          {offers.length === 0 && <ThemedText themeColor="textSecondary">Waiting for nearby jobs...</ThemedText>}
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} onAccept={handleAcceptOffer} onDecline={handleDeclineOffer} busy={busy} />
          ))}
        </>
      ) : (
        <ThemedText themeColor="textSecondary">Tap GO to start receiving job offers.</ThemedText>
      )}
    </ScrollView>
  );
}

function OfferCard({
  offer,
  onAccept,
  onDecline,
  busy,
}: {
  offer: OfferWithDetails;
  onAccept: (offer: OfferWithDetails) => void;
  onDecline: (offer: OfferWithDetails) => void;
  busy: boolean;
}) {
  const [secondsLeft, setSecondsLeft] = useState(
    Math.max(0, Math.round((new Date(offer.expires_at).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.round((new Date(offer.expires_at).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [offer.expires_at]);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">
        {offer.order_trips.leg === 'pickup' ? 'Pickup' : 'Delivery'} · {offer.distance_km?.toFixed(1) ?? '?'} km away
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={{ marginBottom: 8 }}>
        {offer.order_trips.orders.addresses.line1}, {offer.order_trips.orders.addresses.suburb}
      </ThemedText>
      <ThemedText style={{ marginBottom: 8 }}>Expires in {secondsLeft}s</ThemedText>
      <View style={styles.actionRow}>
        <View style={{ flex: 1 }}>
          <PrimaryButton label="Decline" variant="outline" onPress={() => onDecline(offer)} disabled={busy} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton label="Accept" onPress={() => onAccept(offer)} disabled={busy || secondsLeft === 0} />
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  goRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  card: { borderRadius: 16, padding: 20, gap: 4, marginBottom: 16 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, height: 48, fontSize: 16, marginBottom: 12 },
});
