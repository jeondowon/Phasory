// Mock iOS status bar — identical on every screen (PHASE-SPEC §2.7).
// We render the design's status row and hide the real OS bar for fidelity.
import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export function StatusBarMock() {
  return (
    <View style={styles.row}>
      <AppText style={styles.time}>9:41</AppText>
      <View style={styles.right}>
        {/* signal bars: heights 5/8/11, 3px wide, 2px gap */}
        <View style={styles.bars}>
          {[5, 8, 11].map((h) => (
            <View key={h} style={[styles.bar, { height: h }]} />
          ))}
        </View>
        {/* battery: 22x11, 1px border, inner fill 68% */}
        <View style={styles.battery}>
          <View style={styles.batteryFill} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 26,
    paddingBottom: 4,
  },
  time: {
    fontFamily: fonts.regular,
    fontSize: 13,
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: { width: 3, borderRadius: 1, backgroundColor: colors.textSecondary },
  battery: {
    width: 22,
    height: 11,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    borderRadius: 3,
    justifyContent: 'center',
    paddingHorizontal: 1,
  },
  batteryFill: {
    width: '68%',
    height: 6,
    borderRadius: 1,
    backgroundColor: colors.textSecondary,
  },
});
