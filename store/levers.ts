// 4레버의 pct(0..100) → 화면 라벨 매핑. 단어/개수/BPM 범위를 여기서 자유롭게 편집한다.
//
// - 이산 레버(SCALE/DENSITY/SPACE): 단어 배열을 pct에 "균등 분할"로 매핑.
//     N개 단어 → 각 구간 폭 = 100/N%.
//     예) 4단어 → 0–25 / 25–50 / 50–75 / 75–100
//         5단어 → 0–20 / 20–40 / 40–60 / 60–80 / 80–100
//   단어를 추가/삭제하면 구간이 자동으로 다시 균등 분할된다.
//
// - 연속 레버(TEMPO): pct를 BPM 범위로 선형 변환. min/max만 정하면 된다.
import type { GenerativePreset } from './types';

export const SCALE_WORDS = ['MINOR', 'PENTATONIC', 'DORIAN', 'MAJOR', 'LYDIAN'];
export const DENSITY_WORDS = ['MINIMAL', 'SPARSE', 'FLOWING', 'DENSE'];
export const SPACE_WORDS = ['DRY', 'ROOM', 'HALL', 'CATHEDRAL'];
export const TEMPO_MIN_BPM = 40;
export const TEMPO_MAX_BPM = 100;

// pct를 단어 배열 인덱스로 (균등 분할). pct=100이면 마지막 단어.
function wordAt(words: string[], pct: number): string {
  const i = Math.min(words.length - 1, Math.floor((pct / 100) * words.length));
  return words[i];
}

export function leverLabel(key: keyof GenerativePreset, pct: number): string {
  switch (key) {
    case 'scale':
      return wordAt(SCALE_WORDS, pct);
    case 'density':
      return wordAt(DENSITY_WORDS, pct);
    case 'space':
      return wordAt(SPACE_WORDS, pct);
    case 'tempo':
      return `${Math.round(TEMPO_MIN_BPM + (TEMPO_MAX_BPM - TEMPO_MIN_BPM) * (pct / 100))} BPM`;
  }
}
