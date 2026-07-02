import { PrimaryButton, useAuth, type BankAccount, type PartnerProfile, type PartnerType } from '@rinse/shared';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function PartnerProfileScreen() {
  const theme = useTheme();
  const { profile, signOut } = useAuth();
  const [partnerProfile, setPartnerProfile] = useState<PartnerProfile | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [partnerType, setPartnerType] = useState<PartnerType>('home');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [savingBank, setSavingBank] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const [{ data: partnerData }, { data: bankData }] = await Promise.all([
      supabase.from('partner_profiles').select('*').eq('user_id', profile.id).single(),
      supabase.from('bank_accounts').select('*').eq('owner_id', profile.id).maybeSingle(),
    ]);
    if (partnerData) {
      setPartnerProfile(partnerData);
      setBusinessName(partnerData.business_name ?? '');
      setPartnerType(partnerData.partner_type);
    }
    if (bankData) {
      setBankAccount(bankData);
      setBankName(bankData.bank_name);
      setAccountHolder(bankData.account_holder);
      setAccountNumber(bankData.account_number);
      setBranchCode(bankData.branch_code);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUseCurrentLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const position = await Location.getCurrentPositionAsync({});
      if (!profile) return;
      await supabase
        .from('partner_profiles')
        .update({ lat: position.coords.latitude, lng: position.coords.longitude })
        .eq('user_id', profile.id);
      load();
    } finally {
      setLocating(false);
    }
  }

  async function handleSaveProfile() {
    if (!profile) return;
    setSaving(true);
    await supabase
      .from('partner_profiles')
      .update({ business_name: businessName, partner_type: partnerType })
      .eq('user_id', profile.id);
    setSaving(false);
    load();
  }

  async function handleSaveBank() {
    if (!profile) return;
    setSavingBank(true);
    if (bankAccount) {
      await supabase
        .from('bank_accounts')
        .update({ bank_name: bankName, account_holder: accountHolder, account_number: accountNumber, branch_code: branchCode })
        .eq('id', bankAccount.id);
    } else {
      await supabase.from('bank_accounts').insert({
        owner_id: profile.id,
        bank_name: bankName,
        account_holder: accountHolder,
        account_number: accountNumber,
        branch_code: branchCode,
      });
    }
    setSavingBank(false);
    load();
  }

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title" style={{ fontSize: 28, marginBottom: 8 }}>
        Business profile
      </ThemedText>

      {partnerProfile?.status !== 'approved' && (
        <ThemedView type="backgroundElement" style={styles.banner}>
          <ThemedText type="smallBold">
            {partnerProfile?.status === 'pending' ? 'Pending approval' : 'Account suspended'}
          </ThemedText>
          <ThemedText themeColor="textSecondary" type="small">
            {partnerProfile?.status === 'pending'
              ? "We're reviewing your details. You'll be able to receive orders once approved."
              : 'Contact support for more information.'}
          </ThemedText>
        </ThemedView>
      )}

      <ThemedText themeColor="textSecondary" style={{ marginBottom: 16 }}>
        {profile?.phone}
      </ThemedText>

      <TextInput
        value={businessName}
        onChangeText={setBusinessName}
        placeholder="Business name"
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
      />

      <View style={styles.toggleRow}>
        {(['home', 'laundromat'] as PartnerType[]).map((type) => (
          <Pressable key={type} onPress={() => setPartnerType(type)}>
            <View
              style={[
                styles.chip,
                { backgroundColor: partnerType === type ? theme.tint : theme.backgroundElement },
              ]}>
              <ThemedText style={partnerType === type ? { color: '#fff' } : undefined}>
                {type === 'home' ? 'Home partner' : 'Laundromat'}
              </ThemedText>
            </View>
          </Pressable>
        ))}
      </View>

      <PrimaryButton
        label={partnerProfile?.lat ? 'Update location' : 'Set my location'}
        variant="outline"
        onPress={handleUseCurrentLocation}
        loading={locating}
      />
      <View style={{ height: 12 }} />
      <PrimaryButton label="Save profile" onPress={handleSaveProfile} loading={saving} />

      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
        BANK ACCOUNT FOR CASH-OUT
      </ThemedText>
      <TextInput
        value={bankName}
        onChangeText={setBankName}
        placeholder="Bank name"
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
      />
      <TextInput
        value={accountHolder}
        onChangeText={setAccountHolder}
        placeholder="Account holder"
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
      />
      <TextInput
        value={accountNumber}
        onChangeText={setAccountNumber}
        placeholder="Account number"
        placeholderTextColor={theme.textSecondary}
        keyboardType="number-pad"
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
      />
      <TextInput
        value={branchCode}
        onChangeText={setBranchCode}
        placeholder="Branch code"
        placeholderTextColor={theme.textSecondary}
        keyboardType="number-pad"
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
      />
      <PrimaryButton label="Save bank details" variant="outline" onPress={handleSaveBank} loading={savingBank} />

      <View style={{ height: 32 }} />
      <PrimaryButton label="Sign out" variant="danger" onPress={signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  banner: { borderRadius: 12, padding: 14, marginBottom: 16, gap: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, height: 48, fontSize: 16, marginBottom: 12 },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  sectionTitle: { marginTop: 32, marginBottom: 12 },
});
