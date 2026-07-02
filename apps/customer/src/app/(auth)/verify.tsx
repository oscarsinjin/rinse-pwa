import { PrimaryButton, requestOtp, verifyOtp } from '@rinse/shared';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function VerifyScreen() {
  const theme = useTheme();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleVerify() {
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(supabase, phone, code);
      // Session updates via onAuthStateChange; the root layout redirects automatically.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError(null);
    try {
      await requestOtp(supabase, { phone, role: 'customer' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code.');
    } finally {
      setResending(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Enter code
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.subtitle}>
        We sent a 6-digit code to {phone}
      </ThemedText>

      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="123456"
        placeholderTextColor={theme.textSecondary}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
      />

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      <PrimaryButton label="Verify" onPress={handleVerify} disabled={code.length < 6} loading={loading} />
      <PrimaryButton label="Resend code" variant="outline" onPress={handleResend} loading={resending} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { marginBottom: 4 },
  subtitle: { marginBottom: 32, fontSize: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: 16,
  },
  error: { color: '#E5484D', marginBottom: 8 },
});
