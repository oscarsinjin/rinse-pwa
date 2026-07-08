import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton, useAuth, type ServiceTier } from '@rinse/shared';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

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
    setError(null);
    try {
      let latitude: number;
      let longitude: number;

      if (Platform.OS === 'web') {
        // On web, navigator.geolocation is the reliable path. expo-location's
        // requestForegroundPermissionsAsync() only queries the Permissions API
        // (which returns 'undetermined' before the user has been asked) and
        // would bail out early without ever showing the browser dialog.
        const position = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
        );
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Location permission denied. Enter your address manually.');
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      }

      setCoords({ lat: latitude, lng: longitude });

      // Reverse geocode is best-effort: it requires a Google Maps key on web,
      // so failures are silenced and the user fills in the address manually.
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (place) {
          setLine1([place.streetNumber, place.street].filter(Boolean).join(' '));
          setSuburb(place.district ?? place.subregion ?? '');
          setCity(place.city ?? '');
        }
      } catch {
        // reverse geocode unavailable (e.g. web without Maps key) — coords already saved
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
    <ThemedView style={{ flex: 1 }}>
      <View style={[styles.stepHeader, { borderBottomColor: theme.backgroundElement }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.stepTitle}>Book a pickup</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.stepSub}>Step 1 of 3</ThemedText>
        </View>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressSegment, { backgroundColor: theme.tint }]} />
        <View style={[styles.progressSegment, { backgroundColor: theme.backgroundElement }]} />
        <View style={[styles.progressSegment, { backgroundColor: theme.backgroundElement }]} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Section title="When">
          <View style={styles.chipRow}>
            <Chip label="ASAP" selected={isAsap} onPress={() => setIsAsap(true)} theme={theme} />
            <Chip label="Later today" selected={!isAsap} onPress={() => setIsAsap(false)} theme={theme} />
          </View>
        </Section>

        <Section title="Service">
          {loadingTiers ? (
            <ActivityIndicator />
          ) : (
            <View style={styles.chipRow}>
              {tiers.map((tier) => (
                <Chip
                  key={tier.id}
                  label={tier.name}
                  selected={selectedTierId === tier.id}
                  onPress={() => setSelectedTierId(tier.id)}
                  theme={theme}
                />
              ))}
            </View>
          )}
          {selectedTier && (
            <View style={[styles.tierInfo, { backgroundColor: theme.backgroundElement, borderRadius: 12 }]}>
              <ThemedText style={{ fontWeight: '600' }}>{selectedTier.name}</ThemedText>
              <ThemedText themeColor="textSecondary" style={{ fontSize: 13, marginTop: 2 }}>
                {selectedTier.description}
              </ThemedText>
              <ThemedText style={{ fontSize: 13, marginTop: 6, color: theme.tint, fontWeight: '600' }}>
                {selectedTier.price_per_kg ? `R${selectedTier.price_per_kg}/kg` : `from R${selectedTier.base_price.toFixed(0)}`}
                {' · '}
                {selectedTier.category === 'everyday' ? 'Home partners' : 'Laundromat partners'}
              </ThemedText>
            </View>
          )}
        </Section>

        <Section title="Pickup address">
          <Pressable
            onPress={handleUseCurrentLocation}
            style={[styles.locationButton, { borderColor: theme.tint }]}>
            {locating ? (
              <ActivityIndicator size="small" color={theme.tint} />
            ) : (
              <>
                <Ionicons name="location-outline" size={18} color={theme.tint} />
                <ThemedText style={{ color: theme.tint, fontWeight: '600', fontSize: 15 }}>
                  Use current location
                </ThemedText>
              </>
            )}
          </Pressable>
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

        <Section title="Items">
          {ITEM_CATEGORIES.map((category) => (
            <View key={category} style={[styles.itemRow, { borderBottomColor: theme.backgroundElement }]}>
              <ThemedText style={{ flex: 1, fontSize: 15 }}>{category}</ThemedText>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => adjustQuantity(category, -1)}
                  style={[styles.stepperBtn, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText style={styles.stepperSign}>−</ThemedText>
                </Pressable>
                <ThemedText style={styles.stepperVal}>{quantities[category] ?? 0}</ThemedText>
                <Pressable
                  onPress={() => adjustQuantity(category, 1)}
                  style={[styles.stepperBtn, { backgroundColor: theme.tint }]}>
                  <ThemedText style={[styles.stepperSign, { color: '#fff' }]}>+</ThemedText>
                </Pressable>
              </View>
            </View>
          ))}
        </Section>

        {error && <ThemedText style={{ color: '#E5484D', marginBottom: 4 }}>{error}</ThemedText>}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.bottomBar, { borderTopColor: theme.backgroundElement, backgroundColor: theme.background }]}>
        <View>
          <ThemedText themeColor="textSecondary" style={{ fontSize: 12 }}>
            {totalItems === 0 ? 'Add items to continue' : `${totalItems} items`}
          </ThemedText>
          <ThemedText style={{ fontSize: 20, fontWeight: '700' }}>
            {estimatedTotal > 0 ? `R${estimatedTotal.toFixed(0)}` : 'R0'}
          </ThemedText>
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton
            label="Continue"
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={submitting}
          />
        </View>
      </View>
    </ThemedView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
        {title.toUpperCase()}
      </ThemedText>
      {children}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
  theme,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  theme: { tint: string; backgroundElement: string; text: string };
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: '#111111' }
          : { backgroundColor: theme.backgroundElement },
      ]}>
      <ThemedText style={[styles.chipLabel, selected && { color: '#fff' }]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  backButton: { padding: 4 },
  stepTitle: { fontSize: 17, fontWeight: '700' },
  stepSub: { fontSize: 13 },
  progressBar: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  progressSegment: { flex: 1, height: 3, borderRadius: 2 },
  container: { padding: 20, gap: 4, paddingBottom: 16 },
  section: { marginBottom: 20, gap: 10 },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  chipLabel: { fontSize: 14, fontWeight: '600' },
  tierInfo: { padding: 14 },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, height: 48, fontSize: 16 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepperSign: { fontSize: 18, fontWeight: '600', lineHeight: 22 },
  stepperVal: { width: 24, textAlign: 'center', fontSize: 15, fontWeight: '600' },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    paddingBottom: 28,
  },
});
