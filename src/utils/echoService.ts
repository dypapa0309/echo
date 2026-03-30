import { actionItemExtractor } from './actionItemExtractor';
import { contextMappingEngine } from './contextMapping';
import { storageUtils } from './storage';
import { VoiceMemo, ActionItem, RecordingContext, ActionItemExtractionResult } from '../types/index';
import { getLastTranscriptionState, transcribeAudio } from './stt';
import { STTSource } from './sttEngine';
import uuid from 'react-native-uuid';

type ExpoFileSystemModule = typeof import('expo-file-system');

/**
 * Echo Core Service
 * 
 * 다음 파이프라인을 조율합니다:
 * 1. 녹음 시작 → Context 수집
 * 2. 녹음 종료 → STT 변환
 * 3. 텍스트 처리 → Action Item 추출
 * 4. 저장 및 통합
 */

export interface EchoProcessingResult {
  memo: VoiceMemo;
  actionItems: ActionItem[];
  summary: string;
  processingTimeMs: number;
  sttSource: STTSource;
  sttMessage: string;
}

export interface MemoInsightGroup {
  id: string;
  label: string;
  memoCount: number;
  summaryCount: number;
  actionCount: number;
  preview: string;
}

type TopicId = 'schedule' | 'finance' | 'design' | 'build' | 'customer' | 'general';

const TOPIC_RULES: Record<TopicId, Array<{ pattern: RegExp; weight: number }>> = {
  schedule: [
    { pattern: /(일정|스케줄|타임라인|마감|기한|배포|릴리즈|런칭|출시|회의|미팅|캘린더|데드라인)/i, weight: 3 },
    { pattern: /(내일|오늘|이번 주|다음 주|월요일|화요일|수요일|목요일|금요일|토요일|일요일)/i, weight: 2 },
    { pattern: /(언제|언제까지|조율|확정|예약)/i, weight: 1 },
  ],
  finance: [
    { pattern: /(예산|비용|단가|견적|매출|매입|정산|계약|세금|청구|결제|구독료|수익|손익)/i, weight: 3 },
    { pattern: /(금액|원|만원|억원|투자|지출)/i, weight: 2 },
  ],
  design: [
    { pattern: /(디자인|시안|화면|ui|ux|레이아웃|타이포|컬러|브랜딩|와이어프레임|프로토타입|컴포넌트)/i, weight: 3 },
    { pattern: /(버튼|카드|모달|탭|상세 화면|온보딩|랜딩|인터랙션)/i, weight: 2 },
  ],
  build: [
    { pattern: /(개발|구현|코드|테스트|버그|빌드|stt|녹음|전사|품질|성능|리팩터링|api|서버|모듈)/i, weight: 3 },
    { pattern: /(에러|오류|디버그|수정|백그라운드|헤이 에코|wake word|딥링크|권한)/i, weight: 2 },
  ],
  customer: [
    { pattern: /(고객|사용자|유저|클라이언트|문의|피드백|요청|불만|voc|지원)/i, weight: 3 },
    { pattern: /(인터뷰|반응|접근성|경험|불편|니즈)/i, weight: 2 },
  ],
  general: [],
};

const loadFileSystemModule = (): ExpoFileSystemModule | null => {
  try {
    return require('expo-file-system') as ExpoFileSystemModule;
  } catch (error) {
    console.warn('[Echo] expo-file-system is unavailable:', error);
    return null;
  }
};

const getAudioExtension = (audioUri: string): string => {
  const cleanUri = audioUri.split('?')[0];
  const match = cleanUri.match(/(\.[a-z0-9]+)$/i);
  return match?.[1] ?? '.m4a';
};

export class EchoCoreService {
  /**
   * Process completed recording (audio->STT->extract)
   */
  async processAudioRecording(
    audioUri: string,
    duration: number,
    context?: RecordingContext
  ): Promise<EchoProcessingResult> {
    const transcript = await transcribeAudio(audioUri);
    const sttState = getLastTranscriptionState();
    const resolvedContext = context ?? (await this.getRecordingContext());
    const result = await this.processRecording(audioUri, duration, transcript, resolvedContext);
    return {
      ...result,
      sttSource: sttState.source,
      sttMessage: sttState.message,
    };
  }

  private async getRecordingContext(): Promise<RecordingContext | undefined> {
    try {
      return await contextMappingEngine.buildContext();
    } catch (error) {
      console.warn('[Echo] Context mapping unavailable:', error);
      return undefined;
    }
  }

  /**
   * Process completed recording
   * 녹음 종료 후 전체 처리 파이프라인
   */
  async processRecording(
    audioUri: string,
    duration: number,
    transcript: string,
    context?: RecordingContext
  ): Promise<EchoProcessingResult> {
    const startTime = Date.now();
    const memoId = uuid.v4() as string;

    try {
      // Step 1: Extract action items
      const extractionResult = actionItemExtractor.extract(transcript);

      // Step 2: Generate summary (simple version for MVP)
      const summary = this.generateSummary(transcript, extractionResult);
      const managedAudioUri = await this.persistAudioFile(audioUri, memoId);

      // Step 3: Create memo object
      const memo: VoiceMemo = {
        id: memoId,
        title: context?.calendarEvent?.title || '메모',
        transcript,
        summary,
        audioUri: managedAudioUri,
        timestamp: Date.now(),
        duration,
        context,
        tags: this.deriveTags({
          title: context?.calendarEvent?.title || '메모',
          transcript,
          summary,
          audioUri: managedAudioUri,
          timestamp: Date.now(),
          duration,
          context,
          actionItems: extractionResult.actionItems,
          confidence: extractionResult.confidence,
          id: memoId,
        }),
        actionItems: extractionResult.actionItems,
        confidence: extractionResult.confidence,
      };

      // Step 4: Save to storage
      await storageUtils.saveMemo(memo);

      // Step 5: Prepare result
      const result: EchoProcessingResult = {
        memo,
        actionItems: extractionResult.actionItems,
        summary,
        processingTimeMs: Date.now() - startTime,
        sttSource: 'mock',
        sttMessage: 'Transcript provided directly.',
      };

      console.log(
        `[Echo] Processing completed in ${result.processingTimeMs}ms`,
        `Extracted ${extractionResult.actionItems.length} action items`
      );

      return result;
    } catch (error) {
      console.error('[Echo] Processing error:', error);
      throw error;
    }
  }

  /**
   * Generate summary from transcript and action items
   */
  private generateSummary(
    transcript: string,
    extractionResult: ActionItemExtractionResult
  ): string {
    const lines: string[] = [];
    const discussionGroups = this.buildDiscussionGroups(transcript, extractionResult);
    lines.push('회의 요약');
    lines.push('');

    lines.push(this.buildOverviewSentence(extractionResult, discussionGroups.length));
    lines.push('');

    if (discussionGroups.length > 0) {
      lines.push('주요 논의');
      discussionGroups.forEach(group => {
        lines.push(`• ${group}`);
      });
      lines.push('');
    }

    if (extractionResult.keyDecisions.length > 0) {
      lines.push('핵심 결정');
      extractionResult.keyDecisions.forEach(decision => {
        lines.push(`• ${decision}`);
      });
      lines.push('');
    }

    if (extractionResult.actionItems.length > 0) {
      lines.push('후속 액션');
      extractionResult.actionItems.forEach((item, idx) => {
        const deadline = item.deadline
          ? `${new Date(item.deadline).toLocaleDateString('ko-KR')}까지`
          : '기한 미정';
        const owner = item.assignee || '담당자 미정';
        lines.push(`${idx + 1}. ${owner} · ${item.task}`);
        lines.push(`   ${deadline}`);
      });
      lines.push('');
    }

    if (extractionResult.issues.length > 0) {
      lines.push('리스크 및 메모');
      extractionResult.issues.forEach(issue => {
        lines.push(`• ${issue}`);
      });
      lines.push('');
    }

    lines.push(`정리 신뢰도 ${Math.round(extractionResult.confidence * 100)}%`);

    return lines.join('\n');
  }

  private async persistAudioFile(audioUri: string, memoId: string): Promise<string> {
    const fileSystem = loadFileSystemModule();
    if (!fileSystem?.documentDirectory) {
      return audioUri;
    }

    try {
      const directory = `${fileSystem.documentDirectory}echo-memos`;
      await fileSystem.makeDirectoryAsync(directory, { intermediates: true });

      const destinationUri = `${directory}/${memoId}${getAudioExtension(audioUri)}`;
      if (destinationUri === audioUri) {
        return audioUri;
      }

      const currentInfo = await fileSystem.getInfoAsync(audioUri);
      if (!currentInfo.exists) {
        return audioUri;
      }

      const destinationInfo = await fileSystem.getInfoAsync(destinationUri);
      if (destinationInfo.exists) {
        await fileSystem.deleteAsync(destinationUri, { idempotent: true });
      }

      await fileSystem.copyAsync({ from: audioUri, to: destinationUri });

      if (audioUri.startsWith('file://')) {
        await fileSystem.deleteAsync(audioUri, { idempotent: true }).catch(() => undefined);
      }

      return destinationUri;
    } catch (error) {
      console.warn('[Echo] Audio persistence fallback:', error);
      return audioUri;
    }
  }

  private deriveTags(memo: VoiceMemo): string[] {
    const tags: string[] = [];
    const topicInfo = this.getMemoInsightGroup(memo);
    const projectTag = this.extractProjectOrOrganizationTag(memo);

    if (topicInfo.id !== 'general') {
      tags.push(topicInfo.label);
    }
    if (projectTag) {
      tags.push(projectTag);
    }
    if ((memo.actionItems?.length ?? 0) > 0) {
      tags.push('할 일');
    }
    if (memo.context?.calendarEvent) {
      tags.push('일정');
    }
    if (memo.summary?.includes('리스크 및 메모')) {
      tags.push('리스크');
    }
    if (memo.summary?.includes('핵심 결정')) {
      tags.push('결정');
    }

    return Array.from(new Set(tags)).slice(0, 3);
  }

  private extractProjectOrOrganizationTag(memo: VoiceMemo): string | undefined {
    const sourceText = [memo.title, memo.summary, memo.transcript]
      .filter(Boolean)
      .join(' ');

    const explicitMatch = sourceText.match(/([A-Za-z0-9가-힣]{2,24})\s*(프로젝트|앱|서비스|팀)\b/);
    if (explicitMatch) {
      return explicitMatch[1];
    }

    const englishLikeMatches = sourceText.match(/\b[A-Z][A-Za-z0-9+-]{2,20}\b/g) ?? [];
    const blocked = new Set(['STT', 'UI', 'UX', 'API', 'PDF', 'IOS', 'ANDROID']);
    const candidate = englishLikeMatches.find(token => !blocked.has(token.toUpperCase()));
    return candidate;
  }

  private buildOverviewSentence(
    extractionResult: ActionItemExtractionResult,
    discussionGroupCount: number
  ): string {
    const actionCount = extractionResult.actionItems.length;
    const decisionCount = extractionResult.keyDecisions.length;
    const issueCount = extractionResult.issues.length;

    if (actionCount === 0 && decisionCount === 0 && issueCount === 0 && discussionGroupCount === 0) {
      return '이번 메모에서는 눈에 띄는 후속 액션이나 결정 사항을 찾지 못했습니다.';
    }

    const parts: string[] = [];

    if (discussionGroupCount > 0) {
      parts.push(`주요 논의 ${discussionGroupCount}건`);
    }
    if (decisionCount > 0) {
      parts.push(`결정 사항 ${decisionCount}건`);
    }
    if (actionCount > 0) {
      parts.push(`후속 액션 ${actionCount}건`);
    }
    if (issueCount > 0) {
      parts.push(`리스크 ${issueCount}건`);
    }

    return `이번 메모에서는 ${parts.join(', ')}이 정리되었습니다.`;
  }

  private buildDiscussionGroups(
    transcript: string,
    extractionResult: ActionItemExtractionResult
  ): string[] {
    const actionTexts = new Set(
      extractionResult.actionItems.map(item => this.normalizeForMatch(item.task))
    );
    const decisionTexts = new Set(
      extractionResult.keyDecisions.map(item => this.normalizeForMatch(item))
    );
    const issueTexts = new Set(
      extractionResult.issues.map(item => this.normalizeForMatch(item))
    );

    const groups = new Map<string, string[]>();
    const sentences = this.splitTranscriptIntoSentences(transcript);

    sentences.forEach(sentence => {
      const normalized = this.normalizeForMatch(sentence);
      if (!normalized || normalized.length < 8) {
        return;
      }

      if (this.isDecisionOrIssueSentence(sentence)) {
        return;
      }

      if (
        actionTexts.has(normalized) ||
        decisionTexts.has(normalized) ||
        issueTexts.has(normalized)
      ) {
        return;
      }

      const topic = this.detectTopic(sentence);
      const keywordKey = this.getKeywordClusterKey(sentence);
      const groupKey = `${topic}:${keywordKey}`;
      const current = groups.get(groupKey) ?? [];
      if (!current.some(entry => entry === sentence)) {
        current.push(sentence);
      }
      groups.set(groupKey, current);
    });

    return Array.from(groups.values())
      .sort((a, b) => b.length - a.length)
      .map(group => this.summarizeSentenceGroup(group))
      .filter(Boolean)
      .slice(0, 3);
  }

  private splitTranscriptIntoSentences(transcript: string): string[] {
    return transcript
      .split(/[\n。！？.!?]+/)
      .map(sentence => sentence.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }

  private normalizeForMatch(text: string): string {
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  private detectTopic(sentence: string): TopicId {
    const normalized = sentence.toLowerCase();
    let bestTopic: TopicId = 'general';
    let bestScore = 0;

    (Object.entries(TOPIC_RULES) as Array<[TopicId, Array<{ pattern: RegExp; weight: number }>]>)
      .forEach(([topic, rules]) => {
        const score = rules.reduce((sum, rule) => {
          return rule.pattern.test(normalized) ? sum + rule.weight : sum;
        }, 0);

        if (score > bestScore) {
          bestTopic = topic;
          bestScore = score;
        }
      });

    return bestScore > 0 ? bestTopic : 'general';
  }

  private summarizeSentenceGroup(group: string[]): string {
    const lead = this.selectLeadSentence(group);
    if (group.length === 1) {
      return lead;
    }

    const trimmedLead = lead.replace(/[.。]$/, '');
    return `${trimmedLead} 외 ${group.length - 1}건의 관련 논의가 이어졌습니다.`;
  }

  private selectLeadSentence(group: string[]): string {
    return [...group].sort((a, b) => {
      const aLengthScore = Math.min(a.length, 120);
      const bLengthScore = Math.min(b.length, 120);
      const aKeywordScore = this.extractMeaningfulKeywords(a).length;
      const bKeywordScore = this.extractMeaningfulKeywords(b).length;

      if (bKeywordScore !== aKeywordScore) {
        return bKeywordScore - aKeywordScore;
      }

      return bLengthScore - aLengthScore;
    })[0];
  }

  private getKeywordClusterKey(sentence: string): string {
    const keywords = this.extractMeaningfulKeywords(sentence).slice(0, 3);
    if (keywords.length === 0) {
      return this.normalizeForMatch(sentence).slice(0, 18);
    }

    return keywords.join('|');
  }

  private extractMeaningfulKeywords(sentence: string): string[] {
    const stopwords = new Set([
      '그리고',
      '그래서',
      '이번',
      '관련',
      '대한',
      '에서',
      '으로',
      '합니다',
      '해주세요',
      '있습니다',
      '정리',
      '논의',
      '메모',
      '회의',
    ]);

    return Array.from(
      new Set(
        sentence
          .toLowerCase()
          .replace(/[^0-9a-z가-힣\s]/gi, ' ')
          .split(/\s+/)
          .map(token => token.trim())
          .filter(token => token.length >= 2 && !stopwords.has(token))
      )
    );
  }

  private isDecisionOrIssueSentence(sentence: string): boolean {
    return /^(결정|확정|합의|이슈|문제|리스크)\s*[:\-]?/i.test(sentence)
      || /(방향은|확정합니다|결정합니다|막힘|오류|충돌|지연|실패)/i.test(sentence);
  }

  /**
   * Export memo as shareable format
   */
  async exportMemoAsSlack(memo: VoiceMemo): Promise<string> {
    const lines: string[] = [];

    lines.push(`📝 *${memo.title || '메모'}*`);
    lines.push(`• 시간: ${new Date(memo.timestamp).toLocaleString('ko-KR')}`);
    lines.push(`• 길이: ${Math.floor(memo.duration / 60)}분 ${memo.duration % 60}초`);
    lines.push('');

    if (memo.actionItems && memo.actionItems.length > 0) {
      lines.push('🎯 *할 일*');
      memo.actionItems.forEach(item => {
        const deadline = item.deadline
          ? new Date(item.deadline).toLocaleDateString('ko-KR')
          : '미정';
        lines.push(`• ${item.assignee}: ${item.task} (_by ${deadline}_)`);
      });
      lines.push('');
    }

    lines.push(`📊 신뢰도: ${(memo.confidence ? memo.confidence * 100 : 0).toFixed(0)}%`);

    return lines.join('\n');
  }

  /**
   * Create action item summary for quick copy to clipboard
   */
  createClipboardSummary(memo: VoiceMemo): string {
    if (!memo.actionItems || memo.actionItems.length === 0) {
      return memo.summary || (memo.transcript ?? '').substring(0, 200);
    }

    const lines: string[] = [];
    lines.push(`[${new Date(memo.timestamp).toLocaleTimeString('ko-KR')}] ${memo.title}`);
    lines.push('');

    memo.actionItems.forEach(item => {
      lines.push(`- ${item.assignee}: ${item.task}`);
      if (item.deadline) {
        const date = new Date(item.deadline).toLocaleDateString('ko-KR');
        lines.push(`  (마감: ${date})`);
      }
    });

    return lines.join('\n');
  }

  /**
   * Get action items statistics
   */
  getStatistics(memos: VoiceMemo[]): {
    totalMemos: number;
    totalActionItems: number;
    averageConfidence: number;
    tasksByType: Record<string, number>;
  } {
    const totalMemos = memos.length;
    let totalActionItems = 0;
    let confidenceSum = 0;
    const tasksByType: Record<string, number> = {};

    memos.forEach(memo => {
      if (memo.actionItems) {
        totalActionItems += memo.actionItems.length;
        memo.actionItems.forEach(item => {
          tasksByType[item.type] = (tasksByType[item.type] || 0) + 1;
        });
      }
      if (memo.confidence) {
        confidenceSum += memo.confidence;
      }
    });

    return {
      totalMemos,
      totalActionItems,
      averageConfidence: totalMemos > 0 ? confidenceSum / totalMemos : 0,
      tasksByType,
    };
  }

  getMemoInsightGroups(memos: VoiceMemo[]): MemoInsightGroup[] {
    const groups = new Map<
      string,
      {
        label: string;
        memos: VoiceMemo[];
        previews: string[];
        actionCount: number;
      }
    >();

    memos.forEach(memo => {
      const sourceText = this.buildMemoTopicSource(memo);
      if (!sourceText && !memo.customTopicId) {
        return;
      }

      const topic = this.getMemoInsightGroup(memo);
      const current = groups.get(topic.id) ?? {
        label: topic.label,
        memos: [],
        previews: [],
        actionCount: 0,
      };

      current.memos.push(memo);
      current.actionCount += memo.actionItems?.length ?? 0;

      const preview = this.extractPreviewSentence(memo.summary || memo.transcript || '');
      if (preview && !current.previews.includes(preview)) {
        current.previews.push(preview);
      }

      groups.set(topic.id, current);
    });

    return Array.from(groups.entries())
      .map(([id, group]) => ({
        id,
        label: group.label,
        memoCount: group.memos.length,
        summaryCount: group.previews.length,
        actionCount: group.actionCount,
        preview:
          group.previews[0] ||
          `${group.label} 관련 메모 ${group.memos.length}개가 정리되었습니다.`,
      }))
      .filter(group => group.memoCount > 0)
      .sort((a, b) => {
        if (b.memoCount !== a.memoCount) {
          return b.memoCount - a.memoCount;
        }
        return b.actionCount - a.actionCount;
      })
      .slice(0, 4);
  }

  getMemoInsightGroupId(memo: VoiceMemo): string {
    return this.getMemoInsightGroup(memo).id;
  }

  getMemoInsightGroupLabel(memo: VoiceMemo): string {
    return this.getMemoInsightGroup(memo).label;
  }

  private buildMemoTopicSource(memo: VoiceMemo): string {
    const actionTasks = memo.actionItems?.map(item => item.task).join(' ') ?? '';
    return [memo.title, memo.summary, memo.transcript, actionTasks]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  private getMemoInsightGroup(memo: VoiceMemo): { id: string; label: string } {
    if (memo.customTopicId && memo.customTopicLabel) {
      return {
        id: memo.customTopicId,
        label: memo.customTopicLabel,
      };
    }

    const sourceText = this.buildMemoTopicSource(memo);
    if (!sourceText) {
      return {
        id: 'general',
        label: this.getTopicLabel('general'),
      };
    }

    const detectedTopic = this.detectTopic(sourceText);
    return {
      id: detectedTopic,
      label: this.getTopicLabel(detectedTopic),
    };
  }

  private getTopicLabel(topic: TopicId): string {
    switch (topic) {
      case 'schedule':
        return '일정과 배포';
      case 'finance':
        return '예산과 비용';
      case 'design':
        return '디자인과 화면';
      case 'build':
        return '구현과 품질';
      case 'customer':
        return '고객과 요청';
      default:
        return '기타 논의';
    }
  }

  private extractPreviewSentence(text: string): string {
    const cleaned = text
      .split('\n')
      .map(line => line.trim())
      .find(line => line && line !== '회의 요약' && !line.startsWith('정리 신뢰도'));

    return cleaned?.replace(/^•\s*/, '') ?? '';
  }
}

export const echoCoreService = new EchoCoreService();
