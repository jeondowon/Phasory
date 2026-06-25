// Phase Orbit — the app's signature visual (PHASE-SPEC §7.2 / §8).
// Glowing hollow dots drift at DIFFERENT speeds around concentric rings, phasing
// in and out of sync (Brian Eno style). The non-matching durations are the whole
// point — never round them to common multiples. Kept isolated per claude.md.
//
// 도트 = 패드(key '1'..'8'). 사운드가 배치된 패드만 그린다(빈 패드 = 도트 없음). 색/링/회전
// 주기는 패드 위치 기반 고정. transport가 그 패드를 트리거하면 도트가 반짝였다 사그라든다
// (참고 phase-orbit-reference.html ③). PhaseOrbit이 transport currentTime/트리거를 구독한다.
import { useEffect } from 'react';
import { Canvas, Circle, Group, BlurMask, RadialGradient, vec } from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  useFrameCallback,
  type SharedValue,
} from 'react-native-reanimated';
import type { Pad } from '@/store/types';
import * as transport from '@/audio/transport';

const SIZE = 360;
const C = SIZE / 2; // center

// Ring diameters 312/240/168/96 → radii. Soft glow 330 → r165.
const RINGS = [156, 120, 84, 48];
const FADE_MS = 800; // 트리거 glow가 사그라드는 시간

type DotSpec = {
  r: number; // orbit radius (= ring radius)
  dur: number; // ms per revolution
  dir: 1 | -1; // -1 = reverse
  phase: number; // initial offset (deg)
  size: number; // dot diameter
  border: number;
  color: string;
  glow: string;
  glowR: number; // css blur radius
};

// 디자인 토큰 색(claude.md): accent 주황은 절제, slate=텍스처, bone=퍼커시브.
const ACCENT = { color: '#D97757', glow: 'rgba(217,119,87,0.8)' };
const SLATE = { color: '#5e7185', glow: 'rgba(126,144,166,0.7)' };
const BONE = { color: '#9a9a98', glow: 'rgba(216,209,191,0.6)' };

// 패드 key '1'..'8' 고정 도트 속성. dur 23/31/16/19/11/14/7/29초 — 23·31·19·11·7·29가 소수라
// 최소공배수가 사실상 무한 → 절대 같은 패턴으로 반복되지 않음(위상 어긋남 보존). 색은 위치
// 기반: accent는 1·7번만, 나머지 slate/bone 교차(주황 남발 금지). 4링에 2도트씩 분산.
const PAD_DOTS: Record<string, DotSpec> = {
  '1': { r: 156, dur: 23000, dir: 1, phase: 0, size: 12, border: 2, glowR: 14, ...ACCENT },
  '2': { r: 156, dur: 31000, dir: 1, phase: 140, size: 8, border: 1.5, glowR: 11, ...SLATE },
  '3': { r: 120, dur: 16000, dir: -1, phase: 30, size: 10, border: 1.5, glowR: 12, ...BONE },
  '4': { r: 120, dur: 19000, dir: 1, phase: 200, size: 8, border: 1.5, glowR: 10, ...SLATE },
  '5': { r: 84, dur: 11000, dir: 1, phase: 0, size: 9, border: 1.5, glowR: 11, ...BONE },
  '6': { r: 84, dur: 14000, dir: -1, phase: 200, size: 7, border: 1.5, glowR: 9, ...SLATE },
  '7': { r: 48, dur: 7000, dir: -1, phase: 0, size: 8, border: 1.5, glowR: 10, ...ACCENT },
  '8': { r: 48, dur: 29000, dir: 1, phase: 260, size: 7, border: 1.5, glowR: 9, ...BONE },
};

function OrbitDot({
  clock,
  glows,
  d,
  padKey,
}: {
  clock: SharedValue<number>;
  glows: SharedValue<Record<string, number>>;
  d: DotSpec;
  padKey: string;
}) {
  const rad = d.size / 2;
  const cx = useDerivedValue(() => {
    'worklet';
    const theta = (d.phase * Math.PI) / 180 + d.dir * (clock.value / d.dur) * 2 * Math.PI;
    return C + d.r * Math.sin(theta);
  });
  const cy = useDerivedValue(() => {
    'worklet';
    const theta = (d.phase * Math.PI) / 180 + d.dir * (clock.value / d.dur) * 2 * Math.PI;
    return C - d.r * Math.cos(theta);
  });
  // 현재 glow(0..1) — 부모 frame callback이 트리거 시 1로 점화하고 매 프레임 감쇠시킨다.
  const glow = useDerivedValue(() => {
    'worklet';
    return glows.value[padKey] ?? 0;
  });
  const fireR = useDerivedValue(() => rad + 4 + glow.value * 9);
  return (
    <Group>
      {/* 평상시 정적 glow */}
      <Circle cx={cx} cy={cy} r={rad + 2} color={d.glow}>
        <BlurMask blur={d.glowR / 2} style="normal" />
      </Circle>
      {/* 트리거 glow — 그 소리가 울릴 때 부풀었다 사그라듦 */}
      <Circle cx={cx} cy={cy} r={fireR} color={d.color} opacity={glow}>
        <BlurMask blur={8} style="normal" />
      </Circle>
      {/* hollow 도트 */}
      <Circle cx={cx} cy={cy} r={rad} color={d.color} style="stroke" strokeWidth={d.border} />
    </Group>
  );
}

// TEMPO pct(0..100) → 회전 속도 배율. 모든 도트에 같은 배율을 곱하므로 서로 다른 dur의
// 위상 비율은 그대로 보존된다.
function rateFromTempo(pct: number): number {
  return 0.6 + 0.9 * (pct / 100); // 0.6..1.5
}

// transport 구동: 재생 중에만 회전 시계(clock)가 흐르고(정지 시 멈춤), TEMPO가 회전 속도에
// 반영된다. nowMs(절대 진행 시각)는 항상 흐르며 트리거 glow 페이드의 기준이 된다.
export function PhaseOrbit({
  playing = false,
  tempoPct = 50,
  pads = [],
}: {
  playing?: boolean;
  tempoPct?: number;
  pads?: Pad[];
}) {
  const clock = useSharedValue(0);
  const glows = useSharedValue<Record<string, number>>({}); // 패드 key → 현재 glow(0..1)
  const playingSV = useSharedValue(playing);
  const rateSV = useSharedValue(rateFromTempo(tempoPct));
  useEffect(() => {
    playingSV.value = playing;
  }, [playing, playingSV]);
  useEffect(() => {
    rateSV.value = rateFromTempo(tempoPct);
  }, [tempoPct, rateSV]);

  // transport 트리거 구독: 그 패드가 울리면 해당 도트 glow를 1로 점화(감쇠는 frame callback).
  useEffect(() => {
    transport.setOnTrigger((key) => {
      glows.value = { ...glows.value, [key]: 1 };
    });
    return () => transport.setOnTrigger(null);
  }, [glows]);

  useFrameCallback((info) => {
    'worklet';
    const dt = info.timeSincePreviousFrame ?? 0;
    if (playingSV.value) clock.value += dt * rateSV.value;
    // 트리거 glow 감쇠(재생과 무관하게 항상). 절대 시계에 의존하지 않아 리렌더에도 안전하고
    // 값이 항상 0..1로 유지된다.
    const g = glows.value;
    let changed = false;
    const next: Record<string, number> = {};
    for (const k in g) {
      const v = g[k];
      next[k] = v > 0 ? Math.max(0, v - dt / FADE_MS) : 0;
      if (v > 0) changed = true;
    }
    if (changed) glows.value = next;
  });

  // Core pulse: scale 1→1.18 + glow 26→44px over 4.5s.
  const pulse = useDerivedValue(() => {
    'worklet';
    return (Math.sin((clock.value / 4500) * 2 * Math.PI - Math.PI / 2) + 1) / 2; // 0..1
  });
  const coreR = useDerivedValue(() => 9 + 1.62 * pulse.value); // 9 → 10.62
  const coreGlowR = useDerivedValue(() => 22 + 11 * pulse.value); // ~26 → ~44px shadow

  // 사운드가 배치된 패드만 도트로 (빈 패드 = 도트 없음).
  const activeKeys = pads.filter((p) => p.soundId && PAD_DOTS[p.key]).map((p) => p.key);

  return (
    <Canvas style={{ width: SIZE, height: SIZE }}>
      {/* soft radial glow */}
      <Circle cx={C} cy={C} r={165}>
        <RadialGradient
          c={vec(C, C)}
          r={165}
          colors={['rgba(217,119,87,0.10)', 'rgba(217,119,87,0)']}
          positions={[0, 0.62]}
        />
      </Circle>

      {/* static concentric rings */}
      {RINGS.map((r) => (
        <Circle key={r} cx={C} cy={C} r={r} color="rgba(0,0,0,0.06)" style="stroke" strokeWidth={1} />
      ))}

      {/* orbiting dots — one per sound-loaded pad */}
      {activeKeys.map((key) => (
        <OrbitDot key={key} clock={clock} glows={glows} d={PAD_DOTS[key]} padKey={key} />
      ))}

      {/* pulsing core (the only filled dot) */}
      <Circle cx={C} cy={C} r={coreGlowR} color="rgba(217,119,87,0.55)">
        <BlurMask blur={12} style="normal" />
      </Circle>
      <Circle cx={C} cy={C} r={coreR} color="#D97757" />
    </Canvas>
  );
}
