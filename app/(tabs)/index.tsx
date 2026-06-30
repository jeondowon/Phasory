// Screen 01 — Sampler (home). PHASE-SPEC §3.
import { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, TouchableOpacity, Alert } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { HeaderGear } from '@/components/HeaderGear';
import { FilledPad, ActivePad, EmptyPad } from '@/components/pads/Pad';
import { useStore } from '@/store';
import type { Pad } from '@/store/types';
import { playSound, preloadBuiltins } from '@/audio/engine';
import { colors } from '@/theme/colors';
import { glow } from '@/theme/glow';

// Small downward chevron for the SET pill — signals the set-switcher dropdown.
function Chevron() {
  return (
    <Svg width={9} height={6} viewBox="0 0 10 6" fill="none">
      <Path d="M1 1l4 4 4-4" stroke={colors.textFaint} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function SamplerScreen() {
  const router = useRouter();
  const sounds = useStore((s) => s.sounds);
  const banks = useStore((s) => s.banks);
  const bankIndex = useStore((s) => s.bankIndex);
  const playing = useStore((s) => s.playing);
  const setPadVolume = useStore((s) => s.setPadVolume);
  const startPlaying = useStore((s) => s.startPlaying);
  const endPlaying = useStore((s) => s.endPlaying);
  const setBank = useStore((s) => s.setBank);
  const addBank = useStore((s) => s.addBank);
  const clearPad = useStore((s) => s.clearPad);
  const deleteSound = useStore((s) => s.deleteSound);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [setMenuOpen, setSetMenuOpen] = useState(false); // 헤더 SET 칩 → 세트 전환 드롭다운
  const insets = useSafeAreaInsets(); // 드롭다운은 Modal(=루트)에 떠서 노치 아래로 직접 배치
  const [vw, setVw] = useState(0); // 뷰포트(=한 페이지) 너비 — onLayout으로 측정
  const tx = useSharedValue(0); // 트랙 translateX
  const startTx = useSharedValue(0); // 제스처 시작 시점의 tx

  useEffect(() => {
    preloadBuiltins();
  }, []);

  const onAddPage = bankIndex === banks.length; // 마지막 실섹션 다음 = '섹션 추가' 페이지
  const pads = onAddPage ? [] : banks[bankIndex];
  const pageCount = banks.length + 1; // 실섹션들 + '섹션 추가' 페이지

  // bankIndex가 스와이프 외(인디케이터 탭·섹션 추가)로 바뀌어도 같은 트랙이 해당 페이지로 미끄러지게 동기화.
  useEffect(() => {
    if (vw > 0) tx.value = withTiming(-bankIndex * vw, { duration: 240 });
  }, [bankIndex, vw]);

  const trackStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  // 패드 탭 → PLAYING 표시 + 재생. 패드 볼륨이 곧 최종 게인(마스터는 ambient 전용).
  // 정체성은 섹션+패드key(키가 섹션마다 중복되므로). 재생이 끝나면 onEnded로 그 패드만
  // 해제하고, 겹쳐 누르면 카운트가 쌓여 마지막 소리가 끝날 때 복구된다.
  const tap = (pad: Pad, pageIndex: number) => {
    if (!pad.soundId) return;
    const id = `${pageIndex}:${pad.key}`;
    startPlaying(id);
    playSound(sounds[pad.soundId], pad.volume, () => endPlaying(id));
  };

  // 좌우 스와이프로 섹션 전환. 손가락을 따라 트랙이 미끄러지고(패드 볼륨 슬라이더와 충돌하지
  // 않도록 ±24px 가로 의도가 분명할 때만 활성화), 손을 놓으면 50px 넘긴 방향으로 한 칸 스냅,
  // 아니면 원위치로 복귀한다.
  const swipe = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-22, 22])
    .onStart(() => {
      startTx.value = tx.value;
    })
    .onUpdate((e) => {
      const min = -(pageCount - 1) * vw;
      const next = startTx.value + e.translationX;
      tx.value = next > 0 ? 0 : next < min ? min : next; // 양 끝 너머로는 끌리지 않게 클램프
    })
    .onEnd((e) => {
      let target = bankIndex;
      if (e.translationX <= -50 && bankIndex < pageCount - 1) target = bankIndex + 1;
      else if (e.translationX >= 50 && bankIndex > 0) target = bankIndex - 1;
      tx.value = withTiming(-target * vw, { duration: 240 });
      if (target !== bankIndex) runOnJS(setBank)(target);
    });

  const menuPad = menuKey ? pads.find((p) => p.key === menuKey) ?? null : null;
  const menuSound = menuPad?.soundId ? sounds[menuPad.soundId] : null;

  const closeMenu = () => setMenuKey(null);

  const onEdit = () => {
    if (!menuSound) return;
    const id = menuSound.id;
    closeMenu();
    router.push({ pathname: '/edit', params: { id } });
  };

  const onDelete = () => {
    if (!menuSound) return;
    const { id, name } = menuSound;
    closeMenu();
    Alert.alert('Delete sound', `"${name}" 을(를) 영구 삭제할까요?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSound(id) },
    ]);
  };

  const onClear = () => {
    if (!menuPad) return;
    clearPad(menuPad.key);
    closeMenu();
  };

  // 패드 표시 번호 = 섹션 오프셋 + 위치(섹션마다 연속: 1-8, 9-16, 17-24…).
  // 모든 섹션을 동시에 렌더하므로 라벨/활성 표시는 현재 bankIndex가 아니라 그 페이지 인덱스 기준.
  const renderPad = (pad: Pad, pageIndex: number) => {
    const label = String(pageIndex * 8 + Number(pad.key));
    const onVol = (v: number) => setPadVolume(pad.key, v);
    if (pad.soundId) {
      const sound = sounds[pad.soundId];
      if (playing[`${pageIndex}:${pad.key}`]) {
        return <ActivePad key={pad.key} letter={label} name={sound.name} volume={pad.volume} onPress={() => tap(pad, pageIndex)} onVolumeChange={onVol} onMenu={() => setMenuKey(pad.key)} />;
      }
      return (
        <FilledPad key={pad.key} letter={label} name={sound.name} category={sound.category} volume={pad.volume} onPress={() => tap(pad, pageIndex)} onVolumeChange={onVol} onMenu={() => setMenuKey(pad.key)} />
      );
    }
    return <EmptyPad key={pad.key} letter={label} onPress={() => router.push('/record')} />;
  };

  return (
    <Screen>
      {/* Header — wordmark + pulse dot on the left; the SET pill (set switcher) and the
          settings gear on the right. The bottom nav stays reserved for destinations. */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.brand}>
            <View style={[styles.brandDot, glow(9, 0.7)]} />
            <AppText style={styles.title}>PHASE</AppText>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.setPill} onPress={() => setSetMenuOpen(true)} activeOpacity={0.7}>
              <AppText style={styles.setPillText}>
                {onAddPage ? 'NEW SET' : `SET ${String(bankIndex + 1).padStart(2, '0')}`}
              </AppText>
              <Chevron />
            </TouchableOpacity>
            <HeaderGear />
          </View>
        </View>
      </View>

      {/* Swipeable section carousel: every section + the "add section" page laid out in a row.
          The track slides under the finger and snaps; the viewport clips to one page width. */}
      <GestureDetector gesture={swipe}>
        <View style={styles.viewport} onLayout={(e) => setVw(e.nativeEvent.layout.width)}>
          <Animated.View style={[styles.track, { width: vw * pageCount }, trackStyle]}>
            {banks.map((bankPads, page) => (
              <View key={page} style={{ width: vw }}>
                <View style={styles.grid}>
                  {[0, 2, 4, 6].map((i) => (
                    <View key={i} style={styles.gridRow}>
                      {renderPad(bankPads[i], page)}
                      {renderPad(bankPads[i + 1], page)}
                    </View>
                  ))}
                </View>
              </View>
            ))}
            {/* Last page: add a new section */}
            <View key="add" style={{ width: vw }}>
              <View style={styles.addPage}>
                <View style={styles.addCard}>
                  <View style={styles.addPlusBox}>
                    <AppText style={styles.addPlus}>+</AppText>
                  </View>
                  <AppText style={styles.addTitle}>SECTION {banks.length + 1}</AppText>
                  <AppText style={styles.addBody}>
                    섹션을 추가하면 패드 8개{'('}
                    {banks.length * 8 + 1}–{banks.length * 8 + 8}
                    {')'}가 더 생깁니다.{'\n'}섹션 추가는 무제한이며, 하나당 결제가 필요합니다.
                  </AppText>
                  <TouchableOpacity style={[styles.addBtn, glow(16, 0.18)]} onPress={addBank} activeOpacity={0.85}>
                    <AppText style={styles.addBtnLabel}>UNLOCK SECTION</AppText>
                    <AppText style={styles.addBtnPrice}>$1.99 · ONE-TIME</AppText>
                  </TouchableOpacity>
                  <AppText style={styles.addNote}>결제 연동은 추후 제공 예정</AppText>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Set switcher dropdown (opened from the header pill): every existing set + add a new one. */}
      <Modal visible={setMenuOpen} transparent animationType="fade" onRequestClose={() => setSetMenuOpen(false)}>
        <Pressable style={styles.setMenuBackdrop} onPress={() => setSetMenuOpen(false)}>
          <View style={[styles.setMenu, { top: insets.top + 48 }]}>
            {banks.map((_, i) => {
              const active = !onAddPage && i === bankIndex;
              return (
                <TouchableOpacity
                  key={i}
                  style={styles.setMenuItem}
                  onPress={() => {
                    setBank(i);
                    setSetMenuOpen(false);
                  }}
                >
                  <AppText style={[styles.setMenuLabel, active && styles.setMenuLabelActive]}>
                    {`SET ${String(i + 1).padStart(2, '0')}`}
                  </AppText>
                  {active && <View style={styles.setMenuDot} />}
                </TouchableOpacity>
              );
            })}
            <View style={styles.setMenuDivider} />
            <TouchableOpacity
              style={styles.setMenuItem}
              onPress={() => {
                setBank(banks.length);
                setSetMenuOpen(false);
              }}
            >
              <AppText style={[styles.setMenuAdd, onAddPage && styles.setMenuLabelActive]}>+ NEW SET</AppText>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Pad action menu (kebab). userRecorded → Edit/Delete, builtin → Clear pad. */}
      <Modal visible={menuPad !== null} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.menuOverlay} onPress={closeMenu}>
          <View style={styles.menuSheet}>
            <AppText style={styles.menuTitle}>{menuSound?.name ?? ''}</AppText>
            {menuSound?.source === 'userRecorded' ? (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={onEdit}>
                  <AppText style={styles.menuLabel}>EDIT MEMORY</AppText>
                </TouchableOpacity>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={onDelete}>
                  <AppText style={styles.menuDanger}>DELETE SOUND</AppText>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.menuItem} onPress={onClear}>
                <AppText style={styles.menuLabel}>CLEAR PAD</AppText>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingTop: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.accent },
  title: { fontSize: 14, letterSpacing: 4, color: colors.text },
  // right cluster: SET pill (set switcher) + settings gear
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  setPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.hairlineField,
    borderRadius: 9,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  setPillText: { fontSize: 11, letterSpacing: 1.5, color: colors.textMuted },
  // carousel: viewport clips to one page; track holds all pages in a row and slides
  viewport: { flex: 1, overflow: 'hidden' },
  track: { flex: 1, flexDirection: 'row' },
  grid: { flex: 1, paddingHorizontal: 24, paddingVertical: 24, gap: 12 },
  gridRow: { flex: 1, flexDirection: 'row', gap: 12 },
  // add-section page
  addPage: { flex: 1, paddingHorizontal: 24, paddingTop: 20, alignItems: 'center', justifyContent: 'center' },
  addCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 16,
    paddingHorizontal: 26,
    paddingVertical: 34,
    alignItems: 'center',
    gap: 16,
  },
  addPlusBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairlineDash,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlus: { fontSize: 24, color: colors.textFaint, marginTop: -2 },
  addTitle: { fontSize: 12, letterSpacing: 2, color: colors.text },
  addBody: { fontSize: 11, lineHeight: 18, letterSpacing: 0.3, color: colors.textMuted, textAlign: 'center' },
  addBtn: {
    marginTop: 4,
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 3,
  },
  addBtnLabel: { fontSize: 12, letterSpacing: 2, color: colors.accentDark },
  addBtnPrice: { fontSize: 9, letterSpacing: 1, color: colors.accentDark, opacity: 0.7 },
  addNote: { fontSize: 9, letterSpacing: 0.5, color: colors.textFainter },
  // set switcher dropdown (anchored under the header pill)
  setMenuBackdrop: { flex: 1 },
  setMenu: {
    position: 'absolute',
    right: 24,
    minWidth: 152,
    backgroundColor: colors.screenBg,
    borderWidth: 1,
    borderColor: colors.hairlineField,
    borderRadius: 12,
    paddingVertical: 6,
  },
  setMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  setMenuLabel: { fontSize: 12, letterSpacing: 1.5, color: colors.textMuted },
  setMenuLabelActive: { color: colors.text },
  setMenuDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.accent },
  setMenuDivider: { height: 1, backgroundColor: colors.hairline, marginVertical: 4, marginHorizontal: 16 },
  setMenuAdd: { fontSize: 12, letterSpacing: 1.5, color: colors.textFaint },
  // pad action menu (bottom sheet)
  menuOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.18)' },
  menuSheet: {
    backgroundColor: colors.screenBg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 36,
  },
  menuTitle: { fontSize: 11, letterSpacing: 1.5, color: colors.textFaint, marginBottom: 8 },
  menuItem: { paddingVertical: 16 },
  menuLabel: { fontSize: 13, letterSpacing: 2, color: colors.text },
  menuDanger: { fontSize: 13, letterSpacing: 2, color: colors.accent },
  menuDivider: { height: 1, backgroundColor: colors.hairline },
});
