// Screen 04 — Sound Map. 위치가 기록된 사운드를 핀으로 표시(클러스터링 없음). PHASE-SPEC §6.
// MapLibre 전이라 배경은 스타일라이즈드 SVG(SoundMapCanvas), 핀 좌표는 lat/lng를 프레임에
// bbox 정규화한 임시 배치다(P4-b에서 실제 지도 마커로 교체). 핀 탭 → 소리 상세.
import { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBarMock } from '@/components/StatusBarMock';
import { AppText } from '@/components/AppText';
import { SoundMapCanvas } from '@/components/SoundMapCanvas';
import { playUri } from '@/audio/engine';
import { useStore } from '@/store';
import type { Sound } from '@/store/types';
import { colors } from '@/theme/colors';
import { glow } from '@/theme/glow';

const FRAME_W = 372;
const FRAME_H = 826;
// 핀이 상단 헤더·하단 카드와 겹치지 않게 두는 여백(372×826 프레임 기준).
const PAD_X = 54;
const PAD_TOP = 150;
const PAD_BOTTOM = 170;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDate(ms?: number): string {
  if (ms == null) return '';
  const d = new Date(ms);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// peaks(0..100%)를 핀/카드용 미니 막대 5개(4..16px)로 다운샘플. 없으면 기본 모양.
function miniBars(peaks?: number[]): number[] {
  if (!peaks || peaks.length === 0) return [8, 14, 6, 12, 9];
  const n = 5;
  return Array.from({ length: n }, (_, i) => {
    const v = peaks[Math.floor((i / n) * peaks.length)] ?? 0;
    return Math.max(4, Math.min(16, (v / 100) * 16));
  });
}

// 위치 있는 사운드들의 lat/lng를 프레임 좌표(372×826)로 bbox 정규화. 동→오른쪽, 북→위.
function project(located: Sound[]): { left: number; top: number }[] {
  const lats = located.map((s) => s.location!.lat);
  const lngs = located.map((s) => s.location!.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const spanLat = maxLat - minLat || 1;
  const spanLng = maxLng - minLng || 1;
  const single = located.length === 1;
  return located.map((s) => {
    const fx = single ? 0.5 : (s.location!.lng - minLng) / spanLng;
    const fy = single ? 0.5 : (maxLat - s.location!.lat) / spanLat;
    return {
      left: PAD_X + fx * (FRAME_W - PAD_X * 2),
      top: PAD_TOP + fy * (FRAME_H - PAD_TOP - PAD_BOTTOM),
    };
  });
}

function Thumb({ sound }: { sound: Sound }) {
  if (sound.photoUri) return <Image source={{ uri: sound.photoUri }} style={styles.thumbFill} />;
  return (
    <View style={[styles.thumbFill, styles.waveThumb]}>
      {miniBars(sound.peaks).map((h, i) => (
        <View key={i} style={{ width: 2, height: h, borderRadius: 1, backgroundColor: colors.slateWave }} />
      ))}
    </View>
  );
}

function Pin({
  sound,
  left,
  top,
  selected,
  onPress,
}: {
  sound: Sound;
  left: number;
  top: number;
  selected: boolean;
  onPress: () => void;
}) {
  const ringColor = selected ? colors.accent : colors.slate;
  const size = selected ? 50 : 44;
  const inner = size - 4;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.pin, { left: `${(left / FRAME_W) * 100}%`, top: `${(top / FRAME_H) * 100}%` }]}
    >
      <View
        style={[
          styles.pinCircle,
          { width: size, height: size, borderRadius: size / 2, borderColor: ringColor },
          selected && glow(18, 0.4),
        ]}
      >
        <View style={{ width: inner, height: inner, borderRadius: inner / 2, overflow: 'hidden' }}>
          <Thumb sound={sound} />
        </View>
      </View>
      <View style={[styles.tail, { borderTopColor: ringColor }]} />
    </TouchableOpacity>
  );
}

export default function MapScreen() {
  const router = useRouter();
  const sounds = useStore((s) => s.sounds);

  // 위치가 있는 사운드만 핀으로. featured = 가장 최근 것(하단 카드·선택 글로우).
  const { located, positions, featured } = useMemo(() => {
    const list = Object.values(sounds).filter((s) => s.location);
    const pos = list.length ? project(list) : [];
    const feat = list.reduce<Sound | null>(
      (best, s) => (best && (best.createdAt ?? 0) >= (s.createdAt ?? 0) ? best : s),
      null
    );
    return { located: list, positions: pos, featured: feat };
  }, [sounds]);

  const openDetail = (id: string) => router.push({ pathname: '/sound/[id]', params: { id } });
  const play = (s: Sound) => {
    if (s.uri) playUri(s.uri, 100, s.offsetSec ?? 0, s.clipSec).catch(() => {});
  };

  return (
    <View style={styles.root}>
      <SoundMapCanvas />

      {/* pins */}
      {located.map((s, i) => (
        <Pin
          key={s.id}
          sound={s}
          left={positions[i].left}
          top={positions[i].top}
          selected={featured?.id === s.id}
          onPress={() => openDetail(s.id)}
        />
      ))}

      {/* chrome */}
      <SafeAreaView edges={['top']}>
        <StatusBarMock />
        <View style={styles.header}>
          <AppText style={styles.title}>SOUND MAP</AppText>
          <AppText style={styles.count}>{located.length} SOUNDS</AppText>
        </View>
      </SafeAreaView>

      {/* empty state */}
      {located.length === 0 && (
        <View style={styles.empty} pointerEvents="none">
          <AppText style={styles.emptyText}>녹음한 소리에 위치를 더하면 여기에 표시됩니다</AppText>
        </View>
      )}

      {/* featured-sound card */}
      {featured && (
        <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => openDetail(featured.id)}>
          <View style={styles.cardThumb}>
            <Thumb sound={featured} />
          </View>
          <View style={styles.cardText}>
            <AppText style={styles.cardTitle} numberOfLines={1}>{featured.name}</AppText>
            <AppText style={styles.cardMeta} numberOfLines={1}>
              {[featured.location?.label, shortDate(featured.createdAt)].filter(Boolean).join('  ·  ')}
            </AppText>
          </View>
          <TouchableOpacity style={styles.cardPlay} onPress={() => play(featured)}>
            <View style={styles.cardPlayTriangle} />
          </TouchableOpacity>
        </TouchableOpacity>
      )}
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
  // empty
  empty: { position: 'absolute', left: 40, right: 40, top: '46%', alignItems: 'center' },
  emptyText: { fontSize: 12, lineHeight: 20, color: colors.textFaint, textAlign: 'center' },
  // pins
  pin: { position: 'absolute', alignItems: 'center' },
  pinCircle: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pinWaveBg,
  },
  thumbFill: { flex: 1, width: '100%', height: '100%' },
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
