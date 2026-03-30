import * as Speech from 'expo-speech';

export const speechToTextUtils = {
  // 텍스트를 음성으로 읽기
  speak: async (text: string): Promise<void> => {
    try {
      await Speech.speak(text, {
        language: 'ko-KR',
        rate: 1.0,
      });
    } catch (error) {
      console.error('Speech error:', error);
      throw error;
    }
  },

  // 음성 재생 중지
  stop: async (): Promise<void> => {
    try {
      await Speech.stop();
    } catch (error) {
      console.error('Failed to stop speech:', error);
    }
  }
};
