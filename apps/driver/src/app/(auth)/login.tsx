import { isValidSouthAfricanPhone, PrimaryButton, requestOtp, type VehicleType } from '@rinse/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'bike', label: 'Bike' },
  { value: 'car', label: 'Car' },
  { value: 'bakkie', label: 'Bakkie' },
  { value: 'van', label: 'Van' },
];

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = isValidSouthAfricanPhone(phone) && !loading;

  async function handleSendCode() {
    setError(null);
    setLoading(true);
    try {
      await requestOtp(supabase, { phone, role: 'driver', vehicleType });
      router.push({ pathname: '/verify', params: { phone, vehicleType } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send code. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', default: undefined })}>
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          Rinse Driver
        </ThemedText>
        <ThemedText type="subtitle" style={styles.subtitle}>
          Fill the gaps between your other shifts.
        </ThemedText>

        <ThemedText themeColor="textSecondary" style={styles.label}>
          Vehicle type
        </ThemedText>
        <View style={styles.vehicleRow}>
          {VEHICLE_TYPES.map(({ value, label }) => (
            <Pressable key={value} onPress={() => setVehicleType(value)}>
              <View
                style={[
                  styles.chip,
                  { backgroundColor: vehicleType === value ? theme.tint : theme.backgroundElement },
                ]}>
                <ThemedText style={vehicleType === value ? { color: '#fff' } : undefined}>{label}</ThemedText>
              </View>
            </Pressable>
          ))}
        </View>

        <ThemedText themeColor="textSecondary" style={styles.label}>
          Mobile number
        </ThemedText>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="082 123 4567"
          placeholderTextColor={theme.textSecondary}
          keyboardType="phone-pad"
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}

        <PrimaryButton label="Send code" onPress={handleSendCode} disabled={!canSubmit} loading={loading} />
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { marginBottom: 4, fontSize: 36 },
  subtitle: { marginBottom: 32, fontSize: 18 },
  label: { marginBottom: 4 },
  vehicleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 16,
    marginBottom: 16,
  },
  error: { color: '#E5484D', marginBottom: 8 },
});
