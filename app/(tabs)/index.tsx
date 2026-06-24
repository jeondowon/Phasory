// Screen 01 — Sampler (home). PHASE-SPEC §3.
import { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Slider } from '@/components/Slider';
import { FilledPad, ActivePad, EmptyPad } from '@/components/pads/Pad';
import { useStore } from '@/store';
import type { Pad } from '@/store/types';
import { playSound, preloadBuiltins } from '@/audio/engine';
import { colors } from '@/theme/colors';
import { glow } from '@/theme/glow';

export default function SamplerScreen() {
  const router = useRouter();
  const master = useStore((s) => s.master);
  const setMaster = useStore((s) => s.setMaster);
  const sounds = useStore((s) => s.sounds);
  const pads = useStore((s) => s.pads);
  const activeKey = useStore((s) => s.activeKey);
  const setPadVolume = useStore((s) => s.setPadVolume);
  const setActiveKey = useStore((s) => s.setActiveKey);
  const clearPad = useStore((s) => s.clearPad);
  const deleteSound = useStore((s) => s.deleteSound);
  const [menuKey, setMenuKey] = useState<string | null>(null);

  useEffect(() => {
    preloadBuiltins();
  }, []);

  // 패드 탭 → 활성 표시 + 재생. 마스터 볼륨을 곱해 최종 게인 결정.
  const tap = (pad: Pad) => {
    if (!pad.soundId) return;
    setActiveKey(pad.key);
    playSound(sounds[pad.soundId], (pad.volume * master) / 100);
  };

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

  const renderPad = (pad: Pad) => {
    const onVol = (v: number) => setPadVolume(pad.key, v);
    if (pad.soundId) {
      const sound = sounds[pad.soundId];
      if (pad.key === activeKey) {
        return <ActivePad key={pad.key} letter={pad.key} name={sound.name} volume={pad.volume} onPress={() => tap(pad)} onVolumeChange={onVol} onMenu={() => setMenuKey(pad.key)} />;
      }
      return (
        <FilledPad key={pad.key} letter={pad.key} name={sound.name} category={sound.category} volume={pad.volume} onPress={() => tap(pad)} onVolumeChange={onVol} onMenu={() => setMenuKey(pad.key)} />
      );
    }
    return <EmptyPad key={pad.key} letter={pad.key} onPress={() => router.push('/record')} />;
  };

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.brand}>
            <View style={[styles.brandDot, glow(9, 0.7)]} />
            <AppText style={styles.title}>PHASE</AppText>
          </View>
          <AppText style={styles.set}>SET 01</AppText>
        </View>
        {/* Master volume */}
        <View style={styles.masterRow}>
          <AppText style={styles.masterLabel}>MASTER</AppText>
          <Slider pct={master} fillColor={colors.bone} knobColor={colors.text} knobSize={11} style={styles.masterSlider} onChange={setMaster} />
          <AppText style={styles.masterValue}>{master}</AppText>
        </View>
      </View>

      {/* Pad grid: 4 rows × 2 cols */}
      <View style={styles.grid}>
        {[0, 2, 4, 6].map((i) => (
          <View key={i} style={styles.gridRow}>
            {renderPad(pads[i])}
            {renderPad(pads[i + 1])}
          </View>
        ))}
      </View>

      {/* Bank indicator (tab bar is the navigator's, below) */}
      <View style={styles.banks}>
        <View style={styles.bankActive} />
        <View style={styles.bankDot} />
        <View style={styles.bankDot} />
      </View>

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
  header: { paddingHorizontal: 24, paddingTop: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.accent },
  title: { fontSize: 13, letterSpacing: 3, color: colors.text },
  set: { fontSize: 11, letterSpacing: 1.5, color: colors.textFaint },
  masterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  masterLabel: { width: 54, fontSize: 10, letterSpacing: 1.5, color: colors.textFaint },
  masterSlider: { flex: 1 },
  masterValue: { width: 26, fontSize: 11, color: colors.textMuted, textAlign: 'right' },
  grid: { flex: 1, paddingHorizontal: 24, paddingTop: 20, gap: 12 },
  gridRow: { flex: 1, flexDirection: 'row', gap: 12 },
  banks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9, paddingVertical: 14 },
  bankActive: { width: 18, height: 5, borderRadius: 2.5, backgroundColor: colors.accent },
  bankDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.bankInactive },
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
