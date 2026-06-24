// Phase Orbit — the app's signature visual (PHASE-SPEC §7.2 / §8).
// Glowing hollow dots drift at DIFFERENT speeds around concentric rings, phasing
// in and out of sync (Brian Eno style). The non-matching durations are the whole
// point — never round them to common multiples. Kept isolated per claude.md.
import { Canvas, Circle, Group, BlurMask, RadialGradient, vec } from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  useFrameCallback,
  type SharedValue,
} from 'react-native-reanimated';

const SIZE = 360;
const C = SIZE / 2; // center

// Ring diameters 312/240/168/96 → radii. Soft glow 330 → r165.
const RINGS = [156, 120, 84, 48];

type Dot = {
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

// §7.2 table, top-to-bottom.
const DOTS: Dot[] = [
  { r: 156, dur: 23000, dir: 1, phase: 0, size: 12, border: 2, color: '#D97757', glow: 'rgba(217,119,87,0.8)', glowR: 14 },
  { r: 156, dur: 31000, dir: 1, phase: 140, size: 8, border: 1.5, color: '#9a9a98', glow: 'rgba(216,209,191,0.6)', glowR: 11 },
  { r: 120, dur: 16000, dir: -1, phase: 0, size: 10, border: 1.5, color: '#5e7185', glow: 'rgba(126,144,166,0.7)', glowR: 12 },
  { r: 84, dur: 11000, dir: 1, phase: 0, size: 9, border: 1.5, color: '#9a9a98', glow: 'rgba(216,209,191,0.6)', glowR: 11 },
  { r: 84, dur: 14000, dir: -1, phase: 200, size: 7, border: 1.5, color: '#5e7185', glow: 'rgba(126,144,166,0.55)', glowR: 9 },
  { r: 48, dur: 7000, dir: -1, phase: 0, size: 8, border: 1.5, color: '#D97757', glow: 'rgba(217,119,87,0.75)', glowR: 10 },
];

function OrbitDot({ clock, d }: { clock: SharedValue<number>; d: Dot }) {
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
  return (
    <Group>
      <Circle cx={cx} cy={cy} r={rad + 2} color={d.glow}>
        <BlurMask blur={d.glowR / 2} style="normal" />
      </Circle>
      <Circle cx={cx} cy={cy} r={rad} color={d.color} style="stroke" strokeWidth={d.border} />
    </Group>
  );
}

export function PhaseOrbit() {
  const clock = useSharedValue(0);
  useFrameCallback((info) => {
    'worklet';
    clock.value = info.timeSinceFirstFrame ?? 0;
  });

  // Core pulse: scale 1→1.18 + glow 26→44px over 4.5s.
  const pulse = useDerivedValue(() => {
    'worklet';
    return (Math.sin((clock.value / 4500) * 2 * Math.PI - Math.PI / 2) + 1) / 2; // 0..1
  });
  const coreR = useDerivedValue(() => 9 + 1.62 * pulse.value); // 9 → 10.62
  const coreGlowR = useDerivedValue(() => 22 + 11 * pulse.value); // ~26 → ~44px shadow

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

      {/* orbiting dots */}
      {DOTS.map((d, i) => (
        <OrbitDot key={i} clock={clock} d={d} />
      ))}

      {/* pulsing core (the only filled dot) */}
      <Circle cx={C} cy={C} r={coreGlowR} color="rgba(217,119,87,0.55)">
        <BlurMask blur={12} style="normal" />
      </Circle>
      <Circle cx={C} cy={C} r={coreR} color="#D97757" />
    </Canvas>
  );
}
