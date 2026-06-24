// Procedural waveform (PHASE-SPEC §9). Bars are generated, not hand-placed.
import { View, type ViewStyle } from 'react-native';

// Deterministic organic heights, 0..100 (%). Same generator as the design.
export function gen(n: number, seed: number): number[] {
  return Array.from({ length: n }, (_, i) => {
    const v =
      0.5 +
      0.5 *
        (Math.sin(i * 0.6 + seed) * 0.5 +
          Math.sin(i * 0.27 + seed * 1.7) * 0.3 +
          Math.sin(i * 1.33 + seed * 0.5) * 0.2);
    return Math.round(Math.max(0.14, Math.min(1, v)) * 100);
  });
}

// 청크별 RMS(0..1) 배열을 n개 막대 높이(%)로 다운샘플 + 정규화.
// 각 막대는 시간 구간 하나(버킷 내 최댓값). 가장 큰 막대를 100%로 맞추고 최소 floor 보장.
export function toBars(raw: number[], n: number): number[] {
  if (raw.length === 0) return [];
  const bars = Array.from({ length: n }, (_, b) => {
    const lo = Math.floor((b / n) * raw.length);
    const hi = Math.max(lo + 1, Math.floor(((b + 1) / n) * raw.length));
    let m = 0;
    for (let i = lo; i < hi; i++) m = Math.max(m, raw[i]);
    return m;
  });
  const max = Math.max(...bars, 1e-6);
  return bars.map((v) => Math.round(Math.max(0.08, v / max) * 100));
}

type Props = {
  data: number[]; // bar heights as percent
  color?: string;
  colorFor?: (i: number) => string; // per-bar color (e.g. selection)
  gap?: number;
  minHeight?: number; // percent floor
  style?: ViewStyle; // must give the row a fixed height for % bars to resolve
};

export function Waveform({ data, color, colorFor, gap = 2, minHeight = 0, style }: Props) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>
      {data.map((h, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: `${Math.max(minHeight, h)}%`,
            borderRadius: 2,
            backgroundColor: colorFor ? colorFor(i) : color,
          }}
        />
      ))}
    </View>
  );
}
