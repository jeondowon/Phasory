// Screen 04 — Sound Map. Stylized map, pins never clustered. PHASE-SPEC §6.
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBarMock } from '@/components/StatusBarMock';
import { AppText } from '@/components/AppText';
import { SoundMapCanvas } from '@/components/SoundMapCanvas';
import { colors } from '@/theme/colors';
import { glow } from '@/theme/glow';

const RING = { orange: colors.accent, slate: colors.slate, gray: colors.bone } as const;

type PinData = {
  left: number;
  top: number;
  size: number;
  ring: keyof typeof RING;
  kind: 'photo' | 'wave';
  bars?: number;
  selected?: boolean;
};

// §6.3 — positions in the 372×826 frame.
const PINS: PinData[] = [
  { left: 62, top: 300, size: 50, ring: 'orange', kind: 'photo', selected: true },
  { left: 190, top: 250, size: 44, ring: 'slate', kind: 'wave', bars: 5 },
  { left: 268, top: 380, size: 44, ring: 'gray', kind: 'photo' },
  { left: 96, top: 470, size: 44, ring: 'slate', kind: 'wave', bars: 5 },
  { left: 230, top: 540, size: 44, ring: 'gray', kind: 'photo' },
  { left: 150, top: 610, size: 40, ring: 'slate', kind: 'wave', bars: 4 },
];

const WAVE_H = [8, 14, 6, 12, 9];

function PhotoThumb({ radius }: { radius: number }) {
  return (
    <View style={[styles.thumbFill, { backgroundColor: colors.pinPhoto[0], borderRadius: radius }]}>
      <View style={[styles.photoBand, { backgroundColor: colors.pinPhoto[2] }]} />
      <View style={[styles.photoDot, { backgroundColor: colors.pinPhoto[3] }]} />
    </View>
  );
}

function WaveThumb({ bars }: { bars: number }) {
  return (
    <View style={[styles.thumbFill, styles.waveThumb]}>
      {WAVE_H.slice(0, bars).map((h, i) => (
        <View key={i} style={{ width: 2, height: h, borderRadius: 1, backgroundColor: colors.slateWave }} />
      ))}
    </View>
  );
}

function Pin({ pin }: { pin: PinData }) {
  const ringColor = RING[pin.ring];
  const inner = pin.size - 4;
  return (
    <View
      style={[
        styles.pin,
        { left: `${(pin.left / 372) * 100}%`, top: `${(pin.top / 826) * 100}%` },
      ]}
    >
      <View
        style={[
          styles.pinCircle,
          { width: pin.size, height: pin.size, borderRadius: pin.size / 2, borderColor: ringColor },
          pin.selected && glow(18, 0.4),
        ]}
      >
        <View style={{ width: inner, height: inner, borderRadius: inner / 2, overflow: 'hidden' }}>
          {pin.kind === 'photo' ? <PhotoThumb radius={inner / 2} /> : <WaveThumb bars={pin.bars ?? 4} />}
        </View>
      </View>
      <View style={[styles.tail, { borderTopColor: ringColor }]} />
    </View>
  );
}

export default function MapScreen() {
  return (
    <View style={styles.root}>
      <SoundMapCanvas />

      {/* pins */}
      {PINS.map((p, i) => (
        <Pin key={i} pin={p} />
      ))}

      {/* chrome */}
      <SafeAreaView edges={['top']}>
        <StatusBarMock />
        <View style={styles.header}>
          <AppText style={styles.title}>SOUND MAP</AppText>
          <AppText style={styles.count}>14 SOUNDS</AppText>
        </View>
      </SafeAreaView>

      {/* selected-sound card */}
      <View style={styles.card}>
        <View style={styles.cardThumb}>
          <PhotoThumb radius={11} />
        </View>
        <View style={styles.cardText}>
          <AppText style={styles.cardTitle}>Rain on the awning</AppText>
          <AppText style={styles.cardMeta}>Kyoto · Gion  ·  Apr 12</AppText>
        </View>
        <View style={styles.cardPlay}>
          <View style={styles.cardPlayTriangle} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mapLand },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  title: { fontSize: 13, letterSpacing: 3, color: colors.text },
  count: { fontSize: 10, letterSpacing: 2, color: colors.textMuted },
  // pins
  pin: { position: 'absolute', alignItems: 'center' },
  pinCircle: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pinWaveBg,
  },
  thumbFill: { flex: 1, width: '100%', height: '100%' },
  photoBand: { position: 'absolute', left: 0, right: 0, bottom: '28%', height: '20%' },
  photoDot: { position: 'absolute', right: '22%', top: '24%', width: 6, height: 6, borderRadius: 3 },
  waveThumb: {
    backgroundColor: colors.pinWaveBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tail: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  // card
  card: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 36,
    backgroundColor: 'rgba(240,240,238,0.96)',
    borderWidth: 1,
    borderColor: colors.hairlineField,
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardThumb: {
    width: 46,
    height: 46,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    overflow: 'hidden',
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 14, color: colors.text },
  cardMeta: { fontSize: 11, letterSpacing: 0.5, color: colors.textFaint, marginTop: 5 },
  cardPlay: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPlayTriangle: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.accentDark,
  },
});
