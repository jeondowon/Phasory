// Standard screen shell: warm-white background, safe area (clears the OS status bar).
import type { ReactNode } from 'react';
import { type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: colors.screenBg }, style]} edges={['top', 'bottom']}>
      {children}
    </SafeAreaView>
  );
}
