import { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { ActionItem } from '../types/index';

interface ActionItemsDisplayProps {
  actionItems: ActionItem[];
  onToggleComplete?: (id: string) => void;
  onSaveItem?: (id: string, updates: Partial<ActionItem>) => void;
  onAddItem?: () => void;
  theme?: 'light' | 'dark';
}

const getTaskTypeColor = (taskType: string): string => {
  const colors: Record<string, string> = {
    RESEARCH: '#007AFF',
    REVIEW: '#5AC8FA',
    WRITE: '#4CD964',
    FIX: '#FF3B30',
    COORDINATE: '#FF9500',
    PLAN: '#5856D6',
    FOLLOW_UP: '#34C759',
    OTHER: '#8E8E93',
  };
  return colors[taskType] || '#8E8E93';
};

const getTaskTypeLabel = (taskType: string): string => {
  const labels: Record<string, string> = {
    RESEARCH: '조사',
    REVIEW: '검토',
    WRITE: '작성',
    FIX: '수정',
    COORDINATE: '조정',
    PLAN: '계획',
    FOLLOW_UP: '보고',
    OTHER: '기타',
  };
  return labels[taskType] || '기타';
};

const formatDeadlineInput = (deadline?: number): string => {
  if (!deadline) {
    return '';
  }

  const date = new Date(deadline);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDeadlineInput = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return parsed;
};

const ActionItemCard = ({
  item,
  onToggleComplete,
  onSaveItem,
  theme = 'light',
}: {
  item: ActionItem;
  onToggleComplete?: (id: string) => void;
  onSaveItem?: (id: string, updates: Partial<ActionItem>) => void;
  theme?: 'light' | 'dark';
}) => {
  const isDark = theme === 'dark';
  const [isEditing, setIsEditing] = useState(false);
  const [draftTask, setDraftTask] = useState(item.task);
  const [draftAssignee, setDraftAssignee] = useState(item.assignee ?? '');
  const [draftDeadline, setDraftDeadline] = useState(formatDeadlineInput(item.deadline));

  const deadlineStr = item.deadline
    ? new Date(item.deadline).toLocaleDateString('ko-KR')
    : '미정';

  const taskTypeColor = getTaskTypeColor(item.type);
  const taskTypeLabel = getTaskTypeLabel(item.type);

  const resetDrafts = () => {
    setDraftTask(item.task);
    setDraftAssignee(item.assignee ?? '');
    setDraftDeadline(formatDeadlineInput(item.deadline));
  };

  const handleSave = () => {
    const nextTask = draftTask.trim();
    if (!nextTask) {
      return;
    }

    onSaveItem?.(item.id, {
      task: nextTask,
      assignee: draftAssignee.trim() || undefined,
      deadline: parseDeadlineInput(draftDeadline),
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    resetDrafts();
    setIsEditing(false);
  };

  return (
    <View
      style={[
        styles.card,
        isDark && styles.cardDark,
        { borderLeftColor: taskTypeColor },
        item.completed && styles.cardCompleted,
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <Text style={[styles.taskTypeBadge, { backgroundColor: taskTypeColor }]}>
            {taskTypeLabel}
          </Text>
          <View style={styles.titleBody}>
            {isEditing ? (
              <>
                <TextInput
                  style={[styles.input, isDark && styles.inputDark]}
                  value={draftTask}
                  onChangeText={setDraftTask}
                  placeholder="할 일을 입력하세요"
                />
                <TextInput
                  style={[styles.input, isDark && styles.inputDark]}
                  value={draftAssignee}
                  onChangeText={setDraftAssignee}
                  placeholder="담당자"
                />
                <TextInput
                  style={[styles.input, isDark && styles.inputDark]}
                  value={draftDeadline}
                  onChangeText={setDraftDeadline}
                  placeholder="기한 (YYYY-MM-DD)"
                  autoCapitalize="none"
                />
              </>
            ) : (
              <>
                <Text style={[styles.assignee, isDark && styles.assigneeDark]}>{item.assignee || '담당자 미정'}</Text>
                <Text
                  style={[
                    styles.task,
                    isDark && styles.taskDark,
                    item.completed && styles.completedTask,
                  ]}
                  numberOfLines={3}
                >
                  {item.task}
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[
              styles.completionButton,
              item.completed ? styles.completionButtonDone : styles.completionButtonOpen,
            ]}
            onPress={() => onToggleComplete?.(item.id)}
          >
            <Text
              style={[
                styles.completionButtonText,
                item.completed && styles.completionButtonTextDone,
              ]}
            >
              {item.completed ? '완료' : '진행중'}
            </Text>
          </TouchableOpacity>

          <View
            style={[
              styles.confidenceBadge,
              {
                backgroundColor:
                  item.confidence > 0.8
                    ? '#34C759'
                    : item.confidence > 0.6
                    ? '#FF9500'
                    : '#FF3B30',
              },
            ]}
          >
            <Text style={styles.confidenceText}>
              {(item.confidence * 100).toFixed(0)}%
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.deadline, isDark && styles.deadlineDark]}>기한 {deadlineStr}</Text>
        {isEditing ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.secondaryActionButton, isDark && styles.secondaryActionButtonDark]}
              onPress={handleCancel}
            >
              <Text style={[styles.secondaryActionButtonText, isDark && styles.secondaryActionButtonTextDark]}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryActionButton, isDark && styles.primaryActionButtonDark]} onPress={handleSave}>
              <Text style={styles.primaryActionButtonText}>저장</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.secondaryActionButton, isDark && styles.secondaryActionButtonDark]}
            onPress={() => {
              resetDrafts();
              setIsEditing(true);
            }}
          >
            <Text style={[styles.secondaryActionButtonText, isDark && styles.secondaryActionButtonTextDark]}>수정</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export const ActionItemsDisplay = ({
  actionItems,
  onToggleComplete,
  onSaveItem,
  onAddItem,
  theme = 'light',
}: ActionItemsDisplayProps) => {
  const isDark = theme === 'dark';
  if (!actionItems || actionItems.length === 0) {
    return null;
  }

  const completedCount = actionItems.filter(item => item.completed).length;

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.summaryHeader, isDark && styles.summaryHeaderDark]}>
        <View>
          <Text style={[styles.summaryEyebrow, isDark && styles.summaryEyebrowDark]}>TO DO</Text>
          <Text style={[styles.summaryTitle, isDark && styles.summaryTitleDark]}>해야 할 일</Text>
          <Text style={[styles.summaryStats, isDark && styles.summaryStatsDark]}>
            총 {actionItems.length}개 · 완료 {completedCount}개
          </Text>
        </View>
        {onAddItem ? (
          <TouchableOpacity style={[styles.addButton, isDark && styles.addButtonDark]} onPress={onAddItem}>
            <Text style={styles.addButtonText}>직접 추가</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={actionItems}
        keyExtractor={(item: ActionItem) => item.id}
        renderItem={({ item }: { item: ActionItem }) => (
          <ActionItemCard
            item={item}
            onToggleComplete={onToggleComplete}
            onSaveItem={onSaveItem}
            theme={theme}
          />
        )}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    marginHorizontal: 16,
    backgroundColor: '#fffdf8',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e8decf',
  },
  containerDark: {
    backgroundColor: '#1f2428',
    borderColor: '#31373d',
  },
  summaryHeader: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ede3d7',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  summaryHeaderDark: {
    borderBottomColor: '#343a40',
  },
  summaryEyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
    color: '#907b65',
    marginBottom: 4,
  },
  summaryEyebrowDark: {
    color: '#b59a79',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2f3744',
    marginBottom: 4,
  },
  summaryTitleDark: {
    color: '#f3f1ec',
  },
  summaryStats: {
    fontSize: 13,
    color: '#7f7364',
  },
  summaryStatsDark: {
    color: '#a59c91',
  },
  addButton: {
    backgroundColor: '#244f45',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addButtonDark: {
    backgroundColor: '#314a43',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#f8f3eb',
    borderRadius: 16,
    padding: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#ede2d4',
  },
  cardDark: {
    backgroundColor: '#262c31',
    borderColor: '#394047',
  },
  cardCompleted: {
    opacity: 0.8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  titleSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleBody: {
    flex: 1,
  },
  taskTypeBadge: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    minWidth: 50,
    textAlign: 'center',
  },
  assignee: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3b3f46',
  },
  assigneeDark: {
    color: '#f0ede6',
  },
  task: {
    fontSize: 13,
    color: '#5f574f',
    marginTop: 4,
    lineHeight: 19,
  },
  taskDark: {
    color: '#cfc8be',
  },
  completedTask: {
    textDecorationLine: 'line-through',
    color: '#7b7b7b',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d9d4cb',
    backgroundColor: '#fffdf8',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#223',
    marginBottom: 8,
  },
  inputDark: {
    borderColor: '#3b434b',
    backgroundColor: '#1e2327',
    color: '#ece7df',
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  completionButton: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  completionButtonOpen: {
    borderColor: '#d9d4cb',
    backgroundColor: '#fffdf8',
  },
  completionButtonDone: {
    borderColor: '#9ad0ab',
    backgroundColor: '#edf8ef',
  },
  completionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4c5a67',
  },
  completionButtonTextDone: {
    color: '#1f8a43',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  confidenceText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e8ddcf',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  deadline: {
    fontSize: 12,
    color: '#7a6c5d',
    fontWeight: '500',
    flex: 1,
  },
  deadlineDark: {
    color: '#a39a8e',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryActionButton: {
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#d9d4cb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  secondaryActionButtonDark: {
    backgroundColor: '#23292d',
    borderColor: '#394047',
  },
  secondaryActionButtonText: {
    color: '#355070',
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryActionButtonTextDark: {
    color: '#cad3df',
  },
  primaryActionButton: {
    backgroundColor: '#244f45',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  primaryActionButtonDark: {
    backgroundColor: '#314a43',
  },
  primaryActionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
