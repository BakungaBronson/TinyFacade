import React, {useCallback} from 'react';
import {
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {ChatSession} from '../types/session';

type Props = {
  sessions: ChatSession[];
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
};

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) {
    const mins = Math.floor(diffMs / (1000 * 60));
    return `${mins}m ago`;
  }
  if (diffHours < 24) {
    return `${Math.floor(diffHours)}h ago`;
  }
  if (diffHours < 48) {
    return 'Yesterday';
  }
  return date.toLocaleDateString();
}

function getPreview(session: ChatSession): string {
  const lastMsg = [...session.messages]
    .reverse()
    .find(m => m.role === 'assistant' && m.text);
  if (lastMsg) {
    return lastMsg.text.slice(0, 80) + (lastMsg.text.length > 80 ? '...' : '');
  }
  return 'No messages yet';
}

export function ChatListScreen({
  sessions,
  onSelectSession,
  onNewChat,
  onDeleteSession,
}: Props) {
  const handleLongPress = useCallback(
    (session: ChatSession) => {
      Alert.alert('Delete Chat', `Delete "${session.title}"?`, [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDeleteSession(session.id),
        },
      ]);
    },
    [onDeleteSession],
  );

  const renderItem = useCallback(
    ({item}: {item: ChatSession}) => (
      <TouchableOpacity
        style={styles.sessionItem}
        onPress={() => onSelectSession(item.id)}
        onLongPress={() => handleLongPress(item)}>
        <View style={styles.sessionHeader}>
          <Text style={styles.sessionTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.sessionTime}>{formatTime(item.updatedAt)}</Text>
        </View>
        <Text style={styles.sessionModel} numberOfLines={1}>
          {item.modelName}
        </Text>
        <Text style={styles.sessionPreview} numberOfLines={2}>
          {getPreview(item)}
        </Text>
      </TouchableOpacity>
    ),
    [onSelectSession, handleLongPress],
  );

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#111"
        translucent={false}
      />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <TouchableOpacity style={styles.newChatBtn} onPress={onNewChat}>
          <Text style={styles.newChatText}>+ New</Text>
        </TouchableOpacity>
      </View>
      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No chats yet</Text>
          <Text style={styles.emptySubtext}>
            Tap "+ New" to start a conversation
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  newChatBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newChatText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  sessionItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  sessionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  sessionTime: {
    color: '#666',
    fontSize: 12,
  },
  sessionModel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  sessionPreview: {
    color: '#777',
    fontSize: 13,
    lineHeight: 18,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#555',
    fontSize: 14,
  },
});
