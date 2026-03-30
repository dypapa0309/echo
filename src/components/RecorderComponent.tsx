import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';

interface RecorderComponentProps {
  onRecordingComplete: (uri: string, duration: number) => void;
  onRecordingError?: (message: string) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  disabled?: boolean;
  autoStartSignal?: number;
}

export const RecorderComponent = ({
  onRecordingComplete,
  onRecordingError,
  onRecordingStateChange,
  disabled = false,
  autoStartSignal = 0,
}: RecorderComponentProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const handledAutoStartRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const baseWaveform = [14, 10, 18, 12, 24, 16, 10, 22, 28, 18, 14, 26, 17, 11, 21, 15];
  const [waveform, setWaveform] = useState(baseWaveform);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      !autoStartSignal ||
      autoStartSignal === handledAutoStartRef.current ||
      isRecording ||
      disabled ||
      isStartingRef.current ||
      isStoppingRef.current
    ) {
      return;
    }

    handledAutoStartRef.current = autoStartSignal;
    startRecording();
  }, [autoStartSignal, isRecording, disabled]);

  useEffect(() => {
    if (!isRecording) {
      setWaveform(baseWaveform);
      return;
    }

    const waveTimer = setInterval(() => {
      setWaveform(current =>
        current.map((height, index) => {
          const next = height + ((recordingTime + index * 2) % 7) - 3;
          return Math.max(10, Math.min(34, next));
        })
      );
    }, 160);

    return () => clearInterval(waveTimer);
  }, [isRecording, recordingTime]);

  // 녹음 시작
  const startRecording = async () => {
    try {
      if (
        disabled ||
        isRecording ||
        isStartingRef.current ||
        isStoppingRef.current ||
        recordingRef.current
      ) {
        return;
      }

      isStartingRef.current = true;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      onRecordingStateChange?.(true);
      setRecordingTime(0);

      // 녹음 시간 업데이트
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      const message = '녹음을 시작할 수 없습니다. 마이크 권한과 기기 상태를 확인해 주세요.';
      Alert.alert('오류', message);
      onRecordingError?.(message);
      console.error('Recording error:', error);
    } finally {
      isStartingRef.current = false;
    }
  };

  // 녹음 중지
  const stopRecording = async () => {
    const recording = recordingRef.current;

    try {
      if (!recording || isStoppingRef.current) {
        return;
      }

      isStoppingRef.current = true;
      const status = await recording.getStatusAsync();
      const measuredSeconds = Math.floor((status.durationMillis ?? 0) / 1000);
      await recording.stopAndUnloadAsync();

      const finalDuration = Math.max(recordingTime, measuredSeconds);

      if (finalDuration < 1) {
        return;
      }

      const uri = recording.getURI();

      if (!uri) {
        throw new Error('Recording URI unavailable');
      }

      onRecordingComplete(uri, finalDuration);
    } catch (error) {
      const message = '녹음을 마무리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
      Alert.alert('오류', message);
      onRecordingError?.(message);
      console.error('Stop recording error:', error);
    } finally {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      recordingRef.current = null;
      setIsRecording(false);
      onRecordingStateChange?.(false);
      setRecordingTime(0);
      isStoppingRef.current = false;
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.wavePanel}>
        <Text style={styles.waveMeta}>{formatTime(recordingTime)}</Text>

        <View style={styles.waveTrack}>
          {waveform.map((height, index) => (
            <View
              key={`wave-${index}`}
              style={[
                styles.waveBar,
                {
                  height,
                  opacity: isRecording ? 1 : 0.38,
                  backgroundColor: isRecording ? '#ef6a5b' : '#d7d5d1',
                },
              ]}
            />
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.recordButton,
          isRecording && styles.recordButtonActive,
          disabled && styles.recordButtonDisabled,
        ]}
        onPress={isRecording ? stopRecording : startRecording}
        disabled={disabled}
      >
        {disabled ? (
          <Text style={styles.recordProcessingText}>...</Text>
        ) : isRecording ? (
          <View style={styles.stopIcon} />
        ) : (
          <View style={styles.recordIcon} />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fffdf8',
    marginHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5dccf',
    elevation: 3,
    shadowColor: '#2f2315',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  wavePanel: {
    backgroundColor: '#fbfbfa',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: '#ece9e4',
    marginBottom: 14,
  },
  waveMeta: {
    alignSelf: 'center',
    marginBottom: 14,
    fontSize: 13,
    color: '#8f8982',
    fontWeight: '700',
  },
  waveTrack: {
    height: 72,
    borderRadius: 18,
    backgroundColor: '#f3f2ef',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  waveBar: {
    width: 6,
    borderRadius: 999,
  },
  recordButton: {
    width: 92,
    height: 92,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#d9d6d0',
  },
  recordButtonActive: {
    backgroundColor: '#fff3f1',
    borderColor: '#ef6a5b',
  },
  recordButtonDisabled: {
    backgroundColor: '#9eb5ad',
  },
  recordIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ef6a5b',
  },
  stopIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#ef6a5b',
  },
  recordProcessingText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
});
