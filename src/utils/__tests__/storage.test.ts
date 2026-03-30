jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorageMock from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import { buildMemoSearchIndex, memoMatchesQuery, storageUtils } from '../storage';
import { VoiceMemo } from '../../types';

const validMemo: VoiceMemo = {
  id: 'memo-1',
  audioUri: 'file://memo-1.m4a',
  timestamp: 1710000000000,
  duration: 42,
  transcript: '테스트 메모',
  title: '테스트',
};

describe('storageUtils', () => {
  beforeEach(async () => {
    await AsyncStorageMock.clear();
    jest.restoreAllMocks();
  });

  it('saves and loads a valid memo', async () => {
    await storageUtils.saveMemo(validMemo);

    const memos = await storageUtils.getAllMemos();
    const memoIndex = await AsyncStorageMock.getItem('voice_memo_index');
    const memoPayload = await AsyncStorageMock.getItem('voice_memo:memo-1');

    expect(memos).toHaveLength(1);
    expect(memos[0]).toMatchObject(validMemo);
    expect(memos[0].searchIndex).toBe(buildMemoSearchIndex(validMemo));
    expect(memoIndex).toBe(JSON.stringify(['memo-1']));
    expect(JSON.parse(memoPayload as string)).toMatchObject(validMemo);
  });

  it('migrates legacy array storage into index and payload entries', async () => {
    await AsyncStorageMock.setItem(
      'voice_memos',
      JSON.stringify([
        validMemo,
        { id: 'broken', timestamp: 'oops' },
      ])
    );

    const memos = await storageUtils.getAllMemos();
    const memoIndex = await AsyncStorageMock.getItem('voice_memo_index');
    const legacyValue = await AsyncStorageMock.getItem('voice_memos');

    expect(memos).toHaveLength(1);
    expect(memos[0]).toMatchObject(validMemo);
    expect(memoIndex).toBe(JSON.stringify(['memo-1']));
    expect(legacyValue).toBeNull();
  });

  it('rejects invalid memo payloads on save', async () => {
    await expect(
      storageUtils.saveMemo({
        id: 'broken',
        audioUri: 'file://broken.m4a',
      } as VoiceMemo)
    ).rejects.toThrow('Invalid memo payload');
  });

  it('updates a memo without rewriting the whole collection shape', async () => {
    await storageUtils.saveMemo(validMemo);
    await storageUtils.updateMemo('memo-1', {
      title: '업데이트된 제목',
    });

    const memos = await storageUtils.getAllMemos();
    const memoIndex = await AsyncStorageMock.getItem('voice_memo_index');

    expect(memos[0].title).toBe('업데이트된 제목');
    expect(memoIndex).toBe(JSON.stringify(['memo-1']));
  });

  it('searches across title, summary, transcript, and tags', async () => {
    await storageUtils.saveMemo({
      ...validMemo,
      summary: 'Echo 프로젝트 회고',
      tags: ['Echo', '출시 준비'],
    });

    await expect(storageUtils.searchMemos('출시')).resolves.toHaveLength(1);
    await expect(storageUtils.searchMemos('echo')).resolves.toHaveLength(1);
  });

  it('hydrates a reusable search index for saved memos', async () => {
    await storageUtils.saveMemo({
      ...validMemo,
      summary: '다크 모드 정리',
      tags: ['UI', 'Theme'],
    });

    const memos = await storageUtils.getAllMemos();

    expect(memos[0].searchIndex).toBe(buildMemoSearchIndex(memos[0]));
    expect(memoMatchesQuery(memos[0], 'theme')).toBe(true);
    expect(memoMatchesQuery(memos[0], '없는 단어')).toBe(false);
  });
});
