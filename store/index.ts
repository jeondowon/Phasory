// Zustand 전역 스토어 — 패드/사운드/마스터·패드 볼륨/제너레이티브 레버의 단일 출처.
// 시드 값은 기존 화면 디자인(PHASE-SPEC §3·§7)에 박혀있던 값을 그대로 옮긴 것.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Sound, Pad, GenerativePreset } from './types';

const SOUNDS: Record<string, Sound> = {
  rain: { id: 'rain', name: 'Rain', category: 'ambient', source: 'builtin' },
  ocean: { id: 'ocean', name: 'Ocean', category: 'ambient', source: 'builtin' },
  footsteps: { id: 'footsteps', name: 'Footsteps', category: 'perc', source: 'builtin' },
  catpurr: { id: 'catpurr', name: 'Cat purr', category: 'ambient', source: 'builtin' },
  wind: { id: 'wind', name: 'Wind', category: 'ambient', source: 'builtin' },
  doorknock: { id: 'doorknock', name: 'Door knock', category: 'perc', source: 'builtin' },
};

// 패드 키 = 표시 번호('1'..'8'). 배열 순서가 곧 번호.
const PADS: Pad[] = [
  { key: '1', soundId: 'rain', volume: 80 },
  { key: '2', soundId: 'ocean', volume: 55 },
  { key: '3', soundId: 'footsteps', volume: 42 },
  { key: '4', soundId: 'catpurr', volume: 48 },
  { key: '5', soundId: 'wind', volume: 64 },
  { key: '6', soundId: 'doorknock', volume: 38 },
  { key: '7', soundId: null, volume: 0 },
  { key: '8', soundId: null, volume: 0 },
];

const PRESET: GenerativePreset = {
  scale: { pct: 35 },
  density: { pct: 48 },
  space: { pct: 74 },
  tempo: { pct: 28 },
};

// 녹음 결과를 Sound로 저장할 때 받는 입력(트림 비율 + 메모). durationMs는 전체 녹음 길이.
type RecordingInput = {
  uri: string;
  durationMs: number;
  sel: { s: number; e: number };
  title: string;
  memo: string;
  createdAt: number;
};

type State = {
  master: number;
  sounds: Record<string, Sound>;
  pads: Pad[];
  activeKey: string | null; // 현재 재생/활성 패드 (디자인의 PLAYING 상태)
  preset: GenerativePreset;
  setMaster: (pct: number) => void;
  setPadVolume: (key: string, pct: number) => void;
  setActiveKey: (key: string | null) => void;
  setLever: (lever: keyof GenerativePreset, pct: number) => void;
  saveRecording: (rec: RecordingInput) => void;
  clearPad: (key: string) => void; // 패드만 비움(사운드는 라이브러리에 남음)
  deleteSound: (id: string) => void; // 사운드 영구 삭제 + 쓰던 패드 비움
  updateSound: (id: string, patch: Partial<Pick<Sound, 'name' | 'memo' | 'createdAt'>>) => void;
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      master: 72,
      sounds: SOUNDS,
      pads: PADS,
      activeKey: '1',
      preset: PRESET,
      setMaster: (pct) => set({ master: pct }),
      setPadVolume: (key, pct) =>
        set((s) => ({ pads: s.pads.map((p) => (p.key === key ? { ...p, volume: pct } : p)) })),
      setActiveKey: (key) => set({ activeKey: key }),
      setLever: (lever, pct) =>
        set((s) => ({ preset: { ...s.preset, [lever]: { ...s.preset[lever], pct } } })),
      // 녹음 결과를 Sound로 만든다. 빈 패드가 있으면 거기 자동 배치해 샘플러에서 바로 연주
      // 가능하게 한다. 트림 구간만 재생하도록 offset/clip을 박아 둔다. persist로 디스크에 남는다.
      saveRecording: ({ uri, durationMs, sel, title, memo, createdAt }) => {
        const { sounds, pads } = get();
        const id = `rec-${createdAt}`;
        const total = durationMs / 1000;
        const sound: Sound = {
          id,
          name: title.trim() || 'Untitled',
          category: 'ambient',
          source: 'userRecorded',
          uri,
          offsetSec: sel.s * total,
          clipSec: (sel.e - sel.s) * total,
          memo: memo.trim(),
          createdAt,
        };
        const emptyIdx = pads.findIndex((p) => p.soundId === null);
        const nextPads =
          emptyIdx >= 0
            ? pads.map((p, i) => (i === emptyIdx ? { ...p, soundId: id, volume: 70 } : p))
            : pads;
        set({ sounds: { ...sounds, [id]: sound }, pads: nextPads });
      },
      clearPad: (key) =>
        set((s) => ({
          pads: s.pads.map((p) => (p.key === key ? { ...p, soundId: null, volume: 0 } : p)),
        })),
      deleteSound: (id) =>
        set((s) => {
          const { [id]: _removed, ...rest } = s.sounds;
          return {
            sounds: rest,
            pads: s.pads.map((p) => (p.soundId === id ? { ...p, soundId: null, volume: 0 } : p)),
          };
        }),
      updateSound: (id, patch) =>
        set((s) => {
          const cur = s.sounds[id];
          if (!cur) return {};
          return { sounds: { ...s.sounds, [id]: { ...cur, ...patch } } };
        }),
    }),
    {
      name: 'phase-store',
      version: 1, // v0→v1: 패드 key 'A'..'K' → 순서 기반 '1'..'8'
      storage: createJSONStorage(() => AsyncStorage),
      // 영속 대상: 라이브러리/패드배치/마스터/레버. 전환적 상태(activeKey)는 저장 안 함.
      partialize: (s) => ({ sounds: s.sounds, pads: s.pads, master: s.master, preset: s.preset }),
      // 구버전 저장본의 'A'..'K' 키를 배열 순서대로 '1'..'8'로 재할당(데이터 유실 없이).
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<State>;
        if (version < 1 && Array.isArray(p.pads)) {
          p.pads = p.pads.map((pad, i) => ({ ...pad, key: String(i + 1) }));
        }
        return p as State;
      },
      // rehydrate 시 시드 빌트인을 유지하고 저장본을 얹는다(빌트인 정의가 바뀌어도 사라지지 않게).
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return { ...current, ...p, sounds: { ...current.sounds, ...(p.sounds ?? {}) } };
      },
    }
  )
);
