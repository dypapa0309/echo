# 🔊 Echo - Your AI Voice Assistant

**Echo**: 바쁜 핵심 인재를 위한 온디바이스 AI 음성 메모 어플리케이션

당신의 생각(Sound)을 가치 있는 인사이트(Insight)로 돌려준다는 의미의 "에코"

미팅, 아이디어, 할 일을 실시간으로 기록하고 자동으로 정리하세요.

## 📋 Features & Development Status

### ✅ Working Now
- ✅ **Recording Flow**: record audio, save memo, reload memo list
- ✅ **Action Extraction Pipeline**: mock STT -> extraction -> summary generation
- ✅ **Basic Action Item UI**: extracted items shown on the main screen
- ✅ **Local Storage**: AsyncStorage CRUD + simple search

### 🔄 In Progress
- 🔄 **Real STT Integration**: currently mock-based pipeline
- 🔄 **Context Mapping**: structure exists, live location/calendar are placeholders
- 🔄 **UX Refinement**: richer progress, validation, and quick actions

### 🔜 Planned
- 🔜 **Slack Integration**
- 🔜 **Google Calendar Sync**
- 🔜 **To-Do App Integration**
- 🔜 **Zero-Friction Input**
- 🔜 **Advanced Search**
- 🔜 **Speaker Detection**

📊 **Full Development Roadmap**: See [CHECKLIST.md](./CHECKLIST.md) for complete 12-phase plan with 100+ items

## 🛠️ 기술 스택

- **Framework**: React Native 0.73.6
- **Runtime**: Expo 50.0.0
- **Language**: TypeScript
- **Storage**: AsyncStorage
- **Audio**: expo-av (녹음, 재생)
- **TTS**: expo-speech
- **State**: React Hooks
- **AI**: Rule-based NLP + Pattern matching

## 📌 현재 상태 한 줄 요약

현재 앱은 "기본 녹음과 저장, mock 전사 기반 액션아이템 추출"까지 연결된 MVP 골격 단계입니다.

## 📁 Project Architecture

```
echo-app/
├── src/
│   ├── types/
│   │   └── index.ts                     # ★ Enhanced types (ActionItem, Context)
│   ├── utils/
│   │   ├── actionItemExtractor.ts       # ★ Core extraction engine
│   │   ├── contextMapping.ts            # GPS, calendar, metadata
│   │   ├── echoService.ts               # Orchestration service
│   │   ├── storage.ts                   # AsyncStorage CRUD
│   │   └── speech.ts                    # Text-to-speech
│   ├── components/
│   │   ├── RecorderComponent.tsx        # Recording UI
│   │   └── MemoListComponent.tsx        # Memos list
│   └── screens/
│       └── MainScreen.tsx               # Main screen
│
├── Documentation/
│   ├── ARCHITECTURE.md                  # Full system design (8 modules)
│   ├── IMPLEMENTATION.md                # Dev status + examples
│   ├── CHECKLIST.md                     # 12-phase roadmap (100+ items)
│   └── README.md                        # This file
│
├── App.tsx, app.json, package.json
└── tsconfig.json
```

## 🚀 시작하기

### 1. 환경 설정

Node.js 16 이상이 설치되어 있어야 합니다.

### 2. 의존성 설치

```bash
npm install
```

### 3. 프로젝트 실행

#### Expo로 웹에서 실행
```bash
npm start
# 또는
npm run web
```

#### 모바일 기기에서 실행
```bash
# iOS
npm run ios

# Android
npm run android
```

#### 개발 빌드로 실행
`expo-speech-recognition` 같은 네이티브 모듈은 Expo Go보다 개발 빌드에서 확인하는 것이 맞습니다.

```bash
# iOS 개발 빌드
npm run dev:ios

# Android 개발 빌드
npm run dev:android
```

필요 시 네이티브 프로젝트를 다시 생성하려면:

```bash
npm run prebuild
```

## 📱 모바일 테스트

### Expo Go 앱 사용

1. [Expo Go](https://expo.dev/go) 앱을 설치합니다.
2. 터미널에서 `npm start` 실행
3. QR 코드를 Expo Go 앱으로 스캔

> STT 검증은 Expo Go보다 개발 빌드에서 권장됩니다.

### 필요한 권한

- **iOS**: 마이크, 음성 인식
- **Android**: RECORD_AUDIO, WRITE_EXTERNAL_STORAGE, READ_EXTERNAL_STORAGE

## 💾 데이터 저장

- 모든 메모는 AsyncStorage에 로컬로 저장됩니다.
- 저장 형식: JSON
- 저장 위치: 앱의 로컬 스토리지

## 🔊 음성 기능

### 녹음
- `RecorderComponent`에서 녹음 시작/중지
- 녹음 시간 표시
- 고음질 오디오 형식

### 재생
- `MemoListComponent`에서 저장된 음성 재생
- 재생 중 상태 표시
- 재생 완료 자동 감지

## 🔍 검색 기능

- 메모 제목과 텍스트로 검색 가능
- 실시간 검색 필터링
- 대소문자 구분 안 함

## 📝 STT 기능

현재는 mock 텍스트를 사용합니다. 실제 STT 구현을 위해서는:

```typescript
// Whisper.cpp, Native Speech API, 또는 Cloud STT 연동 필요
// src/utils/sttEngine.ts 확장
```

현재 구현 상태:
- 지원 환경에서는 `expo-speech-recognition` 기반 native STT를 시도합니다.
- 지원되지 않는 환경이나 개발 중 오류가 나면 mock fallback을 사용합니다.
- 최근 추출 결과 카드에서 `전사 경로`를 확인할 수 있습니다.

### 개발 빌드 STT 검증 순서

1. `npm run dev:ios` 또는 `npm run dev:android` 실행
2. 앱에서 짧은 한국어 음성을 녹음
3. 최근 추출 결과 카드의 `전사 경로` 확인
4. 아래 중 어느 결과인지 확인

- `실제 STT 사용`
- `native STT 실패 후 mock fallback 사용`
- `mock 전사 사용`

### STT 검증 시 참고

- iOS 파일 기반 전사는 첫 1분까지만 처리될 수 있습니다.
- Android 파일 전사는 Android 13+에서 더 잘 맞습니다.
- 기기/OS에 따라 speech recognition 권한과 서비스 사용 가능 여부가 달라질 수 있습니다.

## 🐛 알려진 문제

- STT 변환은 현재 mock 구현되어 있습니다.
- 위치/캘린더 컨텍스트는 현재 placeholder 수준입니다.
- Web 버전에서는 오디오 녹음이 제한될 수 있습니다.

## 🔄 업데이트 계획

- [ ] 실제 STT API 통합
- [ ] 저장 구조 개선
- [ ] 메모/액션아이템 편집 기능
- [ ] 테스트 추가
- [ ] 카테고리/태그 시스템
- [ ] 다크 모드

## 📞 지원

문제가 발생하면 다음을 확인하세요:

1. Expo 최신 버전 설치
2. Node.js 16+ 설치
3. 마이크 권한 허가
4. 저장소 권한 허가

## 📄 라이선스

MIT License

## 🤝 기여

버그 리포트나 기능 요청은 언제든지 환영합니다!
# echo
