import { actionItemExtractor } from '../actionItemExtractor';

describe('actionItemExtractor', () => {
  it('extracts action items, decisions, and issues from a transcript', () => {
    const transcript = [
      '김대리 가 내일 예산안 수정 해 주세요.',
      '결정 이번 주 안에 베타 테스트를 시작합니다.',
      '이슈 로그인 오류가 계속 발생합니다.',
    ].join(' ');

    const result = actionItemExtractor.extract(transcript);

    expect(result.actionItems).toHaveLength(1);
    expect(result.actionItems[0]).toMatchObject({
      assignee: '김대리',
      type: 'FIX',
      task: expect.stringContaining('예산안 수정'),
    });
    expect(result.actionItems[0].deadline).toBeDefined();
    expect(result.keyDecisions).toEqual(
      expect.arrayContaining([expect.stringContaining('이번 주 안에 베타 테스트를 시작합니다')])
    );
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.stringContaining('로그인 오류가 계속 발생합니다')])
    );
    expect(result.confidence).toBeGreaterThan(0.2);
  });

  it('returns an empty action item list when no action verb is present', () => {
    const result = actionItemExtractor.extract('오늘 논의한 내용을 같이 정리했습니다.');

    expect(result.actionItems).toEqual([]);
    expect(result.confidence).toBe(0.2);
  });

  it('extracts Korean follow-up style tasks with assignee and deadline phrases', () => {
    const transcript = [
      '민수한테 금요일까지 계약서 검토 부탁해.',
      '지원님에게 내일까지 디자인 시안 공유해 주세요.',
    ].join(' ');

    const result = actionItemExtractor.extract(transcript);

    expect(result.actionItems).toHaveLength(2);
    expect(result.actionItems[0]).toMatchObject({
      assignee: '민수',
      type: 'REVIEW',
    });
    expect(result.actionItems[1]).toMatchObject({
      assignee: '지원',
      type: 'FOLLOW_UP',
    });
    expect(result.actionItems[0].deadline).toBeDefined();
    expect(result.actionItems[1].deadline).toBeDefined();
  });

  it('separates decisions and issues from action sentences more cleanly', () => {
    const transcript = [
      '결정: 이번 주 안에 배포 일정은 금요일로 확정합니다.',
      '이슈: iOS에서 로그인 오류가 계속 발생합니다.',
      '민수한테 내일까지 로그인 오류 원인 확인 부탁해.',
    ].join(' ');

    const result = actionItemExtractor.extract(transcript);

    expect(result.keyDecisions).toEqual([
      expect.stringContaining('이번 주 안에 배포 일정은 금요일로 확정합니다'),
    ]);
    expect(result.issues).toEqual([
      expect.stringContaining('iOS에서 로그인 오류가 계속 발생합니다'),
    ]);
    expect(result.actionItems).toHaveLength(1);
    expect(result.actionItems[0]).toMatchObject({
      assignee: '민수',
      type: 'REVIEW',
    });
  });

  it('extracts assignee and time from natural Korean scheduling phrases', () => {
    const transcript = [
      '민수님이 내일 오후 3시까지 제안서 정리해 주세요.',
      '담당: 지수 다음 주 화요일 오전 11시까지 일정 조율해 주세요.',
    ].join(' ');

    const result = actionItemExtractor.extract(transcript);

    expect(result.actionItems).toHaveLength(2);
    expect(result.actionItems[0]).toMatchObject({
      assignee: '민수',
      type: 'WRITE',
      task: expect.stringContaining('제안서 정리해 주세요'),
    });
    expect(result.actionItems[1]).toMatchObject({
      assignee: '지수',
      type: 'COORDINATE',
      task: expect.stringContaining('일정 조율해 주세요'),
    });
    expect(result.actionItems[0].deadline).toBeDefined();
    expect(result.actionItems[1].deadline).toBeDefined();
  });

  it('captures specific date and time deadlines more precisely', () => {
    const result = actionItemExtractor.extract(
      '유진한테 4월 3일 오후 2시까지 배포 문구 작성 부탁해.'
    );

    expect(result.actionItems).toHaveLength(1);
    expect(result.actionItems[0]).toMatchObject({
      assignee: '유진',
      type: 'WRITE',
      task: expect.stringContaining('배포 문구 작성 부탁해'),
    });
    expect(result.actionItems[0].deadline).toBeDefined();
    expect(result.actionItems[0].confidence).toBeGreaterThan(0.7);
  });
});
