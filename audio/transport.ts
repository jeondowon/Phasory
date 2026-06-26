// 제너레이티브 트랜스포트 — 8패드에 올라간 사운드를 4레버에 따라 무한 스케줄링해 하나의
// 공간적 앰비언트로 엮는다(claude.md: audio/는 UI와 독립). 표준 Web Audio lookahead
// 스케줄러를 쓴다: JS 타이머가 주기적으로 깨어나 currentTime 기준 조금 앞 구간을 예약한다
// (start()는 항상 currentTime 기준 — 과거 시각 예약 시 무음이 되는 재생버그 방지).
//
// 레버 매핑(SCALE은 현재 라벨 전용이라 출력 미연결):
//   TEMPO   → 틱 간격(BPM)            DENSITY → 틱당 패드 발화 확률(동시 보이스 수)
//   SPACE   → 메아리(탭) 개수로 잔향: DRY=0 ROOM=1 HALL=2 CATHEDRAL=3 (보이스 복제 방식)
import {
  AudioContext,
  type AudioBuffer,
  type AudioNode,
  type GainNode,
  type WaveShaperNode,
} from 'react-native-audio-api';
import type { Sound, Pad, GenerativePreset } from '../store/types';
import { TEMPO_MIN_BPM, TEMPO_MAX_BPM, SPACE_WORDS } from '../store/levers';
import { ensureAudioSession } from './session';
import { getContext, loadSound } from './engine';

const LOOKAHEAD_MS = 100; // 타이머 주기
const SCHEDULE_AHEAD_SEC = 0.2; // 미리 예약하는 구간

export type TransportParams = {
  pads: Pad[];
  sounds: Record<string, Sound>;
  master: number; // 0..100
  preset: GenerativePreset;
};

let params: TransportParams | null = null;
let playing = false;
let timer: ReturnType<typeof setInterval> | null = null;
let nextTickTime = 0; // 다음 틱의 컨텍스트 절대 시각(초)

// Fast Refresh(HMR)로 이 모듈이 교체될 때 이전 setInterval이 정리되지 않고 좀비로 남으면,
// 같은 AudioContext에 스케줄러가 중복 실행되어 소리가 겹쳐 빨라지고(배속) 깨진다. 전역에
// 타이머 핸들을 보관해, 모듈이 다시 평가될 때 이전 타이머를 확실히 정리한다(프로덕션 무영향).
const G = globalThis as unknown as {
  __phaseTransportTimer?: ReturnType<typeof setInterval> | null;
};
if (G.__phaseTransportTimer != null) {
  clearInterval(G.__phaseTransportTimer);
  G.__phaseTransportTimer = null;
}

// 트리거 구독자(PhaseOrbit). 사운드가 실제로 울리는 시점(when)에 패드 key로 호출 → 도트 glow.
// UI 독립을 위해 reanimated에 의존하지 않고 단순 콜백만 노출한다.
let onTrigger: ((padKey: string) => void) | null = null;
export function setOnTrigger(cb: ((padKey: string) => void) | null): void {
  onTrigger = cb;
}

// 마스터 버스: 모든 보이스(원음·메아리) → masterGain → limiter → destination (단일 직렬).
// ★audio-api 0.11.0은 한 노드를 두 번 연결해 같은 목적지에서 다시 만나는 '다이아몬드' 그래프를
// 렌더하지 못한다(마지막 연결만 남고 나머지는 무음). 그래서 dry/wet을 노드로 분기하지 않고,
// 잔향(메아리)도 원음처럼 '독립 보이스'로 만들어 masterGain에 합류시킨다(샘플러 engine.ts와 동일 패턴).
// 컨텍스트당 한 번만 만든다. busCtx로 어떤 컨텍스트에 묶였는지 추적(녹음 후 교체되면 재구성).
let busCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let limiter: WaveShaperNode | null = null; // 출력단 소프트 리미터(클리핑 방지)

// soundId → 디코드된 버퍼. 스케줄은 동기 타이머에서 일어나 await할 수 없으므로, 미리
// 채워둔(prime) 버퍼만 그 틱에 연주한다.
const ready = new Map<string, AudioBuffer>();

// 패드 key → 그 패드 사운드의 재생 종료 예정 시각(컨텍스트 절대 시각). 재생이 끝나기 전엔
// 같은 패드를 다시 트리거하지 않아, 긴 사운드가 겹쳐 쌓이며 음이 깨지는 것을 막는다.
const lastEnd = new Map<string, number>();

function bpmInterval(pct: number): number {
  const bpm = TEMPO_MIN_BPM + (TEMPO_MAX_BPM - TEMPO_MIN_BPM) * (pct / 100);
  return 60 / bpm; // 1박 간격(초)
}
function densityProb(pct: number): number {
  return 0.1 + 0.78 * (pct / 100); // 패드당 발화 확률 0.1..0.88
}
// tanh 소프트클립 커브 — 여러 보이스가 겹쳐 합산 신호가 ±1을 넘어도 찢어지지 않고 부드럽게
// 압축한다(디지털 클리핑 방지). 입력이 [-1,1]을 벗어나면 WaveShaper가 끝값으로 클램프하므로
// 자연스러운 리미팅이 된다.
function makeSoftClipCurve(): Float32Array {
  const N = 1024;
  const curve = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 - 1; // -1..1
    curve[i] = Math.tanh(x * 1.5);
  }
  return curve;
}

// 메아리(탭) 리버브 — buildReverb/convolver 같은 마스터 버스 이펙트는 전부 '다이아몬드'라
// 0.11.0에서 렌더가 깨졌다(위 마스터 버스 주석 참고). 대신 발화마다 원음 버퍼를 조금씩 늦게
// 재생하는 독립 보이스(메아리)를 SPACE 단계 수만큼 띄워 잔향을 만든다(delay 노드도 불필요).
const REVERB_TAP_DELAYS = [0.07, 0.13, 0.19]; // 메아리 i의 지연(초). 앞에서부터 사용.
const REVERB_TAP_DECAY = 0.6; // 메아리 게인 감쇠(0.6^(i+1) — 뒤 메아리일수록 작게)
const REVERB_DAMP_HZ = 2600; // 메아리 lowpass — 어두운 꼬리
const REVERB_WET = 0.7; // 메아리 전체 레벨(원음 대비)

// SPACE 단어 인덱스(DRY=0, ROOM=1, HALL=2, CATHEDRAL=3)를 그대로 메아리 개수로 쓴다.
// DRY는 0개라 잔향 없이 원음만 — 보이스 복제도 없어 가장 가볍다.
function spaceTaps(pct: number): number {
  const idx = Math.min(SPACE_WORDS.length - 1, Math.floor((pct / 100) * SPACE_WORDS.length));
  return Math.min(idx, REVERB_TAP_DELAYS.length);
}

function buildBus(c: AudioContext): void {
  masterGain = c.createGain();
  masterGain.gain.value = 0.8; // 리미터 앞 헤드룸

  limiter = c.createWaveShaper();
  limiter.curve = makeSoftClipCurve();
  limiter.oversample = 'none'; // 가벼운 tanh 클립이라 오버샘플 불필요(CPU 절약)

  // 모든 보이스(원음·메아리) → masterGain → limiter → destination. 단일 직렬이라 다이아몬드 없음.
  masterGain.connect(limiter);
  limiter.connect(c.destination);

  busCtx = c;
}

// 패드 사운드 버퍼를 디코드(스케줄 시점 동기 접근용). 이미 있으면 건너뜀. 모든 디코드가
// 끝나면 resolve → 재생 시작 전 await해 재생 중 디코드 글리치를 막는다.
async function prime(p: TransportParams): Promise<void> {
  const jobs: Promise<void>[] = [];
  for (const pad of p.pads) {
    if (!pad.soundId || pad.volume <= 0) continue;
    if (ready.has(pad.soundId)) continue;
    const sound = p.sounds[pad.soundId];
    if (!sound) continue;
    const soundId = pad.soundId;
    jobs.push(
      loadSound(sound)
        .then((buf) => {
          if (buf) ready.set(soundId, buf);
        })
        .catch(() => {})
    );
  }
  await Promise.all(jobs);
}

// 라이브 파라미터 갱신(슬라이더가 재생 중 움직여도 반영). 모두 다음 틱부터 반영된다.
export function setParams(p: TransportParams): void {
  params = p;
  void prime(p);
}

// 한 틱(time t)에 DENSITY 확률로 패드들을 골라 발화. 공간감=랜덤 팬 + 약간의 타이밍 흔들림.
function scheduleTick(t: number): void {
  if (!params || !masterGain) return;
  const mg = masterGain; // 클로저(playVoice)에서 non-null로 캡처
  const c = getContext();
  // 이 틱 시각이 이미 지났으면(엔진 시작 직후 currentTime 점프 등) 통째로 건너뛴다. 밀린
  // 틱을 현재에 몰아 동시 발화시키면 배속·클리핑이 생긴다(lookahead는 미래만 예약한다).
  if (t <= c.currentTime) return;
  const { pads, sounds, master, preset } = params;
  const prob = densityProb(preset.density.pct);
  const interval = bpmInterval(preset.tempo.pct);
  for (const pad of pads) {
    if (!pad.soundId || pad.volume <= 0) continue;
    const buf = ready.get(pad.soundId);
    if (!buf) continue;
    if (Math.random() > prob) continue;
    const sound = sounds[pad.soundId];
    if (!sound) continue;

    const jitter = Math.random() * interval * 0.15; // 0..+ 미세 지연(기계적 정렬 방지). t가
    const when = t + jitter; // 이미 미래(위에서 보장)이므로 currentTime으로 클램프하지 않는다.
    // 같은 패드 사운드가 아직 재생 중이면 건너뛴다(겹쳐 쌓여 깨지는 것 방지).
    if (when < (lastEnd.get(pad.key) ?? 0)) continue;
    const playLen =
      sound.source === 'userRecorded' && sound.clipSec != null ? sound.clipSec : buf.duration;
    lastEnd.set(pad.key, when + playLen);

    const vol = (pad.volume * master) / 10000; // (0..100)·(0..100)/10000 = 0..1
    const baseVol = Math.max(0, Math.min(1, vol));
    const taps = spaceTaps(preset.space.pct);

    // 원음 1 + 메아리 taps개를 각각 '독립 보이스'로 띄운다. 보이스 하나 = src→gain→(lowpass)→pan
    // →masterGain 한 줄이라 분기/재합류(다이아몬드)가 없다. 메아리는 같은 버퍼를 조금 늦게(start
    // 시각만 지연) 재생하므로 delay 노드도 필요 없다 — 점점 늦고·작고·어둡고·넓게 퍼진다.
    const playVoice = (gainValue: number, panSpread: number, at: number, lowpass: boolean) => {
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      g.gain.value = gainValue;
      const pan = c.createStereoPanner();
      pan.pan.value = (Math.random() * 2 - 1) * panSpread;
      src.connect(g);
      let tail: AudioNode = g;
      if (lowpass) {
        const damp = c.createBiquadFilter();
        damp.type = 'lowpass';
        damp.frequency.value = REVERB_DAMP_HZ;
        g.connect(damp);
        tail = damp;
      }
      tail.connect(pan);
      pan.connect(mg);
      if (sound.source === 'userRecorded' && sound.uri) {
        src.start(at, sound.offsetSec ?? 0, sound.clipSec);
      } else {
        src.start(at);
      }
    };

    // 원음(dry): 0.7..1.0배 게인 흔들림, lowpass 없음
    playVoice(baseVol * (0.7 + Math.random() * 0.3), 0.7, when, false);
    // 메아리(wet 탭): 늦게·작게(decay)·어둡게(lowpass)·넓게(pan)
    for (let i = 0; i < taps; i++) {
      const echoGain = baseVol * REVERB_WET * Math.pow(REVERB_TAP_DECAY, i + 1);
      playVoice(echoGain, 0.9, when + REVERB_TAP_DELAYS[i], true);
    }

    // 실제로 울리는 시점(when)에 맞춰 도트 glow를 깨운다(lookahead만큼 지연). 정지/언마운트 후
    // onTrigger가 null이면 no-op.
    if (onTrigger) {
      const key = pad.key;
      setTimeout(() => onTrigger?.(key), Math.max(0, (when - c.currentTime) * 1000));
    }
  }
}

// lookahead 루프: 예약 지평선(currentTime + SCHEDULE_AHEAD) 안에 든 틱을 모두 예약하고
// 다음 틱 시각을 TEMPO 간격만큼 전진. 간격은 매 틱 다시 읽어 템포 변경이 바로 반영된다.
function loop(): void {
  if (!playing || !params) return;
  const c = getContext();
  // 타이머가 밀려 nextTickTime이 과거로 처지면, 밀린 틱들이 모두 currentTime에 클램프되어
  // 한꺼번에 시작 → 피크가 튄다(지직). 현재 시점으로 당겨 동시 몰림을 막는다.
  if (nextTickTime < c.currentTime) nextTickTime = c.currentTime + 0.05;
  while (nextTickTime < c.currentTime + SCHEDULE_AHEAD_SEC) {
    scheduleTick(nextTickTime);
    nextTickTime += bpmInterval(params.preset.tempo.pct);
  }
}

export async function start(): Promise<void> {
  if (playing || !params) return;
  playing = true; // 동기 선점 — await 사이 더블탭으로 타이머가 두 개 생기는 것을 막는다.
  try {
    await ensureAudioSession();
    const c = getContext();
    if (c.state === 'suspended') await c.resume();
    // 컨텍스트가 새로 생겼으면(녹음 후 교체 등) 버스와 디코드 캐시를 재구성한다.
    if (!masterGain || busCtx !== c) {
      ready.clear();
      buildBus(c);
    }
    await prime(params); // 재생 전 버퍼 디코드를 끝낸다(재생 중 디코드 글리치 방지)
    if (!playing) return; // await 동안 stop됐으면 중단
    const startAt = c.currentTime;
    // 첫 틱에 모든 패드가 한꺼번에 발화하지 않도록, 패드별 첫 발화 가능 시각을 흩뿌린다
    // (동시 시작 피크로 인한 초반 깨짐 방지 + 앰비언트답게 소리가 서서히 쌓인다).
    lastEnd.clear();
    for (const pad of params.pads) {
      if (pad.soundId && pad.volume > 0) lastEnd.set(pad.key, startAt + Math.random() * 3.5);
    }
    // 시작 직후 엔진 워밍업 구간을 짧은 페이드인으로 부드럽게 가린다.
    if (masterGain) {
      masterGain.gain.cancelScheduledValues(startAt);
      masterGain.gain.setValueAtTime(0, startAt);
      masterGain.gain.linearRampToValueAtTime(0.8, startAt + 0.3);
    }
    nextTickTime = startAt + 0.15;
    timer = setInterval(loop, LOOKAHEAD_MS);
    G.__phaseTransportTimer = timer;
  } catch (e) {
    playing = false;
    throw e;
  }
}

export function stop(): void {
  playing = false;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  G.__phaseTransportTimer = null;
}

export function isPlaying(): boolean {
  return playing;
}
