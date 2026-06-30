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

// 패드 key = 뱅크 내 위치('1'..'8'). 화면 표시 번호는 bankIndex*8 + key로 파생(섹션마다 연속).
const BANK0: Pad[] = [
  { key: '1', soundId: 'rain', volume: 80 },
  { key: '2', soundId: 'ocean', volume: 55 },
  { key: '3', soundId: 'footsteps', volume: 42 },
  { key: '4', soundId: 'catpurr', volume: 48 },
  { key: '5', soundId: 'wind', volume: 64 },
  { key: '6', soundId: 'doorknock', volume: 38 },
  { key: '7', soundId: null, volume: 0 },
  { key: '8', soundId: null, volume: 0 },
];

// 빈 8패드 섹션. 추가 섹션(결제) 및 시드 2번째 섹션에 쓴다.
const emptyBank = (): Pad[] =>
  Array.from({ length: 8 }, (_, i) => ({ key: String(i + 1), soundId: null, volume: 0 }));

// 무료로 열려 있는 섹션 2개(첫 섹션 = 빌트인 배치, 둘째 = 빈 패드). 이후는 결제로 추가.
const BANKS: Pad[][] = [BANK0, emptyBank()];

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
  location?: { lat: number; lng: number; label: string };
  photoUri?: string;
  peaks?: number[]; // 트림 구간의 파형 막대(%). 지도 핀 썸네일용
};

type State = {
  master: number;
  sounds: Record<string, Sound>;
  banks: Pad[][]; // 가변 길이(시드 2). 섹션마다 8패드. 좌우 스와이프로 전환.
  bankIndex: number; // 현재 보이는 섹션. banks.length면 '섹션 추가' 페이지.
  // 현재 재생 중인 패드들. 키 = `${섹션index}:${패드key}`, 값 = 진행 중 재생 수(겹쳐 누르면 >1).
  // 0이 되면 키 삭제 → PLAYING 해제. 패드 key가 섹션마다 중복되므로 섹션을 포함해 구분한다.
  playing: Record<string, number>;
  preset: GenerativePreset;
  setMaster: (pct: number) => void;
  setPadVolume: (key: string, pct: number) => void; // 현재 섹션의 패드
  startPlaying: (id: string) => void; // 패드 재생 시작 → 카운트 +1 (PLAYING 표시)
  endPlaying: (id: string) => void; // 재생 종료 → 카운트 −1, 0이면 해제(원상복구)
  setBank: (i: number) => void; // 섹션 전환
  addBank: () => void; // 빈 8패드 섹션 추가(결제 자리 — 지금은 UI/프로토타입용 실제 추가)
  setLever: (lever: keyof GenerativePreset, pct: number) => void;
  saveRecording: (rec: RecordingInput) => void;
  clearPad: (key: string) => void; // 현재 섹션의 패드만 비움(사운드는 라이브러리에 남음)
  deleteSound: (id: string) => void; // 사운드 영구 삭제 + 전 섹션에서 쓰던 패드 비움
  updateSound: (
    id: string,
    patch: Partial<Pick<Sound, 'name' | 'memo' | 'createdAt' | 'location' | 'photoUri'>>
  ) => void;
};

// 현재 보이는 섹션의 8패드. add 페이지(bankIndex===length)에선 마지막 실섹션으로 클램프.
export const selectCurrentPads = (s: State): Pad[] =>
  s.banks[Math.min(s.bankIndex, s.banks.length - 1)] ?? s.banks[0];

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      master: 72,
      sounds: SOUNDS,
      banks: BANKS,
      bankIndex: 0,
      playing: {},
      preset: PRESET,
      setMaster: (pct) => set({ master: pct }),
      // 패드 볼륨/클리어/녹음배치는 모두 '현재 섹션'에만 작용. 다른 섹션은 그대로 둔다.
      setPadVolume: (key, pct) =>
        set((s) => ({
          banks: s.banks.map((bank, bi) =>
            bi === s.bankIndex ? bank.map((p) => (p.key === key ? { ...p, volume: pct } : p)) : bank
          ),
        })),
      startPlaying: (id) =>
        set((s) => ({ playing: { ...s.playing, [id]: (s.playing[id] ?? 0) + 1 } })),
      endPlaying: (id) =>
        set((s) => {
          const n = (s.playing[id] ?? 0) - 1;
          if (n > 0) return { playing: { ...s.playing, [id]: n } };
          const { [id]: _done, ...rest } = s.playing;
          return { playing: rest };
        }),
      setBank: (i) => set({ bankIndex: i }),
      addBank: () =>
        set((s) => {
          const banks = [...s.banks, emptyBank()];
          return { banks, bankIndex: banks.length - 1 };
        }),
      setLever: (lever, pct) =>
        set((s) => ({ preset: { ...s.preset, [lever]: { ...s.preset[lever], pct } } })),
      // 녹음 결과를 Sound로 만든다. 현재 섹션에 빈 패드가 있으면 거기 자동 배치해 바로 연주
      // 가능하게 한다. 트림 구간만 재생하도록 offset/clip을 박아 둔다. persist로 디스크에 남는다.
      saveRecording: ({ uri, durationMs, sel, title, memo, createdAt, location, photoUri, peaks }) => {
        const { sounds, banks, bankIndex } = get();
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
          location,
          photoUri,
          peaks,
        };
        const bi = Math.min(bankIndex, banks.length - 1);
        const emptyIdx = banks[bi].findIndex((p) => p.soundId === null);
        const nextBanks =
          emptyIdx >= 0
            ? banks.map((bank, b) =>
                b === bi
                  ? bank.map((p, i) => (i === emptyIdx ? { ...p, soundId: id, volume: 70 } : p))
                  : bank
              )
            : banks;
        set({ sounds: { ...sounds, [id]: sound }, banks: nextBanks });
      },
      clearPad: (key) =>
        set((s) => ({
          banks: s.banks.map((bank, bi) =>
            bi === s.bankIndex
              ? bank.map((p) => (p.key === key ? { ...p, soundId: null, volume: 0 } : p))
              : bank
          ),
        })),
      deleteSound: (id) =>
        set((s) => {
          const { [id]: _removed, ...rest } = s.sounds;
          return {
            sounds: rest,
            banks: s.banks.map((bank) =>
              bank.map((p) => (p.soundId === id ? { ...p, soundId: null, volume: 0 } : p))
            ),
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
      version: 2, // v0→v1: 패드 key 'A'..'K'→'1'..'8'. v1→v2: pads:Pad[] → banks:Pad[][](섹션)
      storage: createJSONStorage(() => AsyncStorage),
      // 영속 대상: 라이브러리/섹션배치/마스터/레버. 전환적 상태(bankIndex/playing)는 저장 안 함.
      partialize: (s) => ({ sounds: s.sounds, banks: s.banks, master: s.master, preset: s.preset }),
      // 구버전 저장본 마이그레이션. v0: 'A'..'K'→'1'..'8'. v1: 단일 pads → 섹션 2개(기존 + 빈 섹션).
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as any;
        if (version < 1 && Array.isArray(p.pads)) {
          p.pads = p.pads.map((pad: Pad, i: number) => ({ ...pad, key: String(i + 1) }));
        }
        if (version < 2) {
          const pads = Array.isArray(p.pads) ? p.pads : [...BANK0];
          p.banks = [pads, emptyBank()];
          delete p.pads;
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
