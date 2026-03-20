import React, {useCallback, useRef, useState} from 'react';
import {ChatScreen} from '../components/ChatScreen';
import {ChatListScreen} from '../components/ChatListScreen';
import {useChatSessions} from '../hooks/useChatSessions';
import {ActivityIndicator, StyleSheet, View} from 'react-native';

type Screen =
  | {type: 'list'}
  | {type: 'chat'; sessionId: string};

export function AppNavigator() {
  const {
    sessions,
    loading,
    createSession,
    updateSessionMessages,
    flushPendingSave,
    deleteSession,
    getSession,
  } = useChatSessions();

  const [currentScreen, setCurrentScreen] = useState<Screen>({type: 'list'});
  const activeSessionIdRef = useRef<string | null>(null);

  const handleNewChat = useCallback(async () => {
    activeSessionIdRef.current = null;
    setCurrentScreen({type: 'chat', sessionId: '__new__'});
  }, []);

  const handleSelectSession = useCallback((sessionId: string) => {
    setCurrentScreen({type: 'chat', sessionId});
  }, []);

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      await deleteSession(sessionId);
    },
    [deleteSession],
  );

  const handleBack = useCallback(async () => {
    await flushPendingSave();
    setCurrentScreen({type: 'list'});
  }, [flushPendingSave]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (currentScreen.type === 'list') {
    return (
      <ChatListScreen
        sessions={sessions.filter(s => !s.archived)}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
      />
    );
  }

  const isNew = currentScreen.sessionId === '__new__';
  const session = !isNew ? getSession(currentScreen.sessionId) : undefined;

  // Keep the ref in sync for existing sessions
  if (session) {
    activeSessionIdRef.current = session.id;
  }

  return (
    <ChatScreen
      sessionId={currentScreen.sessionId}
      initialMessages={session?.messages}
      onMessagesChanged={(messages) => {
        const sid = activeSessionIdRef.current;
        if (sid) {
          updateSessionMessages(sid, messages);
        }
      }}
      onBack={handleBack}
      onSessionCreated={async (modelPath, modelName, messages) => {
        const newSession = await createSession(modelPath, modelName);
        activeSessionIdRef.current = newSession.id;
        if (messages.length > 0) {
          updateSessionMessages(newSession.id, messages);
        }
        setCurrentScreen({type: 'chat', sessionId: newSession.id});
      }}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
});
