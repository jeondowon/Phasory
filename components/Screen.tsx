// Standard screen shell: warm-white background, safe area, mock status bar.
import type { ReactNode } from 'react';
import { type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBarMock } from './StatusBarMock';
import { colors } from '@/theme/colors';

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: colors.screenBg }, style]} edges={['top', 'bottom']}>
      <StatusBarMock />
      {children}
    </SafeAreaView>
  );
}
