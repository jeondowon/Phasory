// 의존성 없는 날짜(년/월/일) 스텝퍼 박스 — ADD A MEMORY와 EDIT MEMORY가 공용한다.
// 시:분은 보존하고 날짜만 조정한다. JS Date 산술이 월/일 wrap·carry를 처리.
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText } from '@/components/AppText';
import { colors } from '@/theme/colors';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Stepper({ value, onStep }: { value: string; onStep: (delta: number) => void }) {
  return (
    <View style={styles.stepRow}>
      <AppText style={styles.stepValue}>{value}</AppText>
      <View style={styles.stepBtns}>
        <TouchableOpacity style={styles.stepBtn} onPress={() => onStep(-1)} hitSlop={8}>
          <AppText style={styles.stepChevron}>‹</AppText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.stepBtn} onPress={() => onStep(1)} hitSlop={8}>
          <AppText style={styles.stepChevron}>›</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function DateStepperBox({ dateMs, onChange }: { dateMs: number; onChange: (ms: number) => void }) {
  const d = new Date(dateMs);
  const bump = (field: 'y' | 'm' | 'd', delta: number) => {
    const nd = new Date(dateMs);
    if (field === 'y') nd.setFullYear(nd.getFullYear() + delta);
    else if (field === 'm') nd.setMonth(nd.getMonth() + delta);
    else nd.setDate(nd.getDate() + delta);
    onChange(nd.getTime());
  };
  return (
    <View style={styles.dateBox}>
      <Stepper value={String(d.getFullYear())} onStep={(delta) => bump('y', delta)} />
      <View style={styles.stepDivider} />
      <Stepper value={MONTHS[d.getMonth()]} onStep={(delta) => bump('m', delta)} />
      <View style={styles.stepDivider} />
      <Stepper value={String(d.getDate())} onStep={(delta) => bump('d', delta)} />
    </View>
  );
}

const styles = StyleSheet.create({
  dateBox: {
    borderWidth: 1,
    borderColor: colors.hairlineField,
    borderRadius: 13,
    backgroundColor: colors.surfaceRecessed,
    paddingHorizontal: 15,
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  stepValue: { fontSize: 14, color: colors.textField },
  stepBtns: { flexDirection: 'row', gap: 6 },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.hairlineBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepChevron: { fontSize: 16, color: colors.textMuted },
  stepDivider: { height: 1, backgroundColor: colors.hairline },
});
