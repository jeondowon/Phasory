// Screen 04 — Sound Map. 위치가 기록된 사운드를 실제 지도(MapLibre) 위에 핀으로 표시
// (클러스터링 없음, PHASE-SPEC §6). positron 라이트 톤 기본 지도 위에 PHASE 주황 핀·현위치 점.
// 진입 시 현재 위치를 기준으로 카메라를 잡고(UserLocation 점도 표시), 핀 탭 → 소리 상세.
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Map,
  Camera,
  Marker,
  UserLocation,
  Layer,
  type CameraRef,
  type InitialViewState,
  type LngLatBounds,
} from '@maplibre/maplibre-react-native';
import { AppText } from '@/components/AppText';
import { HeaderGear } from '@/components/HeaderGear';
import { getCurrentCoords } from '@/lib/geo';
import { useStore } from '@/store';
import type { Sound } from '@/store/types';
import { colors } from '@/theme/colors';

// 키 불필요한 무료 라이트 스타일(positron). PHASE 톤(#FAFAF8 계열)과 잘 맞는다.
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const DEFAULT_CENTER: [number, number] = [126.978, 37.5665]; // 위치도 핀도 없을 때 기본(서울)
const ENTRY_ZOOM = 9; // 진입/기본 카메라 — 광역. 소리가 멀리 흩어져 있어도 한눈에 개괄한다.
const PIN_ZOOM = 15; // 핀(썸네일)을 탭했을 때 줌인하는 레벨

// peaks(0..100%)를 핀용 미니 막대 5개(4..16px)로 다운샘플. 없으면 기본 모양.
function miniBars(peaks?: number[]): number[] {
  if (!peaks || peaks.length === 0) return [8, 14, 6, 12, 9];
  const n = 5;
  return Array.from({ length: n }, (_, i) => {
    const v = peaks[Math.floor((i / n) * peaks.length)] ?? 0;
    return Math.max(4, Math.min(16, (v / 100) * 16));
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

// 현재 위치로 이동 버튼의 조준(crosshair) 아이콘.
function Crosshair({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={7} stroke={color} strokeWidth={1.6} fill="none" />
      <Circle cx={12} cy={12} r={2.4} fill={color} />
      <Line x1={12} y1={1.5} x2={12} y2={5} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={12} y1={19} x2={12} y2={22.5} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={1.5} y1={12} x2={5} y2={12} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={19} y1={12} x2={22.5} y2={12} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

// 마커 비주얼만(좌표 배치는 Marker가 한다). 꼬리가 아래를 향하므로 anchor='bottom'으로 꼬리
// 끝이 좌표를 가리키게 한다.
function PinVisual({ sound }: { sound: Sound }) {
  const size = 44;
  const inner = size - 4;
  return (
    <View style={styles.pin}>
      <View style={[styles.pinCircle, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={{ width: inner, height: inner, borderRadius: inner / 2, overflow: 'hidden' }}>
          <Thumb sound={sound} />
        </View>
      </View>
      <View style={styles.tail} />
    </View>
  );
}

export default function MapScreen() {
  const router = useRouter();
  const sounds = useStore((s) => s.sounds);

  // 현재 위치 좌표. ready=조회 완료(성공/거부 무관) → 이때 Map을 렌더해 초기 카메라를 확정한다
  // (initialViewState는 마운트 1회만 반영되므로, 위치를 안 뒤에 Map을 올려야 그 위치로 잡힌다).
  const [here, setHere] = useState<[number, number] | null>(null);
  const [ready, setReady] = useState(false);
  const cameraRef = useRef<CameraRef>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const c = await getCurrentCoords();
      if (!alive) return;
      if (c) setHere([c.lng, c.lat]);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 위치가 있는 사운드만 핀으로.
  const located = useMemo(() => Object.values(sounds).filter((s) => s.location), [sounds]);

  // 초기 카메라: 현재 위치가 있으면 그곳을 우선. 없으면 핀들을 담거나(2+), 단일 핀/기본 위치.
  const initial: InitialViewState = useMemo(() => {
    if (here) return { center: here, zoom: ENTRY_ZOOM };
    if (located.length >= 2) {
      const lngs = located.map((s) => s.location!.lng);
      const lats = located.map((s) => s.location!.lat);
      const bounds: LngLatBounds = [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
      return { bounds, padding: { top: 150, bottom: 120, left: 60, right: 60 } };
    }
    if (located.length === 1) {
      const l = located[0].location!;
      return { center: [l.lng, l.lat], zoom: ENTRY_ZOOM };
    }
    return { center: DEFAULT_CENTER, zoom: ENTRY_ZOOM };
  }, [here, located]);

  const openDetail = (id: string) => router.push({ pathname: '/sound/[id]', params: { id } });

  // 핀 탭 → 그 위치로 줌인하면서 상세 화면을 연다(돌아오면 줌인된 채로 남는다).
  const openSound = (s: Sound) => {
    cameraRef.current?.flyTo({
      center: [s.location!.lng, s.location!.lat],
      zoom: PIN_ZOOM,
      duration: 500,
    });
    openDetail(s.id);
  };

  // 현재 위치로 카메라 이동(최신 좌표를 다시 받아 부드럽게). 줌은 보던 그대로 유지. 거부·실패 시 무시.
  const recenter = async () => {
    const c = await getCurrentCoords();
    if (!c) return;
    const center: [number, number] = [c.lng, c.lat];
    setHere(center);
    cameraRef.current?.flyTo({ center, duration: 700 });
  };

  return (
    <View style={styles.root}>
      {/* 고정 헤더 — 샘플러처럼 상단에 줄로 고정. 지도 콘텐츠는 이 아래부터 시작한다. */}
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <AppText style={styles.title}>MAP</AppText>
          <View style={styles.headerRight}>
            <AppText style={styles.count}>{located.length} SOUNDS</AppText>
            <HeaderGear />
          </View>
        </View>
      </SafeAreaView>

      {/* 지도 영역 — 헤더 아래 남은 공간만 채운다(화면 전체를 덮지 않음). */}
      <View style={styles.mapWrap}>
        {ready && (
          <Map style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE} logo={false} compass={false} attribution={false}>
            <Camera ref={cameraRef} initialViewState={initial} />
            {/* 현재 위치 점 — 기본 puck(파란 점)을 PHASE 주황으로 교체(흰 테두리로 지도 위 가독성). */}
            <UserLocation animated>
              <Layer
                id="user-location-dot"
                type="circle"
                source="mlrn-user-location"
                paint={{
                  'circle-radius': 7,
                  'circle-color': colors.accent,
                  'circle-stroke-width': 3,
                  'circle-stroke-color': colors.screenBg,
                  'circle-pitch-alignment': 'map',
                }}
              />
            </UserLocation>
            {located.map((s) => (
              <Marker
                key={s.id}
                id={s.id}
                lngLat={[s.location!.lng, s.location!.lat]}
                anchor="bottom"
                onPress={() => openSound(s)}
              >
                <PinVisual sound={s} />
              </Marker>
            ))}
          </Map>
        )}

        {/* empty state */}
        {ready && located.length === 0 && (
          <View style={styles.empty} pointerEvents="none">
            <AppText style={styles.emptyText}>녹음한 소리에 위치를 더하면 여기에 표시됩니다</AppText>
          </View>
        )}

        {/* 현재 위치로 이동 */}
        {ready && (
          <TouchableOpacity style={styles.locateBtn} onPress={recenter} activeOpacity={0.85}>
            <Crosshair color={colors.slate} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg },
  // 고정 헤더 줄 — 샘플러/앰비언트와 같은 톤(좌: 화면명, 우: 개수). 지도는 이 아래에서 시작.
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: { fontSize: 13, letterSpacing: 3, color: colors.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  count: { fontSize: 10, letterSpacing: 2, color: colors.textMuted },
  // 지도 영역 — 헤더 아래의 남은 공간. 로딩 중(ready 전)에도 빈 화면이 아니라 land 톤이 보이게.
  mapWrap: { flex: 1, backgroundColor: colors.mapLand, overflow: 'hidden' },
  // empty
  empty: { position: 'absolute', left: 40, right: 40, top: '46%', alignItems: 'center' },
  emptyText: { fontSize: 12, lineHeight: 20, color: colors.textFaint, textAlign: 'center' },
  // 현재 위치로 이동 버튼 (우하단, 헤어라인 보더·드롭섀도 지양)
  locateBtn: {
    position: 'absolute',
    right: 20,
    bottom: 44,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(250,250,248,0.96)',
    borderWidth: 1,
    borderColor: colors.hairlineField,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // pins
  pin: { alignItems: 'center' },
  pinCircle: {
    borderWidth: 2,
    borderColor: colors.accent,
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
    borderTopColor: colors.accent,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
