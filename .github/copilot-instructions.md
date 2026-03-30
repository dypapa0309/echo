# Echo - Development Instructions

## Project Overview
**Echo** - 온디바이스 AI 기반 음성 메모 어플리케이션. 바쁜 핵심 인재를 위해 생각을 즉시 기록하고, 자동으로 정리하며, 행동으로 연결하는 앱

## Tech Stack
- **Framework**: React Native with TypeScript
- **Database**: AsyncStorage (local storage)
- **Audio Recording**: react-native-audio-recorder-player
- **Speech-to-Text**: react-native-google-cloud-speech-to-text (또는 native API)
- **State Management**: React Hooks
- **Build Tool**: Expo (for mobile deployment)

## Key Features
1. 음성 메모 녹음
2. Speech-to-Text (STT) 변환
3. 메모 저장 및 관리
4. 검색 기능
5. 재생 기능

## Project Status
- [ ] Scaffolding complete
- [ ] Dependencies installed
- [ ] Core features implemented
- [ ] Testing done
- [ ] Ready for deployment

## Setup Instructions
```bash
npm install
npx expo start
```

## Development Workflow
- Run `npx expo start` to launch development server
- Use Expo Go app on mobile devices for testing
- Test on iOS and Android devices
