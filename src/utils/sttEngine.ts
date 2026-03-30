import { Platform } from 'react-native';

export interface STTEngine {
  initialize(): Promise<void>;
  transcribe(audioUri: string): Promise<string>;
  stream(audioStream: any): Promise<string>;
  dispose(): Promise<void>;
}

export type STTSource = 'native' | 'mock' | 'fallback';

export interface STTTranscriptionState {
  source: STTSource;
  message: string;
}

export interface STTDiagnostics {
  nativeModuleAvailable: boolean;
  recognitionAvailable: boolean;
  platform: string;
  recommendedMode: 'development_build' | 'expo_go_fallback';
}

type SpeechRecognitionModule = typeof import('expo-speech-recognition');

const DEFAULT_TRANSCRIPTION_TIMEOUT_MS = 45000;

const loadSpeechRecognitionModule = (): SpeechRecognitionModule | null => {
  try {
    return require('expo-speech-recognition') as SpeechRecognitionModule;
  } catch (error) {
    console.warn('[STT] expo-speech-recognition is unavailable:', error);
    return null;
  }
};

export class MockSTTEngine implements STTEngine {
  private lastTranscriptionState: STTTranscriptionState = {
    source: 'mock',
    message: 'STT has not run yet.',
  };

  getLastTranscriptionState(): STTTranscriptionState {
    return this.lastTranscriptionState;
  }

  getDiagnostics(): STTDiagnostics {
    const speechModule = loadSpeechRecognitionModule();
    const nativeModuleAvailable = !!speechModule;
    const recognitionAvailable = speechModule
      ? speechModule.isRecognitionAvailable()
      : false;

    return {
      nativeModuleAvailable,
      recognitionAvailable,
      platform: Platform.OS,
      recommendedMode:
        nativeModuleAvailable && recognitionAvailable
          ? 'development_build'
          : 'expo_go_fallback',
    };
  }

  async initialize(): Promise<void> {
    const speechModule = loadSpeechRecognitionModule();
    if (!speechModule) {
      return;
    }

    if (!speechModule.isRecognitionAvailable()) {
      console.warn('[STT] Speech recognition is not available on this device.');
    }
  }

  private buildAudioSource(
    speechModule: SpeechRecognitionModule,
    audioUri: string
  ) {
    return {
      uri: audioUri,
      ...(Platform.OS === 'android'
        ? {
            audioChannels: 1,
            audioEncoding: speechModule.AudioEncodingAndroid.ENCODING_PCM_16BIT,
            sampleRate: 16000,
          }
        : {}),
    };
  }

  private async transcribeWithNativeModule(audioUri: string): Promise<string> {
    const speechModule = loadSpeechRecognitionModule();
    if (!speechModule) {
      throw new Error('Speech recognition module unavailable');
    }

    if (!speechModule.isRecognitionAvailable()) {
      throw new Error('Speech recognition is not available on this device');
    }

    const permission = await speechModule.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Speech recognition permission not granted');
    }

    return await new Promise<string>((resolve, reject) => {
      let resolved = false;
      const finalSegments: string[] = [];
      let latestTranscript = '';

      const cleanup = () => {
        resultListener.remove();
        errorListener.remove();
        endListener.remove();
        clearTimeout(timeout);
      };

      const finish = (value: string) => {
        if (resolved) {
          return;
        }
        resolved = true;
        cleanup();
        resolve(value.trim());
      };

      const fail = (error: Error) => {
        if (resolved) {
          return;
        }
        resolved = true;
        cleanup();
        reject(error);
      };

      const resultListener = speechModule.addSpeechRecognitionListener('result', event => {
        const transcript = event.results[0]?.transcript?.trim() ?? '';
        if (!transcript) {
          return;
        }

        latestTranscript = transcript;
        if (event.isFinal) {
          finalSegments.push(transcript);
        }
      });

      const errorListener = speechModule.addSpeechRecognitionListener('error', event => {
        fail(new Error(`${event.error}: ${event.message}`));
      });

      const endListener = speechModule.addSpeechRecognitionListener('end', () => {
        const combinedTranscript = finalSegments.join(' ').trim() || latestTranscript;
        if (combinedTranscript) {
          finish(combinedTranscript);
          return;
        }

        fail(new Error('Speech recognition ended without a transcript'));
      });

      const timeout = setTimeout(() => {
        try {
          speechModule.ExpoSpeechRecognitionModule.abort();
        } catch (error) {
          console.error('[STT] abort error:', error);
        }
        fail(new Error('Speech recognition timed out'));
      }, DEFAULT_TRANSCRIPTION_TIMEOUT_MS);

      try {
        speechModule.ExpoSpeechRecognitionModule.start({
          lang: 'ko-KR',
          interimResults: true,
          requiresOnDeviceRecognition: false,
          audioSource: this.buildAudioSource(speechModule, audioUri),
        });
      } catch (error) {
        fail(
          error instanceof Error
            ? error
            : new Error('Failed to start speech recognition')
        );
      }
    });
  }

  private createMockTranscript(audioUri: string): string {
    const createdAt = new Date().toLocaleString('ko-KR');

    // 개발 단계에서는 후속 파이프라인을 검증할 수 있도록
    // 액션 아이템, 결정 사항, 이슈를 포함한 목업 전사를 반환한다.
    return [
      `녹음 파일 ${audioUri} 에 대한 모의 전사입니다. 생성 시각은 ${createdAt}입니다.`,
      '김대리가 내일까지 고객 인터뷰 결과를 정리해 주세요.',
      '박매니저가 4월 2일까지 예산안을 수정해 주세요.',
      '이번 주 금요일까지 디자인 시안을 검토해 주세요.',
      '결정: 다음 주에 베타 테스트를 시작합니다.',
      '이슈: 로그인 화면에서 오류가 반복되고 있습니다.',
    ].join(' ');
  }

  private shouldFallbackToMock(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);

    return (
      message.includes('module unavailable') ||
      message.includes('not available') ||
      message.includes('permission') ||
      message.includes('audio-capture') ||
      message.includes('service-not-allowed') ||
      message.includes('timed out')
    );
  }

  async transcribe(audioUri: string): Promise<string> {
    try {
      const transcript = await this.transcribeWithNativeModule(audioUri);
      this.lastTranscriptionState = {
        source: 'native',
        message: 'Native speech recognition completed.',
      };
      return transcript;
    } catch (error) {
      if (this.shouldFallbackToMock(error)) {
        this.lastTranscriptionState = {
          source: 'fallback',
          message:
            error instanceof Error
              ? error.message
              : 'Native STT unavailable. Using mock fallback.',
        };
        return this.createMockTranscript(audioUri);
      }

      console.warn('[STT] Native transcription failed:', error);

      this.lastTranscriptionState = {
        source: 'mock',
        message:
          error instanceof Error
            ? error.message
            : 'Unknown transcription error',
      };
      throw error;
    }
  }

  async stream(_audioStream: any): Promise<string> {
    // 스트리밍 방식은 아직 미구현 (파일 기반으로 처리)
    return '스트리밍 STT 미지원 (Mock)';
  }

  async dispose(): Promise<void> {
    // 리소스 해제
    return;
  }
}

export const sttEngine: STTEngine = new MockSTTEngine();
