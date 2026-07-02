import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { BrandColors } from '../theme/tokens';

export interface PrimaryButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'danger' | 'outline';
}

export function PrimaryButton({ label, loading, variant = 'primary', disabled, ...rest }: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'danger' && styles.danger,
        variant === 'outline' && styles.outline,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? BrandColors.primary : '#fff'} />
      ) : (
        <Text style={[styles.label, variant === 'outline' && styles.labelOutline]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primary: { backgroundColor: BrandColors.primary },
  danger: { backgroundColor: BrandColors.danger },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: BrandColors.primary },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  label: { color: '#fff', fontSize: 16, fontWeight: '600' },
  labelOutline: { color: BrandColors.primary },
});
