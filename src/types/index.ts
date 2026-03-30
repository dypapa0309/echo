export interface VoiceMemo {
  id: string;
  transcript?: string;
  audioUri: string;
  timestamp: number;
  duration: number;
  title?: string;
  summary?: string;
  tags?: string[];
  searchIndex?: string;
  isFollowUp?: boolean;
  actionItems?: ActionItem[];
  confidence?: number;
  context?: RecordingContext;
  comments?: MemoComment[];
}

export interface MemoComment {
  id: string;
  text: string;
  createdAt: number;
}

export interface ActionItem {
  id: string;
  type: 'RESEARCH' | 'REVIEW' | 'WRITE' | 'FIX' | 'COORDINATE' | 'PLAN' | 'FOLLOW_UP' | 'OTHER';
  task: string;
  assignee?: string;
  deadline?: number;
  confidence: number;
  context?: string;
  completed?: boolean;
}

export interface ActionItemExtractionResult {
  actionItems: ActionItem[];
  keyDecisions: string[];
  issues: string[];
  confidence: number;
}

export interface RecordingContext {
  location?: {
    latitude: number;
    longitude: number;
    placeName?: string;
  };
  calendarEvent?: {
    id: string;
    title: string;
    startDate: number;
    endDate: number;
  };
}

export interface RecordingState {
  isRecording: boolean;
  isPaying: boolean;
  currentRecordingUri?: string;
}

export type PlanTier = 'free' | 'pro';

export interface BillingProfile {
  tier: PlanTier;
  firstMemoAt?: number;
  expansionSaveCount: number;
  upgradeDismissedAt?: number;
}

export interface UpgradeRecommendation {
  shouldPrompt: boolean;
  headline: string;
  detail: string;
}
