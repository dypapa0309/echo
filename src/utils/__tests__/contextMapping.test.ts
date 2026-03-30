import { pickBestCalendarEvent } from '../contextMapping';

describe('pickBestCalendarEvent', () => {
  const baseNow = new Date('2026-03-29T10:00:00+09:00').getTime();

  it('prefers an event that is currently in progress', () => {
    const event = pickBestCalendarEvent(
      [
        {
          id: 'upcoming',
          title: '다음 일정',
          startDate: new Date(baseNow + 20 * 60 * 1000),
          endDate: new Date(baseNow + 80 * 60 * 1000),
        },
        {
          id: 'active',
          title: '진행 중 일정',
          startDate: new Date(baseNow - 15 * 60 * 1000),
          endDate: new Date(baseNow + 15 * 60 * 1000),
        },
      ],
      baseNow
    );

    expect(event?.id).toBe('active');
  });

  it('falls back to a near upcoming event when nothing is active', () => {
    const event = pickBestCalendarEvent(
      [
        {
          id: 'soon',
          title: '곧 시작',
          startDate: new Date(baseNow + 25 * 60 * 1000),
          endDate: new Date(baseNow + 55 * 60 * 1000),
        },
      ],
      baseNow
    );

    expect(event?.id).toBe('soon');
  });

  it('ignores events that are too far away', () => {
    const event = pickBestCalendarEvent(
      [
        {
          id: 'later',
          title: '나중 일정',
          startDate: new Date(baseNow + 90 * 60 * 1000),
          endDate: new Date(baseNow + 120 * 60 * 1000),
        },
      ],
      baseNow
    );

    expect(event).toBeUndefined();
  });

  it('ignores all-day events and prefers a real meeting event', () => {
    const event = pickBestCalendarEvent(
      [
        {
          id: 'all-day',
          title: '하루 종일 일정',
          startDate: new Date(baseNow - 2 * 60 * 60 * 1000),
          endDate: new Date(baseNow + 10 * 60 * 60 * 1000),
          allDay: true,
        },
        {
          id: 'meeting',
          title: '실제 미팅',
          startDate: new Date(baseNow + 10 * 60 * 1000),
          endDate: new Date(baseNow + 40 * 60 * 1000),
        },
      ],
      baseNow
    );

    expect(event?.id).toBe('meeting');
  });

  it('prefers active events with a clearer titled meeting', () => {
    const event = pickBestCalendarEvent(
      [
        {
          id: 'light',
          title: '',
          startDate: new Date(baseNow - 10 * 60 * 1000),
          endDate: new Date(baseNow + 20 * 60 * 1000),
        },
        {
          id: 'clear',
          title: '팀 싱크',
          startDate: new Date(baseNow - 8 * 60 * 1000),
          endDate: new Date(baseNow + 18 * 60 * 1000),
        },
      ],
      baseNow
    );

    expect(event?.id).toBe('clear');
  });

  it('prefers a specific meeting title over a generic busy-style title', () => {
    const event = pickBestCalendarEvent(
      [
        {
          id: 'generic',
          title: 'Busy',
          startDate: new Date(baseNow - 12 * 60 * 1000),
          endDate: new Date(baseNow + 18 * 60 * 1000),
        },
        {
          id: 'specific',
          title: 'Echo 출시 점검 회의',
          startDate: new Date(baseNow - 11 * 60 * 1000),
          endDate: new Date(baseNow + 19 * 60 * 1000),
        },
      ],
      baseNow
    );

    expect(event?.id).toBe('specific');
  });
});
