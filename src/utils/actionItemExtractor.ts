import { ActionItem, ActionItemExtractionResult } from '../types/index';

type TaskType =
  | 'RESEARCH'
  | 'REVIEW'
  | 'WRITE'
  | 'FIX'
  | 'COORDINATE'
  | 'PLAN'
  | 'FOLLOW_UP'
  | 'OTHER';

const ACTION_PATTERNS: Array<{ regex: RegExp; type: TaskType }> = [
  { regex: /(조사|리서치|찾아봐|찾아봐요|확인해봐)/, type: 'RESEARCH' },
  { regex: /(확인|검토|봐줘|리뷰|체크)/, type: 'REVIEW' },
  { regex: /(작성|정리해|정리하고|문서화|기록해|공유자료)/, type: 'WRITE' },
  { regex: /(수정|고쳐|고치고|패치|버그)/, type: 'FIX' },
  { regex: /(조율|조정|연락해|연결해|미팅 잡|일정 잡)/, type: 'COORDINATE' },
  { regex: /(계획|플랜|준비해|준비하고|세팅해)/, type: 'PLAN' },
  { regex: /(보내|전달|공유해|업데이트해|부탁해|보고해|알려줘|팔로업)/, type: 'FOLLOW_UP' },
];

const ACTION_SENTENCE_HINT = /(하기|해야|해\s*줘|해\s*주세요|부탁|보내|공유해|전달해|검토해|확인해|수정해|정리해|준비해|업데이트해|보고해|연락해|조율해|계획해|작성해|등록해|예약해|봐줘|합시다)/;
const NON_ACTION_PAST_PATTERN = /(했습니다|했어요|해뒀|정리했습니다|공유했습니다|기록했습니다|논의했습니다)/;
const NON_ACTION_PREFIX = /^(결정|이슈|문제|확정)\s*[:\-]?\s*/;
const DECISION_PATTERNS = [/^(결정|확정|합의)\s*[:\-]?\s*/i, /(방향은|하기로 했|하기로 결정|확정합니다|결정합니다)/i];
const ISSUE_PATTERNS = [/^(이슈|문제|리스크)\s*[:\-]?\s*/i, /(막힘|오류|충돌|지연|불가|어렵습니다|안 됨|안됩니다|실패)/i];
const ASSIGNEE_PATTERNS = [
  /([가-힣A-Za-z0-9]{2,})(님)?(한테|에게|보고|한테는)/,
  /([가-힣A-Za-z0-9]{2,})(님)?(이|가)\s+/,
  /담당\s*[:\-]?\s*([가-힣A-Za-z0-9]{2,})(님)?/,
  /([가-힣A-Za-z0-9]{2,})(님)?\s+(가|이|은|는|에게|한테)\b/,
];
const TEMPORAL_PATTERNS = [
  { regex: /다음\s*주\s*([월화수목금토일])요일\s*(오전|오후)?\s*(\d{1,2})시(\s*(반|30분))?\s*까지/, parser: (text: string) => parseRelativeWeekdayTime(text, true) },
  { regex: /이번\s*주\s*([월화수목금토일])요일\s*(오전|오후)?\s*(\d{1,2})시(\s*(반|30분))?\s*까지/, parser: (text: string) => parseRelativeWeekdayTime(text, false) },
  { regex: /([월화수목금토일])요일\s*(오전|오후)?\s*(\d{1,2})시(\s*(반|30분))?\s*까지/, parser: (text: string) => parseWeekdayTime(text) },
  { regex: /(오늘|내일|모레)\s*(오전|오후)?\s*(\d{1,2})시(\s*(반|30분))?\s*까지/, parser: (text: string) => parseRelativeDayTime(text) },
  { regex: /(\d+)월\s*(\d+)일\s*(오전|오후)?\s*(\d{1,2})시(\s*(반|30분))?\s*까지/, parser: (text: string) => parseSpecificDateTime(text) },
  { regex: /(\d+)월\s*(\d+)일\s*까지/, parser: (text: string) => parseSpecificDate(text) },
  { regex: /(\d+)월\s*(\d+)일/, parser: (text: string) => parseSpecificDate(text) },
  { regex: /내일\s*까지/, parser: () => getDateAfterDays(1) },
  { regex: /내일/, parser: () => getDateAfterDays(1) },
  { regex: /모레\s*까지/, parser: () => getDateAfterDays(2) },
  { regex: /오늘\s*안에/, parser: () => getDateAfterDays(0) },
  { regex: /오늘\s*(오전|오후)?\s*(\d{1,2})시(\s*(반|30분))?/, parser: (text: string) => parseRelativeDayTime(text) },
  { regex: /내일\s*(오전|오후)?\s*(\d{1,2})시(\s*(반|30분))?/, parser: (text: string) => parseRelativeDayTime(text) },
  { regex: /이번\s*주\s*안에/, parser: () => getEndOfWeek() },
  { regex: /이번\s*주\s*금요일까지/, parser: () => getNextWeekday(5, true) },
  { regex: /금요일까지/, parser: () => getNextWeekday(5, false) },
  { regex: /월요일까지/, parser: () => getNextWeekday(1, false) },
];

function getDateAfterDays(days: number): number {
  const date = new Date();
  date.setHours(18, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function getNextWeekday(targetDay: number, sameWeek: boolean): number {
  const today = new Date();
  const current = today.getDay();
  let delta = (targetDay - current + 7) % 7;

  if (delta === 0) {
    delta = sameWeek ? 0 : 7;
  }

  if (!sameWeek && delta === 0) {
    delta = 7;
  }

  const next = new Date();
  next.setHours(18, 0, 0, 0);
  next.setDate(today.getDate() + delta);
  return next.getTime();
}

function getEndOfWeek(): number {
  return getNextWeekday(5, true);
}

function parseSpecificDate(text: string): number {
  const monthMatch = text.match(/(\d+)월/);
  const dayMatch = text.match(/(\d+)일/);

  if (monthMatch && dayMatch) {
    const month = Number(monthMatch[1]) - 1;
    const day = Number(dayMatch[1]);
    const now = new Date();
    let year = now.getFullYear();

    if (month < now.getMonth() || (month === now.getMonth() && day < now.getDate())) {
      year += 1;
    }

    return new Date(year, month, day, 18, 0, 0, 0).getTime();
  }

  return Date.now();
}

function resolveHourPeriod(baseHour: number, meridiem?: string, hasHalf = false): { hour: number; minute: number } {
  let hour = baseHour;
  if (meridiem === '오후' && hour < 12) {
    hour += 12;
  }
  if (meridiem === '오전' && hour === 12) {
    hour = 0;
  }
  return {
    hour,
    minute: hasHalf ? 30 : 0,
  };
}

function buildTimestamp(year: number, month: number, day: number, hour = 18, minute = 0): number {
  return new Date(year, month, day, hour, minute, 0, 0).getTime();
}

function parseSpecificDateTime(text: string): number {
  const monthMatch = text.match(/(\d+)월/);
  const dayMatch = text.match(/(\d+)일/);
  const hourMatch = text.match(/(\d{1,2})시/);
  const meridiemMatch = text.match(/(오전|오후)/);
  const hasHalf = /반|30분/.test(text);

  if (!monthMatch || !dayMatch || !hourMatch) {
    return parseSpecificDate(text);
  }

  const now = new Date();
  let year = now.getFullYear();
  const month = Number(monthMatch[1]) - 1;
  const day = Number(dayMatch[1]);
  const baseHour = Number(hourMatch[1]);
  const { hour, minute } = resolveHourPeriod(baseHour, meridiemMatch?.[1], hasHalf);

  if (month < now.getMonth() || (month === now.getMonth() && day < now.getDate())) {
    year += 1;
  }

  return buildTimestamp(year, month, day, hour, minute);
}

function weekdayToNumber(weekday: string): number {
  return {
    일: 0,
    월: 1,
    화: 2,
    수: 3,
    목: 4,
    금: 5,
    토: 6,
  }[weekday] ?? 0;
}

function parseWeekdayTime(text: string): number {
  const weekdayMatch = text.match(/([월화수목금토일])요일/);
  const hourMatch = text.match(/(\d{1,2})시/);
  const meridiemMatch = text.match(/(오전|오후)/);
  const hasHalf = /반|30분/.test(text);

  if (!weekdayMatch || !hourMatch) {
    return Date.now();
  }

  const weekday = weekdayToNumber(weekdayMatch[1]);
  const current = new Date();
  const delta = (weekday - current.getDay() + 7) % 7 || 7;
  const next = new Date();
  next.setDate(current.getDate() + delta);
  const { hour, minute } = resolveHourPeriod(Number(hourMatch[1]), meridiemMatch?.[1], hasHalf);
  next.setHours(hour, minute, 0, 0);
  return next.getTime();
}

function parseRelativeWeekdayTime(text: string, nextWeek: boolean): number {
  const weekdayMatch = text.match(/([월화수목금토일])요일/);
  const hourMatch = text.match(/(\d{1,2})시/);
  const meridiemMatch = text.match(/(오전|오후)/);
  const hasHalf = /반|30분/.test(text);

  if (!weekdayMatch || !hourMatch) {
    return Date.now();
  }

  const weekday = weekdayToNumber(weekdayMatch[1]);
  const current = new Date();
  let delta = (weekday - current.getDay() + 7) % 7;
  if (nextWeek || delta === 0) {
    delta += 7;
  }

  const target = new Date();
  target.setDate(current.getDate() + delta);
  const { hour, minute } = resolveHourPeriod(Number(hourMatch[1]), meridiemMatch?.[1], hasHalf);
  target.setHours(hour, minute, 0, 0);
  return target.getTime();
}

function parseRelativeDayTime(text: string): number {
  const dayWordMatch = text.match(/(오늘|내일|모레)/);
  const hourMatch = text.match(/(\d{1,2})시/);
  const meridiemMatch = text.match(/(오전|오후)/);
  const hasHalf = /반|30분/.test(text);

  if (!dayWordMatch || !hourMatch) {
    return Date.now();
  }

  const offset =
    dayWordMatch[1] === '오늘' ? 0 : dayWordMatch[1] === '내일' ? 1 : 2;
  const target = new Date();
  target.setDate(target.getDate() + offset);
  const { hour, minute } = resolveHourPeriod(Number(hourMatch[1]), meridiemMatch?.[1], hasHalf);
  target.setHours(hour, minute, 0, 0);
  return target.getTime();
}

function normalizeSentence(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractActionType(text: string): TaskType {
  for (const pattern of ACTION_PATTERNS) {
    if (pattern.regex.test(text)) {
      return pattern.type;
    }
  }
  return 'OTHER';
}

function looksLikeActionSentence(text: string): boolean {
  if (NON_ACTION_PREFIX.test(text)) {
    return false;
  }

  if (NON_ACTION_PAST_PATTERN.test(text)) {
    return false;
  }

  return ACTION_SENTENCE_HINT.test(text);
}

function extractTemporal(text: string): { deadline?: number; found: boolean } {
  for (const pattern of TEMPORAL_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      return { deadline: pattern.parser(match[0]), found: true };
    }
  }
  return { found: false };
}

function extractAssignee(text: string): { name?: string; confidence: number } {
  for (const pattern of ASSIGNEE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return { name: match[1].replace(/님$/, ''), confidence: 0.85 };
    }
  }

  const words = text.split(/\s+/);
  for (let index = 0; index < words.length - 1; index += 1) {
    const current = words[index].replace(/님$/, '');
    const next = words[index + 1];
    if (/^[가-힣A-Za-z0-9]{2,}$/.test(current) && /^(가|이|은|는)$/.test(next)) {
      return { name: current, confidence: 0.8 };
    }
  }

  return { name: undefined, confidence: 0.35 };
}

function cleanTaskText(text: string): string {
  return text
    .replace(/^(그리고|또|그럼|그러면)\s+/, '')
    .replace(/^담당\s*[:\-]?\s*[가-힣A-Za-z0-9]{2,}(님)?\s*/, '')
    .replace(/^[가-힣A-Za-z0-9]{2,}(님)?(한테|에게|보고|한테는)\s*/, '')
    .replace(/^[가-힣A-Za-z0-9]{2,}(님)?(이|가)\s+/, '')
    .replace(/^(오늘|내일|모레)\s*(오전|오후)?\s*\d{1,2}시(\s*(반|30분))?\s*까지\s*/, '')
    .replace(/^((다음|이번)\s*주\s*)?[월화수목금토일]요일\s*(오전|오후)?\s*\d{1,2}시(\s*(반|30분))?\s*까지\s*/, '')
    .replace(/^\d+월\s*\d+일\s*(오전|오후)?\s*\d{1,2}시(\s*(반|30분))?\s*까지\s*/, '')
    .replace(/^\d+월\s*\d+일\s*까지\s*/, '')
    .replace(/^(오늘|내일|모레|이번\s*주\s*안에|이번\s*주\s*금요일까지|금요일까지|월요일까지)\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanDecisionText(text: string): string {
  return text
    .replace(/^(결정|확정|합의)\s*[:\-]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanIssueText(text: string): string {
  return text
    .replace(/^(이슈|문제|리스크)\s*[:\-]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateConfidence(hasAssignee: boolean, hasAction: boolean, hasDeadline: boolean): number {
  let confidence = 0.35;
  if (hasAction) confidence += 0.3;
  if (hasAssignee) confidence += 0.15;
  if (hasDeadline) confidence += 0.2;
  return Math.min(confidence, 1);
}

export class ActionItemExtractor {
  extract(transcript: string): ActionItemExtractionResult {
    const sentences = transcript
      .split(/[.!?。！？\n]+/)
      .map(sentence => normalizeSentence(sentence))
      .filter(sentence => sentence.length > 0);

    const items: ActionItem[] = [];

    sentences.forEach((sentence, idx) => {
      if (!looksLikeActionSentence(sentence)) {
        return;
      }

      const type = extractActionType(sentence);
      const temporal = extractTemporal(sentence);
      const assignee = extractAssignee(sentence);
      const task = cleanTaskText(sentence);

      const actionItem: ActionItem = {
        id: `action_${Date.now()}_${idx}`,
        type,
        task,
        assignee: assignee.name,
        deadline: temporal.deadline,
        confidence: calculateConfidence(assignee.confidence > 0.5, type !== 'OTHER', temporal.found),
        completed: false,
      };

      items.push(actionItem);
    });

    const keyDecisions = extractKeyDecisions(transcript);
    const issues = extractIssues(transcript);
    const confidence =
      items.length > 0
        ? Math.min(0.25 + items.reduce((sum, item) => sum + item.confidence, 0) / items.length, 1)
        : 0.2;

    return {
      actionItems: items,
      keyDecisions,
      issues,
      confidence,
    };
  }
}

function extractKeyDecisions(transcript: string): string[] {
  return transcript
    .split(/[\n。！？.!?]+/)
    .map(line => line.trim())
    .filter(line => line.length > 5)
    .filter(line => DECISION_PATTERNS.some(pattern => pattern.test(line)))
    .filter(line => !looksLikeActionSentence(line))
    .map(line => cleanDecisionText(line))
    .filter(Boolean);
}

function extractIssues(transcript: string): string[] {
  return transcript
    .split(/[\n。！？.!?]+/)
    .map(line => line.trim())
    .filter(line => line.length > 5)
    .filter(line => ISSUE_PATTERNS.some(pattern => pattern.test(line)))
    .filter(line => !looksLikeActionSentence(line))
    .map(line => cleanIssueText(line))
    .filter(Boolean);
}

export const actionItemExtractor = new ActionItemExtractor();
