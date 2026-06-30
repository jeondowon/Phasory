// PHASE 데이터 모델 (AppPlan.md §4 기반). P0 범위로 필요한 필드만 정의하고,
// fileUri/memo/waveformThumb 등은 녹음·메모 단계(P1/P2)에서 확장한다.
export type Category = 'ambient' | 'perc';

export type Sound = {
  id: string;
  name: string;
  category: Category;
  source: 'builtin' | 'userRecorded';
  // userRecorded 전용 (P2). 파일은 재인코딩하지 않고 통째로 두되, 트림 구간만 재생한다.
  uri?: string;
  offsetSec?: number; // 트림 시작(파일 내 오프셋)
  clipSec?: number; // 재생 길이(트림 구간)
  memo?: string; // "이 소리는 무엇인가" 메모
  createdAt?: number; // ms epoch
  // 기록(P4). 위치의 단일 소스는 label, lat/lng는 label에서 파생(지도 핀 좌표).
  location?: { lat: number; lng: number; label: string };
  photoUri?: string; // 첨부 사진(갤러리/촬영)
  peaks?: number[]; // 파형 썸네일용 막대 높이(%). 사진 없는 핀에 사용
};

export type Pad = {
  key: string; // '1'..'8' (뱅크 내 위치). 화면 표시 번호 = bankIndex*8 + key
  soundId: string | null; // null = 빈 패드
  volume: number; // 0..100
};

// 제너레이티브 4레버. pct는 슬라이더 위치(0..100). 화면 라벨은 저장하지 않고
// store/levers.ts의 leverLabel(key, pct)로 pct에서 실시간 파생한다.
export type Lever = {
  pct: number; // 0..100
};

export type GenerativePreset = {
  scale: Lever;
  density: Lever;
  space: Lever;
  tempo: Lever;
};
