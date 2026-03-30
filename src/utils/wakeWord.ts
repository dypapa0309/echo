type SpeechRecognitionModule = typeof import('expo-speech-recognition');

export interface WakeWordDiagnostics {
  available: boolean;
  message: string;
}

export interface WakeWordRuntimeState {
  active: boolean;
  isListening: boolean;
  isStarting: boolean;
  restartCount: number;
  lastDetectedAt: number | null;
  lastError: string | null;
}

export interface WakeWordCallbacks {
  onDetected: (transcript: string) => void;
  onStatusChange?: (message: string) => void;
  onError?: (message: string) => void;
}

const WAKE_WORD_PATTERNS = [
  '헤이 에코',
  '해이 에코',
  'hey echo',
  'hey, echo',
  '에이 에코',
];

const RESTARTABLE_ERRORS = new Set(['no-speech', 'speech-timeout', 'aborted']);

const loadSpeechRecognitionModule = (): SpeechRecognitionModule | null => {
  try {
    return require('expo-speech-recognition') as SpeechRecognitionModule;
  } catch (error) {
    console.warn('[WakeWord] expo-speech-recognition is unavailable:', error);
    return null;
  }
};

class WakeWordController {
  private speechModule: SpeechRecognitionModule | null = null;

  private active = false;

  private detected = false;

  private lastMatch = 0;

  private subscriptions: Array<{ remove: () => void }> = [];

  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  private callbacks: WakeWordCallbacks | null = null;

  private isListening = false;

  private isStarting = false;

  private restartCount = 0;

  private lastDetectedAt: number | null = null;

  private lastError: string | null = null;

  getDiagnostics(): WakeWordDiagnostics {
    const speechModule = loadSpeechRecognitionModule();
    if (!speechModule) {
      return {
        available: false,
        message: '음성 인식 모듈을 불러올 수 없습니다.',
      };
    }

    if (!speechModule.isRecognitionAvailable()) {
      return {
        available: false,
        message: '현재 환경에서는 핫워드 감지가 지원되지 않습니다.',
      };
    }

    return {
      available: true,
      message: '앱이 열려 있는 동안 “헤이 에코” 감지를 사용할 수 있습니다.',
    };
  }

  getRuntimeState(): WakeWordRuntimeState {
    return {
      active: this.active,
      isListening: this.isListening,
      isStarting: this.isStarting,
      restartCount: this.restartCount,
      lastDetectedAt: this.lastDetectedAt,
      lastError: this.lastError,
    };
  }

  async start(callbacks: WakeWordCallbacks) {
    if (this.active && (this.isListening || this.isStarting)) {
      this.callbacks = callbacks;
      callbacks.onStatusChange?.('헤이 에코를 기다리는 중입니다.');
      return;
    }

    this.speechModule = loadSpeechRecognitionModule();
    if (!this.speechModule || !this.speechModule.isRecognitionAvailable()) {
      throw new Error('핫워드 감지를 시작할 수 없습니다.');
    }

    const permission =
      await this.speechModule.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      throw new Error('음성 인식 권한이 필요합니다.');
    }

    this.callbacks = callbacks;
    this.active = true;
    this.detected = false;
    this.lastError = null;
    this.clearRestartTimer();
    this.cleanupSubscriptions();
    this.attachListeners();
    callbacks.onStatusChange?.('헤이 에코를 기다리는 중입니다.');
    this.startRecognition();
  }

  async stop() {
    this.active = false;
    this.detected = false;
    this.isListening = false;
    this.isStarting = false;
    this.clearRestartTimer();
    this.cleanupSubscriptions();

    if (this.speechModule) {
      try {
        this.speechModule.ExpoSpeechRecognitionModule.abort();
      } catch (error) {
        console.error('[WakeWord] abort error:', error);
      }
    }
  }

  private attachListeners() {
    if (!this.speechModule) {
      return;
    }

    this.subscriptions.push(
      this.speechModule.addSpeechRecognitionListener('result', event => {
        const transcript = event.results?.[0]?.transcript?.trim() ?? '';
        if (!transcript || !this.active) {
          return;
        }

        if (this.matchesWakeWord(transcript)) {
          const now = Date.now();
          if (now - this.lastMatch < 2000) {
            return;
          }

          this.lastMatch = now;
          this.lastDetectedAt = now;
          this.detected = true;
          this.isListening = false;
          this.callbacks?.onStatusChange?.('헤이 에코를 감지했습니다. 녹음을 시작합니다.');
          this.callbacks?.onDetected(transcript);
          this.stop().catch(error => {
            console.error('[WakeWord] stop after detection error:', error);
          });
        }
      })
    );

    this.subscriptions.push(
      this.speechModule.addSpeechRecognitionListener('error', event => {
        if (!this.active) {
          return;
        }

        const message = `${event.error}: ${event.message}`;
        this.lastError = message;
        this.isListening = false;
        if (RESTARTABLE_ERRORS.has(event.error)) {
          this.callbacks?.onStatusChange?.('헤이 에코를 다시 대기 중입니다.');
          this.scheduleRestart();
          return;
        }

        this.callbacks?.onError?.(message);
      })
    );

    this.subscriptions.push(
      this.speechModule.addSpeechRecognitionListener('end', () => {
        this.isListening = false;
        if (!this.active || this.detected) {
          return;
        }

        this.scheduleRestart();
      })
    );
  }

  private startRecognition() {
    if (!this.speechModule || !this.active || this.isStarting || this.isListening) {
      return;
    }

    try {
      this.isStarting = true;
      this.speechModule.ExpoSpeechRecognitionModule.start({
        lang: 'ko-KR',
        interimResults: true,
        continuous: true,
        addsPunctuation: false,
        contextualStrings: ['헤이 에코', 'hey echo', '에코'],
      });
      this.isListening = true;
      this.lastError = null;
    } catch (error) {
      this.lastError =
        error instanceof Error ? error.message : '핫워드 감지를 시작하지 못했습니다.';
      this.callbacks?.onError?.(
        error instanceof Error ? error.message : '핫워드 감지를 시작하지 못했습니다.'
      );
    } finally {
      this.isStarting = false;
    }
  }

  private scheduleRestart() {
    if (!this.active) {
      return;
    }

    this.clearRestartTimer();
    this.restartTimer = setTimeout(() => {
      if (!this.active) {
        return;
      }
      this.restartCount += 1;
      this.startRecognition();
    }, 500);
  }

  private clearRestartTimer() {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  private cleanupSubscriptions() {
    this.subscriptions.forEach(subscription => subscription.remove());
    this.subscriptions = [];
  }

  private matchesWakeWord(transcript: string) {
    const normalized = transcript.toLowerCase().replace(/\s+/g, ' ').trim();
    return WAKE_WORD_PATTERNS.some(pattern => normalized.includes(pattern));
  }
}

export const wakeWordController = new WakeWordController();
