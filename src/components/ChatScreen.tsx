import React, {useCallback, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {ChatMessage} from '../types/chat';
import {useModel} from '../context/ModelContext';
import {useFilePicker} from '../hooks/useFilePicker';
import {useToolCalling} from '../hooks/useToolCalling';
import {useToolSettings} from '../hooks/useToolSettings';
import {COMPLETION_PARAMS} from '../constants/model';
import {ModelStatusBar} from './ModelStatusBar';
import {ModelPicker} from './ModelPicker';
import {MessageBubble} from './MessageBubble';
import {ChatInput} from './ChatInput';
import {ToolSettingsPanel} from './ToolSettingsPanel';

let nextId = 1;
function makeId() {
  return String(nextId++);
}

function stripStopTokens(text: string): string {
  let result = text;
  for (const token of COMPLETION_PARAMS.stop) {
    result = result.replaceAll(token, '');
  }
  return result.trimEnd();
}

type ChatScreenProps = {
  sessionId?: string;
  initialMessages?: ChatMessage[];
  onMessagesChanged?: (messages: ChatMessage[]) => void;
  onBack?: () => void;
  onSessionCreated?: (
    modelPath: string,
    modelName: string,
    messages: ChatMessage[],
  ) => void;
};

export function ChatScreen({
  sessionId,
  initialMessages,
  onMessagesChanged,
  onBack,
  onSessionCreated,
}: ChatScreenProps) {
  const {
    modelStatus,
    loadProgress,
    sendMessage,
    getContext,
    clearCacheIfNeeded,
    storageState,
    persistModel,
    clearPersistedModel,
    scanState,
    models,
    selectModel,
    rescan,
    setActiveModel,
    resolvedModel,
  } = useModel();

  const {pickerState, error: pickerError, pickModel, resetPicker} =
    useFilePicker();

  const {
    globalEnabled,
    enabledTools,
    toggleGlobal,
    toggleTool,
    getEnabledTools,
  } = useToolSettings();

  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages ?? [],
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeToolName, setActiveToolName] = useState<string | null>(null);
  const [showToolSettings, setShowToolSettings] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const currentEnabledTools = getEnabledTools();
  const {executeWithTools} = useToolCalling(getContext, currentEnabledTools);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({animated: true});
    }, 100);
  }, []);

  const sessionCreatedRef = useRef(false);

  const handleSelectScanned = useCallback(
    async (model: {name: string; path: string}) => {
      selectModel(model);
      setActiveModel(model);
      await persistModel(model);
      if (onSessionCreated && !sessionCreatedRef.current) {
        sessionCreatedRef.current = true;
        onSessionCreated(model.path, model.name, []);
      }
    },
    [selectModel, setActiveModel, persistModel, onSessionCreated],
  );

  const handleBrowse = useCallback(async () => {
    const picked = await pickModel();
    if (picked) {
      setActiveModel(picked);
      await persistModel(picked);
      rescan();
      if (onSessionCreated && !sessionCreatedRef.current) {
        sessionCreatedRef.current = true;
        onSessionCreated(picked.path, picked.name, []);
      }
    }
  }, [pickModel, setActiveModel, persistModel, rescan, onSessionCreated]);

  const handleChangeModel = useCallback(async () => {
    await clearPersistedModel();
    setActiveModel(null);
    setMessages([]);
    resetPicker();
  }, [clearPersistedModel, setActiveModel, resetPicker]);

  const updateMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      setMessages(prev => {
        const next = updater(prev);
        onMessagesChanged?.(next);
        return next;
      });
    },
    [onMessagesChanged],
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (modelStatus !== 'ready') {
        return;
      }

      const userMessage: ChatMessage = {
        id: makeId(),
        role: 'user',
        text,
        timestamp: Date.now(),
      };

      const assistantId = makeId();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        text: '',
        timestamp: Date.now(),
      };

      const updatedMessages = [...messages, userMessage];

      updateMessages(() => [...updatedMessages, assistantMessage]);
      setIsGenerating(true);
      scrollToEnd();

      if (sessionId && sessionId !== '__new__') {
        await clearCacheIfNeeded(sessionId);
      }

      try {
        if (globalEnabled && currentEnabledTools.length > 0) {
          const result = await executeWithTools(
            updatedMessages,
            (token: string) => {
              updateMessages(prev =>
                prev.map(m =>
                  m.id === assistantId ? {...m, text: m.text + token} : m,
                ),
              );
              scrollToEnd();
            },
            (toolName: string | null) => {
              setActiveToolName(toolName);
            },
          );

          if (result) {
            updateMessages(prev =>
              prev.map(m =>
                m.id === assistantId
                  ? {
                      ...m,
                      text: stripStopTokens(m.text || result.text),
                      timings: result.timings as any,
                    }
                  : m,
              ),
            );
          }
        } else {
          const result = await sendMessage(updatedMessages, (token: string) => {
            updateMessages(prev =>
              prev.map(m =>
                m.id === assistantId ? {...m, text: m.text + token} : m,
              ),
            );
            scrollToEnd();
          });

          if (result) {
            updateMessages(prev =>
              prev.map(m =>
                m.id === assistantId
                  ? {
                      ...m,
                      text: stripStopTokens(m.text),
                      timings: result.timings as any,
                    }
                  : m,
              ),
            );
          } else {
            updateMessages(prev =>
              prev.map(m =>
                m.id === assistantId
                  ? {...m, text: stripStopTokens(m.text)}
                  : m,
              ),
            );
          }
        }
      } catch (err) {
        console.error('Completion error:', err);
        updateMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? {...m, text: m.text || 'Error generating response.'}
              : m,
          ),
        );
      } finally {
        setIsGenerating(false);
        setActiveToolName(null);
      }
    },
    [
      modelStatus,
      messages,
      sendMessage,
      scrollToEnd,
      globalEnabled,
      currentEnabledTools,
      executeWithTools,
      updateMessages,
      sessionId,
      clearCacheIfNeeded,
    ],
  );

  // Show loading spinner while checking persisted storage
  if (storageState === 'loading') {
    return (
      <SafeAreaView
        style={styles.safe}
        edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="#111"
          translucent={false}
        />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  // Show model picker if no model is active
  if (!resolvedModel) {
    return (
      <SafeAreaView
        style={styles.safe}
        edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="#111"
          translucent={false}
        />
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backText}>{'< Chats'}</Text>
          </TouchableOpacity>
        )}
        <ModelPicker
          scanState={scanState}
          models={models}
          onSelectModel={handleSelectScanned}
          onBrowse={handleBrowse}
          onRescan={rescan}
          pickerState={pickerState}
          pickerError={pickerError}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#111"
        translucent={false}
      />
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>{'< Chats'}</Text>
        </TouchableOpacity>
      )}
      <ModelStatusBar
        status={modelStatus}
        progress={loadProgress}
        modelName={resolvedModel.name}
        onChangeModel={handleChangeModel}
        toolCallingEnabled={globalEnabled}
        onToolsPress={() => setShowToolSettings(true)}
        activeToolName={activeToolName}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={({item, index}) => (
            <MessageBubble
              message={item}
              isGenerating={
                isGenerating &&
                item.role === 'assistant' &&
                index === messages.length - 1
              }
            />
          )}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => scrollToEnd()}
          keyboardShouldPersistTaps="handled"
        />
        <ChatInput
          onSend={handleSend}
          disabled={isGenerating || modelStatus !== 'ready'}
        />
      </KeyboardAvoidingView>
      <ToolSettingsPanel
        visible={showToolSettings}
        onClose={() => setShowToolSettings(false)}
        globalEnabled={globalEnabled}
        enabledTools={enabledTools}
        onToggleGlobal={toggleGlobal}
        onToggleTool={toggleTool}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#111',
  },
  flex: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
    backgroundColor: '#111',
  },
  listContent: {
    paddingVertical: 8,
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
  },
  backText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
});
