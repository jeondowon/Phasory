// 오디오 엔진 — UI와 분리(claude.md 폴더 규약). AudioContext 싱글톤 + 사운드 버퍼
// 디코드 캐시 + playPad. 사운드는 신스 합성이 아니라 파일 재생(AppPlan §5.7):
// require()한 wav 에셋의 metro 모듈 id(number)를 decodeAudioData가 그대로 받는다.
import { AudioContext, type AudioBuffer } from 'react-native-audio-api';
import type { Sound } from '../store/types';
import { ensureAudioSession } from './session';

const ASSETS: Record<string, number> = {
  rain: require('../assets/builtin-sounds/rain.wav'),
  ocean: require('../assets/builtin-sounds/ocean.wav'),
  footsteps: require('../assets/builtin-sounds/footsteps.wav'),
  catpurr: require('../assets/builtin-sounds/catpurr.wav'),
  wind: require('../assets/builtin-sounds/wind.wav'),
  doorknock: require('../assets/builtin-sounds/doorknock.wav'),
};

let ctx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();

function context(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

// 녹음 정지 시 호출. AudioRecorder.stop()은 네이티브에서 공유 AVAudioEngine 인스턴스를
// 새로 교체하는데, 기존 AudioContext는 교체 전 엔진에 묶여 무효가 된다. 컨텍스트와
// 디코드 캐시를 버려 다음 재생이 현재 엔진에 새로 바인딩되도록 한다.
export function resetContext(): void {
  const old = ctx;
  ctx = null;
  buffers.clear();
  if (old) old.close().catch(() => {});
}

// 사운드 버퍼를 디코드해 캐시. 최초 1회만 디코드.
async function load(soundId: string): Promise<AudioBuffer | null> {
  const cached = buffers.get(soundId);
  if (cached) return cached;
  const asset = ASSETS[soundId];
  if (asset == null) return null;
  const buf = await context().decodeAudioData(asset);
  buffers.set(soundId, buf);
  return buf;
}

// 제너레이티브 트랜스포트가 공유하는 컨텍스트 접근자. UI 일회성 재생과 같은 싱글톤을 쓴다.
export function getContext(): AudioContext {
  return context();
}

// Sound 하나를 디코드해 캐시(빌트인=에셋, userRecorded=uri). 트랜스포트 스케줄러가 사용.
export async function loadSound(sound: Sound): Promise<AudioBuffer | null> {
  if (sound.source === 'userRecorded' && sound.uri) {
    const cached = buffers.get(sound.uri);
    if (cached) return cached;
    const buf = await context().decodeAudioData(sound.uri);
    buffers.set(sound.uri, buf);
    return buf;
  }
  return load(sound.id);
}

// 패드 탭 → 일회성 재생. volume 0..100 → gain 0..1 (0이면 무음).
export async function playPad(soundId: string, volume: number): Promise<void> {
  await ensureAudioSession();
  const c = context();
  if (c.state === 'suspended') await c.resume();
  const buf = await load(soundId);
  if (!buf) return;
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  gain.gain.value = Math.max(0, Math.min(1, volume / 100));
  src.connect(gain);
  gain.connect(c.destination);
  src.start(c.currentTime);
}

// 패드 탭 → Sound 하나를 일회성 재생. builtin은 에셋(playPad), userRecorded는
// 녹음 파일 uri의 트림 구간(offset~clip)만 재생. volume 0..100.
export async function playSound(sound: Sound, volume: number): Promise<void> {
  if (sound.source === 'userRecorded' && sound.uri) {
    return playUri(sound.uri, volume, sound.offsetSec ?? 0, sound.clipSec);
  }
  return playPad(sound.id, volume);
}

// 첫 탭 지연을 줄이기 위해 빌트인 사운드를 미리 디코드(선택).
export function preloadBuiltins(): void {
  Object.keys(ASSETS).forEach((id) => void load(id));
}

// 임의 파일 URI 재생 (녹음 미리듣기 등). volume 0..100.
// offsetSec/durationSec를 주면 그 구간만 재생(트림 미리듣기). uri 버퍼는 캐시해 재디코드 회피.
export async function playUri(
  uri: string,
  volume = 100,
  offsetSec = 0,
  durationSec?: number
): Promise<void> {
  await ensureAudioSession();
  const c = context();
  if (c.state === 'suspended') await c.resume();
  let buf = buffers.get(uri);
  if (!buf) {
    buf = await c.decodeAudioData(uri);
    buffers.set(uri, buf);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  gain.gain.value = Math.max(0, Math.min(1, volume / 100));
  src.connect(gain);
  gain.connect(c.destination);
  // when은 컨텍스트 절대 시각. currentTime은 계속 흐르므로 0을 주면 두 번째 재생부터
  // 과거 시각 예약이라 무음이 된다. 항상 currentTime(=지금)을 기준으로 예약한다.
  if (durationSec != null) src.start(c.currentTime, offsetSec, durationSec);
  else src.start(c.currentTime, offsetSec);
}
