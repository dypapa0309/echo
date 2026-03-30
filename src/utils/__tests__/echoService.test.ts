jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-uuid', () => ({
  v4: () => 'memo-test-id',
}));

import { echoCoreService } from '../echoService';
import { storageUtils } from '../storage';
import { RecordingContext } from '../../types';

describe('echoCoreService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('processes a transcript and saves a memo', async () => {
    const saveMemoSpy = jest
      .spyOn(storageUtils, 'saveMemo')
      .mockResolvedValue(undefined);

    const context: RecordingContext = {
      calendarEvent: {
        id: 'event-1',
        title: '주간 리뷰',
        startDate: 1710000000000,
        endDate: 1710003600000,
      },
    };

    const result = await echoCoreService.processRecording(
      'file://recording.m4a',
      90,
      '김대리 가 내일 예산안 수정 해 주세요. 결정 배포 일정을 확정합니다.',
      context
    );

    expect(saveMemoSpy).toHaveBeenCalledTimes(1);
    expect(result.memo).toMatchObject({
      id: 'memo-test-id',
      audioUri: 'file://recording.m4a',
      duration: 90,
      title: '주간 리뷰',
    });
    expect(result.actionItems.length).toBeGreaterThan(0);
    expect(result.summary).toContain('회의 요약');
    expect(result.summary).not.toContain('• 결정 배포 일정을 확정합니다');
    expect(result.summary).toContain('후속 액션');
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('creates a clipboard summary from extracted items', () => {
    const summary = echoCoreService.createClipboardSummary({
      id: 'memo-2',
      audioUri: 'file://recording.m4a',
      timestamp: 1710000000000,
      duration: 30,
      title: '팀 메모',
      transcript: '김대리 가 내일 예산안 수정 해 주세요.',
      actionItems: [
        {
          id: 'action-1',
          type: 'FIX',
          task: '예산안 수정',
          assignee: '김대리',
          deadline: 1710086400000,
          confidence: 0.9,
        },
      ],
    });

    expect(summary).toContain('팀 메모');
    expect(summary).toContain('김대리');
    expect(summary).toContain('예산안 수정');
  });

  it('builds a readable summary even when no action items are extracted', async () => {
    const saveMemoSpy = jest
      .spyOn(storageUtils, 'saveMemo')
      .mockResolvedValue(undefined);

    const result = await echoCoreService.processRecording(
      'file://recording-2.m4a',
      20,
      '오늘 논의한 내용을 간단히 정리했습니다.',
      undefined
    );

    expect(saveMemoSpy).toHaveBeenCalled();
    expect(result.summary).toContain('회의 요약');
    expect(result.summary).toContain('주요 논의');
    expect(result.summary).toContain('주요 논의 1건');
    expect(result.summary).toContain('오늘 논의한 내용을 간단히 정리했습니다');
  });

  it('groups similar discussion sentences into a tighter summary section', async () => {
    const saveMemoSpy = jest
      .spyOn(storageUtils, 'saveMemo')
      .mockResolvedValue(undefined);

    const result = await echoCoreService.processRecording(
      'file://recording-3.m4a',
      42,
      '디자인 시안을 다시 정리합니다. 버튼 배치와 화면 레이아웃을 다시 정리합니다. 디자인 시안 검토 의견도 같이 모읍니다.',
      undefined
    );

    expect(saveMemoSpy).toHaveBeenCalled();
    expect(result.summary).toContain('주요 논의');
    expect(result.summary).toContain('디자인');
    expect(result.summary).toContain('버튼 배치와 화면 레이아웃');
    expect(result.summary).not.toContain('후속 액션');
  });

  it('groups memos into insight clusters for the main screen', () => {
    const groups = echoCoreService.getMemoInsightGroups([
      {
        id: 'memo-1',
        audioUri: 'file://memo-1.m4a',
        timestamp: 1710000000000,
        duration: 60,
        title: '배포 준비',
        transcript: '배포 일정과 테스트 범위를 다시 확인합니다.',
        summary: '회의 요약\n\n주요 논의 1건이 정리되었습니다.\n\n주요 논의\n• 배포 일정과 테스트 범위를 다시 확인합니다.\n\n정리 신뢰도 80%',
        actionItems: [],
        confidence: 0.8,
      },
      {
        id: 'memo-2',
        audioUri: 'file://memo-2.m4a',
        timestamp: 1710003600000,
        duration: 45,
        title: '디자인 점검',
        transcript: '디자인 시안과 화면 흐름을 점검합니다.',
        summary: '회의 요약\n\n주요 논의 1건이 정리되었습니다.\n\n주요 논의\n• 디자인 시안과 화면 흐름을 점검합니다.\n\n정리 신뢰도 76%',
        actionItems: [
          {
            id: 'action-2',
            type: 'REVIEW',
            task: '시안 검토',
            confidence: 0.8,
          },
        ],
        confidence: 0.76,
      },
    ]);

    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0]).toHaveProperty('label');
    expect(groups[0]).toHaveProperty('preview');
  });

  it('derives lightweight project tags when a memo references a named project', async () => {
    const saveMemoSpy = jest
      .spyOn(storageUtils, 'saveMemo')
      .mockResolvedValue(undefined);

    const result = await echoCoreService.processRecording(
      'file://recording-4.m4a',
      40,
      'Echo 프로젝트 배포 체크리스트를 오늘 안에 다시 정리합니다.',
      undefined
    );

    expect(saveMemoSpy).toHaveBeenCalled();
    expect(result.memo.tags).toContain('Echo');
  });

  it('prefers the dominant topic across title, summary, transcript, and actions', () => {
    const groupId = echoCoreService.getMemoInsightGroupId({
      id: 'memo-3',
      audioUri: 'file://memo-3.m4a',
      timestamp: 1710007200000,
      duration: 52,
      title: '디자인 QA',
      transcript:
        '사용자 요청을 반영해서 버튼 배치와 화면 레이아웃을 다시 정리합니다. 다음 시안도 확인합니다.',
      summary:
        '회의 요약\n\n주요 논의 1건이 정리되었습니다.\n\n주요 논의\n• 버튼 배치와 화면 레이아웃을 다시 정리합니다.\n\n정리 신뢰도 78%',
      actionItems: [
        {
          id: 'action-3',
          type: 'REVIEW',
          task: '시안 검토',
          confidence: 0.84,
        },
      ],
      confidence: 0.78,
    });

    expect(groupId).toBe('design');
  });
});
