// Custom bottom tab bar — PHASE-SPEC §3.3. Text only, hairline top border.
import type { ComponentProps } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Tabs } from 'expo-router';
import { AppText } from './AppText';
import { colors } from '@/theme/colors';

const LABELS: Record<string, string> = {
  index: 'SAMPLER',
  map: 'MAP',
  ambient: 'AMBIENT',
};

// Exact props expo-router passes to a custom tabBar (its vendored react-navigation
// types — extracted from Tabs so it stays in sync without a deep import).
type Props = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export function CustomTabBar({ state, navigation }: Props) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <View style={styles.bar}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const label = LABELS[route.name] ?? route.name.toUpperCase();
          // Equal-width tabs so the middle label sits at the true screen center;
          // align text to the bar edges (left / center / right).
          const textAlign = i === 0 ? 'left' : i === state.routes.length - 1 ? 'right' : 'center';
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <TouchableOpacity key={route.key} onPress={onPress} hitSlop={10} style={styles.tab}>
              <AppText style={[styles.label, { textAlign, color: focused ? colors.text : colors.textFainter }]}>
                {label}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.screenBg },
  bar: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.tabDivider,
  },
  tab: { flex: 1 },
  label: { fontSize: 10, letterSpacing: 1.5 },
});
