// Screen 02 — Record & Trim → Memory (단일 라우트, 단계 전환형). PHASE-SPEC §4·§5.
// 녹음/트림을 마치고 ✓를 누르면 화면 전환 없이 같은 페이지가 메모 입력('memo' 단계)으로 바뀐다.
// 메모는 강제 아님 — CANCEL은 저장 없이 닫고, SAVE만 Sound로 영속화한다.
import { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TextInput,
  ScrollView,
  Image,
  Alert,
  type LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Waveform, toBars } from '@/components/Waveform';
import { ensureMicPermission, startRecording, stopRecording, currentDuration, getPeaks } from '@/audio/recorder';
import { playUri } from '@/audio/engine';
import { useStore } from '@/store';
import { colors } from '@/theme/colors';
import { DateStepperBox } from '@/components/DateStepperBox';
import { getCurrentLocation, resolveLocation, type GeoFix } from '@/lib/geo';
import { pickPhoto } from '@/lib/photo';

const N = 64; // 파형 막대 수
const MIN_GAP = 0.04; // 트림 핸들 최소 간격(전체 길이 대비 비율)
const FLAT = Array(N).fill(8) as number[]; // idle 평탄 베이스라인

type Phase = 'idle' | 'recording' | 'recorded' | 'memo';

// 경과 ms → "m:ss".
function fmt(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// 전체 파형 막대에서 트림 선택 구간만 잘라냄(메모 카드에는 트림된 소리를 표시).
function sliceSel(peaks: number[], sel: { s: number; e: number }): number[] {
  const n = peaks.length;
  if (n === 0) return [];
  const lo = Math.floor(sel.s * n);
  return peaks.slice(lo, Math.max(lo + 1, Math.ceil(sel.e * n)));
}

// haze: 녹음 타이머 점 (1.4s). 녹음 중에만 렌더.
function HazeDot() {
  const o = useSharedValue(0.5);
  useEffect(() => {
    o.value = withRepeat(withTiming(0.85, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.hazeDot, style]} />;
}

// 녹음 중엔 stop(사각) + 확장 링(recpulse), 그 외엔 record dot(원).
function RecordButton({ recording, onPress }: { recording: boolean; onPress: () => void }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (recording) {
      p.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }), -1, false);
    } else {
      p.value = 0;
    }
  }, [recording]);
  const halo = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.35 * p.value }],
    opacity: recording ? 0.45 * (1 - p.value) : 0,
  }));
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <View style={styles.recordWrap}>
        <Animated.View style={[styles.recordHalo, halo]} />
        <View style={styles.recordBtn}>
          {recording ? <View style={styles.recordStop} /> : <View style={styles.recordDot} />}
        </View>
      </View>
    </Pressable>
  );
}

// 트림 핸들 — left는 0..1 비율(파형 폭 기준).
function Handle({ left }: { left: number }) {
  return (
    <View style={[styles.handle, { left: `${left * 100}%` }]}>
      <View style={styles.grip}>
        <View style={styles.tick} />
        <View style={styles.tick} />
      </View>
    </View>
  );
}

export default function RecordScreen() {
  const router = useRouter();
  const saveRecording = useStore((s) => s.saveRecording);
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [uri, setUri] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [peaks, setPeaks] = useState<number[]>([]); // 막대 높이(%), 정지 시 프리즈
  const [sel, setSel] = useState({ s: 0, e: 1 }); // 트림 선택 구간(0..1 비율)
  const [title, setTitle] = useState('');
  const [memo, setMemo] = useState('');
  const [createdAt, setCreatedAt] = useState<number | null>(null); // memo 진입 시각 = 캡처 시각
  const [loc, setLoc] = useState<GeoFix | null>(null); // GPS 자동기록 위치(라벨 포함)
  const [locLabel, setLocLabel] = useState(''); // 편집 가능한 위치 라벨
  const [locating, setLocating] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const selRef = useRef(sel);
  selRef.current = sel;
  const boxW = useRef(0); // 파형 박스 폭(px) — 제스처 좌표 변환용
  const active = useRef<'s' | 'e'>('s'); // 드래그 중인 핸들
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ensureMicPermission().then((ok) => setDenied(!ok));
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const toggle = async () => {
    if (phase === 'recording') {
      if (timer.current) clearInterval(timer.current);
      const res = stopRecording();
      setPeaks(toBars(getPeaks(), N)); // 마지막 청크까지 반영해 프리즈
      setPhase('recorded');
      if (res) {
        setUri(res.uri);
        setElapsedMs(res.duration * 1000);
        setSel({ s: 0, e: 1 });
      } else {
        Alert.alert('녹음 정지 실패', 'stop()이 결과를 반환하지 않음');
      }
      return;
    }
    const ok = await ensureMicPermission();
    if (!ok) {
      setDenied(true);
      return;
    }
    if (!(await startRecording())) return;
    setUri(null);
    setElapsedMs(0);
    setPeaks([]);
    setSel({ s: 0, e: 1 });
    setPhase('recording');
    timer.current = setInterval(() => {
      setElapsedMs(currentDuration() * 1000);
      setPeaks(toBars(getPeaks(), N));
    }, 100);
  };

  const total = elapsedMs / 1000;
  const trimmedSec = (sel.e - sel.s) * total;

  const preview = () => {
    if (!uri) {
      Alert.alert('미리듣기 불가', 'uri 없음 — 녹음 저장이 안 됨');
      return;
    }
    playUri(uri, 100, sel.s * total, trimmedSec).catch((e) =>
      Alert.alert('미리듣기 실패', `${uri}\n\n${String(e)}`)
    );
  };

  // ✓ — 녹음/트림을 마치고 같은 페이지를 메모 단계로 전환. uri 없으면 무시(비활성).
  // 메모 진입과 동시에 현재 위치를 비동기로 채운다(권한 거부·실패해도 저장은 막지 않음).
  const confirm = () => {
    if (!uri) return;
    setCreatedAt((c) => c ?? Date.now());
    setPhase('memo');
    if (!loc && !locating) {
      setLocating(true);
      getCurrentLocation()
        .then((g) => {
          if (g) {
            setLoc(g);
            setLocLabel(g.label);
          }
        })
        .finally(() => setLocating(false));
    }
  };

  // SAVE — 제목 필수. 라벨 텍스트로 최종 위치를 확정(바뀌었으면 지오코딩)하고 영속화.
  const save = async () => {
    if (!uri || createdAt == null) return;
    const location = await resolveLocation(locLabel, loc ?? undefined);
    saveRecording({
      uri,
      durationMs: elapsedMs,
      sel,
      title,
      memo,
      createdAt,
      location,
      photoUri: photoUri ?? undefined,
      peaks: sliceSel(peaks, sel),
    });
    router.back();
  };

  // 파형 박스 폭 기록(제스처 px→비율 변환).
  const onBox = (e: LayoutChangeEvent) => {
    boxW.current = e.nativeEvent.layout.width;
  };

  // 터치 x(px) → 가까운 핸들을 잡아 이동. begin일 때 활성 핸들 결정, 최소 간격 보장.
  const moveHandle = (x: number, begin: boolean) => {
    if (boxW.current === 0) return;
    const v = Math.max(0, Math.min(1, x / boxW.current));
    const cur = selRef.current;
    if (begin) active.current = Math.abs(v - cur.s) <= Math.abs(v - cur.e) ? 's' : 'e';
    if (active.current === 's') setSel({ s: Math.min(v, cur.e - MIN_GAP), e: cur.e });
    else setSel({ s: cur.s, e: Math.max(v, cur.s + MIN_GAP) });
  };

  const trim = Gesture.Pan()
    .minDistance(0)
    .hitSlop({ top: 12, bottom: 12 })
    .onBegin((e) => runOnJS(moveHandle)(e.x, true))
    .onUpdate((e) => runOnJS(moveHandle)(e.x, false));

  // ── 메모 단계 ──────────────────────────────────────────────
  if (phase === 'memo') {
    const memoBars = sliceSel(peaks, sel);
    const canSave = title.trim().length > 0; // 제목만 필수 — 비면 SAVE 비활성
    return (
      <Screen>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setPhase('recorded')} hitSlop={12}>
            <AppText style={styles.close}>‹</AppText>
          </TouchableOpacity>
          <AppText style={styles.title}>ADD A MEMORY</AppText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* waveform card */}
          <View style={styles.waveCard}>
            <TouchableOpacity style={styles.playBtn} onPress={preview} activeOpacity={0.7}>
              <View style={styles.memoPlayTriangle} />
            </TouchableOpacity>
            <Waveform data={memoBars} color={colors.slateWave} minHeight={20} style={styles.memoWave} />
            <AppText style={styles.duration}>{fmt(trimmedSec * 1000)}</AppText>
          </View>

          {/* title (필수) */}
          <View>
            <AppText style={styles.fieldLabel}>TITLE</AppText>
            <TextInput
              style={[styles.titleField, styles.fieldText]}
              value={title}
              onChangeText={setTitle}
              placeholder="Rain on the café awning"
              placeholderTextColor={colors.textFainter}
              selectionColor={colors.accent}
            />
          </View>

          {/* description */}
          <View>
            <AppText style={styles.fieldLabel}>WHAT IS THIS SOUND?</AppText>
            <TextInput
              style={[styles.field, styles.fieldText]}
              value={memo}
              onChangeText={setMemo}
              placeholder="The morning it finally cooled down…"
              placeholderTextColor={colors.textFainter}
              selectionColor={colors.accent}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* date (자동, 수정 가능) */}
          <View>
            <AppText style={styles.fieldLabel}>DATE</AppText>
            {createdAt != null && <DateStepperBox dateMs={createdAt} onChange={setCreatedAt} />}
          </View>

          {/* location (자동, 라벨 수정 가능) */}
          <View>
            <AppText style={styles.fieldLabel}>LOCATION</AppText>
            <TextInput
              style={[styles.titleField, styles.fieldText]}
              value={locLabel}
              onChangeText={setLocLabel}
              placeholder={locating ? 'Locating…' : 'Add a place'}
              placeholderTextColor={colors.textFainter}
              selectionColor={colors.accent}
            />
          </View>

          {/* photo (선택) */}
          <View>
            <AppText style={styles.fieldLabel}>PHOTO</AppText>
            {photoUri ? (
              <TouchableOpacity style={styles.photoBox} onPress={() => pickPhoto(setPhotoUri)} activeOpacity={0.85}>
                <Image source={{ uri: photoUri }} style={styles.photo} />
                <View style={styles.photoChange}>
                  <AppText style={styles.photoChangeText}>CHANGE</AppText>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.photoSlot} onPress={() => pickPhoto(setPhotoUri)} activeOpacity={0.7}>
                <AppText style={styles.photoSlotText}>+ ADD PHOTO</AppText>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        {/* Buttons */}
        <View style={styles.memoButtons}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
            <AppText style={styles.cancelLabel}>CANCEL</AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.disabled]}
            onPress={save}
            disabled={!canSave}
          >
            <AppText style={styles.saveLabel}>SAVE SOUND</AppText>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  // ── 녹음/트림 단계 ─────────────────────────────────────────
  const label =
    denied ? 'MIC ACCESS DENIED'
    : phase === 'recording' ? 'RECORDING'
    : phase === 'recorded' ? 'RECORDED'
    : 'TAP TO RECORD';

  const recorded = phase === 'recorded';
  const bars = phase === 'idle' || peaks.length === 0 ? FLAT : peaks;
  // idle: 흐린 베이스라인 / recording: 전체 활성 / recorded: 선택 구간만 진하게.
  const colorFor = (i: number) => {
    if (phase === 'idle') return 'rgba(0,0,0,0.10)';
    if (!recorded) return colors.waveDark;
    const f = (i + 0.5) / N;
    return f >= sel.s && f <= sel.e ? colors.waveDark : 'rgba(0,0,0,0.16)';
  };

  const waveBox = (
    <View style={styles.waveBox} onLayout={onBox}>
      {recorded && (
        <View
          style={[styles.selTint, { left: `${sel.s * 100}%`, width: `${(sel.e - sel.s) * 100}%` }]}
        />
      )}
      <Waveform data={bars} colorFor={colorFor} style={styles.bars} />
      {recorded && <Handle left={sel.s} />}
      {recorded && <Handle left={sel.e} />}
    </View>
  );

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <AppText style={styles.close}>×</AppText>
        </TouchableOpacity>
        <AppText style={styles.title}>RECORD</AppText>
        <AppText style={styles.target}>A·01</AppText>
      </View>

      {/* Big timer */}
      <View style={styles.timerWrap}>
        <View style={styles.timerRow}>
          {phase === 'recording' && <HazeDot />}
          <AppText style={styles.timer}>{fmt(elapsedMs)}</AppText>
        </View>
        <AppText style={styles.recording}>{label}</AppText>
      </View>

      {/* Waveform + trim (녹음 중 실시간 → 정지 후 트림) */}
      <View style={styles.waveWrap}>
        {recorded ? <GestureDetector gesture={trim}>{waveBox}</GestureDetector> : waveBox}
        {recorded && (
          <View style={styles.trimLabels}>
            <AppText style={styles.trimEdge}>{fmt(sel.s * total * 1000)}</AppText>
            <AppText style={styles.trimMid}>SELECTION {fmt((sel.e - sel.s) * total * 1000)}</AppText>
            <AppText style={styles.trimEdge}>{fmt(sel.e * total * 1000)}</AppText>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.sideBtn, !uri && styles.disabled]}
          onPress={preview}
          disabled={!uri}
        >
          <View style={styles.playTriangle} />
        </TouchableOpacity>
        <RecordButton recording={phase === 'recording'} onPress={toggle} />
        <TouchableOpacity
          style={[styles.confirmBtn, phase !== 'recorded' && styles.disabled]}
          onPress={confirm}
          disabled={phase !== 'recorded'}
        >
          <View style={styles.check} />
        </TouchableOpacity>
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
  close: { fontSize: 18, color: colors.textFaint },
  headerSpacer: { width: 12 },
  title: { fontSize: 13, letterSpacing: 3, color: colors.text },
  target: { fontSize: 11, letterSpacing: 1, color: colors.textFaint },
  // timer
  timerWrap: { alignItems: 'center', marginTop: 46 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hazeDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.accent },
  timer: { fontFamily: 'JetBrainsMono_300Light', fontSize: 46, letterSpacing: 2, color: colors.text },
  recording: { fontSize: 10, letterSpacing: 3, color: colors.accentMuted, marginTop: 8 },
  // waveform
  waveWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  waveBox: { height: 210, position: 'relative' },
  selTint: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: colors.accentWave,
    borderRadius: 4,
  },
  bars: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  handle: { position: 'absolute', top: -6, bottom: -6, width: 2, marginLeft: -1, backgroundColor: colors.accent },
  grip: {
    position: 'absolute',
    top: '50%',
    marginTop: -17,
    marginLeft: -6,
    width: 14,
    height: 34,
    borderRadius: 5,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tick: { width: 1, height: 12, backgroundColor: colors.accentTint },
  trimLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 22 },
  trimEdge: { fontSize: 11, letterSpacing: 0.5, color: colors.accentMuted },
  trimMid: { fontSize: 11, letterSpacing: 0.5, color: colors.textFaint },
  // controls
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 36, paddingBottom: 44 },
  sideBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: colors.hairlineBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  playTriangle: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 11,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.bone,
  },
  recordWrap: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center' },
  recordHalo: { position: 'absolute', width: 78, height: 78, borderRadius: 39, backgroundColor: colors.accent },
  recordBtn: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordStop: { width: 24, height: 24, borderRadius: 5, backgroundColor: colors.accentDark },
  recordDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accentDark },
  confirmBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentFill08,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 14,
    height: 9,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.accent,
    transform: [{ rotate: '-45deg' }],
  },
  // ── memo 단계 ──
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 16, gap: 16 },
  waveCard: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 13,
    padding: 14,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentFill08,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoPlayTriangle: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 9,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.accent,
  },
  memoWave: { flex: 1, height: 32 },
  duration: { fontSize: 11, color: colors.textFaint },
  fieldLabel: { fontSize: 10, letterSpacing: 1.5, color: colors.textFaint, marginBottom: 9 },
  titleField: {
    borderWidth: 1,
    borderColor: colors.hairlineField,
    borderRadius: 13,
    paddingHorizontal: 15,
    paddingVertical: 13,
    backgroundColor: colors.surfaceRecessed,
  },
  field: {
    borderWidth: 1,
    borderColor: colors.hairlineField,
    borderRadius: 13,
    padding: 15,
    minHeight: 80,
    backgroundColor: colors.surfaceRecessed,
  },
  fieldText: { fontSize: 13, lineHeight: 22, color: colors.textField },
  photoSlot: {
    borderWidth: 1,
    borderColor: colors.hairlineDash,
    borderStyle: 'dashed',
    borderRadius: 13,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRecessed,
  },
  photoSlotText: { fontSize: 11, letterSpacing: 1.5, color: colors.textFaint },
  photoBox: {
    borderRadius: 13,
    overflow: 'hidden',
    height: 180,
    backgroundColor: colors.surfaceRecessed,
  },
  photo: { width: '100%', height: '100%' },
  photoChange: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  photoChangeText: { fontSize: 10, letterSpacing: 1.5, color: '#fff' },
  memoButtons: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 40 },
  cancelBtn: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairlineBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: { fontSize: 13, letterSpacing: 2, color: colors.textMuted },
  saveBtn: {
    flex: 2,
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: { fontSize: 13, letterSpacing: 2, color: colors.accentDark },
});
