// 녹음 — UI와 분리(claude.md 폴더 규약). AudioRecorder 래핑: 권한, 시작/정지, 경과 시간.
import { AudioRecorder, AudioManager, FileDirectory } from 'react-native-audio-api';
import { ensureAudioSession } from './session';
import { resetContext } from './engine';

let recorder: AudioRecorder | null = null;
// 녹음 중 청크별 RMS(0..1). start 때 리셋, stop 후에도 유지(녹음 결과 파형으로 사용).
let peaks: number[] = [];

// onAudioReady 청크 선호 설정. 콜백 ~11Hz(48000/4096). 실제값은 기기에 따라 다를 수 있음.
const CHUNK = { sampleRate: 48000, bufferLength: 4096, channelCount: 1 };

function get(): AudioRecorder {
  if (!recorder) recorder = new AudioRecorder();
  return recorder;
}

// 모노 채널의 RMS(0..1).
function rms(ch: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < ch.length; i++) sum += ch[i] * ch[i];
  return Math.sqrt(sum / ch.length);
}

// 마이크 권한 보장. 거부 시 false.
export async function ensureMicPermission(): Promise<boolean> {
  const status = await AudioManager.checkRecordingPermissions();
  if (status === 'Granted') return true;
  return (await AudioManager.requestRecordingPermissions()) === 'Granted';
}

// 녹음 시작. 세션을 보장한 뒤 시작. 성공 여부 반환.
export async function startRecording(): Promise<boolean> {
  await ensureAudioSession();
  const r = get();
  // 기본 출력은 Caches인데 iOS가 정리할 수 있어 다이어리 영구 보관엔 부적합 → Document에 기록.
  // 파일명은 라이브러리가 timestamp로 붙여 녹음끼리 덮어쓰지 않는다.
  if (r.enableFileOutput({ directory: FileDirectory.Document }).status === 'error') return false;
  peaks = [];
  r.onAudioReady(CHUNK, ({ buffer }) => peaks.push(rms(buffer.getChannelData(0))));
  return r.start().status === 'success';
}

// 녹음 정지 → { uri, duration(초) }. 실패 시 null.
// audio-api 0.11.0의 stop().duration은 파일 finalize 전에 측정돼 부정확(0에 가까운 값).
// 실제 기록 프레임 기반인 getCurrentDuration()을 정지 직전에 읽어 길이로 사용.
export function stopRecording(): { uri: string; duration: number } | null {
  if (!recorder) return null;
  const duration = recorder.getCurrentDuration();
  recorder.clearOnAudioReady();
  const info = recorder.stop();
  if (info.status === 'error') return null;
  // stop()이 네이티브 공유 엔진을 교체하므로 재생 컨텍스트를 무효화한다(미리듣기/샘플러 복구).
  resetContext();
  return { uri: info.path, duration };
}

// 녹음 중 경과 시간(초).
export function currentDuration(): number {
  return recorder ? recorder.getCurrentDuration() : 0;
}

// 마지막 start 이후 수집된 청크별 RMS(0..1). stop 후에도 다음 start 전까지 유지.
export function getPeaks(): number[] {
  return peaks;
}
