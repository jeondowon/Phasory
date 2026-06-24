// Base text component — guarantees the monospace family so nothing falls back
// to a system sans-serif (PHASE-SPEC §2.3). Always use this instead of <Text>.
import { Text, type TextProps } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export function AppText({ style, ...props }: TextProps) {
  return (
    <Text
      {...props}
      style={[{ fontFamily: fonts.regular, color: colors.text }, style]}
    />
  );
}
