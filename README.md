# 🔊 Echo - Your AI Voice Assistant

**Echo**: 바쁜 핵심 인재를 위한 온디바이스 AI 음성 메모 어플리케이션

당신의 생각(Sound)을 가치 있는 인사이트(Insight)로 돌려준다는 의미의 "에코"

미팅, 아이디어, 할 일을 실시간으로 기록하고 자동으로 정리하세요.

## 📋 Features & Development Status

### ✅ Working Now
- ✅ **Recording Flow**: record audio, save memo, reload memo list
- ✅ **Action Extraction Pipeline**: native STT attempt -> fallback if needed -> extraction -> summary generation
- ✅ **Action Item Workspace**: extracted items shown, edited, completed, and manually added
- ✅ **Local Storage**: indexed AsyncStorage storage + migration support
- ✅ **Quick Actions**: latest result copy/share and STT diagnostics
- ✅ **Memo Detail View**: summary / transcript / actions tabs with audio player
- ✅ **Grouped Insights**: related memos clustered on the main screen with quick drill-in
- ✅ **Quick Capture UX**: foreground "헤이 에코" mode and `echo://record` deep link
- ✅ **Integration Coverage**: processing, persistence reload, and export formatting flows tested
- ✅ **Managed Audio + Tags**: recordings are copied into app storage and lightweight tags are attached
- ✅ **Monetization Groundwork**: free-plan usage tracking and Pro timing guidance are wired into settings

### 🔄 In Progress
- 🔄 **Real STT Integration**: native path works, device validation is still in progress
- 🔄 **Context Mapping**: live location and active calendar lookup are wired, wider enrichment is still in progress
- 🔄 **Wake Word Accessibility**: foreground and app-resume flow exist, full background behavior is still limited
- 🔄 **UX Refinement**: grouped summaries, insight navigation, and error handling continue to improve

### 🔜 Planned
- 🔜 **Slack Integration**
- 🔜 **Google Calendar Sync**
- 🔜 **To-Do App Integration**
- 🔜 **Zero-Friction Input**
- 🔜 **Advanced Search**
- 🔜 **Speaker Detection**

📊 **Full Development Roadmap**: See [CHECKLIST.md](./CHECKLIST.md) for complete 12-phase plan with 100+ items

## 🚢 앱스토어 최소 출시 기준

지금 Echo는 `완성형 최종판`보다 `먼저 올라가 있는 쓸 수 있는 버전`을 목표로 잡는 것이 맞습니다.

### 지금 출시해도 되는 범위
- `녹음 -> 정리 -> 다시 보기` 핵심 플로우
- 메모 저장 / 재생 / 삭제
- 핵심 정리 / 기록 내용 / 할 일 보기
- 태그 / 검색 / 보관함 정리

### 출시 전에 꼭 확인할 것
- iPhone 실기기에서 `native STT` 1회 이상 성공 확인
- 실제 일정이 있는 상태에서 캘린더 연결 메모 1회 확인
- 앱 아이콘 / 권한 문구 / 스토어 설명 최종 정리
- 결제를 같이 넣을 경우 RevenueCat 키와 상품 조회 확인

### 출시 후 업데이트로 넘겨도 되는 것
- 캘린더 정밀도 추가 보강
- 아이디어 확장 UX 추가 개선
- 다크 모드 폴리싱
- background wake-word 고도화
- 외부 연동 및 고급 검색

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

현재 앱은 "녹음 -> STT -> 요약/액션 추출 -> 묶인 인사이트 탐색"까지 연결된 MVP 단계이며, 실기기 검증과 context 정밀도 보강이 남아 있습니다.

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
`expo-speech-recognition`, `expo-location`, `expo-calendar` 같은 네이티브 모듈은 Expo Go보다 개발 빌드에서 확인하는 것이 맞습니다.

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

현재 구현 상태:
- 지원 환경에서는 `expo-speech-recognition` 기반 native STT를 시도합니다.
- 지원되지 않는 환경이나 개발 중 오류가 나면 mock fallback을 사용합니다.
- 최근 추출 결과 카드에서 `전사 경로`를 확인할 수 있습니다.
- STT 진단 카드에서 native 모듈/recognizer 상태를 확인할 수 있습니다.
- `헤이 에코 모드` 카드에서 wake-word 대기 상태와 재시작 상태를 확인할 수 있습니다.
- 녹음 파일은 임시 경로에만 두지 않고 앱 문서 저장소로 옮겨 관리합니다.
- 메모에는 `할 일`, `일정`, `결정` 같은 간단한 태그가 자동으로 붙습니다.
- 메모 상세에서 태그를 직접 다듬고, 추천 태그로 빠르게 정리할 수 있으며 보관함에서는 태그 칩으로 빠르게 좁혀볼 수 있습니다.
- 검색은 제목/기록 내용/핵심 정리/태그를 합친 인덱스를 기준으로 동작해 메모가 쌓여도 더 안정적으로 찾습니다.
- 설정에서 무료 플랜 사용량과 Pro 전환을 고민할 시점을 확인할 수 있습니다.
- 현재 결제 provider 1순위는 `RevenueCat`이며, `expo-dev-client`와 `react-native-purchases`를 붙여둔 상태에서 `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` 준비 여부와 SDK 연결 점검을 설정에서 확인할 수 있습니다.
- 시스템 다크 모드에 맞춰 메인/보관함/설정/상세 카드가 단계적으로 대응되어 있습니다.
- 설정 안 `기기 검증 도우미`에서 마이크/캘린더 권한과 현재 음성 경로를 한 번에 확인할 수 있습니다.

### 개발 빌드 STT 검증 순서

1. `npm run dev:ios` 또는 `npm run dev:android` 실행
2. 앱에서 짧은 한국어 음성을 녹음
3. 최근 추출 결과 카드의 `전사 경로` 확인
4. 아래 중 어느 결과인지 확인

- `실제 STT 사용`
- `native STT 실패 후 mock fallback 사용`
- `mock 전사 사용`

### 수동 검증 체크리스트

1. `홈`에서 녹음 시작 후 5~10초 정도 한국어로 말합니다.
2. 저장 후 최근 메모에서 `전사 경로`와 요약 결과를 확인합니다.
3. `보관함`에서 같은 메모를 다시 열어 `핵심 정리 / 기록 내용 / 할 일 / 확장`이 모두 보이는지 확인합니다.
4. `해야 할 일` 보기에서 `높은 확신` 또는 작업 유형 필터가 정상 동작하는지 확인합니다.
5. `설정`에서 `헤이 에코`, `언어`, `빠른 기록` 복사가 정상 동작하는지 확인합니다.

### STT 검증 시 참고

- iOS 파일 기반 전사는 첫 1분까지만 처리될 수 있습니다.
- Android 파일 전사는 Android 13+에서 더 잘 맞습니다.
- 기기/OS에 따라 speech recognition 권한과 서비스 사용 가능 여부가 달라질 수 있습니다.

## 🐛 알려진 문제

- native STT는 연결되었지만 아직 실기기 기준 최종 검증과 품질 측정이 남아 있습니다.
- 위치와 현재 캘린더 일정은 1차 연동됐지만, 일정 선택 정밀도와 캘린더 QA는 더 보강이 필요합니다.
- Web 버전에서는 오디오 녹음이 제한될 수 있습니다.
- `헤이 에코`는 앱이 열린 상태/복귀 상태에서만 안정적으로 동작하며, 완전한 background wake-word는 아직 아닙니다.
- 로컬 iOS 개발 빌드는 다시 성공 상태로 복구됐지만, 실제 STT/캘린더 검증은 여전히 기기에서 한 번 더 확인해야 합니다.

## 🔄 업데이트 계획

- [ ] native STT 디바이스 검증 완료
- [ ] 캘린더 context QA 및 정밀도 보강
- [x] integration 테스트 추가
- [~] 카테고리/태그 시스템
- [~] 메모 검색/정리 고도화
- [~] 수익화 / 결제 설계
- [~] 다크 모드

## 🚀 출시 준비 파일

출시 전에 미리 준비할 문서와 배포용 초안은 아래 파일에 정리되어 있습니다.

- [LAUNCH_PREP.md](./LAUNCH_PREP.md): 출시 전 사전 준비 순서와 env 변수 정리
- [APP_STORE_METADATA.md](./APP_STORE_METADATA.md): 앱 이름, 부제목, 설명, 키워드, 심사 메모 초안
- [launch-site/README.md](./launch-site/README.md): Netlify 배포용 지원/약관/개인정보 페이지 안내
- [launch-site/index.html](./launch-site/index.html): Echo 소개 랜딩 페이지 초안
- [launch-site/ko-index.html](./launch-site/ko-index.html): Echo 소개 랜딩 페이지 한글 초안
- [launch-site/privacy.html](./launch-site/privacy.html): 개인정보 처리방침 초안
- [launch-site/ko-privacy.html](./launch-site/ko-privacy.html): 개인정보 처리방침 한글 초안
- [launch-site/terms.html](./launch-site/terms.html): 이용약관 초안
- [launch-site/ko-terms.html](./launch-site/ko-terms.html): 이용약관 한글 초안
- [launch-site/support.html](./launch-site/support.html): 고객지원 페이지 초안
- [launch-site/ko-support.html](./launch-site/ko-support.html): 고객지원 한글 초안

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
