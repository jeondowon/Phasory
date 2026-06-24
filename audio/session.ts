// iOS 오디오 세션 — 앱이 재생과 녹음을 모두 하므로 playAndRecord로 통일한다.
// (재생만 playback / 녹음만 record로 따로 잡으면 서로 세션을 덮어써 충돌한다.)
// defaultToSpeaker로 스피커 출력, 무음 스위치에서도 재생·녹음이 동작한다.
import { AudioManager } from 'react-native-audio-api';

let configured = false;

export async function ensureAudioSession(): Promise<void> {
  if (configured) return;
  AudioManager.setAudioSessionOptions({
    iosCategory: 'playAndRecord',
    iosOptions: ['defaultToSpeaker', 'allowBluetooth'],
  });
  await AudioManager.setAudioSessionActivity(true);
  configured = true;
}
