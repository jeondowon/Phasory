// Screen — Edit a Memory. 패드 케밥(⋮) → "Edit memory"로 진입. 날짜·제목·설명 수정.
// 날짜는 의존성 없는 커스텀 스텝퍼(년/월/일)로 조정한다(시:분은 보존).
import { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, Pressable, Keyboard } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { useStore } from '@/store';
import { colors } from '@/theme/colors';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 한 줄 스텝퍼 — 값 + ‹ › (delta=-1/+1).
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

export default function EditMemoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = String(params.id ?? '');
  const sound = useStore((s) => s.sounds[id]);
  const updateSound = useStore((s) => s.updateSound);

  const [title, setTitle] = useState(sound?.name ?? '');
  const [memo, setMemo] = useState(sound?.memo ?? '');
  const [dateMs, setDateMs] = useState(sound?.createdAt ?? Date.now());

  // 사운드가 사라졌으면(삭제 등) 머무를 이유 없음.
  useEffect(() => {
    if (!sound) router.back();
  }, [sound]);
  if (!sound) return null;

  // JS Date 산술이 월/일 wrap·carry를 자동 처리(시:분은 유지).
  const d = new Date(dateMs);
  const bump = (field: 'y' | 'm' | 'd', delta: number) => {
    const nd = new Date(dateMs);
    if (field === 'y') nd.setFullYear(nd.getFullYear() + delta);
    else if (field === 'm') nd.setMonth(nd.getMonth() + delta);
    else nd.setDate(nd.getDate() + delta);
    setDateMs(nd.getTime());
  };

  const save = () => {
    updateSound(id, { name: title.trim() || 'Untitled', memo: memo.trim(), createdAt: dateMs });
    router.back();
  };

  return (
    <Screen>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <AppText style={styles.close}>×</AppText>
        </TouchableOpacity>
        <AppText style={styles.title}>EDIT MEMORY</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <Pressable style={styles.content} onPress={Keyboard.dismiss} accessible={false}>
        {/* title */}
        <View>
          <AppText style={styles.fieldLabel}>TITLE</AppText>
          <TextInput
            style={[styles.titleField, styles.fieldText]}
            value={title}
            onChangeText={setTitle}
            placeholder="Untitled"
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

        {/* date */}
        <View>
          <AppText style={styles.fieldLabel}>DATE</AppText>
          <View style={styles.dateBox}>
            <Stepper value={String(d.getFullYear())} onStep={(delta) => bump('y', delta)} />
            <View style={styles.stepDivider} />
            <Stepper value={MONTHS[d.getMonth()]} onStep={(delta) => bump('m', delta)} />
            <View style={styles.stepDivider} />
            <Stepper value={String(d.getDate())} onStep={(delta) => bump('d', delta)} />
          </View>
        </View>
      </Pressable>

      {/* Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <AppText style={styles.cancelLabel}>CANCEL</AppText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={save}>
          <AppText style={styles.saveLabel}>SAVE</AppText>
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
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 22, gap: 18 },
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
  // date stepper
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
  // buttons
  buttons: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 40 },
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
