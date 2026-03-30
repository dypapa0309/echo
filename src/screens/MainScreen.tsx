import { useDeferredValue, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Alert,
  TouchableOpacity,
  Share,
  ScrollView,
  Modal,
  AppState,
  Linking,
  useColorScheme,
  ScrollView as RNScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import appConfig from '../../app.json';
import { BillingProfile, UpgradeRecommendation, RecordingContext, VoiceMemo } from '../types/index';
import { memoMatchesQuery, storageUtils } from '../utils/storage';
import { RecorderComponent } from '../components/RecorderComponent';
import { MemoListComponent } from '../components/MemoListComponent';
import { ActionItemsDisplay } from '../components/ActionItemsDisplay';
import { BILLING_PROVIDER_PLAN, billingUtils } from '../utils/billing';
import { echoCoreService } from '../utils/echoService';
import { FREE_PLAN_FEATURES, PRO_PLAN_FEATURES } from '../utils/pricing';
import { subscriptionUtils } from '../utils/subscription';
import { wakeWordController } from '../utils/wakeWord';

type StatusTone = 'info' | 'success' | 'error';
type BottomTab = 'archive' | 'home' | 'topics';
type MemoView = 'all' | 'tasks';
type AppLanguage = 'ko' | 'en';
type ExpansionIdea = {
  key: 'next-actions' | 'plan' | 'questions' | 'message';
  title: string;
  description: string;
  body: string;
};

const LANGUAGE_STORAGE_KEY = 'echo:language';
const APP_VERSION = appConfig.expo.version ?? '0.1.0';

const readPublicEnv = (key: string): string => {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };

  return processLike.process?.env?.[key] ?? '';
};

const SUPPORT_EMAIL = readPublicEnv('EXPO_PUBLIC_SUPPORT_EMAIL');
const PRIVACY_URL = readPublicEnv('EXPO_PUBLIC_PRIVACY_URL');
const TERMS_URL = readPublicEnv('EXPO_PUBLIC_TERMS_URL');

const buildSttRecoveryGuidance = (source: 'native' | 'mock' | 'fallback', message: string) => {
  if (source === 'native') {
    return '실제 음성 인식으로 정리했습니다.';
  }

  if (message.includes('permission')) {
    return '음성 인식 권한이 없어 기본 경로로 처리했습니다. 설정에서 마이크와 음성 인식을 허용해 주세요.';
  }

  if (message.includes('not available') || message.includes('module unavailable')) {
    return '이 환경에서는 실제 음성 인식이 어려워 기본 경로로 처리했습니다. 개발 빌드에서 다시 확인해 보세요.';
  }

  if (message.includes('timed out')) {
    return '음성 인식 시간이 초과되어 기본 경로로 처리했습니다. 더 짧게 녹음하거나 조용한 환경에서 다시 시도해 보세요.';
  }

  return source === 'fallback'
    ? '실제 음성 인식이 불안정해 기본 경로로 이어서 처리했습니다.'
    : '기본 음성 처리 경로로 정리했습니다.';
};

const formatSttLabel = (source: 'native' | 'mock' | 'fallback') => {
  if (source === 'native') {
    return '기기 음성 인식 사용';
  }

  if (source === 'fallback') {
    return '기본 정리 경로 사용';
  }

  return '기본 정리 경로 사용';
};

const uiText = {
  ko: {
    settings: '설정',
    close: '닫기',
    heyEcho: '헤이 에코',
    heyEchoHintOff: '앱이 열려 있을 때 음성으로 빠르게 기록을 시작합니다',
    heyEchoHintOn: '앱이 열려 있거나 막 돌아왔을 때 가장 잘 작동합니다',
    heyEchoBackgroundLimited: '앱이 백그라운드에 있습니다. 기기 정책상 상시 대기는 제한될 수 있습니다.',
    heyEchoStopped: '헤이 에코 대기가 멈췄습니다.',
    heyEchoListening: '지금은 헤이 에코를 듣는 중입니다.',
    heyEchoRestarting: '녹음이 끝나면 헤이 에코 대기를 다시 시작합니다.',
    heyEchoTurnedOff: '헤이 에코를 껐습니다.',
    heyEchoStartFail: '헤이 에코를 시작하지 못했습니다.',
    speechRecognition: '음성 인식',
    language: '언어',
    languageHint: '화면에 보이는 기본 언어를 고릅니다',
    plan: '플랜',
    freePlan: '무료 플랜',
    proPlan: 'Echo Pro 준비 중',
    upgradeReady: 'Pro로 업그레이드하기',
    upgradeHint: 'Pro에서 열리는 기능과 결제 흐름을 확인합니다',
    billingProvider: '결제 방식',
    billingReadiness: '결제 준비 상태',
    billingConnection: '결제 연결',
    billingCheck: '결제 연결 확인',
    restorePurchases: '구매 복원',
    restorePurchasesHint: '이전에 결제한 Pro 권한을 다시 확인합니다',
    qaCheck: '권한 확인하기',
    qaStatus: '권한 상태',
    contact: '문의하기',
    privacyPolicy: '개인정보 처리방침',
    terms: '이용약관',
    appVersion: '앱 버전',
    linkPending: '출시 전 링크 연결 예정',
    contactPending: '문의 메일 연결 예정',
    open: '열기',
    archiveTags: '태그로 좁히기',
    allTags: '전체 태그',
    freeIncludes: '무료에 포함',
    proIncludes: 'Pro에서 열릴 것',
    topics: '다시 볼 주제',
    recentMemo: '방금 정리한 메모',
    browseByTopic: '주제별로 보기',
    browseHint: '비슷한 메모끼리 묶어서 다시 볼 수 있습니다',
    search: '검색',
    allMemos: '모든 메모',
    topicOverview: '주제 정리',
    followUps: '챙길 메모',
    allGuide: '저장된 내용을 시간순으로 봅니다',
    tasksGuide: '다시 봐야 할 메모만 모았습니다',
    expandTitle: '이 메모로 할 수 있는 일',
    expandHint: '원하는 아이콘을 눌러 바로 정리합니다.',
    expandPrimary: '현재 메모 보기',
    noExpandMemo: '먼저 메모를 하나 만들면 여기서 바로 이어서 정리할 수 있습니다.',
    detailSummary: '핵심 정리',
    detailTranscript: '기록 내용',
    detailActions: '할 일',
    detailExpand: '활용',
    shareSummary: '정리 공유',
    pinToHome: '메인에 고정',
    copyRecord: '기록 복사',
    fullRecord: '기록 내용 전체',
    noRecord: '기록 내용이 없습니다.',
    saveAsMemo: '새 메모',
    startNewRecording: '새 녹음하기',
    startNewRecordingHint: '이 화면에서 바로 새 녹음을 시작합니다',
    shareIdea: '공유',
    copyIdea: '복사',
    ideaSaved: '확장 내용을 새 메모로 저장했습니다.',
    ideaCopied: '확장 아이디어를 복사했습니다.',
    ideaCopyFail: '확장 아이디어 복사에 실패했습니다.',
    ideaShareFail: '확장 아이디어 공유에 실패했습니다.',
    currentMemo: '기준 메모',
    currentMemoView: '현재 메모로 보기',
    expandStepChoose: '원하는 방식 고르기',
    expandStepResult: '바로 나온 결과',
    expandOpenFull: '상세에서 더 보기',
    expandHowTo: '',
    expandActionReady: '이 메모를 바탕으로 바로 쓸 수 있게 정리했습니다.',
    expandSelected: '선택됨',
    expandSelect: '선택',
    on: '켜짐',
    turnOn: '켜기',
    waiting: '대기 중',
    memoUsage: (memoCount: number, savedCount: number) => `메모 ${memoCount}개 · 확장 저장 ${savedCount}회`,
    proFeatureHint: (features: string[]) => `Pro 결제 연결 후 열리는 기능: ${features.join(', ')}`,
    sdkNotReady: 'SDK 연결 전입니다.',
    qaNotChecked: '아직 확인하지 않았습니다.',
    topicViewAll: '모아보기',
    topicViewHighlights: '핵심만',
    topicEmptyHighlights: '이 주제에는 아직 핵심 정리가 모이지 않았습니다.',
    topicEmptyMemos: '이 주제에는 아직 메모가 없습니다.',
    topicSourceNotes: '원본 메모',
    topicSourceNotesHint: '위 요약에 담긴 메모를 그대로 다시 봅니다',
    memoDefaultTitle: '메모',
    latestMemoFallback: '최근 메모',
    transcriptMissing: '기록 내용 없음',
    detailAudio: '오디오',
    detailPlay: '오디오 재생',
    detailStop: '재생 중지',
    detailSummaryEmpty: '아직 정리된 내용이 없습니다.',
    detailSourceMemo: '원본 메모',
    detailEdit: '수정',
    detailCollapse: '접기',
    detailEditPlaceholder: '메모 원본을 수정해 주세요',
    cancel: '취소',
    save: '저장',
    detailCommentTitle: '아이디어 코멘트',
    detailCommentPlaceholder: '나중에 이어갈 생각이나 떠오른 아이디어를 적어 두세요',
    detailCommentAdd: '코멘트 추가',
    detailFollowUps: '챙길 일',
    sendToFollowUps: '챙길 메모로 보내기',
    removeFromFollowUps: '챙길 메모에서 빼기',
    followUpAdded: '챙길 메모로 보냈습니다.',
    followUpRemoved: '챙길 메모에서 뺐습니다.',
    followUpSaveFail: '챙길 메모 상태를 저장하지 못했습니다.',
    purchasesRestored: '구매 복원을 확인했습니다.',
    purchasesNotFound: '복원할 구매 내역이 없습니다.',
    purchasesRestoreFail: '구매 복원을 진행하지 못했습니다.',
    homeEmptyMemos: '아직 메모가 없습니다.',
    homeEmptyTopics: '아직 주제로 묶인 메모가 없습니다.',
    followUpsEmpty: '아직 챙길 메모가 없습니다.',
    quickCaptureOpened: '빠른 기록으로 바로 시작할 수 있게 준비했습니다.',
    analyzingRecording: '정리 중입니다. 잠시만 기다려 주세요.',
  },
  en: {
    settings: 'Settings',
    close: 'Close',
    heyEcho: 'Hey Echo',
    heyEchoHintOff: 'Start a recording with your voice while the app is open',
    heyEchoHintOn: 'Works best while the app is open or right after you return',
    heyEchoBackgroundLimited: 'The app is in the background, so continuous listening may be limited by the device.',
    heyEchoStopped: 'Hey Echo stopped listening.',
    heyEchoListening: 'Listening for “Hey Echo.”',
    heyEchoRestarting: 'Listening will resume after the recording finishes.',
    heyEchoTurnedOff: 'Hey Echo is off.',
    heyEchoStartFail: 'Could not start Hey Echo.',
    speechRecognition: 'Speech',
    language: 'Language',
    languageHint: 'Choose the main language used on screen',
    plan: 'Plan',
    freePlan: 'Free Plan',
    proPlan: 'Echo Pro soon',
    upgradeReady: 'Upgrade to Pro',
    upgradeHint: 'See Pro features and the payment flow',
    billingProvider: 'Billing',
    billingReadiness: 'Billing readiness',
    billingConnection: 'Billing connection',
    billingCheck: 'Check billing',
    restorePurchases: 'Restore Purchases',
    restorePurchasesHint: 'Check and restore a previous Pro purchase',
    qaCheck: 'Check permissions',
    qaStatus: 'Permission status',
    contact: 'Contact',
    privacyPolicy: 'Privacy Policy',
    terms: 'Terms of Service',
    appVersion: 'App Version',
    linkPending: 'Link will be added before launch',
    contactPending: 'Support email will be added before launch',
    open: 'Open',
    archiveTags: 'Filter by tag',
    allTags: 'All tags',
    freeIncludes: 'Included for free',
    proIncludes: 'Planned for Pro',
    topics: 'Revisit Topics',
    recentMemo: 'Latest Memo',
    browseByTopic: 'Browse by Topic',
    browseHint: 'Group related memos and revisit them quickly',
    search: 'Search',
    allMemos: 'All Memos',
    topicOverview: 'Topic Summary',
    followUps: 'Follow Up',
    allGuide: 'See everything in time order',
    tasksGuide: 'Only memos worth revisiting',
    expandTitle: 'What You Can Do',
    expandHint: 'Tap an icon and turn this memo into something useful.',
    expandPrimary: 'Open current memo',
    noExpandMemo: 'Create a memo first and continue it here.',
    detailSummary: 'Summary',
    detailTranscript: 'Notes',
    detailActions: 'To Do',
    detailExpand: 'Use',
    shareSummary: 'Share Summary',
    pinToHome: 'Pin to Home',
    copyRecord: 'Copy Notes',
    fullRecord: 'Full Notes',
    noRecord: 'No notes yet.',
    saveAsMemo: 'Save Memo',
    startNewRecording: 'Start New Recording',
    startNewRecordingHint: 'Start a new recording right from here',
    shareIdea: 'Share',
    copyIdea: 'Copy',
    ideaSaved: 'Saved this expansion as a new memo.',
    ideaCopied: 'Copied the expansion idea.',
    ideaCopyFail: 'Could not copy the expansion idea.',
    ideaShareFail: 'Could not share the expansion idea.',
    currentMemo: 'Source Memo',
    currentMemoView: 'Use as current memo',
    expandStepChoose: 'Choose a format',
    expandStepResult: 'Ready to use',
    expandOpenFull: 'Open full detail',
    expandHowTo: '',
    expandActionReady: 'This result is ready to use from the current memo.',
    expandSelected: 'Selected',
    expandSelect: 'Choose',
    on: 'On',
    turnOn: 'Turn On',
    waiting: 'Waiting',
    memoUsage: (memoCount: number, savedCount: number) => `${memoCount} memos · ${savedCount} saved expansions`,
    proFeatureHint: (features: string[]) => `Features that unlock with Pro billing: ${features.join(', ')}`,
    sdkNotReady: 'SDK not connected yet.',
    qaNotChecked: 'Not checked yet.',
    topicViewAll: 'All Notes',
    topicViewHighlights: 'Highlights',
    topicEmptyHighlights: 'No highlights yet for this topic.',
    topicEmptyMemos: 'No memos yet for this topic.',
    topicSourceNotes: 'Source Memos',
    topicSourceNotesHint: 'Read the original memos behind this summary',
    memoDefaultTitle: 'Memo',
    latestMemoFallback: 'Latest Memo',
    transcriptMissing: 'No notes yet',
    detailAudio: 'Audio',
    detailPlay: 'Play Audio',
    detailStop: 'Stop Playback',
    detailSummaryEmpty: 'No summary yet.',
    detailSourceMemo: 'Source Note',
    detailEdit: 'Edit',
    detailCollapse: 'Close',
    detailEditPlaceholder: 'Edit the original note',
    cancel: 'Cancel',
    save: 'Save',
    detailCommentTitle: 'Idea Notes',
    detailCommentPlaceholder: 'Add follow-up thoughts or ideas you want to revisit later',
    detailCommentAdd: 'Add Note',
    detailFollowUps: 'Follow Up',
    sendToFollowUps: 'Send to Follow Up',
    removeFromFollowUps: 'Remove from Follow Up',
    followUpAdded: 'Sent to Follow Up.',
    followUpRemoved: 'Removed from Follow Up.',
    followUpSaveFail: 'Could not save follow-up status.',
    purchasesRestored: 'Purchases restored.',
    purchasesNotFound: 'No purchases were available to restore.',
    purchasesRestoreFail: 'Could not restore purchases.',
    homeEmptyMemos: 'No memos yet.',
    homeEmptyTopics: 'No grouped topics yet.',
    followUpsEmpty: 'No follow-up memos yet.',
    quickCaptureOpened: 'Quick capture is ready to start right away.',
    analyzingRecording: 'Organizing your note now. Give it a moment.',
  },
} as const;

const parseSummarySections = (summary?: string) => {
  if (!summary) {
    return [];
  }

  const lines = summary
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const sections: Array<{ title: string; items: string[] }> = [];
  let currentSection: { title: string; items: string[] } | null = null;

  lines.forEach(line => {
    if (!line.startsWith('•') && !/^\d+\./.test(line) && !line.startsWith('정리 신뢰도')) {
      if (line === '회의 요약') {
        return;
      }

      currentSection = { title: line, items: [] };
      sections.push(currentSection);
      return;
    }

    if (!currentSection) {
      currentSection = { title: '요약', items: [] };
      sections.push(currentSection);
    }

    currentSection.items.push(line.replace(/^•\s*/, ''));
  });

  return sections.filter(section => section.items.length > 0);
};

const splitTranscriptParagraphs = (transcript?: string) => {
  if (!transcript) {
    return [];
  }

  return transcript
    .split(/[\n]+/)
    .flatMap(block =>
      block
        .split(/(?<=[.!?。！？])\s+/)
        .map(sentence => sentence.trim())
        .filter(Boolean)
    );
};

const splitExpansionBody = (body: string) =>
  body
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

const formatCalendarEventLabel = (event?: RecordingContext['calendarEvent']) => {
  if (!event) {
    return '';
  }

  const sameDay =
    new Date(event.startDate).toDateString() === new Date(event.endDate).toDateString();

  const startLabel = new Date(event.startDate).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const endLabel = new Date(event.endDate).toLocaleString('ko-KR', sameDay
    ? {
        hour: 'numeric',
        minute: '2-digit',
      }
    : {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

  return `${startLabel} - ${endLabel}`;
};

const buildHomeTopics = (
  groups: ReturnType<typeof echoCoreService.getMemoInsightGroups>,
  memos: VoiceMemo[]
) => {
  const meaningfulGroups = groups.filter(group => group.memoCount > 0).slice(0, 3);
  if (meaningfulGroups.length > 0) {
    return meaningfulGroups.map(group => ({
      id: group.id,
      title: group.label,
      meta: `${group.memoCount}개 메모`,
      groupId: group.id,
    }));
  }

  return memos.slice(0, 3).map(memo => ({
    id: memo.id,
    title: memo.title || '최근 메모',
    meta: new Date(memo.timestamp).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    }),
    memoId: memo.id,
  }));
};

const buildGroupAwareExpansionIdeas = (memos: VoiceMemo[]): ExpansionIdea[] => {
  if (memos.length === 0) {
    return [];
  }

  const sortedMemos = [...memos].sort((a, b) => b.timestamp - a.timestamp);
  const latestMemo = sortedMemos[0];
  const actionItems = sortedMemos.flatMap(memo => memo.actionItems ?? []);
  const topTasks = Array.from(new Set(actionItems.map(item => item.task.trim()).filter(Boolean))).slice(0, 3);
  const summaryPoints = Array.from(
    new Set(
      sortedMemos
        .flatMap(memo => parseSummarySections(memo.summary).flatMap(section => section.items))
        .concat(
          sortedMemos.flatMap(memo => (memo.comments ?? []).map(comment => comment.text.trim()))
        )
        .map(item => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 4);
  const lead =
    latestMemo.summary?.trim() ||
    latestMemo.comments?.[latestMemo.comments.length - 1]?.text?.trim() ||
    latestMemo.transcript?.trim() ||
    latestMemo.title ||
    '이 메모';
  const scopeLabel = memos.length > 1 ? `이 주제 메모 ${memos.length}개` : latestMemo.title || '이 메모';

  return [
    {
      key: 'next-actions',
      title: '지금 할 일',
      description: '바로 움직일 것만 먼저 골랐습니다.',
      body:
        topTasks.length > 0
          ? topTasks.map((task, index) => `${index + 1}. ${task}`).join('\n')
          : [`1. ${scopeLabel}에서 바로 처리할 한 가지를 정합니다.`, '2. 막힌 부분 하나만 먼저 풀어냅니다.', '3. 끝난 뒤 한 줄로 다시 남깁니다.'].join('\n'),
    },
    {
      key: 'plan',
      title: '진행 흐름',
      description: '어떤 순서로 가면 좋을지 정리했습니다.',
      body:
        summaryPoints.length > 0
          ? summaryPoints.slice(0, 3).map((point, index) => `${index + 1}단계. ${point}`).join('\n')
          : [`1단계. ${scopeLabel}의 핵심을 한 줄로 정리합니다.`, '2단계. 오늘 안에 할 수 있는 작은 작업으로 나눕니다.', '3단계. 다시 확인할 기준을 남깁니다.'].join('\n'),
    },
    {
      key: 'questions',
      title: '더 볼 질문',
      description: '다음 판단에 필요한 질문만 남겼습니다.',
      body: [
        `${scopeLabel}에서 가장 먼저 확인해야 할 막힌 부분은 무엇일까?`,
        '지금 빠져 있는 정보 하나만 더 채우면 판단이 쉬워질까?',
        '이 주제를 더 밀려면 다음으로 누구나 무엇이 필요할까?',
      ].join('\n'),
    },
    {
      key: 'message',
      title: '공유용 요약',
      description: '핵심만 바로 전할 수 있게 다듬었습니다.',
      body:
        summaryPoints.length > 0
          ? `${scopeLabel}의 핵심은 ${summaryPoints.slice(0, 2).join(', ')}입니다. 우선순위가 높은 일부터 정리해서 이어가면 됩니다.`
          : `${scopeLabel}의 핵심은 "${lead}"입니다. 우선 가장 중요한 한 가지부터 움직이면 됩니다.`,
    },
  ];
};

const buildInsightDetailOverview = (memos: VoiceMemo[]) => {
  if (memos.length === 0) {
    return {
      summary: '아직 이 주제에 모인 메모가 없습니다.',
      topTasks: [] as string[],
      latestLabel: '',
    };
  }

  const sorted = [...memos].sort((a, b) => b.timestamp - a.timestamp);
  const latest = sorted[0];
  const summaryPoints = Array.from(
    new Set(
      sorted
        .flatMap(memo => parseSummarySections(memo.summary).flatMap(section => section.items))
        .concat(sorted.flatMap(memo => (memo.comments ?? []).map(comment => comment.text.trim())))
        .filter(Boolean)
    )
  ).slice(0, 3);
  const topTasks = Array.from(
    new Set(
      sorted.flatMap(memo => (memo.actionItems ?? []).map(item => item.task.trim())).filter(Boolean)
    )
  ).slice(0, 3);

  return {
    summary:
      summaryPoints.length > 0
        ? summaryPoints.join(' · ')
        : latest.summary?.trim() || latest.transcript?.trim() || latest.title || '이 주제를 다시 정리해 보세요.',
    topTasks,
    latestLabel: new Date(latest.timestamp).toLocaleString('ko-KR'),
  };
};

const BottomTabIcon = ({
  tab,
  active,
}: {
  tab: BottomTab;
  active: boolean;
}) => {
  const activeColor = '#f2efe8';
  const idleColor = '#6f7674';
  const color = active ? activeColor : idleColor;

  if (tab === 'home') {
    return (
      <View style={[styles.iconCaptureRing, { borderColor: color }]}>
        <View style={[styles.iconCaptureDot, { backgroundColor: color }]} />
      </View>
    );
  }

  if (tab === 'topics') {
    return (
      <View style={styles.iconMemosWrap}>
        {[0, 1, 2].map(index => (
          <View key={`topic-line-${index}`} style={styles.iconMemosRow}>
            <View style={[styles.iconMemosDot, { backgroundColor: color }]} />
            <View style={[styles.iconMemosLine, { backgroundColor: color }]} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.iconArchiveBox, { borderColor: color }]}>
      <View style={[styles.iconArchiveLid, { backgroundColor: color }]} />
      <View style={[styles.iconArchiveSlot, { backgroundColor: color }]} />
    </View>
  );
};

const SettingsCogIcon = ({ color }: { color: string }) => (
  <View style={styles.iconCogWrap}>
    {[
      styles.iconCogToothTop,
      styles.iconCogToothRight,
      styles.iconCogToothBottom,
      styles.iconCogToothLeft,
    ].map((toothStyle, index) => (
      <View
        key={`cog-tooth-${index}`}
        style={[styles.iconCogTooth, toothStyle, { backgroundColor: color }]}
      />
    ))}
    <View style={[styles.iconCogRing, { borderColor: color }]}>
      <View style={[styles.iconCogCore, { backgroundColor: color }]} />
    </View>
  </View>
);

const FloatingRecorderIcon = () => (
  <View style={styles.floatingRecorderIconRing}>
    <View style={styles.floatingRecorderIconDot} />
  </View>
);

export const MainScreen = ({ quickCaptureToken = 0 }: { quickCaptureToken?: number }) => {
  const mainScrollRef = useRef<RNScrollView | null>(null);
  const [memos, setMemos] = useState<VoiceMemo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [filteredMemos, setFilteredMemos] = useState<VoiceMemo[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusTone, setStatusTone] = useState<StatusTone>('info');
  const [lastProcessedMemo, setLastProcessedMemo] = useState<VoiceMemo | null>(null);
  const [memoView, setMemoView] = useState<MemoView>('all');
  const [lastSttInfo, setLastSttInfo] = useState('');
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [wakeWordStatus, setWakeWordStatus] = useState<string>(uiText.ko.heyEchoHintOn);
  const [recorderAutoStartSignal, setRecorderAutoStartSignal] = useState(0);
  const [selectedInsightGroupId, setSelectedInsightGroupId] = useState<string | null>(null);
  const [showInsightDetail, setShowInsightDetail] = useState(false);
  const [showInsightExpand, setShowInsightExpand] = useState(false);
  const [showExpansionRecorder, setShowExpansionRecorder] = useState(false);
  const [showQuickRecorder, setShowQuickRecorder] = useState(false);
  const [pendingInsightExpand, setPendingInsightExpand] = useState(false);
  const [activeTab, setActiveTab] = useState<BottomTab>('home');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<VoiceMemo | null>(null);
  const [isTranscriptEditorOpen, setIsTranscriptEditorOpen] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [detailSound, setDetailSound] = useState<Audio.Sound | null>(null);
  const [isDetailPlaying, setIsDetailPlaying] = useState(false);
  const [selectedExpansionIdeaKey, setSelectedExpansionIdeaKey] = useState<ExpansionIdea['key']>('next-actions');
  const [language, setLanguage] = useState<AppLanguage>('ko');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const [billingConnectionDetail, setBillingConnectionDetail] = useState('');
  const [deviceQaStatus, setDeviceQaStatus] = useState('');
  const [billingProfile, setBillingProfile] = useState<BillingProfile>({
    tier: 'free',
    expansionSaveCount: 0,
  });
  const [upgradeRecommendation, setUpgradeRecommendation] = useState<UpgradeRecommendation>({
    shouldPrompt: false,
    headline: '무료 플랜',
    detail: '핵심 기록과 정리는 계속 무료로 사용할 수 있습니다.',
  });
  const wakeWordRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deferredSearchQuery = useDeferredValue(debouncedSearchQuery);
  const wakeWordDiagnostics = wakeWordController.getDiagnostics();
  const text = uiText[language];
  const isDarkMode = useColorScheme() === 'dark';
  const billingReadiness = billingUtils.getRevenueCatReadiness();

  // 초기화
  useEffect(() => {
    loadMemos();
    requestAudioPermissions();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 180);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (savedLanguage === 'ko' || savedLanguage === 'en') {
          setLanguage(savedLanguage);
        }
      } catch (error) {
        console.error('Failed to load language:', error);
      }
    };

    loadLanguage();
  }, []);

  useEffect(() => {
    const loadBillingProfile = async () => {
      try {
        const profile = await subscriptionUtils.getProfile();
        setBillingProfile(profile);
      } catch (error) {
        console.error('Failed to load billing profile:', error);
      }
    };

    loadBillingProfile();
  }, []);

  useEffect(() => {
    setUpgradeRecommendation(
      subscriptionUtils.getUpgradeRecommendation(billingProfile, memos.length)
    );
  }, [billingProfile, memos.length]);

  // 메모 필터링
  useEffect(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();
    let baseMemos =
      memoView === 'tasks'
        ? memos.filter(memo => memo.isFollowUp)
        : memos;

    if (selectedTagFilter) {
      baseMemos = baseMemos.filter(memo => (memo.tags ?? []).includes(selectedTagFilter));
    }

    if (normalizedQuery) {
      const filtered = baseMemos.filter(memo => memoMatchesQuery(memo, normalizedQuery));
      setFilteredMemos(filtered);
    } else {
      setFilteredMemos(baseMemos);
    }
  }, [deferredSearchQuery, memos, memoView, selectedTagFilter]);

  useEffect(() => {
    if (!selectedMemo) {
      return;
    }

    const refreshed = memos.find(memo => memo.id === selectedMemo.id);
    if (refreshed) {
      setSelectedMemo(refreshed);
      setTranscriptDraft(refreshed.transcript ?? '');
    }
  }, [memos, selectedMemo]);

  useEffect(() => {
    return () => {
      if (wakeWordRestartTimerRef.current) {
        clearTimeout(wakeWordRestartTimerRef.current);
      }
      if (detailSound) {
        detailSound.unloadAsync().catch(error => {
          console.error('Detail sound cleanup error:', error);
        });
      }
    };
  }, [detailSound]);

  useEffect(() => {
    return () => {
      wakeWordController.stop().catch(error => {
        console.error('[WakeWord] cleanup error:', error);
      });
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (!wakeWordEnabled) {
        return;
      }

      if (nextState === 'active') {
        startWakeWordMode().catch(error => {
          console.error('[WakeWord] resume error:', error);
        });
        return;
      }

      setWakeWordStatus(text.heyEchoBackgroundLimited);
      wakeWordController.stop().catch(error => {
        console.error('[WakeWord] pause error:', error);
      });
    });

    return () => {
      subscription.remove();
    };
  }, [wakeWordEnabled]);

  useEffect(() => {
    if (!pendingInsightExpand || showInsightDetail) {
      return;
    }

    const timer = setTimeout(() => {
      setShowInsightExpand(true);
      setPendingInsightExpand(false);
    }, 220);

    return () => clearTimeout(timer);
  }, [pendingInsightExpand, showInsightDetail]);

  useEffect(() => {
    if (showInsightExpand) {
      setSelectedExpansionIdeaKey('next-actions');
    }
  }, [showInsightExpand]);

  useEffect(() => {
    if (!quickCaptureToken) {
      return;
    }

    setActiveTab('home');
    setRecorderAutoStartSignal(prev => prev + 1);
    setStatusTone('info');
    setStatusMessage(text.quickCaptureOpened);
  }, [quickCaptureToken]);

  // 메모 로드
  const loadMemos = async () => {
    try {
      const savedMemos = await storageUtils.getAllMemos();
      setMemos(savedMemos.sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      setStatusTone('error');
      setStatusMessage('메모 목록을 불러오지 못했습니다.');
      Alert.alert('오류', '메모를 불러올 수 없습니다.');
    }
  };

  // 오디오 권한 요청
  const requestAudioPermissions = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setStatusTone('error');
        setStatusMessage('마이크 권한이 필요합니다. 권한을 허용한 뒤 다시 시도해 주세요.');
        Alert.alert('권한 필요', '마이크 접근 권한이 필요합니다.');
      }
    } catch (error) {
      setStatusTone('error');
      setStatusMessage('오디오 권한 요청에 실패했습니다.');
      console.error('Permission error:', error);
    }
  };

  // 녹음 완료
  const finalizeRecording = async (
    uri: string,
    duration: number,
    options?: { goHomeAfterSave?: boolean }
  ) => {
    try {
      setIsExtracting(true);
      setStatusTone('info');
      setStatusMessage(text.analyzingRecording);

      const result = await echoCoreService.processAudioRecording(uri, duration);
      const nextBillingProfile = await subscriptionUtils.markMemoCreated(result.memo.timestamp);
      setBillingProfile(nextBillingProfile);

      setLastProcessedMemo(result.memo);
      setLastSttInfo(formatSttLabel(result.sttSource));
      await loadMemos();
      if (options?.goHomeAfterSave ?? true) {
        setActiveTab('home');
      }
      setStatusTone(result.sttSource === 'native' ? 'success' : 'info');
      const baseMessage = `메모가 저장되었습니다. 할 일 ${result.actionItems.length}개를 찾았습니다. ${buildSttRecoveryGuidance(
        result.sttSource,
        result.sttMessage
      )}`;
      const shouldPromptUpgrade = subscriptionUtils.getUpgradeRecommendation(
        nextBillingProfile,
        memos.length + 1
      ).shouldPrompt;
      setStatusMessage(
        shouldPromptUpgrade
          ? `${baseMessage} 이제 Pro 전환을 고민해볼 시점입니다.`
          : baseMessage
      );
    } catch (error) {
      setStatusTone('error');
      setStatusMessage('메모 저장 또는 분석 중 오류가 발생했습니다.');
      Alert.alert('오류', '메모 저장 중 오류가 발생했습니다.');
      console.error('handleRecordingComplete error:', error);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleRecordingComplete = async (uri: string, duration: number) => {
    await finalizeRecording(uri, duration, { goHomeAfterSave: true });
  };

  const handleQuickRecordingComplete = async (uri: string, duration: number) => {
    setShowQuickRecorder(false);
    await finalizeRecording(uri, duration, { goHomeAfterSave: false });
  };

  const handleRecorderError = (message: string) => {
    setStatusTone('error');
    setStatusMessage(message);
  };

  const handleQuickRecorderError = (message: string) => {
    setShowQuickRecorder(false);
    handleRecorderError(message);
  };

  const openInsightDetail = (groupId: string) => {
    setSelectedInsightGroupId(groupId);
    setShowInsightExpand(false);
    setShowInsightDetail(true);
    setStatusTone('info');
    setStatusMessage('선택한 주제를 열었습니다.');
  };

  const handleOpenInsightGroupMemo = (groupId: string) => {
    openInsightDetail(groupId);
  };

  const handleSelectInsightGroup = (groupId: string) => {
    openInsightDetail(groupId);
  };

  const closeInsightDetail = () => {
    setShowInsightDetail(false);
    setShowInsightExpand(false);
    setShowExpansionRecorder(false);
    setPendingInsightExpand(false);
    setSelectedInsightGroupId(null);
  };

  const openInsightExpandFromDetail = () => {
    setPendingInsightExpand(true);
    setShowInsightDetail(false);
  };

  const startWakeWordMode = async () => {
    if (!wakeWordDiagnostics.available) {
      throw new Error(wakeWordDiagnostics.message);
    }

    await wakeWordController.start({
      onDetected: () => {
        setRecorderAutoStartSignal(prev => prev + 1);
      },
      onStatusChange: message => {
        setWakeWordStatus(message);
      },
      onError: message => {
        setWakeWordEnabled(false);
        setWakeWordStatus(text.heyEchoStopped);
        setStatusTone('error');
        setStatusMessage(message);
      },
    });
  };

  const handleRecordingStateChange = async (recording: boolean) => {
    if (recording) {
      if (wakeWordRestartTimerRef.current) {
        clearTimeout(wakeWordRestartTimerRef.current);
        wakeWordRestartTimerRef.current = null;
      }

      if (wakeWordEnabled) {
        await wakeWordController.stop();
        setWakeWordStatus(text.analyzingRecording);
      }
      return;
    }

    if (wakeWordEnabled && wakeWordDiagnostics.available) {
      setWakeWordStatus(text.heyEchoRestarting);
      wakeWordRestartTimerRef.current = setTimeout(async () => {
        try {
          await startWakeWordMode();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : text.heyEchoStartFail;
          setWakeWordEnabled(false);
          setWakeWordStatus(message);
        } finally {
          wakeWordRestartTimerRef.current = null;
        }
      }, 1500);
    }
  };

  const handleToggleWakeWord = async () => {
    if (wakeWordRestartTimerRef.current) {
      clearTimeout(wakeWordRestartTimerRef.current);
      wakeWordRestartTimerRef.current = null;
    }

    if (wakeWordEnabled) {
      await wakeWordController.stop();
      setWakeWordEnabled(false);
      setWakeWordStatus(text.heyEchoTurnedOff);
      return;
    }

    if (!wakeWordDiagnostics.available) {
      setStatusTone('error');
      setStatusMessage(wakeWordDiagnostics.message);
      return;
    }

    try {
      await startWakeWordMode();
      setWakeWordEnabled(true);
      setWakeWordStatus(text.heyEchoHintOn);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : text.heyEchoStartFail;
      setWakeWordStatus(message);
      setStatusTone('error');
      setStatusMessage(message);
    }
  };

  const openMemoDetail = (memo: VoiceMemo) => {
    setSelectedMemo(memo);
    setIsTranscriptEditorOpen(false);
    setTranscriptDraft(memo.transcript ?? '');
    setCommentDraft('');
  };

  const handleRenameMemo = async (memo: VoiceMemo, nextTitle: string) => {
    try {
      await storageUtils.updateMemo(memo.id, { title: nextTitle });
      await loadMemos();

      if (lastProcessedMemo?.id === memo.id) {
        setLastProcessedMemo({ ...lastProcessedMemo, title: nextTitle });
      }

      setStatusTone('success');
      setStatusMessage('메모 이름을 바꿨습니다.');
    } catch (error) {
      setStatusTone('error');
      setStatusMessage('메모 이름을 바꾸지 못했습니다.');
    }
  };

  const handleDeleteMemo = (memo: VoiceMemo) => {
    Alert.alert(
      language === 'ko' ? '메모 삭제' : 'Delete Memo',
      language === 'ko'
        ? '이 메모를 삭제할까요? 삭제한 뒤에는 되돌릴 수 없습니다.'
        : 'Do you want to delete this memo? This cannot be undone.',
      [
        { text: text.cancel, style: 'cancel' },
        {
          text: language === 'ko' ? '삭제' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await storageUtils.deleteMemo(memo.id);
              await loadMemos();

              if (selectedMemo?.id === memo.id) {
                setSelectedMemo(null);
              }

              if (lastProcessedMemo?.id === memo.id) {
                setLastProcessedMemo(null);
              }

              setStatusTone('success');
              setStatusMessage(language === 'ko' ? '메모를 삭제했습니다.' : 'Memo deleted.');
            } catch (error) {
              console.error('Delete memo error:', error);
              setStatusTone('error');
              setStatusMessage(language === 'ko' ? '메모를 삭제하지 못했습니다.' : 'Could not delete the memo.');
            }
          },
        },
      ]
    );
  };

  const closeMemoDetail = async () => {
    if (detailSound) {
      await detailSound.unloadAsync();
      setDetailSound(null);
    }
    setIsDetailPlaying(false);
    setSelectedMemo(null);
  };

  const handleSaveTranscript = async () => {
    if (!selectedMemo) {
      return;
    }

    const nextTranscript = transcriptDraft.trim();
    if (!nextTranscript) {
      setStatusTone('error');
      setStatusMessage('원본 메모는 비워둘 수 없습니다.');
      return;
    }

    try {
      await storageUtils.updateMemo(selectedMemo.id, { transcript: nextTranscript });
      await loadMemos();
      setStatusTone('success');
      setStatusMessage('원본 메모를 수정했습니다.');
      setIsTranscriptEditorOpen(false);
    } catch (error) {
      setStatusTone('error');
      setStatusMessage('원본 메모를 저장하지 못했습니다.');
    }
  };

  const handleAddComment = async () => {
    if (!selectedMemo) {
      return;
    }

    const text = commentDraft.trim();
    if (!text) {
      setStatusTone('error');
      setStatusMessage('코멘트를 먼저 적어 주세요.');
      return;
    }

    const nextComments = [
      ...(selectedMemo.comments ?? []),
      {
        id: `comment-${Date.now()}`,
        text,
        createdAt: Date.now(),
      },
    ];

    try {
      await storageUtils.updateMemo(selectedMemo.id, { comments: nextComments });
      await loadMemos();
      setCommentDraft('');
      setStatusTone('success');
      setStatusMessage('아이디어 코멘트를 남겼습니다.');
    } catch (error) {
      setStatusTone('error');
      setStatusMessage('코멘트를 저장하지 못했습니다.');
    }
  };

  const handleToggleFollowUp = async () => {
    if (!selectedMemo) {
      return;
    }

    const nextValue = !selectedMemo.isFollowUp;

    try {
      await storageUtils.updateMemo(selectedMemo.id, { isFollowUp: nextValue });
      await loadMemos();
      setStatusTone('success');
      setStatusMessage(nextValue ? text.followUpAdded : text.followUpRemoved);
    } catch (error) {
      setStatusTone('error');
      setStatusMessage(text.followUpSaveFail);
    }
  };

  const handleToggleDetailPlayback = async () => {
    if (!selectedMemo) {
      return;
    }

    try {
      if (detailSound && isDetailPlaying) {
        await detailSound.stopAsync();
        await detailSound.setPositionAsync(0);
        setIsDetailPlaying(false);
        return;
      }

      if (detailSound) {
        await detailSound.replayAsync();
        setIsDetailPlaying(true);
        return;
      }

      const { sound } = await Audio.Sound.createAsync({ uri: selectedMemo.audioUri });
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) {
          setIsDetailPlaying(false);
        }
      });
      setDetailSound(sound);
      setIsDetailPlaying(true);
      await sound.playAsync();
    } catch (error) {
      Alert.alert('오류', '오디오를 재생할 수 없습니다.');
      console.error('Detail playback error:', error);
    }
  };

  const handleCopyExpansionIdea = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setStatusTone('success');
      setStatusMessage(uiText[language].ideaCopied);
    } catch (error) {
      setStatusTone('error');
      setStatusMessage(uiText[language].ideaCopyFail);
    }
  };

  const handleShareExpansionIdea = async (title: string, body: string) => {
    try {
      await Share.share({
        title,
        message: body,
      });
    } catch (error) {
      setStatusTone('error');
      setStatusMessage(uiText[language].ideaShareFail);
    }
  };

  const handleOpenExpansionRecorder = () => {
    setShowExpansionRecorder(true);
  };

  const handleExpansionRecordingComplete = async (uri: string, duration: number) => {
    setShowExpansionRecorder(false);
    setShowInsightExpand(false);
    await handleRecordingComplete(uri, duration);
  };

  const handleExpansionRecordingError = (message: string) => {
    setShowExpansionRecorder(false);
    handleRecorderError(message);
  };

  const handleChangeLanguage = async (nextLanguage: AppLanguage) => {
    try {
      setLanguage(nextLanguage);
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch (error) {
      console.error('Failed to save language:', error);
    }
  };

  const handleCheckBillingConnection = async () => {
    const status = await billingUtils.initializeRevenueCat();
    setBillingConnectionDetail(status.detail);
    setStatusTone(status.initialized ? 'success' : 'info');
    setStatusMessage(status.detail);
  };

  const handleRunDeviceQaCheck = async () => {
    try {
      const audioPermission = await Audio.getPermissionsAsync();
      const calendarModule = await import('expo-calendar');
      const calendarPermission = await calendarModule.getCalendarPermissionsAsync();

      const lines = [
        `마이크 ${audioPermission.granted ? '허용' : '미허용'}`,
        `캘린더 ${calendarPermission.granted ? '허용' : '미허용'}`,
        `음성 경로 ${lastSttInfo || '아직 검사 전'}`,
      ];

      const nextStatus = lines.join(' · ');
      setDeviceQaStatus(nextStatus);
      setStatusTone('info');
      setStatusMessage(nextStatus);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '기기 검증 상태를 확인하지 못했습니다.';
      setDeviceQaStatus(message);
      setStatusTone('error');
      setStatusMessage(message);
    }
  };

  const handleRestorePurchases = async () => {
    const result = await billingUtils.restoreRevenueCatPurchases();

    if (result.restored) {
      const nextProfile = await subscriptionUtils.setTier('pro');
      setBillingProfile(nextProfile);
      setStatusTone('success');
      setStatusMessage(`${text.purchasesRestored} ${result.detail}`);
      return;
    }

    setStatusTone(result.detail.includes('실패') || result.detail.includes('failed') ? 'error' : 'info');
    setStatusMessage(
      result.detail.includes('없') || result.detail.includes('No purchases')
        ? text.purchasesNotFound
        : `${text.purchasesRestoreFail} ${result.detail}`
    );
  };

  const openExternalSettingLink = async (url: string, fallbackMessage: string) => {
    if (!url.trim()) {
      setStatusTone('info');
      setStatusMessage(fallbackMessage);
      return;
    }

    try {
      await Linking.openURL(url);
    } catch (error) {
      setStatusTone('error');
      setStatusMessage(fallbackMessage);
    }
  };

  const handleOpenSupport = async () => {
    const target = SUPPORT_EMAIL ? `mailto:${SUPPORT_EMAIL}` : '';
    await openExternalSettingLink(target, text.contactPending);
  };

  const handleOpenPrivacy = async () => {
    await openExternalSettingLink(PRIVACY_URL, text.linkPending);
  };

  const handleOpenTerms = async () => {
    await openExternalSettingLink(TERMS_URL, text.linkPending);
  };

  const latestTranscriptPreview =
    lastProcessedMemo?.transcript?.trim() || '아직 최근 기록이 없습니다.';
  const latestSummarySections = parseSummarySections(lastProcessedMemo?.summary);
  const memoInsightGroups = echoCoreService.getMemoInsightGroups(memos);
  const insightDetailGroup = memoInsightGroups.find(group => group.id === selectedInsightGroupId) ?? null;
  const insightDetailMemos = insightDetailGroup
    ? memos
        .filter(memo => echoCoreService.getMemoInsightGroupId(memo) === insightDetailGroup.id)
        .sort((a, b) => b.timestamp - a.timestamp)
    : [];
  const detailActionItems = selectedMemo?.actionItems ?? [];
  const detailSummarySections = parseSummarySections(selectedMemo?.summary);
  const detailTranscriptParagraphs = splitTranscriptParagraphs(selectedMemo?.transcript);
  const insightDetailOverview = buildInsightDetailOverview(insightDetailMemos);
  const insightExpansionIdeas = buildGroupAwareExpansionIdeas(insightDetailMemos);
  const homeTopics = buildHomeTopics(memoInsightGroups, memos);
  const showHomeTab = activeTab === 'home';
  const showArchiveTab = activeTab === 'archive';
  const showTopicsTab = activeTab === 'topics';
  const shouldShowBaseFloatingRecorder = !showHomeTab && !showQuickRecorder;
  const shouldShowModalFloatingRecorder = !showQuickRecorder && !showExpansionRecorder;
  const bottomTabs: Array<{ key: BottomTab; label: string }> = [
    { key: 'archive', label: language === 'ko' ? '보관함' : 'Archive' },
    { key: 'home', label: language === 'ko' ? '홈' : 'Home' },
    { key: 'topics', label: language === 'ko' ? '주제' : 'Topics' },
  ];
  const visibleTagOptions = Array.from(
    new Set(memos.flatMap(memo => memo.tags ?? []))
  )
    .sort((left, right) => {
      const leftCount = memos.filter(memo => (memo.tags ?? []).includes(left)).length;
      const rightCount = memos.filter(memo => (memo.tags ?? []).includes(right)).length;
      return rightCount - leftCount || left.localeCompare(right);
    })
    .slice(0, 8);

  const statusContainerStyle = [
    styles.statusContainer,
    statusTone === 'success'
      ? styles.statusSuccess
      : statusTone === 'error'
      ? styles.statusError
      : styles.statusInfo,
  ];
  const shouldShowHomeStatus = !!statusMessage && (statusTone === 'error' || isExtracting);

  return (
    <View style={[styles.screen, isDarkMode && styles.screenDark]}>
      <ScrollView
        ref={mainScrollRef}
        style={[styles.container, isDarkMode && styles.containerDark]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroBrand}>
            <View style={styles.heroIconWrap}>
              <Text style={styles.heroIcon}>E</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.heroSettingsButton, isDarkMode && styles.surfaceButtonDark]}
            onPress={() => setShowSettings(true)}
            accessibilityRole="button"
            accessibilityLabel={text.settings}
          >
            <SettingsCogIcon color={isDarkMode ? '#aeb6c2' : '#44474d'} />
          </TouchableOpacity>
        </View>
      </View>

      {showHomeTab && (
        <>
      <RecorderComponent
        onRecordingComplete={handleRecordingComplete}
        onRecordingError={handleRecorderError}
        onRecordingStateChange={handleRecordingStateChange}
        disabled={isExtracting}
        autoStartSignal={recorderAutoStartSignal}
      />

      {shouldShowHomeStatus && (
        <View style={statusContainerStyle}>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      )}

      {homeTopics.length > 0 && (
        <View style={styles.homeTopicSection}>
          <Text style={styles.homeSectionTitle}>{text.topics}</Text>
          <View style={styles.homeTopicRow}>
            {homeTopics.map(topic => (
              <TouchableOpacity
                key={`home-topic-${topic.id}`}
                style={[styles.homeTopicCard, isDarkMode && styles.surfaceCardDark]}
                activeOpacity={0.9}
                onPress={() => {
                  if ('groupId' in topic && topic.groupId) {
                    openInsightDetail(topic.groupId);
                    return;
                  }

                  if ('memoId' in topic && topic.memoId) {
                    const targetMemo = memos.find(memo => memo.id === topic.memoId);
                    if (targetMemo) {
                      openMemoDetail(targetMemo);
                    }
                  }
                }}
              >
                <Text style={[styles.homeTopicTitle, isDarkMode && styles.primaryTextDark]}>{topic.title}</Text>
                <Text style={[styles.homeTopicMeta, isDarkMode && styles.secondaryTextDark]}>{topic.meta}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {lastProcessedMemo && (
        <TouchableOpacity
          style={[styles.recentMemoCard, isDarkMode && styles.surfaceCardDark]}
          activeOpacity={0.92}
          onPress={() => openMemoDetail(lastProcessedMemo)}
        >
          <Text style={[styles.homeSectionTitle, isDarkMode && styles.primaryTextDark]}>{text.recentMemo}</Text>
          <Text style={[styles.recentMemoTitle, isDarkMode && styles.primaryTextDark]}>
            {lastProcessedMemo.title || text.latestMemoFallback}
          </Text>
          <Text style={[styles.recentMemoMeta, isDarkMode && styles.secondaryTextDark]}>
            {new Date(lastProcessedMemo.timestamp).toLocaleString(language === 'en' ? 'en-US' : 'ko-KR')}
          </Text>
          <Text style={[styles.recentMemoBody, isDarkMode && styles.secondaryTextDark]} numberOfLines={4}>
            {latestSummarySections[0]?.items[0] || lastProcessedMemo.summary || latestTranscriptPreview}
          </Text>
        </TouchableOpacity>
      )}
        </>
      )}

      {showArchiveTab && (
        <>
      <TextInput
        style={[styles.searchInput, isDarkMode && styles.inputDark]}
        placeholder={text.search}
        placeholderTextColor={isDarkMode ? '#7f8792' : '#999'}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <Text style={[styles.memoGuideText, isDarkMode && styles.secondaryTextDark]}>
        {memoView === 'all'
          ? text.allGuide
          : text.tasksGuide}
      </Text>

      {visibleTagOptions.length > 0 && (
        <View style={styles.tagFilterSection}>
          <Text style={styles.tagFilterLabel}>{text.archiveTags}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagFilterRow}
          >
            <TouchableOpacity
              style={[
                styles.tagFilterChip,
                selectedTagFilter === null && styles.tagFilterChipActive,
              ]}
              onPress={() => setSelectedTagFilter(null)}
            >
              <Text
                style={[
                  styles.tagFilterChipText,
                  selectedTagFilter === null && styles.tagFilterChipTextActive,
                ]}
              >
                {text.allTags}
              </Text>
            </TouchableOpacity>
            {visibleTagOptions.map(tag => (
              <TouchableOpacity
                key={`archive-tag-${tag}`}
                style={[
                  styles.tagFilterChip,
                  selectedTagFilter === tag && styles.tagFilterChipActive,
                ]}
                onPress={() =>
                  setSelectedTagFilter(current => (current === tag ? null : tag))
                }
              >
                <Text
                  style={[
                    styles.tagFilterChipText,
                    selectedTagFilter === tag && styles.tagFilterChipTextActive,
                  ]}
                >
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[
            styles.filterChip,
            memoView === 'all' && styles.filterChipActive,
          ]}
          onPress={() => setMemoView('all')}
        >
          <Text
            style={[
              styles.filterChipText,
              memoView === 'all' && styles.filterChipTextActive,
            ]}
          >
            {text.allMemos}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterChip,
            memoView === 'tasks' && styles.filterChipActive,
          ]}
          onPress={() => setMemoView('tasks')}
        >
          <Text
            style={[
              styles.filterChipText,
              memoView === 'tasks' && styles.filterChipTextActive,
            ]}
          >
            {text.followUps}
          </Text>
        </TouchableOpacity>
      </View>

      {filteredMemos.length > 0 ? (
        <MemoListComponent
          memos={filteredMemos}
          language={language}
          onSelectMemo={openMemoDetail}
          onRenameMemo={handleRenameMemo}
          onDeleteMemo={handleDeleteMemo}
          scrollEnabled={false}
          theme={isDarkMode ? 'dark' : 'light'}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {memos.length === 0
              ? text.homeEmptyMemos
              : memoView === 'tasks'
              ? text.followUpsEmpty
              : language === 'en'
              ? 'No results found.'
              : '검색 결과가 없습니다.'}
          </Text>
        </View>
      )}
        </>
      )}

      {showTopicsTab && (
        <>
          {memoInsightGroups.length > 0 ? (
            <View style={[styles.insightSection, isDarkMode && styles.surfaceCardDark]}>
              <Text style={[styles.archiveSectionTitle, isDarkMode && styles.primaryTextDark]}>{text.browseByTopic}</Text>
              <Text style={[styles.archiveSectionHint, isDarkMode && styles.secondaryTextDark]}>{text.browseHint}</Text>
              <View style={styles.insightGrid}>
                {memoInsightGroups.map(group => (
                  <View
                    key={group.id}
                    style={[
                      styles.insightCard,
                      isDarkMode && styles.surfaceMutedDark,
                      selectedInsightGroupId === group.id && styles.insightCardActive,
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.insightCardMainButton}
                      activeOpacity={0.9}
                      onPress={() => handleSelectInsightGroup(group.id)}
                    >
                      <View style={styles.insightCardHeader}>
                        <Text style={[styles.insightCardTitle, isDarkMode && styles.primaryTextDark]}>{group.label}</Text>
                        <Text style={[styles.insightCardCount, isDarkMode && styles.secondaryTextDark]}>{group.memoCount}개 메모</Text>
                      </View>
                      <Text style={[styles.insightCardBody, isDarkMode && styles.secondaryTextDark]} numberOfLines={3}>
                        {group.preview}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.insightCardActionRow}>
                      <TouchableOpacity
                        style={[styles.insightCardActionButton, styles.insightCardActionButtonAccent]}
                        onPress={() => handleOpenInsightGroupMemo(group.id)}
                      >
                        <Text style={[styles.insightCardActionText, styles.insightCardActionTextAccent]}>
                          {text.topicOverview}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{text.homeEmptyTopics}</Text>
            </View>
          )}
        </>
      )}
      </ScrollView>

      {shouldShowBaseFloatingRecorder && (
        <TouchableOpacity
          style={styles.floatingRecorderButton}
          activeOpacity={0.92}
          onPress={() => setShowQuickRecorder(true)}
        >
          <FloatingRecorderIcon />
        </TouchableOpacity>
      )}

      <Modal
        visible={showInsightDetail && insightDetailGroup !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeInsightDetail}
      >
        {insightDetailGroup && (
          <View style={[styles.detailScreen, isDarkMode && styles.screenDark]}>
            <View style={[styles.detailHeader, isDarkMode && styles.settingsHeaderDark]}>
              <TouchableOpacity style={styles.detailBackButton} onPress={closeInsightDetail}>
                <Text style={styles.detailBackButtonText}>{text.close}</Text>
              </TouchableOpacity>
              <View style={styles.insightDetailHeaderCopy}>
                <Text style={[styles.insightDetailTitle, isDarkMode && styles.primaryTextDark]}>
                  {insightDetailGroup.label}
                </Text>
                <Text style={[styles.insightDetailMeta, isDarkMode && styles.secondaryTextDark]}>
                  {insightDetailGroup.memoCount}개 메모
                </Text>
              </View>
              <View style={styles.insightDetailHeaderSpacer} />
            </View>

            <ScrollView
              style={styles.detailScroll}
              contentContainerStyle={styles.detailContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.detailHeroCard, isDarkMode && styles.surfaceCardDark]}>
                <Text style={styles.detailEyebrow}>TOPIC</Text>
                <Text style={[styles.detailTitle, isDarkMode && styles.primaryTextDark]}>
                  {insightDetailGroup.label}
                </Text>
                <Text style={[styles.detailBodyText, isDarkMode && styles.secondaryTextDark]}>
                  {insightDetailGroup.preview}
                </Text>
              </View>

              <View style={[styles.detailCard, isDarkMode && styles.surfaceCardDark]}>
                <Text style={[styles.detailCardTitle, isDarkMode && styles.primaryTextDark]}>주제 요약</Text>
                <Text style={[styles.detailBodyText, isDarkMode && styles.secondaryTextDark]}>
                  {insightDetailOverview.summary}
                </Text>
                <View style={styles.insightOverviewMetaRow}>
                  <View style={styles.detailUtilityMetaChip}>
                    <Text style={styles.detailUtilityMetaText}>최근 메모 {insightDetailOverview.latestLabel || '-'}</Text>
                  </View>
                  <View style={styles.detailUtilityMetaChip}>
                    <Text style={styles.detailUtilityMetaText}>할 일 {insightDetailOverview.topTasks.length}개</Text>
                  </View>
                </View>
              </View>

              {insightDetailOverview.topTasks.length > 0 && (
                <View style={[styles.detailCard, isDarkMode && styles.surfaceCardDark]}>
                  <Text style={[styles.detailCardTitle, isDarkMode && styles.primaryTextDark]}>먼저 챙길 것</Text>
                  <View style={styles.detailSummaryList}>
                    {insightDetailOverview.topTasks.map((task, index) => (
                      <View key={`insight-task-${index}`} style={styles.detailSummaryItemRow}>
                        <View style={styles.detailSummaryBullet} />
                        <Text style={[styles.detailBodyText, isDarkMode && styles.secondaryTextDark]}>{task}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.topicExpandSection}>
                <TouchableOpacity
                  style={styles.topicExpandButton}
                  onPress={openInsightExpandFromDetail}
                >
                  <Text style={styles.topicExpandButtonTitle}>주제 활용하기</Text>
                  <Text style={styles.topicExpandButtonMeta}>
                    이 주제 메모 {insightDetailMemos.length}개를 바탕으로 다음 아이디어를 정리합니다
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.detailCard, isDarkMode && styles.surfaceCardDark]}>
                <Text style={[styles.detailCardTitle, isDarkMode && styles.primaryTextDark]}>
                  {text.topicSourceNotes}
                </Text>
                <Text style={[styles.detailBodyText, isDarkMode && styles.secondaryTextDark]}>
                  {text.topicSourceNotesHint}
                </Text>
              </View>

              {insightDetailMemos.length > 0 ? (
                <MemoListComponent
                  memos={insightDetailMemos}
                  language={language}
                  onSelectMemo={memo => {
                    openMemoDetail(memo);
                    setShowInsightDetail(false);
                  }}
                  onRenameMemo={handleRenameMemo}
                  onDeleteMemo={handleDeleteMemo}
                  scrollEnabled={false}
                  theme={isDarkMode ? 'dark' : 'light'}
                />
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>{text.topicEmptyMemos}</Text>
                </View>
              )}
            </ScrollView>

            {shouldShowModalFloatingRecorder && (
              <TouchableOpacity
                style={styles.floatingRecorderButtonModal}
                activeOpacity={0.92}
                onPress={() => setShowQuickRecorder(true)}
              >
                <FloatingRecorderIcon />
              </TouchableOpacity>
            )}
          </View>
        )}
      </Modal>

      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={[styles.settingsScreen, isDarkMode && styles.screenDark]}>
          <View style={[styles.settingsHeader, isDarkMode && styles.settingsHeaderDark]}>
            <Text style={[styles.settingsTitle, isDarkMode && styles.primaryTextDark]}>{text.settings}</Text>
            <TouchableOpacity
              style={styles.detailBackButton}
              onPress={() => setShowSettings(false)}
            >
              <Text style={styles.detailBackButtonText}>{text.close}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.settingsScroll}
            contentContainerStyle={styles.settingsScrollContent}
            showsVerticalScrollIndicator={false}
          >
          <View style={[styles.settingsCard, isDarkMode && styles.surfaceCardDark]}>
            <View style={styles.settingsRow}>
              <View style={styles.settingsCopy}>
                <Text style={styles.settingsLabel}>{text.heyEcho}</Text>
                <Text style={styles.settingsHint}>
                  {wakeWordEnabled ? wakeWordStatus : text.heyEchoHintOff}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.wakeWordButton,
                  wakeWordEnabled && styles.wakeWordButtonActive,
                ]}
                onPress={handleToggleWakeWord}
              >
                <Text
                  style={[
                    styles.wakeWordButtonText,
                    wakeWordEnabled && styles.wakeWordButtonTextActive,
                  ]}
                >
                  {wakeWordEnabled ? text.on : text.turnOn}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingsDivider} />

            <View style={styles.settingsRowStatic}>
              <Text style={styles.settingsLabel}>{text.speechRecognition}</Text>
              <Text style={styles.settingsValue}>{lastSttInfo || text.waiting}</Text>
            </View>

            <View style={styles.settingsDivider} />
            <View style={styles.settingsRowStatic}>
              <Text style={styles.settingsLabel}>{text.language}</Text>
              <Text style={styles.settingsHint}>{text.languageHint}</Text>
              <View style={styles.settingsOptionRow}>
                {([
                  ['ko', '한국어'],
                  ['en', 'English'],
                ] as [AppLanguage, string][]).map(([option, label]) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.settingsOptionChip,
                      language === option && styles.settingsOptionChipActive,
                    ]}
                    onPress={() => handleChangeLanguage(option)}
                  >
                    <Text
                      style={[
                        styles.settingsOptionText,
                        language === option && styles.settingsOptionTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.settingsDivider} />

            <TouchableOpacity
              style={styles.settingsToggleRow}
              activeOpacity={0.9}
              onPress={() => setIsPlanOpen(current => !current)}
            >
              <Text style={styles.settingsLabel}>{text.plan}</Text>
              <Text style={styles.settingsToggleArrow}>{isPlanOpen ? '−' : '+'}</Text>
            </TouchableOpacity>
            {isPlanOpen && (
              <View style={styles.planCard}>
                <Text style={styles.planHeadline}>{upgradeRecommendation.headline}</Text>
                <Text style={styles.planDetail}>
                  {billingProfile.tier === 'pro' ? text.proPlan : text.freePlan}
                </Text>
                <Text style={styles.planUsageText}>
                  {text.memoUsage(memos.length, billingProfile.expansionSaveCount)}
                </Text>
                <Text style={styles.planProviderText}>
                  {text.billingProvider}: {BILLING_PROVIDER_PLAN.provider} · {BILLING_PROVIDER_PLAN.summary}
                </Text>
                <Text style={styles.planProviderText}>
                  {text.billingReadiness}: {billingReadiness.statusLabel}
                </Text>
                {!billingReadiness.configured && (
                  <Text style={styles.planProviderDetailText}>{billingReadiness.detail}</Text>
                )}
                <View style={styles.planFeatureSection}>
                  <Text style={styles.planFeatureTitle}>{text.freeIncludes}</Text>
                  {FREE_PLAN_FEATURES.map((feature: string) => (
                    <Text key={`free-${feature}`} style={styles.planFeatureText}>• {feature}</Text>
                  ))}
                </View>
                <View style={styles.planFeatureSection}>
                  <Text style={styles.planFeatureTitle}>{text.proIncludes}</Text>
                  {PRO_PLAN_FEATURES.map((feature: string) => (
                    <Text key={`pro-${feature}`} style={styles.planFeatureText}>• {feature}</Text>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.settingsShortcutButton}
                  onPress={() => {
                    setStatusTone('info');
                    setStatusMessage(text.proFeatureHint(PRO_PLAN_FEATURES));
                  }}
                >
                  <Text style={styles.settingsShortcutButtonText}>{text.upgradeReady}</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.settingsDivider} />

            <View style={styles.settingsRowStatic}>
              <Text style={styles.settingsLabel}>{text.billingConnection}</Text>
              <Text style={styles.settingsValue}>
                {billingConnectionDetail || text.sdkNotReady}
              </Text>
              <TouchableOpacity
                style={styles.settingsShortcutButton}
                onPress={handleCheckBillingConnection}
              >
                <Text style={styles.settingsShortcutButtonText}>{text.billingCheck}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingsDivider} />

            <View style={styles.settingsRowStatic}>
              <Text style={styles.settingsLabel}>{text.restorePurchases}</Text>
              <Text style={styles.settingsHint}>{text.restorePurchasesHint}</Text>
              <TouchableOpacity
                style={styles.settingsShortcutButton}
                onPress={handleRestorePurchases}
              >
                <Text style={styles.settingsShortcutButtonText}>{text.restorePurchases}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingsDivider} />

            <View style={styles.settingsRowStatic}>
              <Text style={styles.settingsLabel}>{text.qaStatus}</Text>
              <Text style={styles.settingsValue}>
                {deviceQaStatus || text.qaNotChecked}
              </Text>
              <TouchableOpacity
                style={styles.settingsShortcutButton}
                onPress={handleRunDeviceQaCheck}
              >
                <Text style={styles.settingsShortcutButtonText}>{text.qaCheck}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingsDivider} />

            <View style={styles.settingsRowStatic}>
              <Text style={styles.settingsLabel}>{text.contact}</Text>
              <Text style={styles.settingsValue}>{SUPPORT_EMAIL || text.contactPending}</Text>
              <TouchableOpacity
                style={styles.settingsShortcutButton}
                onPress={handleOpenSupport}
              >
                <Text style={styles.settingsShortcutButtonText}>{text.open}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingsDivider} />

            <View style={styles.settingsRowStatic}>
              <Text style={styles.settingsLabel}>{text.privacyPolicy}</Text>
              <Text style={styles.settingsValue}>{PRIVACY_URL || text.linkPending}</Text>
              <TouchableOpacity
                style={styles.settingsShortcutButton}
                onPress={handleOpenPrivacy}
              >
                <Text style={styles.settingsShortcutButtonText}>{text.open}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingsDivider} />

            <View style={styles.settingsRowStatic}>
              <Text style={styles.settingsLabel}>{text.terms}</Text>
              <Text style={styles.settingsValue}>{TERMS_URL || text.linkPending}</Text>
              <TouchableOpacity
                style={styles.settingsShortcutButton}
                onPress={handleOpenTerms}
              >
                <Text style={styles.settingsShortcutButtonText}>{text.open}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingsDivider} />

            <View style={styles.settingsRowStatic}>
              <Text style={styles.settingsLabel}>{text.appVersion}</Text>
              <Text style={styles.settingsValue}>{APP_VERSION}</Text>
            </View>

          </View>
          </ScrollView>
          {shouldShowModalFloatingRecorder && (
            <TouchableOpacity
              style={styles.floatingRecorderButtonModal}
              activeOpacity={0.92}
              onPress={() => setShowQuickRecorder(true)}
            >
              <FloatingRecorderIcon />
            </TouchableOpacity>
          )}
        </View>
      </Modal>

      <Modal
        visible={selectedMemo !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeMemoDetail}
      >
        {selectedMemo && (
          <View style={[styles.detailScreen, isDarkMode && styles.screenDark]}>
              <View style={[styles.detailHeader, isDarkMode && styles.settingsHeaderDark]}>
                <TouchableOpacity style={styles.detailBackButton} onPress={closeMemoDetail}>
                  <Text style={styles.detailBackButtonText}>{text.close}</Text>
                </TouchableOpacity>
                <View style={styles.detailHeaderSpacer} />
            </View>

            <ScrollView
              style={styles.detailScroll}
              contentContainerStyle={styles.detailContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.detailHeroCard, isDarkMode && styles.surfaceCardDark]}>
                <View style={styles.detailHeroTitleRow}>
                  <Text style={[styles.detailTitle, isDarkMode && styles.primaryTextDark]}>{selectedMemo.title || text.memoDefaultTitle}</Text>
                  <TouchableOpacity
                    style={[
                      styles.detailFollowUpIconButton,
                      selectedMemo.isFollowUp && styles.detailFollowUpIconButtonActive,
                    ]}
                    onPress={handleToggleFollowUp}
                  >
                    <Text
                      style={[
                        styles.detailFollowUpIcon,
                        selectedMemo.isFollowUp && styles.detailFollowUpIconActive,
                      ]}
                    >
                      {selectedMemo.isFollowUp ? '★' : '☆'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.detailMeta, isDarkMode && styles.secondaryTextDark]}>
                  {new Date(selectedMemo.timestamp).toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US')} · {Math.floor(selectedMemo.duration / 60)}:{`${selectedMemo.duration % 60}`.padStart(2, '0')}
                </Text>
                <Text style={[styles.detailFollowUpHint, isDarkMode && styles.secondaryTextDark]}>
                  {selectedMemo.isFollowUp ? text.removeFromFollowUps : text.sendToFollowUps}
                </Text>
                {selectedMemo.context?.calendarEvent && (
                  <View style={[styles.detailScheduleChip, isDarkMode && styles.surfaceMutedDark]}>
                    <Text style={[styles.detailScheduleTitle, isDarkMode && styles.primaryTextDark]}>
                      {selectedMemo.context.calendarEvent.title}
                    </Text>
                    <Text style={[styles.detailScheduleMeta, isDarkMode && styles.secondaryTextDark]}>
                      {formatCalendarEventLabel(selectedMemo.context.calendarEvent)}
                    </Text>
                  </View>
                )}
                {!!selectedMemo.tags?.length && (
                  <View style={styles.detailTagRow}>
                    {selectedMemo.tags.map(tag => (
                      <View key={`${selectedMemo.id}-${tag}`} style={[styles.detailTagChip, isDarkMode && styles.tagChipDark]}>
                        <Text style={styles.detailTagChipText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={[styles.detailPlayerCard, isDarkMode && styles.surfaceCardDark]}>
                <Text style={[styles.detailCardTitle, isDarkMode && styles.primaryTextDark]}>{text.detailAudio}</Text>
                <View style={styles.detailPlayerWave}>
                  <View style={styles.detailPlayerWaveAccent} />
                </View>
                <TouchableOpacity
                  style={[
                    styles.detailPlayerButton,
                    isDetailPlaying && styles.detailPlayerButtonActive,
                  ]}
                  onPress={handleToggleDetailPlayback}
                >
                  <Text
                    style={[
                      styles.detailPlayerButtonText,
                      isDetailPlaying && styles.detailPlayerButtonTextActive,
                    ]}
                  >
                    {isDetailPlaying ? text.detailStop : text.detailPlay}
                  </Text>
                </TouchableOpacity>
              </View>

              {detailSummarySections.length > 0 ? (
                <View style={styles.detailSummaryStack}>
                  {detailSummarySections.map(section => (
                    <View key={section.title} style={[styles.detailCard, isDarkMode && styles.surfaceCardDark]}>
                      <Text style={[styles.detailCardTitle, isDarkMode && styles.primaryTextDark]}>{section.title}</Text>
                      <View style={styles.detailSummaryList}>
                        {section.items.map((item, index) => (
                          <View key={`${section.title}-${index}`} style={styles.detailSummaryItemRow}>
                            <View style={styles.detailSummaryBullet} />
                            <Text style={[styles.detailBodyText, isDarkMode && styles.secondaryTextDark]}>{item}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={[styles.detailCard, isDarkMode && styles.surfaceCardDark]}>
                  <Text style={[styles.detailCardTitle, isDarkMode && styles.primaryTextDark]}>{text.detailSummary}</Text>
                  <Text style={[styles.detailBodyText, isDarkMode && styles.secondaryTextDark]}>
                    {selectedMemo.summary || text.detailSummaryEmpty}
                  </Text>
                </View>
              )}

              <View style={[styles.detailCard, isDarkMode && styles.surfaceCardDark]}>
                  <View style={styles.detailCardHeaderRow}>
                    <Text style={[styles.detailCardTitle, isDarkMode && styles.primaryTextDark]}>{text.detailSourceMemo}</Text>
                    <TouchableOpacity
                      style={styles.detailInlineAction}
                      onPress={() => {
                        setTranscriptDraft(selectedMemo.transcript ?? '');
                        setIsTranscriptEditorOpen(current => !current);
                      }}
                    >
                      <Text style={styles.detailInlineActionText}>
                        {isTranscriptEditorOpen ? text.detailCollapse : text.detailEdit}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {isTranscriptEditorOpen ? (
                    <>
                      <TextInput
                        style={[styles.detailTagInput, styles.detailTranscriptEditor]}
                        value={transcriptDraft}
                        onChangeText={setTranscriptDraft}
                        multiline
                        textAlignVertical="top"
                        placeholder={text.detailEditPlaceholder}
                        placeholderTextColor="#9a938a"
                      />
                      <View style={styles.detailTagEditorActions}>
                        <TouchableOpacity
                          style={styles.detailUtilityButton}
                          onPress={() => {
                            setTranscriptDraft(selectedMemo.transcript ?? '');
                            setIsTranscriptEditorOpen(false);
                          }}
                        >
                          <Text style={styles.detailUtilityButtonText}>{text.cancel}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.detailUtilityButton}
                          onPress={handleSaveTranscript}
                        >
                          <Text style={styles.detailUtilityButtonText}>{text.save}</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : detailTranscriptParagraphs.length > 0 ? (
                    <View style={styles.detailTranscriptStack}>
                      {detailTranscriptParagraphs.map((paragraph, index) => (
                        <Text key={`summary-paragraph-${index}`} style={styles.detailTranscriptParagraph}>
                          {paragraph}
                        </Text>
                      ))}
                    </View>
                  ) : (
                    <Text style={[styles.detailBodyText, isDarkMode && styles.secondaryTextDark]}>
                      {text.noRecord}
                    </Text>
                  )}
                </View>

              <View style={[styles.detailCard, isDarkMode && styles.surfaceCardDark]}>
                  <Text style={[styles.detailCardTitle, isDarkMode && styles.primaryTextDark]}>{text.detailCommentTitle}</Text>
                  {!!selectedMemo.comments?.length && (
                    <View style={styles.detailCommentList}>
                      {selectedMemo.comments.map(comment => (
                        <View key={comment.id} style={styles.detailCommentItem}>
                          <Text style={styles.detailCommentMeta}>
                            {new Date(comment.createdAt).toLocaleString('ko-KR')}
                          </Text>
                          <Text style={styles.detailBodyText}>{comment.text}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <TextInput
                    style={[styles.detailTagInput, styles.detailCommentInput]}
                    value={commentDraft}
                    onChangeText={setCommentDraft}
                    multiline
                    textAlignVertical="top"
                    placeholder={text.detailCommentPlaceholder}
                    placeholderTextColor="#9a938a"
                  />
                  <View style={styles.detailTagEditorActions}>
                    <TouchableOpacity
                      style={styles.detailUtilityButton}
                      onPress={handleAddComment}
                    >
                      <Text style={styles.detailUtilityButtonText}>{text.detailCommentAdd}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

              {detailActionItems.length > 0 && (
                <View style={[styles.detailCard, isDarkMode && styles.surfaceCardDark]}>
                  <Text style={[styles.detailCardTitle, isDarkMode && styles.primaryTextDark]}>{text.detailFollowUps}</Text>
                  <ActionItemsDisplay actionItems={detailActionItems} theme={isDarkMode ? 'dark' : 'light'} />
                </View>
              )}

            </ScrollView>
            {shouldShowModalFloatingRecorder && (
              <TouchableOpacity
                style={styles.floatingRecorderButtonModal}
                activeOpacity={0.92}
                onPress={() => setShowQuickRecorder(true)}
              >
                <FloatingRecorderIcon />
              </TouchableOpacity>
            )}
          </View>
        )}
      </Modal>

      <Modal
        visible={showInsightExpand && insightDetailGroup !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowInsightExpand(false)}
      >
        {insightDetailGroup && (
          <View style={[styles.detailScreen, isDarkMode && styles.screenDark]}>
            <View style={[styles.detailHeader, isDarkMode && styles.settingsHeaderDark]}>
              <TouchableOpacity
                style={styles.detailBackButton}
                onPress={() => setShowInsightExpand(false)}
              >
                <Text style={styles.detailBackButtonText}>{text.close}</Text>
              </TouchableOpacity>
              <View style={styles.insightDetailHeaderCopy}>
                <Text style={[styles.insightDetailTitle, isDarkMode && styles.primaryTextDark]}>
                  {insightDetailGroup.label} 활용
                </Text>
                <Text style={[styles.insightDetailMeta, isDarkMode && styles.secondaryTextDark]}>
                  모인 메모를 한 번 더 요약하고 아이디어로 확장합니다
                </Text>
              </View>
              <View style={styles.insightDetailHeaderSpacer} />
            </View>

            <ScrollView
              style={styles.detailScroll}
              contentContainerStyle={styles.detailContent}
              showsVerticalScrollIndicator={false}
            >
              {insightExpansionIdeas.map((idea, index) => (
                <TouchableOpacity
                  key={`insight-expand-${index}`}
                  activeOpacity={0.92}
                  onPress={() => setSelectedExpansionIdeaKey(idea.key)}
                  style={[
                    styles.detailCard,
                    isDarkMode && styles.surfaceCardDark,
                    selectedExpansionIdeaKey === idea.key && styles.detailCardSelected,
                  ]}
                >
                  <View style={styles.expandCardHeader}>
                    <Text style={[styles.detailCardTitle, isDarkMode && styles.primaryTextDark, styles.expandCardTitle]}>
                      {idea.title}
                    </Text>
                    <View style={styles.expandCardActions}>
                      <TouchableOpacity
                        style={styles.expandCardActionButton}
                        onPress={() => handleShareExpansionIdea(idea.title, idea.body)}
                      >
                        <Text style={styles.expandCardActionText}>{text.shareIdea}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.expandCardActionButton}
                        onPress={() => handleCopyExpansionIdea(idea.body)}
                      >
                        <Text style={styles.expandCardActionText}>{text.copyIdea}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={[styles.expandResultHint, isDarkMode && styles.secondaryTextDark]}>
                    {idea.description}
                  </Text>
                  <View style={styles.expandResultList}>
                    {splitExpansionBody(idea.body).map((line, lineIndex) => (
                      <View key={`${idea.key}-${lineIndex}`} style={styles.expandResultRow}>
                        <View style={styles.expandResultBullet} />
                        <Text style={[styles.expandResultText, isDarkMode && styles.secondaryTextDark]}>
                          {line.replace(/^\d+(단계)?[.)]?\s*/, '')}
                        </Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              ))}

              {insightExpansionIdeas.find(idea => idea.key === selectedExpansionIdeaKey) && (
                <View style={styles.expandPrimaryActionWrap}>
                  <TouchableOpacity
                    style={styles.topicExpandButton}
                    onPress={() => {
                      handleOpenExpansionRecorder();
                    }}
                  >
                    <Text style={styles.topicExpandButtonTitle}>{text.startNewRecording}</Text>
                    <Text style={styles.topicExpandButtonMeta}>
                      {text.startNewRecordingHint}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            {showExpansionRecorder && (
              <View style={styles.expansionRecorderOverlay}>
                <View style={[styles.expansionRecorderSheet, isDarkMode && styles.surfaceCardDark]}>
                  <View style={styles.expansionRecorderHeader}>
                    <Text style={[styles.detailCardTitle, isDarkMode && styles.primaryTextDark]}>
                      {text.startNewRecording}
                    </Text>
                    <TouchableOpacity
                      style={styles.detailBackButton}
                      onPress={() => setShowExpansionRecorder(false)}
                    >
                      <Text style={styles.detailBackButtonText}>{text.close}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.detailBodyText, isDarkMode && styles.secondaryTextDark, styles.expansionRecorderHint]}>
                    {text.startNewRecordingHint}
                  </Text>
                  <RecorderComponent
                    onRecordingComplete={handleExpansionRecordingComplete}
                    onRecordingError={handleExpansionRecordingError}
                    onRecordingStateChange={handleRecordingStateChange}
                    disabled={isExtracting}
                    autoStartSignal={0}
                  />
                </View>
              </View>
            )}

            {shouldShowModalFloatingRecorder && (
              <TouchableOpacity
                style={styles.floatingRecorderButtonModal}
                activeOpacity={0.92}
                onPress={() => setShowQuickRecorder(true)}
              >
                <FloatingRecorderIcon />
              </TouchableOpacity>
            )}
          </View>
        )}
      </Modal>

      <Modal
        visible={showQuickRecorder}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQuickRecorder(false)}
      >
        <View style={styles.quickRecorderOverlay}>
          <View style={[styles.quickRecorderSheet, isDarkMode && styles.surfaceCardDark]}>
            <View style={styles.expansionRecorderHeader}>
              <Text style={[styles.detailCardTitle, isDarkMode && styles.primaryTextDark]}>
                {text.startNewRecording}
              </Text>
              <TouchableOpacity
                style={styles.detailBackButton}
                onPress={() => setShowQuickRecorder(false)}
              >
                <Text style={styles.detailBackButtonText}>{text.close}</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.detailBodyText, isDarkMode && styles.secondaryTextDark, styles.expansionRecorderHint]}>
              {text.startNewRecordingHint}
            </Text>
            <RecorderComponent
              onRecordingComplete={handleQuickRecordingComplete}
              onRecordingError={handleQuickRecorderError}
              onRecordingStateChange={handleRecordingStateChange}
              disabled={isExtracting}
              autoStartSignal={0}
            />
          </View>
        </View>
      </Modal>

      <View style={[styles.bottomNav, isDarkMode && styles.surfaceMutedDark]}>
        {bottomTabs.map(tab => {
          const isHome = tab.key === 'home';
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.bottomNavItem,
                isHome && styles.bottomNavItemCenter,
              ]}
              activeOpacity={0.85}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
            >
              <BottomTabIcon tab={tab.key} active={activeTab === tab.key} />
              {!isHome && (
                <View
                  style={[
                    styles.bottomNavIndicator,
                    activeTab === tab.key && styles.bottomNavIndicatorActive,
                  ]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f2ee',
  },
  screenDark: {
    backgroundColor: '#15181b',
  },
  container: {
    backgroundColor: '#f4f2ee',
  },
  containerDark: {
    backgroundColor: '#15181b',
  },
  surfaceCardDark: {
    backgroundColor: '#20252b',
    borderColor: '#313843',
  },
  surfaceMutedDark: {
    backgroundColor: '#191e23',
    borderColor: '#313843',
  },
  surfaceButtonDark: {
    backgroundColor: '#20252b',
    borderColor: '#313843',
  },
  settingsHeaderDark: {
    borderBottomColor: '#313843',
    backgroundColor: '#15181b',
  },
  inputDark: {
    backgroundColor: '#20252b',
    borderColor: '#313843',
    color: '#f2f4f7',
  },
  primaryTextDark: {
    color: '#f2f4f7',
  },
  secondaryTextDark: {
    color: '#aeb6c2',
  },
  tagChipDark: {
    backgroundColor: '#24312d',
  },
  contentContainer: {
    paddingTop: 28,
    paddingBottom: 104,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#17181b',
  },
  heroCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  heroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#1c2e2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  heroContent: {
    flex: 1,
  },
  heroEyebrow: {
    color: '#7f8288',
    fontSize: 12,
    letterSpacing: 0.2,
    fontWeight: '700',
    marginBottom: 2,
  },
  heroSubtitle: {
    marginTop: 14,
    color: '#6f7278',
    fontSize: 14,
    lineHeight: 20,
  },
  heroStatusPill: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e7e4de',
  },
  heroStatusText: {
    color: '#666970',
    fontSize: 11,
    fontWeight: '700',
  },
  heroStatRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  heroStatChip: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#ece8e1',
  },
  heroStatValue: {
    color: '#17181b',
    fontSize: 18,
    fontWeight: '800',
  },
  heroStatLabel: {
    marginTop: 4,
    color: '#88857f',
    fontSize: 12,
    fontWeight: '600',
  },
  heroSettingsButton: {
    backgroundColor: '#ffffff',
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e7e4de',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSettingsButtonText: {
    color: '#44474d',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  iconCogWrap: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCogTooth: {
    position: 'absolute',
    borderRadius: 1.5,
  },
  iconCogToothTop: {
    width: 2.5,
    height: 5,
    top: 0,
  },
  iconCogToothRight: {
    width: 5,
    height: 2.5,
    right: 0,
  },
  iconCogToothBottom: {
    width: 2.5,
    height: 5,
    bottom: 0,
  },
  iconCogToothLeft: {
    width: 5,
    height: 2.5,
    left: 0,
  },
  iconCogRing: {
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconCogCore: {
    width: 3,
    height: 3,
    borderRadius: 999,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7d6855',
    marginHorizontal: 20,
    marginTop: 6,
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  searchInput: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#fffdf8',
    borderRadius: 16,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e5dccf',
    color: '#2f3744',
  },
  archiveSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2329',
    marginBottom: 4,
  },
  archiveSectionHint: {
    fontSize: 12,
    lineHeight: 18,
    color: '#8a857e',
    marginBottom: 8,
  },
  memoGuideText: {
    marginHorizontal: 18,
    marginBottom: 10,
    color: '#8a857e',
    fontSize: 12,
    lineHeight: 18,
  },
  tagFilterSection: {
    marginHorizontal: 16,
    marginBottom: 10,
  },
  tagFilterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8a857e',
    marginBottom: 8,
  },
  tagFilterRow: {
    gap: 8,
    paddingRight: 16,
  },
  tagFilterChip: {
    backgroundColor: '#f1ece4',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tagFilterChipActive: {
    backgroundColor: '#1c2e2a',
  },
  tagFilterChipText: {
    color: '#7c6d5b',
    fontSize: 12,
    fontWeight: '700',
  },
  tagFilterChipTextActive: {
    color: '#ffffff',
  },
  homeTopicSection: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 14,
  },
  homeSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2329',
    marginBottom: 12,
  },
  homeTopicRow: {
    flexDirection: 'row',
    gap: 12,
  },
  homeTopicCard: {
    flex: 1,
    backgroundColor: '#fffdf8',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#e8dfd2',
  },
  homeTopicTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#20242a',
    marginBottom: 6,
  },
  homeTopicMeta: {
    fontSize: 12,
    color: '#7c7871',
  },
  recentMemoCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#fffdf8',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e8dfd2',
  },
  recentMemoTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1f2329',
    marginBottom: 6,
  },
  recentMemoMeta: {
    fontSize: 12,
    color: '#8a857e',
    marginBottom: 10,
  },
  recentMemoBody: {
    fontSize: 14,
    lineHeight: 21,
    color: '#53575e',
  },
  expansionRecorderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 18, 20, 0.18)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  quickRecorderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 18, 20, 0.18)',
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  expansionRecorderSheet: {
    backgroundColor: '#fffdf8',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e8dfd2',
    paddingTop: 16,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  expansionRecorderHeader: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  expansionRecorderHint: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  quickRecorderSheet: {
    backgroundColor: '#fffdf8',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e8dfd2',
    paddingTop: 16,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  floatingRecorderButton: {
    position: 'absolute',
    right: 22,
    bottom: 94,
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: '#1c2e2a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#12211e',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  floatingRecorderButtonModal: {
    position: 'absolute',
    right: 22,
    bottom: 22,
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: '#1c2e2a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#12211e',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  floatingRecorderIconRing: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#f6f2ea',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingRecorderIconDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#ef6a5b',
  },
  insightSection: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#fffdf8',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e8dfd2',
  },
  insightSectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1c2127',
  },
  insightSectionSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#77716a',
  },
  insightGrid: {
    marginTop: 12,
    gap: 10,
  },
  insightCard: {
    backgroundColor: '#faf7f2',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ece2d5',
  },
  insightCardMainButton: {
    gap: 4,
  },
  insightCardActive: {
    backgroundColor: '#eef6f2',
    borderColor: '#244f45',
  },
  insightCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  insightCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#21252b',
    flex: 1,
  },
  insightCardCount: {
    fontSize: 12,
    color: '#8b7b69',
    fontWeight: '700',
  },
  insightCardBody: {
    fontSize: 13,
    lineHeight: 20,
    color: '#50545b',
  },
  insightCardMeta: {
    marginTop: 10,
    fontSize: 12,
    color: '#8c857d',
    fontWeight: '600',
  },
  insightCardActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  insightCardActionButton: {
    flex: 1,
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#ddd5c9',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  insightCardActionButtonAccent: {
    backgroundColor: '#244f45',
    borderColor: '#244f45',
  },
  insightCardActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5b5f67',
  },
  insightCardActionTextAccent: {
    color: '#ffffff',
  },
  activeInsightBanner: {
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#d9e5de',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  activeInsightCopy: {
    flex: 1,
  },
  activeInsightLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6f807a',
    marginBottom: 4,
  },
  activeInsightTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2724',
    marginBottom: 4,
  },
  activeInsightText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#66706c',
  },
  activeInsightButton: {
    backgroundColor: '#244f45',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  activeInsightButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  insightDetailHeaderCopy: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 10,
  },
  insightDetailHeaderSpacer: {
    width: 56,
  },
  insightDetailTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#17181b',
  },
  insightDetailMeta: {
    fontSize: 12,
    color: '#66706c',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#8b7d6c',
    textAlign: 'center',
  },
  expandSection: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  expandHero: {
    backgroundColor: '#fffdf8',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e8dfd2',
    marginBottom: 10,
  },
  expandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1f2329',
    marginBottom: 6,
  },
  expandHint: {
    fontSize: 13,
    lineHeight: 19,
    color: '#7f7a74',
  },
  expandHowTo: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: '#5f6a68',
    fontWeight: '600',
  },
  expandSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#7a6859',
    marginBottom: 8,
    marginTop: 4,
  },
  expandSourceCard: {
    backgroundColor: '#fffdf8',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e8dfd2',
    marginBottom: 10,
  },
  expandSourceLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#8f7d6a',
    marginBottom: 6,
  },
  expandSourceTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1d2127',
    marginBottom: 8,
  },
  expandSourceBody: {
    fontSize: 13,
    lineHeight: 20,
    color: '#55585f',
  },
  expandActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  expandActionTile: {
    backgroundColor: '#fffdf8',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e8dfd2',
    width: '48%',
    minHeight: 112,
    justifyContent: 'space-between',
  },
  expandActionTileActive: {
    borderColor: '#244f45',
    backgroundColor: '#f3faf7',
  },
  expandActionTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  expandActionStatus: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7d6855',
  },
  expandActionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#20242a',
  },
  expandResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  expansionIconTaskWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expansionIconCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  expansionIconTaskLines: {
    gap: 4,
  },
  expansionIconLineShort: {
    width: 18,
    height: 3,
    borderRadius: 3,
  },
  expansionIconLineLong: {
    width: 28,
    height: 3,
    borderRadius: 3,
  },
  expansionIconPlanWrap: {
    gap: 4,
  },
  expansionIconPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expansionIconPlanDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  expansionIconQuestionWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expansionIconQuestionMark: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  expansionIconMessageWrap: {
    alignItems: 'center',
  },
  expansionIconMessageBox: {
    width: 28,
    height: 20,
    borderRadius: 7,
    borderWidth: 2,
  },
  expansionIconMessageTail: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  expandPrimaryButton: {
    backgroundColor: '#244f45',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  expandPrimaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  expandResultHint: {
    fontSize: 12,
    lineHeight: 18,
    color: '#5f6a68',
    marginBottom: 10,
    fontWeight: '700',
  },
  expandCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  expandCardTitle: {
    marginBottom: 0,
    flex: 1,
  },
  expandCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  expandCardActionButton: {
    backgroundColor: '#f4efe7',
    borderWidth: 1,
    borderColor: '#e7dccd',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  expandCardActionText: {
    color: '#5f655f',
    fontSize: 12,
    fontWeight: '700',
  },
  expandResultList: {
    gap: 10,
  },
  expandResultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  expandResultBullet: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#244f45',
    marginTop: 7,
    flexShrink: 0,
  },
  expandResultText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: '#4d5057',
  },
  expandInlineLink: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  expandInlineLinkText: {
    color: '#244f45',
    fontSize: 12,
    fontWeight: '700',
  },
  statusContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  statusInfo: {
    backgroundColor: '#eef5ff',
    borderColor: '#c6daf9',
  },
  statusSuccess: {
    backgroundColor: '#edf7ef',
    borderColor: '#cfe7d4',
  },
  statusError: {
    backgroundColor: '#fff0ef',
    borderColor: '#f2c5c0',
  },
  statusText: {
    fontSize: 14,
    color: '#2f3744',
    fontWeight: '700',
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  wakeWordCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
    backgroundColor: '#fffdf8',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5dccf',
  },
  wakeWordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  wakeWordCopy: {
    flex: 1,
  },
  wakeWordTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1f2329',
    marginBottom: 6,
  },
  wakeWordText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6f7278',
  },
  wakeWordButton: {
    backgroundColor: '#f3ece4',
    borderWidth: 1,
    borderColor: '#e5d5c8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  wakeWordButtonActive: {
    backgroundColor: '#1c2e2a',
    borderColor: '#1c2e2a',
  },
  wakeWordButtonText: {
    color: '#8a5c49',
    fontSize: 13,
    fontWeight: '700',
  },
  wakeWordButtonTextActive: {
    color: '#ffffff',
  },
  wakeWordStatus: {
    marginTop: 10,
    fontSize: 12,
    color: '#8a857e',
    lineHeight: 18,
  },
  settingsScreen: {
    flex: 1,
    backgroundColor: '#f4f2ee',
    paddingTop: 24,
  },
  settingsScroll: {
    flex: 1,
  },
  settingsScrollContent: {
    paddingBottom: 40,
  },
  settingsHeader: {
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingsTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#17181b',
  },
  settingsCard: {
    marginHorizontal: 16,
    backgroundColor: '#fffdf8',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e8dfd2',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
  },
  settingsCopy: {
    flex: 1,
  },
  settingsLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1f2329',
  },
  settingsHint: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: '#7b7770',
  },
  settingsDivider: {
    height: 1,
    backgroundColor: '#eee7dc',
  },
  settingsRowStatic: {
    paddingVertical: 14,
    gap: 6,
  },
  settingsToggleRow: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingsToggleArrow: {
    color: '#6e6a63',
    fontSize: 24,
    fontWeight: '500',
  },
  settingsExpandableCard: {
    marginTop: 2,
    marginBottom: 12,
    backgroundColor: '#faf7f2',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ece2d5',
    gap: 6,
  },
  settingsValue: {
    fontSize: 13,
    lineHeight: 19,
    color: '#686c72',
  },
  settingsOptionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  settingsOptionChip: {
    backgroundColor: '#f5f1ea',
    borderWidth: 1,
    borderColor: '#e5dccf',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  settingsOptionChipActive: {
    backgroundColor: '#244f45',
    borderColor: '#244f45',
  },
  settingsOptionText: {
    color: '#615c54',
    fontSize: 12,
    fontWeight: '700',
  },
  settingsOptionTextActive: {
    color: '#ffffff',
  },
  settingsShortcutButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: '#244f45',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  settingsShortcutButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  planCard: {
    marginTop: 10,
    backgroundColor: '#faf7f2',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ece2d5',
    gap: 6,
  },
  planHeadline: {
    color: '#1f2329',
    fontSize: 15,
    fontWeight: '800',
  },
  planDetail: {
    color: '#6e6a63',
    fontSize: 13,
    lineHeight: 19,
  },
  planUsageText: {
    color: '#8a857e',
    fontSize: 12,
    fontWeight: '700',
  },
  planProviderText: {
    color: '#5f625f',
    fontSize: 12,
    lineHeight: 18,
  },
  planProviderDetailText: {
    color: '#8a857e',
    fontSize: 12,
    lineHeight: 18,
  },
  planFeatureSection: {
    marginTop: 6,
    gap: 4,
  },
  planFeatureTitle: {
    color: '#20242a',
    fontSize: 12,
    fontWeight: '800',
  },
  planFeatureText: {
    color: '#6e6a63',
    fontSize: 12,
    lineHeight: 18,
  },
  wakeWordMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  wakeWordMetaChip: {
    backgroundColor: '#f7f6f2',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e6e0d8',
  },
  wakeWordMetaLabel: {
    fontSize: 11,
    color: '#8a8378',
    fontWeight: '700',
    marginBottom: 2,
  },
  wakeWordMetaValue: {
    fontSize: 12,
    color: '#24312d',
    fontWeight: '800',
  },
  wakeWordHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#8c645d',
    lineHeight: 18,
  },
  expandPrimaryActionWrap: {
    marginTop: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  secondaryActionButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#d5d9e0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  secondaryActionButtonText: {
    color: '#355070',
    fontSize: 13,
    fontWeight: '600',
  },
  shareButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#244f45',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  summaryCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ece8e1',
    shadowColor: '#21160e',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  summaryWaveStrip: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#faf9f7',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  summaryWaveAccent: {
    width: 2,
    height: '100%',
    backgroundColor: '#d47a62',
    marginLeft: '52%',
  },
  summarySegmentedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  summarySegment: {
    backgroundColor: '#f1f1ef',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  summarySegmentActive: {
    backgroundColor: '#ddd9d2',
  },
  summarySegmentText: {
    fontSize: 13,
    color: '#6d6a64',
    fontWeight: '600',
  },
  summarySegmentTextActive: {
    color: '#212227',
  },
  summaryIconButton: {
    backgroundColor: '#faf9f7',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ece8e1',
  },
  summaryIconButtonText: {
    fontSize: 12,
    color: '#5e6168',
    fontWeight: '700',
  },
  summaryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#18191d',
  },
  summaryCardMeta: {
    fontSize: 12,
    color: '#8d8882',
    fontWeight: '600',
  },
  summaryHeadline: {
    fontSize: 24,
    fontWeight: '800',
    color: '#16171b',
    marginBottom: 10,
  },
  summaryCardText: {
    fontSize: 13,
    color: '#55585f',
    marginTop: 4,
  },
  summaryCardDetail: {
    fontSize: 12,
    color: '#8d8882',
    marginTop: 8,
  },
  workspaceGrid: {
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 10,
  },
  workspaceCard: {
    backgroundColor: '#fffdf8',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ece8e1',
  },
  workspaceLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#8f7d6a',
    marginBottom: 8,
  },
  workspaceTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1d2127',
    marginBottom: 8,
  },
  workspaceBody: {
    fontSize: 13,
    lineHeight: 20,
    color: '#55585f',
  },
  summaryTranscriptPreview: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 20,
    color: '#42454c',
    backgroundColor: '#faf9f7',
    borderRadius: 16,
    padding: 14,
  },
  diagnosticsCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ece8e1',
  },
  diagnosticsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#43464d',
    marginBottom: 6,
  },
  diagnosticsText: {
    fontSize: 13,
    color: '#72767e',
    lineHeight: 19,
  },
  emptyActionCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ece8e1',
  },
  emptyActionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6f5730',
    marginBottom: 6,
  },
  emptyActionText: {
    fontSize: 13,
    color: '#7d6a4c',
    lineHeight: 19,
  },
  emptyActionButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#244f45',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 10,
  },
  emptyActionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterChip: {
    backgroundColor: '#efebe5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  filterChipActive: {
    backgroundColor: '#1c2e2a',
  },
  filterChipText: {
    color: '#6f6354',
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  detailScreen: {
    flex: 1,
    backgroundColor: '#f4f2ee',
  },
  detailHeader: {
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e9e5de',
    backgroundColor: '#fdfcf9',
  },
  detailBackButton: {
    backgroundColor: '#1c2e2a',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  detailBackButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  detailHeaderSpacer: {
    width: 52,
  },
  detailGhostButton: {
    backgroundColor: '#f3ece4',
    borderWidth: 1,
    borderColor: '#e5d5c8',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  detailGhostButtonText: {
    color: '#8a5c49',
    fontSize: 13,
    fontWeight: '700',
  },
  detailScroll: {
    flex: 1,
  },
  detailContent: {
    paddingTop: 18,
    paddingBottom: 30,
  },
  detailHeroCard: {
    marginHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#ece8e1',
  },
  detailEyebrow: {
    color: '#86827a',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  detailTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#16171b',
  },
  detailHeroTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailMeta: {
    marginTop: 8,
    color: '#7a766f',
    fontSize: 13,
  },
  detailFollowUpIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3eee5',
    borderWidth: 1,
    borderColor: '#e7ddcf',
  },
  detailFollowUpIconButtonActive: {
    backgroundColor: '#1c2e2a',
    borderColor: '#1c2e2a',
  },
  detailFollowUpIcon: {
    fontSize: 18,
    color: '#8c7254',
    fontWeight: '800',
  },
  detailFollowUpIconActive: {
    color: '#f6efe3',
  },
  detailFollowUpHint: {
    marginTop: 8,
    color: '#7a766f',
    fontSize: 12,
  },
  detailScheduleChip: {
    marginTop: 14,
    backgroundColor: '#faf7f2',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#ece2d5',
  },
  detailScheduleTitle: {
    color: '#20242a',
    fontSize: 14,
    fontWeight: '800',
  },
  detailScheduleMeta: {
    marginTop: 4,
    color: '#7c7871',
    fontSize: 12,
    lineHeight: 18,
  },
  detailTagRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailTagChip: {
    backgroundColor: '#eef3f1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  detailTagChipText: {
    color: '#35524a',
    fontSize: 12,
    fontWeight: '700',
  },
  detailPlayerCard: {
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ece8e1',
  },
  detailPlayerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailPlayerLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#43464d',
  },
  detailPlayerDuration: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8a857e',
  },
  detailPlayerWave: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#faf9f7',
    justifyContent: 'center',
    marginBottom: 14,
    overflow: 'hidden',
  },
  detailPlayerWaveAccent: {
    width: 2,
    height: '100%',
    backgroundColor: '#d47a62',
    marginLeft: '54%',
  },
  detailPlayerButton: {
    backgroundColor: '#1c2e2a',
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
  },
  detailPlayerButtonActive: {
    backgroundColor: '#f3ece4',
    borderWidth: 1,
    borderColor: '#e5d5c8',
  },
  detailPlayerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  detailPlayerButtonTextActive: {
    color: '#9a5f4b',
  },
  topicExpandSection: {
    marginTop: 12,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  topicExpandButton: {
    backgroundColor: '#1c2e2a',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  topicExpandButtonTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  topicExpandButtonMeta: {
    color: '#d6ddd8',
    fontSize: 13,
    lineHeight: 19,
  },
  topicDetailFilterRow: {
    marginTop: 2,
  },
  detailTabRow: {
    marginTop: 12,
    marginHorizontal: 16,
    flexDirection: 'row',
    gap: 8,
  },
  inlineExpandEntry: {
    marginTop: 12,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e8decf',
    backgroundColor: '#fffdf8',
  },
  inlineExpandEntryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  inlineExpandEntryTitle: {
    color: '#20242a',
    fontSize: 15,
    fontWeight: '800',
  },
  inlineExpandEntryArrow: {
    color: '#6f756f',
    fontSize: 20,
    fontWeight: '700',
  },
  inlineExpandEntryText: {
    color: '#6d736d',
    fontSize: 13,
    lineHeight: 19,
  },
  detailUtilityRow: {
    marginTop: 10,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  detailUtilityButton: {
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#e8decf',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
  },
  detailUtilityButtonText: {
    color: '#465061',
    fontSize: 13,
    fontWeight: '700',
  },
  detailUtilityMetaChip: {
    backgroundColor: '#eee8de',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
  },
  detailUtilityMetaText: {
    color: '#7c6d5b',
    fontSize: 12,
    fontWeight: '700',
  },
  insightOverviewMetaRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailTagInput: {
    backgroundColor: '#faf9f7',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ebe4d8',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#30343b',
  },
  detailTranscriptEditor: {
    minHeight: 160,
  },
  detailCommentInput: {
    minHeight: 108,
  },
  detailTagSuggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  detailTagSuggestionChip: {
    backgroundColor: '#eef3f1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  detailTagSuggestionText: {
    color: '#35524a',
    fontSize: 12,
    fontWeight: '700',
  },
  detailTagEditorActions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  detailActionFilterRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  detailFilterChip: {
    backgroundColor: '#f1ece4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  detailFilterChipActive: {
    backgroundColor: '#1c2e2a',
  },
  detailFilterChipText: {
    color: '#7c6d5b',
    fontSize: 12,
    fontWeight: '700',
  },
  detailFilterChipTextActive: {
    color: '#ffffff',
  },
  detailTab: {
    backgroundColor: '#efebe5',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  detailTabActive: {
    backgroundColor: '#1c2e2a',
  },
  detailTabText: {
    color: '#6f6354',
    fontSize: 13,
    fontWeight: '700',
  },
  detailTabTextActive: {
    color: '#fff',
  },
  detailCard: {
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#ece8e1',
  },
  detailCardSelected: {
    borderColor: '#244f45',
    backgroundColor: '#f7fbf9',
  },
  detailCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  detailInlineAction: {
    backgroundColor: '#eef3f1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  detailInlineActionText: {
    color: '#35524a',
    fontSize: 12,
    fontWeight: '700',
  },
  detailSummaryStack: {
    gap: 12,
  },
  detailSummaryList: {
    gap: 10,
  },
  detailSummaryItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  detailSummaryBullet: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#d47a62',
    marginTop: 7,
    flexShrink: 0,
  },
  detailTranscriptStack: {
    gap: 12,
  },
  detailTranscriptParagraph: {
    fontSize: 14,
    lineHeight: 23,
    color: '#4d5057',
    backgroundColor: '#faf9f7',
    borderRadius: 14,
    padding: 14,
  },
  detailCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#202227',
    marginBottom: 10,
  },
  detailBodyText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4d5057',
  },
  detailCommentList: {
    gap: 10,
    marginBottom: 12,
  },
  detailCommentItem: {
    backgroundColor: '#faf9f7',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ece8e1',
  },
  detailCommentMeta: {
    color: '#8a857e',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  bottomNav: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    backgroundColor: 'rgba(25, 30, 33, 0.96)',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#15181b',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  bottomNavItemCenter: {
    flex: 1.2,
  },
  iconHomeWrap: {
    width: 24,
    height: 18,
    alignItems: 'center',
  },
  iconHomeRoof: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginBottom: 1,
  },
  iconHomeBody: {
    width: 14,
    height: 9,
    borderWidth: 2,
    borderTopWidth: 0,
    borderRadius: 2,
  },
  iconCaptureRing: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCaptureDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  iconArchiveBox: {
    width: 22,
    height: 18,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 3,
  },
  iconArchiveLid: {
    position: 'absolute',
    top: 2,
    width: 14,
    height: 2.5,
    borderRadius: 999,
  },
  iconArchiveSlot: {
    marginTop: 7,
    width: 8,
    height: 2.5,
    borderRadius: 999,
  },
  iconTopicsWrap: {
    width: 22,
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconTopicsDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  iconInsightsWrap: {
    width: 22,
    height: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  iconInsightsBar: {
    width: 4,
    borderRadius: 999,
  },
  iconMemosWrap: {
    width: 22,
    height: 18,
    justifyContent: 'space-between',
  },
  iconMemosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconMemosDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
  },
  iconMemosLine: {
    flex: 1,
    height: 2.5,
    borderRadius: 999,
  },
  bottomNavIndicator: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  bottomNavIndicatorActive: {
    backgroundColor: '#f2efe8',
  },
});
