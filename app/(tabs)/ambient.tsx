// Screen 05 — Ambient (Phase Orbit). The signature screen. PHASE-SPEC §7.
import { View, StyleSheet } from 'react-native';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Slider } from '@/components/Slider';
import { PhaseOrbit } from '@/components/PhaseOrbit';
import { useStore } from '@/store';
import type { GenerativePreset } from '@/store/types';
import { leverLabel } from '@/store/levers';
import { colors } from '@/theme/colors';
import { glow } from '@/theme/glow';

const LEVER_LABELS: { key: keyof GenerativePreset; label: string }[] = [
  { key: 'scale', label: 'SCALE' },
  { key: 'density', label: 'DENSITY' },
  { key: 'space', label: 'SPACE' },
  { key: 'tempo', label: 'TEMPO' },
];

export default function AmbientScreen() {
  const preset = useStore((s) => s.preset);
  const setLever = useStore((s) => s.setLever);

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <AppText style={styles.title}>AMBIENT</AppText>
        <AppText style={styles.sub}>DRIFTING · IN PHASE</AppText>
      </View>

      {/* Orbit */}
      <View style={styles.orbit}>
        <PhaseOrbit />
      </View>

      {/* 4 levers */}
      <View style={styles.levers}>
        {LEVER_LABELS.map(({ key, label }) => (
          <View key={key} style={styles.leverRow}>
            <AppText style={styles.leverLabel}>{label}</AppText>
            <Slider
              pct={preset[key].pct}
              fillColor={colors.slate}
              knobColor={colors.bone}
              knobSize={12}
              style={styles.leverSlider}
              onChange={(v) => setLever(key, v)}
            />
            <AppText style={styles.leverValue} numberOfLines={1}>{leverLabel(key, preset[key].pct)}</AppText>
          </View>
        ))}
      </View>

      {/* Transport */}
      <View style={styles.transport}>
        <View style={styles.spacer} />
        <View style={[styles.play, glow(26, 0.3)]}>
          <View style={styles.pauseBar} />
          <View style={styles.pauseBar} />
        </View>
        <View style={styles.rec}>
          <View style={styles.recDot} />
          <AppText style={styles.recLabel}>REC</AppText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  title: { fontSize: 13, letterSpacing: 3, color: colors.text },
  sub: { fontSize: 10, letterSpacing: 2, color: colors.textFaint },
  orbit: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  levers: { paddingHorizontal: 26, paddingTop: 8, gap: 18 },
  leverRow: { flexDirection: 'row', alignItems: 'center' },
  leverLabel: { width: 66, fontSize: 10, letterSpacing: 1.5, color: colors.textMuted },
  leverSlider: { flex: 1 },
  leverValue: { width: 78, fontSize: 10, letterSpacing: 0.5, color: colors.textFaint, textAlign: 'right' },
  transport: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingTop: 26,
    paddingBottom: 40,
  },
  spacer: { width: 54 },
  play: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pauseBar: { width: 6, height: 26, borderRadius: 2, backgroundColor: colors.accentDark },
  rec: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: colors.hairlineBtn,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  recDot: { width: 11, height: 11, borderRadius: 5.5, backgroundColor: colors.accent },
  recLabel: { fontSize: 7, letterSpacing: 0.5, color: colors.textMuted },
});
