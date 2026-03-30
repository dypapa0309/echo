import { memo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  FlatList,
  Platform,
} from 'react-native';
import { VoiceMemo } from '../types/index';

interface MemoListComponentProps {
  memos: VoiceMemo[];
  language?: 'ko' | 'en';
  onSelectMemo?: (memo: VoiceMemo) => void;
  onRenameMemo?: (memo: VoiceMemo, nextTitle: string) => void;
  onDeleteMemo?: (memo: VoiceMemo) => void;
  scrollEnabled?: boolean;
  theme?: 'light' | 'dark';
}

export const MemoListComponent = ({
  memos,
  language = 'ko',
  onSelectMemo,
  onRenameMemo,
  onDeleteMemo,
  scrollEnabled = true,
  theme = 'light',
}: MemoListComponentProps) => {
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <FlatList
      data={memos}
      keyExtractor={(item: VoiceMemo) => item.id}
      renderItem={({ item }: { item: VoiceMemo }) => (
        <MemoListItem
          item={item}
          language={language}
          theme={theme}
          onSelect={onSelectMemo}
          onRename={onRenameMemo}
          onDelete={onDeleteMemo}
          formatDate={formatDate}
          formatDuration={formatDuration}
        />
      )}
      style={[styles.list, !scrollEnabled && styles.listStatic]}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      removeClippedSubviews={scrollEnabled}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={5}
      scrollEnabled={scrollEnabled}
    />
  );
};

const TrashIcon = ({ color }: { color: string }) => (
  <View style={styles.trashIconWrap}>
    <View style={[styles.trashIconHandle, { backgroundColor: color }]} />
    <View style={[styles.trashIconLid, { backgroundColor: color }]} />
    <View style={[styles.trashIconBody, { borderColor: color }]}>
      <View style={[styles.trashIconLine, { backgroundColor: color }]} />
      <View style={[styles.trashIconLine, { backgroundColor: color }]} />
    </View>
  </View>
);

interface MemoListItemProps {
  item: VoiceMemo;
  language: 'ko' | 'en';
  theme: 'light' | 'dark';
  onSelect?: (memo: VoiceMemo) => void;
  onRename?: (memo: VoiceMemo, nextTitle: string) => void;
  onDelete?: (memo: VoiceMemo) => void;
  formatDate: (timestamp: number) => string;
  formatDuration: (seconds: number) => string;
}

const MemoListItem = memo(({
  item,
  language,
  theme,
  onSelect,
  onRename,
  onDelete,
  formatDate,
  formatDuration,
}: MemoListItemProps) => {
  const isDark = theme === 'dark';
  const handleRename = () => {
    if (!onRename) {
      return;
    }

    if (Platform.OS === 'ios' && Alert.prompt) {
      Alert.prompt(
        language === 'ko' ? '이름 바꾸기' : 'Rename',
        language === 'ko' ? '메모 이름을 더 알아보기 쉽게 바꿔보세요.' : 'Give this memo a clearer name.',
        [
          { text: language === 'ko' ? '취소' : 'Cancel', style: 'cancel' },
          {
            text: language === 'ko' ? '저장' : 'Save',
            onPress: value => {
              const nextTitle = value?.trim();
              if (nextTitle) {
                onRename(item, nextTitle);
              }
            },
          },
        ],
        'plain-text',
        item.title || ''
      );
      return;
    }

    Alert.alert(
      language === 'ko' ? '이름 바꾸기' : 'Rename',
      language === 'ko'
        ? '현재는 iOS에서 바로 이름 바꾸기를 지원합니다.'
        : 'Inline rename is currently supported on iOS.'
    );
  };

  return (
    <TouchableOpacity
      style={[styles.memoItem, isDark && styles.memoItemDark]}
      activeOpacity={0.9}
      onPress={() => onSelect?.(item)}
    >
      <View style={styles.memoContent}>
        <View style={styles.memoTitleRow}>
          <Text style={[styles.memoTitle, isDark && styles.memoTitleDark]}>{item.title || (language === 'ko' ? '메모' : 'Memo')}</Text>
          <View style={styles.memoTitleActions}>
            <TouchableOpacity
              style={[styles.renameIconButton, isDark && styles.quickActionButtonDark]}
              onPress={event => {
                event.stopPropagation();
                handleRename();
              }}
            >
              <Text style={[styles.renameIconText, isDark && styles.quickActionButtonTextDark]}>✎</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.renameIconButton, isDark && styles.quickActionButtonDark]}
              onPress={event => {
                event.stopPropagation();
                onDelete?.(item);
              }}
            >
              <TrashIcon color={isDark ? '#d6d0c7' : '#61584f'} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[styles.memoText, isDark && styles.memoTextDark]} numberOfLines={2}>
          {item.transcript || (language === 'ko' ? '기록 내용 없음' : 'No notes yet')}
        </Text>
        <Text style={[styles.memoMeta, isDark && styles.memoMetaDark]}>
          {formatDate(item.timestamp)} • {formatDuration(item.duration)}
        </Text>

        {!!item.tags?.length && (
          <View style={styles.tagRow}>
            {item.tags.slice(0, 2).map(tag => (
              <View key={`${item.id}-${tag}`} style={[styles.tagChip, isDark && styles.tagChipDark]}>
                <Text style={[styles.tagChipText, isDark && styles.tagChipTextDark]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

    </TouchableOpacity>
  );
});

MemoListItem.displayName = 'MemoListItem';

const styles = StyleSheet.create({
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listStatic: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
  },
  memoItem: {
    backgroundColor: '#fffdf8',
    padding: 14,
    borderRadius: 18,
    marginVertical: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8dfd2',
    elevation: 2,
    shadowColor: '#2f2315',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  memoItemDark: {
    backgroundColor: '#1f2428',
    borderColor: '#31373d',
    shadowColor: '#000000',
  },
  memoContent: {
    flex: 1,
    marginRight: 10,
  },
  memoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  memoTitleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2a2e37',
    flex: 1,
  },
  memoTitleDark: {
    color: '#f2efe8',
  },
  memoBadge: {
    backgroundColor: '#efe6da',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  memoBadgeDark: {
    backgroundColor: '#313840',
  },
  memoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#776755',
  },
  memoBadgeTextDark: {
    color: '#d8c9b5',
  },
  memoText: {
    fontSize: 14,
    color: '#655a4f',
    marginBottom: 6,
    lineHeight: 19,
  },
  memoTextDark: {
    color: '#c7c1b8',
  },
  memoMeta: {
    fontSize: 12,
    color: '#9a8d7e',
  },
  memoMetaDark: {
    color: '#989086',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tagChip: {
    backgroundColor: '#f3efe8',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  tagChipDark: {
    backgroundColor: '#2a3036',
  },
  tagChipText: {
    color: '#72685b',
    fontSize: 11,
    fontWeight: '700',
  },
  tagChipTextDark: {
    color: '#c9c2b6',
  },
  quickActionButton: {
    backgroundColor: '#f6f1e8',
    borderWidth: 1,
    borderColor: '#e8dfd2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  quickActionButtonDark: {
    backgroundColor: '#252b30',
    borderColor: '#353d45',
  },
  quickActionButtonText: {
    color: '#61584f',
    fontSize: 12,
    fontWeight: '700',
  },
  quickActionButtonTextDark: {
    color: '#d6d0c7',
  },
  renameIconButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f1e8',
    borderWidth: 1,
    borderColor: '#e8dfd2',
  },
  renameIconText: {
    color: '#61584f',
    fontSize: 14,
    fontWeight: '800',
  },
  trashIconWrap: {
    width: 14,
    height: 16,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  trashIconHandle: {
    width: 4,
    height: 2,
    borderRadius: 999,
    marginBottom: 1,
  },
  trashIconLid: {
    width: 10,
    height: 2,
    borderRadius: 999,
    marginBottom: 1,
  },
  trashIconBody: {
    width: 11,
    height: 9,
    borderWidth: 1.4,
    borderTopWidth: 1.8,
    borderRadius: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  trashIconLine: {
    width: 1.3,
    height: 5,
    borderRadius: 999,
  },
  separator: {
    height: 6,
  },
});
