// Sampler pads (PHASE-SPEC §3.2). Three kinds: Filled, Active (the one "alive"
// element — eq + padpulse), Empty (dashed, an entry point itself).
import { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { AppText } from '../AppText';
import { Slider } from '../Slider';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { glow } from '@/theme/glow';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Category = 'ambient' | 'perc';

function KeyChip({ letter, active }: { letter: string; active?: boolean }) {
  return (
    <View
      style={[
        styles.keychip,
        active && { borderColor: colors.accentBorder6 },
      ]}
    >
      <AppText style={[styles.keyLetter, active && { color: colors.accent }]}>{letter}</AppText>
    </View>
  );
}

// 케밥(⋮) — 패드 우측 상단. 탭하면 액션 메뉴(Edit/Delete/Clear)를 띄운다.
function Kebab({ active, onPress }: { active?: boolean; onPress?: () => void }) {
  const color = active ? colors.accentMuted : colors.textFaint;
  return (
    <TouchableOpacity onPress={onPress} hitSlop={12} style={styles.kebab}>
      <View style={[styles.kebabDot, { backgroundColor: color }]} />
      <View style={[styles.kebabDot, { backgroundColor: color }]} />
      <View style={[styles.kebabDot, { backgroundColor: color }]} />
    </TouchableOpacity>
  );
}

export function FilledPad({
  letter,
  name,
  category,
  volume,
  onPress,
  onVolumeChange,
  onMenu,
}: {
  letter: string;
  name: string;
  category: Category;
  volume: number;
  onPress?: () => void;
  onVolumeChange?: (pct: number) => void;
  onMenu?: () => void;
}) {
  const catColor = category === 'ambient' ? colors.slate : colors.bone;
  return (
    <TouchableOpacity activeOpacity={0.8} style={styles.pad} onPress={onPress}>
      <View style={styles.headerRow}>
        <KeyChip letter={letter} />
        <Kebab onPress={onMenu} />
      </View>
      <View>
        <AppText style={styles.name}>{name}</AppText>
        <View style={styles.catRow}>
          <View style={[styles.catDot, { backgroundColor: catColor }]} />
          <AppText style={styles.catLabel}>
            {category === 'ambient' ? 'AMBIENT' : 'PERCUSSIVE'}
          </AppText>
        </View>
      </View>
      <Slider pct={volume} fillColor={catColor} knobColor={colors.bone} knobSize={9} onChange={onVolumeChange} />
    </TouchableOpacity>
  );
}

function EqBar({ delay, duration }: { delay: number; duration: number }) {
  const h = useSharedValue(0.3);
  useEffect(() => {
    h.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
  }, []);
  const style = useAnimatedStyle(() => ({ height: 12 * h.value }));
  return <Animated.View style={[styles.eqBar, style]} />;
}

export function ActivePad({
  letter,
  name,
  volume,
  onPress,
  onVolumeChange,
  onMenu,
}: {
  letter: string;
  name: string;
  volume: number;
  onPress?: () => void;
  onVolumeChange?: (pct: number) => void;
  onMenu?: () => void;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const pulse = useAnimatedStyle(() => ({
    shadowRadius: 16 + 14 * p.value,
    shadowOpacity: 0.14 + 0.16 * p.value,
  }));

  return (
    <AnimatedPressable onPress={onPress} style={[styles.pad, styles.padActive, glow(16, 0.14), pulse]}>
      <View style={styles.headerRow}>
        <KeyChip letter={letter} active />
        <Kebab active onPress={onMenu} />
      </View>
      <View>
        <AppText style={[styles.name, { color: colors.accentText }]}>{name}</AppText>
        <View style={styles.eqRow}>
          <View style={styles.eqBars}>
            <EqBar delay={0} duration={900} />
            <EqBar delay={200} duration={700} />
            <EqBar delay={100} duration={1100} />
            <EqBar delay={350} duration={800} />
          </View>
          <AppText style={styles.playing}>PLAYING</AppText>
        </View>
      </View>
      <Slider pct={volume} fillColor={colors.accent} knobColor={colors.accent} knobSize={9} trackColor={colors.accentTrack} onChange={onVolumeChange} />
    </AnimatedPressable>
  );
}

export function EmptyPad({ letter, onPress }: { letter: string; onPress?: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={[styles.pad, styles.padEmpty]}>
      <AppText style={styles.keyLetterEmpty}>{letter}</AppText>
      <View style={styles.plusBox}>
        <AppText style={styles.plus}>+</AppText>
      </View>
      <AppText style={styles.emptyCaption}>RECORD OR{'\n'}CHOOSE</AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pad: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 13,
    padding: 13,
    justifyContent: 'space-between',
  },
  padActive: { backgroundColor: colors.accentTint, borderColor: colors.accentBorder55 },
  padEmpty: {
    backgroundColor: 'transparent',
    borderColor: colors.hairlineDashSoft,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  keychip: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.keychip,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyLetter: { fontSize: 11, color: colors.textMuted },
  kebab: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', gap: 2.5 },
  kebabDot: { width: 3, height: 3, borderRadius: 1.5 },
  name: { fontSize: 14, color: colors.text },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
  catDot: { width: 6, height: 6, borderRadius: 3 },
  catLabel: { fontSize: 9, letterSpacing: 1, color: colors.textFaint },
  // active
  eqRow: { flexDirection: 'row', alignItems: 'center', marginTop: 7 },
  eqBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 12 },
  eqBar: { width: 3, borderRadius: 1, backgroundColor: colors.accent },
  playing: { fontSize: 9, letterSpacing: 1, color: colors.accentMuted, marginLeft: 5 },
  // empty
  plusBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.hairlineDash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: { fontFamily: fonts.light, fontSize: 17, color: '#88888b' },
  emptyCaption: {
    fontSize: 9,
    letterSpacing: 1,
    lineHeight: 14,
    textAlign: 'center',
    color: colors.textFainter,
  },
  keyLetterEmpty: { position: 'absolute', top: 13, left: 13, fontSize: 11, color: colors.textDisabled },
});
