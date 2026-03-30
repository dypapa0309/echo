import {
  sttEngine,
  STTDiagnostics,
  STTEngine,
  STTTranscriptionState,
} from './sttEngine';

/**
 * STT (Speech-to-Text) wrapper for Echo app
 *
 * 현재는 Mock 엔진을 사용하며, 추후 Whisper.cpp/Native/Cloud 연동 예정.
 */

export const transcribeAudio = async (audioUri: string): Promise<string> => {
  try {
    return await sttEngine.transcribe(audioUri);
  } catch (error) {
    console.error('[STT] transcribeAudio error:', error);
    return `모의 전사: ${audioUri} (생성일 ${new Date().toLocaleString('ko-KR')})`;
  }
};

export const getLastTranscriptionState = (): STTTranscriptionState => {
  if ('getLastTranscriptionState' in sttEngine) {
    return (sttEngine as STTEngine & {
      getLastTranscriptionState: () => STTTranscriptionState;
    }).getLastTranscriptionState();
  }

  return {
    source: 'mock',
    message: 'STT state unavailable.',
  };
};

export const getSTTDiagnostics = (): STTDiagnostics => {
  if ('getDiagnostics' in sttEngine) {
    return (sttEngine as STTEngine & {
      getDiagnostics: () => STTDiagnostics;
    }).getDiagnostics();
  }

  return {
    nativeModuleAvailable: false,
    recognitionAvailable: false,
    platform: 'unknown',
    recommendedMode: 'expo_go_fallback',
  };
};
