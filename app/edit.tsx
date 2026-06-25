// Screen — Edit a Memory. 패드 케밥(⋮) 또는 지도 상세에서 진입. 제목·설명·날짜·위치·사진 수정.
// 위치는 라벨이 단일 소스 — 라벨을 바꾸면 저장 시 forward-geocode로 지도 핀 좌표가 따라간다.
import { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, ScrollView, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { DateStepperBox } from '@/components/DateStepperBox';
import { useStore } from '@/store';
import { colors } from '@/theme/colors';
import { resolveLocation } from '@/lib/geo';
import { pickPhoto } from '@/lib/photo';

export default function EditMemoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = String(params.id ?? '');
  const sound = useStore((s) => s.sounds[id]);
  const updateSound = useStore((s) => s.updateSound);

  const [title, setTitle] = useState(sound?.name ?? '');
  const [memo, setMemo] = useState(sound?.memo ?? '');
  const [dateMs, setDateMs] = useState(sound?.createdAt ?? Date.now());
  const [locLabel, setLocLabel] = useState(sound?.location?.label ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(sound?.photoUri ?? null);

  // 사운드가 사라졌으면(삭제 등) 머무를 이유 없음.
  useEffect(() => {
    if (!sound) router.back();
  }, [sound]);
  if (!sound) return null;

  const canSave = title.trim().length > 0;

  // 라벨이 바뀌었으면 지오코딩으로 핀 좌표를 갱신(resolveLocation이 처리).
  const save = async () => {
    const location = await resolveLocation(locLabel, sound.location);
    updateSound(id, {
      name: title.trim() || 'Untitled',
      memo: memo.trim(),
      createdAt: dateMs,
      location,
      photoUri: photoUri ?? undefined,
    });
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
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
          <DateStepperBox dateMs={dateMs} onChange={setDateMs} />
        </View>

        {/* location */}
        <View>
          <AppText style={styles.fieldLabel}>LOCATION</AppText>
          <TextInput
            style={[styles.titleField, styles.fieldText]}
            value={locLabel}
            onChangeText={setLocLabel}
            placeholder="Add a place"
            placeholderTextColor={colors.textFainter}
            selectionColor={colors.accent}
          />
        </View>

        {/* photo */}
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
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <AppText style={styles.cancelLabel}>CANCEL</AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.disabled]}
          onPress={save}
          disabled={!canSave}
        >
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
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 16, gap: 16 },
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
  disabled: { opacity: 0.4 },
});
