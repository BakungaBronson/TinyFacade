import {useCallback, useEffect, useRef, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {ChatMessage} from '../types/chat';
import type {ChatSession} from '../types/session';

const STORAGE_PREFIX = '@tinyfacade/chat/';
const INDEX_KEY = '@tinyfacade/chat_index';
const DEBOUNCE_MS = 2000;

function generateId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function titleFromMessage(message: ChatMessage): string {
  const text = message.text.trim();
  if (text.length <= 40) {
    return text;
  }
  return text.slice(0, 40) + '...';
}

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{sessionId: string; session: ChatSession} | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const indexRaw = await AsyncStorage.getItem(INDEX_KEY);
      if (!indexRaw) {
        setSessions([]);
        setLoading(false);
        return;
      }

      const ids: string[] = JSON.parse(indexRaw);
      const keys = ids.map(id => STORAGE_PREFIX + id);
      const pairs = await AsyncStorage.multiGet(keys);

      const loaded: ChatSession[] = [];
      for (const [, value] of pairs) {
        if (value) {
          try {
            loaded.push(JSON.parse(value));
          } catch {}
        }
      }

      loaded.sort((a, b) => b.updatedAt - a.updatedAt);
      setSessions(loaded);
    } catch (err) {
      console.warn('[ChatSessions] Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const saveSession = useCallback(async (session: ChatSession) => {
    try {
      await AsyncStorage.setItem(
        STORAGE_PREFIX + session.id,
        JSON.stringify(session),
      );
      // Update index
      const indexRaw = await AsyncStorage.getItem(INDEX_KEY);
      const ids: string[] = indexRaw ? JSON.parse(indexRaw) : [];
      if (!ids.includes(session.id)) {
        ids.push(session.id);
        await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(ids));
      }
      setSessions(prev => {
        const existing = prev.findIndex(s => s.id === session.id);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = session;
          return updated.sort((a, b) => b.updatedAt - a.updatedAt);
        }
        return [session, ...prev];
      });
    } catch (err) {
      console.warn('[ChatSessions] Failed to save session:', err);
    }
  }, []);

  const createSession = useCallback(
    async (modelPath: string, modelName: string): Promise<ChatSession> => {
      const session: ChatSession = {
        id: generateId(),
        title: 'New Chat',
        modelPath,
        modelName,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        archived: false,
      };
      await saveSession(session);
      return session;
    },
    [saveSession],
  );

  const writeToDisk = useCallback(async (session: ChatSession) => {
    try {
      await AsyncStorage.setItem(
        STORAGE_PREFIX + session.id,
        JSON.stringify(session),
      );
    } catch (err) {
      console.warn('[ChatSessions] Failed to write session to disk:', err);
    }
  }, []);

  const updateSessionMessages = useCallback(
    (sessionId: string, messages: ChatMessage[]) => {
      // 1. Optimistic in-memory update (immediate, for UI)
      setSessions(prev => {
        const session = prev.find(s => s.id === sessionId);
        if (!session) {
          return prev;
        }

        const firstUserMsg = messages.find(m => m.role === 'user');
        const title =
          session.title === 'New Chat' && firstUserMsg
            ? titleFromMessage(firstUserMsg)
            : session.title;

        const updated: ChatSession = {
          ...session,
          messages,
          title,
          updatedAt: Date.now(),
        };

        // Store pending save data for debounced disk write
        pendingSaveRef.current = {sessionId, session: updated};

        const newSessions = prev.map(s =>
          s.id === sessionId ? updated : s,
        );
        return newSessions.sort((a, b) => b.updatedAt - a.updatedAt);
      });

      // 2. Debounced disk write
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(async () => {
        const pending = pendingSaveRef.current;
        if (pending && pending.sessionId === sessionId) {
          await writeToDisk(pending.session);
          pendingSaveRef.current = null;
        }
      }, DEBOUNCE_MS);
    },
    [writeToDisk],
  );

  const flushPendingSave = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const pending = pendingSaveRef.current;
    if (pending) {
      await writeToDisk(pending.session);
      pendingSaveRef.current = null;
    }
  }, [writeToDisk]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await AsyncStorage.removeItem(STORAGE_PREFIX + sessionId);
      const indexRaw = await AsyncStorage.getItem(INDEX_KEY);
      if (indexRaw) {
        const ids: string[] = JSON.parse(indexRaw);
        const filtered = ids.filter(id => id !== sessionId);
        await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(filtered));
      }
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) {
      console.warn('[ChatSessions] Failed to delete session:', err);
    }
  }, []);

  const getSession = useCallback(
    (sessionId: string): ChatSession | undefined => {
      return sessions.find(s => s.id === sessionId);
    },
    [sessions],
  );

  return {
    sessions,
    loading,
    createSession,
    saveSession,
    updateSessionMessages,
    flushPendingSave,
    deleteSession,
    getSession,
    refresh: loadSessions,
  };
}
