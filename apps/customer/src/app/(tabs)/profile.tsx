import { PrimaryButton, useAuth } from '@rinse/shared';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={{ gap: 4, marginBottom: 32 }}>
        <ThemedText type="title" style={{ fontSize: 32 }}>
          {profile?.full_name || 'Your profile'}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{profile?.phone}</ThemedText>
      </ThemedView>

      <PrimaryButton label="Sign out" variant="outline" onPress={signOut} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 80 },
});
