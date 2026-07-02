import { PrimaryButton, useAuth, type BankAccount, type DriverProfile } from '@rinse/shared';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function DriverProfileScreen() {
  const theme = useTheme();
  const { profile, signOut } = useAuth();
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
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
    const [{ data: driverData }, { data: bankData }] = await Promise.all([
      supabase.from('driver_profiles').select('*').eq('user_id', profile.id).single(),
      supabase.from('bank_accounts').select('*').eq('owner_id', profile.id).maybeSingle(),
    ]);
    if (driverData) {
      setDriverProfile(driverData);
      setVehicleMake(driverData.vehicle_make ?? '');
      setVehicleModel(driverData.vehicle_model ?? '');
      setVehiclePlate(driverData.vehicle_plate ?? '');
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

  async function handleSaveVehicle() {
    if (!profile) return;
    setSaving(true);
    await supabase
      .from('driver_profiles')
      .update({ vehicle_make: vehicleMake, vehicle_model: vehicleModel, vehicle_plate: vehiclePlate })
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
        Vehicle &amp; profile
      </ThemedText>

      {driverProfile?.status !== 'approved' && (
        <ThemedView type="backgroundElement" style={styles.banner}>
          <ThemedText type="smallBold">
            {driverProfile?.status === 'pending' ? 'Pending approval' : 'Account suspended'}
          </ThemedText>
          <ThemedText themeColor="textSecondary" type="small">
            {driverProfile?.status === 'pending'
              ? "We're reviewing your details. You'll be able to go online once approved."
              : 'Contact support for more information.'}
          </ThemedText>
        </ThemedView>
      )}

      <ThemedText themeColor="textSecondary" style={{ marginBottom: 16 }}>
        {profile?.phone} · {driverProfile?.vehicle_type}
      </ThemedText>

      <TextInput
        value={vehicleMake}
        onChangeText={setVehicleMake}
        placeholder="Vehicle make"
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
      />
      <TextInput
        value={vehicleModel}
        onChangeText={setVehicleModel}
        placeholder="Vehicle model"
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
      />
      <TextInput
        value={vehiclePlate}
        onChangeText={setVehiclePlate}
        placeholder="Number plate"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="characters"
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
      />
      <PrimaryButton label="Save vehicle" onPress={handleSaveVehicle} loading={saving} />

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
  sectionTitle: { marginTop: 32, marginBottom: 12 },
});
