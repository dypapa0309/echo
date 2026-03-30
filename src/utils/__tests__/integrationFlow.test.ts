jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-uuid', () => ({
  v4: (() => {
    let count = 0;
    return () => `integration-memo-${++count}`;
  })(),
}));

jest.mock('../stt', () => ({
  transcribeAudio: jest.fn(),
  getLastTranscriptionState: jest.fn(),
}));

import AsyncStorageMock from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import { echoCoreService } from '../echoService';
import { storageUtils } from '../storage';
import { RecordingContext } from '../../types';
import { getLastTranscriptionState, transcribeAudio } from '../stt';

const mockedTranscribeAudio = transcribeAudio as jest.MockedFunction<typeof transcribeAudio>;
const mockedGetLastTranscriptionState =
  getLastTranscriptionState as jest.MockedFunction<typeof getLastTranscriptionState>;

describe('integration flow', () => {
  beforeEach(async () => {
    await AsyncStorageMock.clear();
    jest.clearAllMocks();
    mockedGetLastTranscriptionState.mockReturnValue({
      source: 'native',
      message: 'Native speech recognition completed.',
    });
  });

  it('runs recording -> transcription -> extraction -> save as one flow', async () => {
    mockedTranscribeAudio.mockResolvedValue(
      '민수한테 내일까지 디자인 시안 공유해 주세요. 결정 이번 주 안에 베타 테스트를 시작합니다.'
    );

    const context: RecordingContext = {
      calendarEvent: {
        id: 'calendar-1',
        title: '디자인 리뷰',
        startDate: 1710000000000,
        endDate: 1710003600000,
      },
    };

    const result = await echoCoreService.processAudioRecording(
      'file://integration-recording.m4a',
      55,
      context
    );

    const savedMemos = await storageUtils.getAllMemos();

    expect(mockedTranscribeAudio).toHaveBeenCalledWith('file://integration-recording.m4a');
    expect(result.sttSource).toBe('native');
    expect(result.memo.title).toBe('디자인 리뷰');
    expect(result.actionItems).toHaveLength(1);
    expect(savedMemos).toHaveLength(1);
    expect(savedMemos[0].summary).toContain('회의 요약');
    expect(savedMemos[0].actionItems?.[0].task).toContain('디자인 시안 공유');
  });

  it('preserves saved memo data across persistence and reload', async () => {
    const result = await echoCoreService.processRecording(
      'file://reload-check.m4a',
      41,
      '지수한테 금요일까지 계약서 검토 부탁해. 이슈 로그인 오류가 계속 발생합니다.',
      undefined
    );

    const reloadedMemos = await storageUtils.getAllMemos();
    const reloadedMemo = reloadedMemos.find(memo => memo.id === result.memo.id);

    expect(reloadedMemo).toBeDefined();
    expect(reloadedMemo?.transcript).toContain('계약서 검토');
    expect(reloadedMemo?.summary).toContain('리스크 및 메모');
    expect(reloadedMemo?.actionItems?.[0].assignee).toBe('지수');
  });

  it('creates export/share strings from a processed memo', async () => {
    const result = await echoCoreService.processRecording(
      'file://share-format.m4a',
      73,
      '수빈한테 내일까지 회의 내용 정리 부탁해. 결정 이번 주 금요일 배포로 확정합니다.',
      {
        calendarEvent: {
          id: 'calendar-2',
          title: '주간 배포 회의',
          startDate: 1710100000000,
          endDate: 1710103600000,
        },
      }
    );

    const slackSummary = await echoCoreService.exportMemoAsSlack(result.memo);
    const clipboardSummary = echoCoreService.createClipboardSummary(result.memo);

    expect(slackSummary).toContain('주간 배포 회의');
    expect(slackSummary).toContain('🎯 *할 일*');
    expect(slackSummary).toContain('수빈');
    expect(clipboardSummary).toContain('주간 배포 회의');
    expect(clipboardSummary).toContain('수빈');
    expect(clipboardSummary).toContain('회의 내용 정리');
  });
});
