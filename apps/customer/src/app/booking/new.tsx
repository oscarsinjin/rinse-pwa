import { PrimaryButton, useAuth, type ServiceTier } from '@rinse/shared';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const ITEM_CATEGORIES = ['Shirts', 'T-shirts', 'Trousers', 'Bedding', 'Towels', 'Suits', 'Dresses'];

export default function NewBookingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();

  const [tiers, setTiers] = useState<ServiceTier[]>([]);
  const [loadingTiers, setLoadingTiers] = useState(true);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);

  const [isAsap, setIsAsap] = useState(true);

  const [line1, setLine1] = useState('');
  const [suburb, setSuburb] = useState('');
  const [city, setCity] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('service_tiers')
      .select('*')
      .eq('is_active', true)
      .order('base_price', { ascending: true })
      .then(({ data }) => {
        setTiers(data ?? []);
        setLoadingTiers(false);
      });
  }, []);

  async function handleUseCurrentLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied. Enter your address manually.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });

      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      if (place) {
        setLine1([place.streetNumber, place.street].filter(Boolean).join(' '));
        setSuburb(place.district ?? place.subregion ?? '');
        setCity(place.city ?? '');
      }
    } catch {
      setError('Could not get your location. Enter your address manually.');
    } finally {
      setLocating(false);
    }
  }

  function adjustQuantity(category: string, delta: number) {
    setQuantities((prev) => {
      const next = Math.max(0, (prev[category] ?? 0) + delta);
      return { ...prev, [category]: next };
    });
  }

  const totalItems = Object.values(quantities).reduce((sum, n) => sum + n, 0);
  const selectedTier = tiers.find((t) => t.id === selectedTierId) ?? null;
  const estimatedTotal = selectedTier
    ? selectedTier.base_price + (selectedTier.price_per_kg ?? 0) * Math.max(totalItems, 1) * 0.5
    : 0;

  const canSubmit = !!profile && !!selectedTier && !!line1 && totalItems > 0 && !submitting;

  async function handleSubmit() {
    if (!profile || !selectedTier) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data: address, error: addressError } = await supabase
        .from('addresses')
        .insert({
          customer_id: profile.id,
          line1,
          suburb,
          city,
          lat: coords?.lat ?? 0,
          lng: coords?.lng ?? 0,
          is_default: true,
        })
        .select()
        .single();
      if (addressError) throw addressError;

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: profile.id,
          address_id: address.id,
          service_tier_id: selectedTier.id,
          status: 'pending_match',
          scheduled_for: isAsap ? null : new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
          subtotal: estimatedTotal,
          service_fee: 0,
          total: estimatedTotal,
        })
        .select()
        .single();
      if (orderError) throw orderError;

      const items = Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([category, quantity]) => ({ order_id: order.id, category, quantity }));
      if (items.length > 0) {
        const { error: itemsError } = await supabase.from('order_items').insert(items);
        if (itemsError) throw itemsError;
      }

      router.replace({ pathname: '/booking/matching', params: { orderId: order.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your order. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title" style={{ fontSize: 28, marginBottom: 24 }}>
        Schedule a pickup
      </ThemedText>

      <Section title="When">
        <View style={styles.toggleRow}>
          <ToggleChip label="ASAP" selected={isAsap} onPress={() => setIsAsap(true)} theme={theme} />
          <ToggleChip label="Later today" selected={!isAsap} onPress={() => setIsAsap(false)} theme={theme} />
        </View>
      </Section>

      <Section title="Pickup address">
        <PrimaryButton
          label="Use current location"
          variant="outline"
          onPress={handleUseCurrentLocation}
          loading={locating}
        />
        <TextInput
          value={line1}
          onChangeText={setLine1}
          placeholder="Street address"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />
        <TextInput
          value={suburb}
          onChangeText={setSuburb}
          placeholder="Suburb"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />
        <TextInput
          value={city}
          onChangeText={setCity}
          placeholder="City"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />
      </Section>

      <Section title="Service tier">
        {loadingTiers ? (
          <ActivityIndicator />
        ) : (
          tiers.map((tier) => (
            <Pressable key={tier.id} onPress={() => setSelectedTierId(tier.id)}>
              <ThemedView
                type={selectedTierId === tier.id ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.tierCard}>
                <ThemedText type="smallBold">{tier.name}</ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                  {tier.description}
                </ThemedText>
                <ThemedText type="small" style={{ marginTop: 4 }}>
                  From R{tier.base_price.toFixed(0)} ·{' '}
                  {tier.category === 'everyday' ? 'Home partners' : 'Laundromat partners'}
                </ThemedText>
              </ThemedView>
            </Pressable>
          ))
        )}
      </Section>

      <Section title="Items">
        {ITEM_CATEGORIES.map((category) => (
          <View key={category} style={styles.itemRow}>
            <ThemedText style={{ flex: 1 }}>{category}</ThemedText>
            <Pressable onPress={() => adjustQuantity(category, -1)} style={styles.stepperButton}>
              <ThemedText type="smallBold">-</ThemedText>
            </Pressable>
            <ThemedText style={styles.stepperValue}>{quantities[category] ?? 0}</ThemedText>
            <Pressable onPress={() => adjustQuantity(category, 1)} style={styles.stepperButton}>
              <ThemedText type="smallBold">+</ThemedText>
            </Pressable>
          </View>
        ))}
      </Section>

      {selectedTier && totalItems > 0 && (
        <ThemedText style={{ marginBottom: 12 }}>Estimated total: R{estimatedTotal.toFixed(2)}</ThemedText>
      )}
      {error && <ThemedText style={{ color: '#E5484D', marginBottom: 12 }}>{error}</ThemedText>}

      <PrimaryButton label="Find a partner" onPress={handleSubmit} disabled={!canSubmit} loading={submitting} />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginBottom: 8 }}>
        {title.toUpperCase()}
      </ThemedText>
      {children}
    </View>
  );
}

function ToggleChip({
  label,
  selected,
  onPress,
  theme,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  theme: { tint: string; backgroundElement: string };
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: selected ? theme.tint : theme.backgroundElement },
      ]}>
      <ThemedText style={selected ? { color: '#fff' } : undefined}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48 },
  section: { marginBottom: 24, gap: 8 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, height: 48, fontSize: 16 },
  tierCard: { borderRadius: 14, padding: 14, marginBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(128,128,128,0.15)',
  },
  stepperValue: { width: 24, textAlign: 'center' },
});
