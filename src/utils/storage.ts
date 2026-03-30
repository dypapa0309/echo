import AsyncStorage from '@react-native-async-storage/async-storage';
import { VoiceMemo } from '../types';

const LEGACY_STORAGE_KEY = 'voice_memos';
const MEMO_INDEX_KEY = 'voice_memo_index';
const MEMO_KEY_PREFIX = 'voice_memo:';
const SAVE_RETRY_LIMIT = 1;

const getMemoStorageKey = (id: string): string => `${MEMO_KEY_PREFIX}${id}`;

const normalizeSearchText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export const buildMemoSearchIndex = (memo: Partial<VoiceMemo>): string =>
  normalizeSearchText(
    [
      memo.title ?? '',
      memo.summary ?? '',
      memo.transcript ?? '',
      ...(memo.comments ?? []).map(comment => comment.text),
      ...(memo.tags ?? []),
    ].join(' ')
  );

export const memoMatchesQuery = (memo: VoiceMemo, query: string): boolean => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return true;
  }

  const searchIndex = memo.searchIndex ?? buildMemoSearchIndex(memo);
  return searchIndex.includes(normalizedQuery);
};

const hydrateMemoSearchIndex = (memo: VoiceMemo): VoiceMemo => ({
  ...memo,
  searchIndex: buildMemoSearchIndex(memo),
});

const isValidMemo = (value: unknown): value is VoiceMemo => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const memo = value as Partial<VoiceMemo>;
  return (
    typeof memo.id === 'string' &&
    typeof memo.audioUri === 'string' &&
    typeof memo.timestamp === 'number' &&
    typeof memo.duration === 'number'
  );
};

const parseMemoArray = (rawValue: string | null): VoiceMemo[] => {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isValidMemo);
  } catch (error) {
    console.error('Failed to parse stored memos:', error);
    return [];
  }
};

const parseMemoIndex = (rawValue: string | null): string[] => {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((id): id is string => typeof id === 'string');
  } catch (error) {
    console.error('Failed to parse memo index:', error);
    return [];
  }
};

const persistValue = async (key: string, value: string, attempt = 0): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    if (attempt < SAVE_RETRY_LIMIT) {
      await persistValue(key, value, attempt + 1);
      return;
    }

    console.error(`Failed to persist key "${key}":`, error);
    throw error;
  }
};

const persistMemoIndex = async (ids: string[]): Promise<void> => {
  await persistValue(MEMO_INDEX_KEY, JSON.stringify(ids));
};

const persistMemo = async (memo: VoiceMemo): Promise<void> => {
  await persistValue(
    getMemoStorageKey(memo.id),
    JSON.stringify(hydrateMemoSearchIndex(memo))
  );
};

const loadMemoIndex = async (): Promise<string[]> => {
  const rawIndex = await AsyncStorage.getItem(MEMO_INDEX_KEY);
  return parseMemoIndex(rawIndex);
};

const loadMemosByIds = async (ids: string[]): Promise<VoiceMemo[]> => {
  if (ids.length === 0) {
    return [];
  }

  const entries = await AsyncStorage.multiGet(ids.map(getMemoStorageKey));
  const validMemos: VoiceMemo[] = [];
  const validIds: string[] = [];

  entries.forEach(([key, rawValue], idx) => {
    if (!rawValue) {
      return;
    }

    try {
      const parsed = JSON.parse(rawValue);
      if (isValidMemo(parsed)) {
        validMemos.push(hydrateMemoSearchIndex(parsed));
        validIds.push(ids[idx]);
      }
    } catch (error) {
      console.error(`Failed to parse memo "${key}":`, error);
    }
  });

  if (validIds.length !== ids.length) {
    await persistMemoIndex(validIds);
  }

  return validMemos;
};

const migrateLegacyStorageIfNeeded = async (): Promise<void> => {
  const existingIndex = await loadMemoIndex();
  if (existingIndex.length > 0) {
    return;
  }

  const legacyRaw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  const legacyMemos = parseMemoArray(legacyRaw);

  if (legacyMemos.length === 0) {
    return;
  }

  await AsyncStorage.multiSet(
    legacyMemos.map(memo => [
      getMemoStorageKey(memo.id),
      JSON.stringify(hydrateMemoSearchIndex(memo)),
    ])
  );
  await persistMemoIndex(legacyMemos.map(memo => memo.id));
  await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
};

const ensureValidMemo = (memo: VoiceMemo): void => {
  if (!isValidMemo(memo)) {
    throw new Error('Invalid memo payload');
  }
};

export const storageUtils = {
  saveMemo: async (memo: VoiceMemo): Promise<void> => {
    try {
      ensureValidMemo(memo);
      await migrateLegacyStorageIfNeeded();

      const existingIds = await loadMemoIndex();
      const nextIds = existingIds.includes(memo.id)
        ? existingIds
        : [...existingIds, memo.id];

      await persistMemo(memo);
      await persistMemoIndex(nextIds);
    } catch (error) {
      console.error('Failed to save memo:', error);
      throw error;
    }
  },

  getAllMemos: async (): Promise<VoiceMemo[]> => {
    try {
      await migrateLegacyStorageIfNeeded();
      const ids = await loadMemoIndex();
      return await loadMemosByIds(ids);
    } catch (error) {
      console.error('Failed to get memos:', error);
      return [];
    }
  },

  deleteMemo: async (id: string): Promise<void> => {
    try {
      await migrateLegacyStorageIfNeeded();
      const ids = await loadMemoIndex();
      const nextIds = ids.filter(existingId => existingId !== id);

      await AsyncStorage.removeItem(getMemoStorageKey(id));
      await persistMemoIndex(nextIds);
    } catch (error) {
      console.error('Failed to delete memo:', error);
      throw error;
    }
  },

  searchMemos: async (query: string): Promise<VoiceMemo[]> => {
    try {
      const memos = await storageUtils.getAllMemos();
      return memos.filter(memo => memoMatchesQuery(memo, query));
    } catch (error) {
      console.error('Failed to search memos:', error);
      return [];
    }
  },

  updateMemo: async (id: string, updates: Partial<VoiceMemo>): Promise<void> => {
    try {
      await migrateLegacyStorageIfNeeded();

      const currentMemoRaw = await AsyncStorage.getItem(getMemoStorageKey(id));
      if (!currentMemoRaw) {
        throw new Error('Memo not found');
      }

      const currentMemo = JSON.parse(currentMemoRaw) as VoiceMemo;
      const nextMemo = { ...currentMemo, ...updates };

      ensureValidMemo(nextMemo);
      await persistMemo(nextMemo);
    } catch (error) {
      console.error('Failed to update memo:', error);
      throw error;
    }
  },
};
