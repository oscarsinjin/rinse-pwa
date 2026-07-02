import { isValidSouthAfricanPhone, PrimaryButton, requestOtp } from '@rinse/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = isValidSouthAfricanPhone(phone) && !loading;

  async function handleSendCode() {
    setError(null);
    setLoading(true);
    try {
      await requestOtp(supabase, { phone, role: 'partner' });
      router.push({ pathname: '/verify', params: { phone } });
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
          Rinse Partner
        </ThemedText>
        <ThemedText type="subtitle" style={styles.subtitle}>
          Earn washing laundry on your schedule.
        </ThemedText>

        <ThemedText themeColor="textSecondary" style={styles.label}>
          Mobile number
        </ThemedText>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="082 123 4567"
          placeholderTextColor={theme.textSecondary}
          keyboardType="phone-pad"
          autoFocus
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
