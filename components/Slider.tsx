// 볼륨/파라미터 슬라이더 — 트랙 + 필 + 노브 (PHASE-SPEC §3.1, §3.2, §7.3).
// onChange를 주면 드래그/탭으로 값이 바뀌고, 안 주면 정적 표시(예: 디자인 고정 카드).
import { useRef } from 'react';
import { View, StyleSheet, type ViewStyle, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { colors } from '@/theme/colors';

type Props = {
  pct: number; // 0..100, fill width and knob position
  fillColor: string;
  knobColor: string;
  knobSize?: number; // 9 (pad) | 11 (master) | 12 (ambient)
  trackColor?: string;
  onChange?: (pct: number) => void; // 없으면 정적 슬라이더
  style?: ViewStyle;
};

export function Slider({
  pct,
  fillColor,
  knobColor,
  knobSize = 9,
  trackColor = colors.track,
  onChange,
  style,
}: Props) {
  const width = useRef(0);

  const onLayout = (e: LayoutChangeEvent) => {
    width.current = e.nativeEvent.layout.width;
  };

  // 컨테이너 폭 기준 x좌표 → 0..100 (트랙 = 컨테이너 폭, 패딩 없음).
  const emit = (x: number) => {
    if (!onChange || width.current === 0) return;
    onChange(Math.round(Math.max(0, Math.min(100, (x / width.current) * 100))));
  };

  // 얇은 트랙도 잡기 쉽도록 위아래로 터치 영역 확장.
  const pan = Gesture.Pan()
    .minDistance(0)
    .hitSlop({ top: 12, bottom: 12 })
    .onBegin((e) => runOnJS(emit)(e.x))
    .onUpdate((e) => runOnJS(emit)(e.x));

  const body = (
    <View style={[{ height: knobSize, justifyContent: 'center' }, style]} onLayout={onLayout}>
      <View style={[styles.track, { backgroundColor: trackColor }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: fillColor }]} />
      </View>
      <View
        style={[
          styles.knob,
          {
            width: knobSize,
            height: knobSize,
            borderRadius: knobSize / 2,
            backgroundColor: knobColor,
            left: `${pct}%`,
            marginLeft: -knobSize / 2,
          },
        ]}
      />
    </View>
  );

  if (!onChange) return body;
  return <GestureDetector gesture={pan}>{body}</GestureDetector>;
}

const styles = StyleSheet.create({
  track: { height: 3, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2 },
  knob: { position: 'absolute' },
});
