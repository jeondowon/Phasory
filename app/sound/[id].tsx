// Screen — Sound detail. 소리 지도 핀을 탭하면 진입. 기록 정보(재생·제목·설명·날짜·위치·사진)를
// 읽기 전용으로 보여주고, EDIT(→ edit 화면)와 DELETE(영구 삭제) 진입점을 둔다.
import { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Waveform } from '@/components/Waveform';
import { playUri } from '@/audio/engine';
import { useStore } from '@/store';
import { colors } from '@/theme/colors';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FLAT = Array(48).fill(8) as number[]; // peaks 없을 때 평탄 베이스라인

function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtDur(sec?: number): string {
  if (!sec) return '';
  const total = Math.floor(sec);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function SoundDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = String(params.id ?? '');
  const sound = useStore((s) => s.sounds[id]);
  const deleteSound = useStore((s) => s.deleteSound);

  // 삭제 등으로 사라지면 머무를 이유 없음.
  useEffect(() => {
    if (!sound) router.back();
  }, [sound]);
  if (!sound) return null;

  const play = () => {
    if (!sound.uri) return;
    playUri(sound.uri, 100, sound.offsetSec ?? 0, sound.clipSec).catch(() => {});
  };

  const onDelete = () => {
    Alert.alert('이 소리를 삭제할까요?', '기록(메모·사진·위치)도 함께 삭제됩니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          deleteSound(id);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <AppText style={styles.close}>×</AppText>
        </TouchableOpacity>
        <AppText style={styles.title}>SOUND</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* waveform card + play */}
        <View style={styles.waveCard}>
          <TouchableOpacity style={styles.playBtn} onPress={play} activeOpacity={0.7}>
            <View style={styles.playTriangle} />
          </TouchableOpacity>
          <Waveform data={sound.peaks ?? FLAT} color={colors.slateWave} minHeight={20} style={styles.wave} />
          <AppText style={styles.duration}>{fmtDur(sound.clipSec)}</AppText>
        </View>

        {/* title */}
        <View>
          <AppText style={styles.fieldLabel}>TITLE</AppText>
          <AppText style={styles.value}>{sound.name}</AppText>
        </View>

        {/* description */}
        {!!sound.memo && (
          <View>
            <AppText style={styles.fieldLabel}>WHAT IS THIS SOUND?</AppText>
            <AppText style={styles.valueBody}>{sound.memo}</AppText>
          </View>
        )}

        {/* date */}
        {sound.createdAt != null && (
          <View>
            <AppText style={styles.fieldLabel}>DATE</AppText>
            <AppText style={styles.value}>{fmtDate(sound.createdAt)}</AppText>
          </View>
        )}

        {/* location */}
        <View>
          <AppText style={styles.fieldLabel}>LOCATION</AppText>
          <AppText style={sound.location ? styles.value : styles.valueFaint}>
            {sound.location?.label ?? 'No location'}
          </AppText>
        </View>

        {/* photo */}
        {!!sound.photoUri && (
          <View>
            <AppText style={styles.fieldLabel}>PHOTO</AppText>
            <Image source={{ uri: sound.photoUri }} style={styles.photo} />
          </View>
        )}
      </ScrollView>

      {/* Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
          <AppText style={styles.deleteLabel}>DELETE</AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => router.push({ pathname: '/edit', params: { id } })}
        >
          <AppText style={styles.editLabel}>EDIT</AppText>
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
  content: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 16, gap: 18 },
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
  playTriangle: {
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
  wave: { flex: 1, height: 32 },
  duration: { fontSize: 11, color: colors.textFaint },
  fieldLabel: { fontSize: 10, letterSpacing: 1.5, color: colors.textFaint, marginBottom: 8 },
  value: { fontSize: 14, color: colors.text },
  valueBody: { fontSize: 13, lineHeight: 22, color: colors.textField },
  valueFaint: { fontSize: 14, color: colors.textFaint },
  photo: { width: '100%', height: 220, borderRadius: 13, backgroundColor: colors.surfaceRecessed },
  buttons: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 40 },
  deleteBtn: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairlineBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteLabel: { fontSize: 13, letterSpacing: 2, color: colors.textMuted },
  editBtn: {
    flex: 2,
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editLabel: { fontSize: 13, letterSpacing: 2, color: colors.accentDark },
});
