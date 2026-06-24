# PHASE

> Ambient Sound Sampler & Diary

Turn everyday sounds into memories, and memories into ambient music.

[English](#english) | [한국어](#한국어)

---

# English

PHASE is an ambient sound sampler and diary that transforms real-world recordings into evolving ambient soundscapes.

Users can record sounds, save them to sampler pads, attach memories such as notes, locations, and photos, then let a generative engine arrange those sounds into calm, Brian Eno-inspired ambient compositions.

Rather than treating sound as audio data, PHASE treats sound as a memory.

## Features

### 8-Pad Sampler

- Hardware-inspired sampler interface
- Per-pad volume control
- Multiple sound banks
- Built-in sounds and user recordings
- Instant playback from the sampler grid

### Record & Trim

- Record directly from microphone
- Import audio files
- Waveform visualization
- Adjustable trim handles
- Audio preview before saving

### Sound Memories

Attach context to every sound:

- Notes and descriptions
- Date and time
- Location information
- Photos

All memory features are optional and can be added later.

### Sound Map

Explore sounds geographically.

- Location-based pins
- Photo thumbnails
- Waveform thumbnails
- Memory exploration through space

### Ambient Engine

Generate evolving ambient music using collected sounds.

Controls:

- Scale
- Density
- Space (Reverb)
- Tempo

The centerpiece of the experience is the **Phase Orbit**, a visualization that represents sounds drifting in and out of synchronization.

## Screens

### 01. Sampler

- 8-pad sampler grid
- Master volume
- Per-pad volume controls
- Bank switching

### 02. Record & Trim

- Recording interface
- Waveform editing
- Trim selection

### 03. Add a Memory

- Sound description
- Date editing
- Location metadata
- Photo attachment

### 04. Sound Map

- Location-based sound visualization
- Photo and waveform pins
- Memory exploration

### 05. Ambient

- Generative playback engine
- Phase Orbit visualization
- Session recording
- Ambient parameter controls

## Tech Stack

### Mobile

- React Native
- Expo Development Build

### Audio

- react-native-audio-api
- AudioBufferSourceNode playback
- Custom generative scheduling engine

### Graphics

- React Native Skia
- React Native SVG
- Animated API

### Maps & Location

- MapLibre
- Expo Location

### Media

- Expo Camera
- Expo Image Picker

## Data Model

```text
Sound
├── id
├── name
├── fileUri
├── source
├── role
├── defaultVolume
├── memo
└── waveformThumbUri

Pad
├── bankId
├── slotIndex
├── key
├── soundId
└── volume

Bank
├── id
├── name
├── order
└── unlocked
```

## Monetization

### Free

- 1 sound bank
- Full ambient engine
- Sound memories
- Sound map

### Premium

- Unlimited sound banks

The goal is to limit quantity, not functionality.

## Vision

Most music apps help users create songs.

PHASE helps users preserve moments.

Rain on a café awning. Footsteps on a quiet street. Waves at sunset. A cat purring beside a window.

Every sound becomes both an instrument and a memory.

---

# 한국어

PHASE는 현실의 소리를 수집하고, 그 소리들을 이용해 앰비언트 음악을 만드는 사운드 샘플러이자 다이어리 앱입니다.

사용자는 원하는 소리를 녹음하거나 가져와 패드에 저장하고, 메모·위치·사진 같은 기록을 남길 수 있습니다. 이후 제너레이티브 엔진이 그 소리들을 조합하여 잔잔하게 변화하는 앰비언트 음악을 만들어냅니다.

PHASE는 소리를 단순한 오디오 데이터가 아니라 **기억의 단위**로 다룹니다.

## 주요 기능

### 8패드 샘플러

- 하드웨어 샘플러에서 영감을 받은 인터페이스
- 패드별 볼륨 조절
- 다중 사운드 뱅크
- 기본 제공 사운드 및 사용자 녹음 지원
- 샘플러 화면에서 즉시 재생 가능

### 녹음 및 트림

- 마이크 녹음
- 오디오 파일 가져오기
- 파형 시각화
- 트림 핸들 편집
- 저장 전 미리 듣기

### 소리 기록

각 사운드에 다음 정보를 기록할 수 있습니다.

- 메모
- 날짜 및 시간
- 위치 정보
- 사진

모든 기록 기능은 선택 사항이며 나중에 추가할 수도 있습니다.

### 소리 지도

기록된 소리를 지도 위에서 탐색합니다.

- 위치 기반 핀
- 사진 썸네일
- 파형 썸네일
- 공간 기반 추억 탐색

### 앰비언트 엔진

수집한 소리를 이용해 변화하는 앰비언트 음악을 생성합니다.

조절 가능한 요소:

- 스케일
- 밀도
- 공간감(리버브)
- 템포

앱의 시그니처 요소인 **Phase Orbit**는 여러 사운드가 서로 다른 위상으로 흐르는 모습을 시각화합니다.

## 화면 구성

### 01. Sampler

- 8패드 그리드
- 마스터 볼륨
- 패드별 볼륨 조절
- 뱅크 전환

### 02. Record & Trim

- 녹음 인터페이스
- 파형 편집
- 트림 구간 선택

### 03. Add a Memory

- 소리 설명
- 날짜 수정
- 위치 정보
- 사진 첨부

### 04. Sound Map

- 위치 기반 시각화
- 사진 및 파형 핀
- 추억 탐색

### 05. Ambient

- 제너레이티브 재생 엔진
- Phase Orbit 시각화
- 세션 녹음
- 앰비언트 파라미터 조절

## 기술 스택

### 모바일

- React Native
- Expo Development Build

### 오디오

- react-native-audio-api
- AudioBufferSourceNode 기반 재생
- 커스텀 제너레이티브 엔진

### 그래픽

- React Native Skia
- React Native SVG
- Animated API

### 지도 및 위치

- MapLibre
- Expo Location

### 미디어

- Expo Camera
- Expo Image Picker

## 데이터 모델

```text
Sound
├── id
├── name
├── fileUri
├── source
├── role
├── defaultVolume
├── memo
└── waveformThumbUri

Pad
├── bankId
├── slotIndex
├── key
├── soundId
└── volume

Bank
├── id
├── name
├── order
└── unlocked
```

## 수익화

### 무료 사용자

- 사운드 뱅크 1개
- 전체 앰비언트 엔진
- 소리 기록 기능
- 소리 지도 기능

### 프리미엄 사용자

- 무제한 사운드 뱅크

기능을 제한하기보다 저장 가능한 양을 제한하는 방향을 목표로 합니다.

## 비전

대부분의 음악 앱은 음악을 만드는 데 집중합니다.

PHASE는 순간을 보존하는 데 집중합니다.

비 오는 카페의 처마 소리, 조용한 골목의 발자국, 저녁 바다의 파도 소리, 창가에서 들리는 고양이의 골골거림.

PHASE에서는 모든 소리가 악기가 되고, 동시에 추억이 됩니다.
