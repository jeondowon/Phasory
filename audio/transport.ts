// 제너레이티브 트랜스포트 — 8패드에 올라간 사운드를 4레버에 따라 무한 스케줄링해 하나의
// 공간적 앰비언트로 엮는다(claude.md: audio/는 UI와 독립). 표준 Web Audio lookahead
// 스케줄러를 쓴다: JS 타이머가 주기적으로 깨어나 currentTime 기준 조금 앞 구간을 예약한다
// (start()는 항상 currentTime 기준 — 과거 시각 예약 시 무음이 되는 재생버그 방지).
//
// 레버 매핑(SCALE은 현재 라벨 전용이라 출력 미연결):
//   TEMPO   → 틱 간격(BPM)            DENSITY → 틱당 패드 발화 확률(동시 보이스 수)
//   SPACE   → 리버브 wet 양(경량 피드백 딜레이 리버브)
import {
  AudioContext,
  type AudioBuffer,
  type GainNode,
  type WaveShaperNode,
} from 'react-native-audio-api';
import type { Sound, Pad, GenerativePreset } from '../store/types';
import { TEMPO_MIN_BPM, TEMPO_MAX_BPM } from '../store/levers';
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

// 마스터 버스: voice → masterGain → dry ────────┐
//                            └→ reverb → wet ────┴→ limiter → destination
// 컨텍스트당 한 번만 만든다. busCtx로 어떤 컨텍스트에 묶였는지 추적(녹음 후 컨텍스트가
// 교체되면 재구성).
let busCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let dryGain: GainNode | null = null;
let wetGain: GainNode | null = null;
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
function spaceWet(pct: number): number {
  return 0.9 * (pct / 100); // 리버브 wet 0..0.9
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

// 경량 피드백 리버브 — naive 실시간 컨볼루션(2.6초 IR)이 렌더 스레드를 과부하시켜 출력 전체가
// 언더런(배속/지직)을 내던 P3 핵심버그의 근본 원인이었다. 병렬 콤 필터(딜레이+감쇠 피드백)는
// 꼬리 길이와 무관하게 CPU가 O(1)이라 안전하다. SPACE는 기존처럼 wet 양(wetGain)만 조절한다.
// time은 서로 소수적 간격(메탈릭 공진 방지), fb<1 + 피드백 루프 lowpass라 항상 안정 감쇠.
const REVERB_COMBS = [
  { time: 0.0297, fb: 0.8 },
  { time: 0.0371, fb: 0.78 },
  { time: 0.0411, fb: 0.77 },
  { time: 0.0437, fb: 0.76 },
];
const REVERB_DAMP_HZ = 3200; // 피드백 루프 고역 감쇠 → 어둡고 자연스러운 꼬리
const REVERB_SEND = 0.5; // 리버브 입력 게인
const REVERB_NORM = 0.28; // 콤 합 정규화(리미터 전 클리핑 방지)

// input(masterGain) → [병렬 콤 필터] → output(wetGain). 컨텍스트당 한 번만 구성.
function buildReverb(c: AudioContext, input: GainNode, output: GainNode): void {
  const send = c.createGain();
  send.gain.value = REVERB_SEND;
  const sum = c.createGain();
  sum.gain.value = REVERB_NORM;
  input.connect(send);
  for (const { time, fb } of REVERB_COMBS) {
    const delay = c.createDelay(1);
    delay.delayTime.value = time;
    const damp = c.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = REVERB_DAMP_HZ;
    const fbGain = c.createGain();
    fbGain.gain.value = fb;
    // send → delay → damp →(sum 출력)
    //                 damp → fbGain → delay (피드백 루프)
    send.connect(delay);
    delay.connect(damp);
    damp.connect(sum);
    damp.connect(fbGain);
    fbGain.connect(delay);
  }
  sum.connect(output);
}

function buildBus(c: AudioContext): void {
  masterGain = c.createGain();
  dryGain = c.createGain();
  wetGain = c.createGain();
  masterGain.gain.value = 0.8; // 리미터 앞 헤드룸
  dryGain.gain.value = 1;
  wetGain.gain.value = 0;

  limiter = c.createWaveShaper();
  limiter.curve = makeSoftClipCurve();
  limiter.oversample = 'none'; // 가벼운 tanh 클립이라 오버샘플 불필요(CPU 절약)

  // voice → masterGain → dry ───────────┐
  //                    └→ reverb → wet ──┴→ limiter → destination
  masterGain.connect(dryGain);
  dryGain.connect(limiter);
  wetGain.connect(limiter);
  limiter.connect(c.destination);
  buildReverb(c, masterGain, wetGain);

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

// 라이브 파라미터 갱신(슬라이더가 재생 중 움직여도 반영). wet은 즉시, 나머지는 다음 틱에 반영.
export function setParams(p: TransportParams): void {
  params = p;
  void prime(p);
  if (wetGain) wetGain.gain.value = spaceWet(p.preset.space.pct);
}

// 한 틱(time t)에 DENSITY 확률로 패드들을 골라 발화. 공간감=랜덤 팬 + 약간의 타이밍 흔들림.
function scheduleTick(t: number): void {
  if (!params || !masterGain) return;
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

    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    const vol = (pad.volume * master) / 10000; // (0..100)·(0..100)/10000 = 0..1
    g.gain.value = Math.max(0, Math.min(1, vol)) * (0.7 + Math.random() * 0.3); // 0.7..1.0배 흔들림
    const pan = c.createStereoPanner();
    pan.pan.value = (Math.random() * 2 - 1) * 0.7;

    src.connect(g);
    g.connect(pan);
    pan.connect(masterGain);

    if (sound.source === 'userRecorded' && sound.uri) {
      src.start(when, sound.offsetSec ?? 0, sound.clipSec);
    } else {
      src.start(when);
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
    if (wetGain) wetGain.gain.value = spaceWet(params.preset.space.pct);
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
