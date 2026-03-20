import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import type {ChatMessage} from '../types/chat';
import {TypingIndicator} from './TypingIndicator';
import {MetricsBar} from './MetricsBar';

type Props = {
  message: ChatMessage;
  isGenerating?: boolean;
};

export function MessageBubble({message, isGenerating}: Props) {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';
  const isToolCall =
    message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0;

  if (isTool) {
    return (
      <View style={[styles.container, styles.assistantContainer]}>
        <View style={styles.toolBlock}>
          <Text style={styles.toolLabel}>Tool Result</Text>
          <Text style={styles.toolContent} selectable>
            {message.text}
          </Text>
        </View>
      </View>
    );
  }

  if (isToolCall) {
    return (
      <View style={[styles.container, styles.assistantContainer]}>
        <View style={styles.toolBlock}>
          <Text style={styles.toolLabel}>Tool Call</Text>
          {message.tool_calls!.map(tc => (
            <View key={tc.id} style={styles.toolCallItem}>
              <Text style={styles.toolFnName}>{tc.function.name}</Text>
              <Text style={styles.toolContent} selectable>
                {tc.function.arguments}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.assistantContainer,
      ]}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}>
        {message.image && (
          <Image source={{uri: message.image}} style={styles.image} />
        )}
        {message.text === '' && isGenerating ? (
          <TypingIndicator />
        ) : message.text !== '' ? (
          <Text
            style={[
              styles.text,
              isUser ? styles.userText : styles.assistantText,
            ]}
            selectable>
            {message.text}
          </Text>
        ) : null}
        {!isUser && message.timings && <MetricsBar timings={message.timings} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    marginVertical: 4,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: '#2563eb',
  },
  assistantBubble: {
    backgroundColor: '#2a2a2a',
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
  userText: {
    color: '#fff',
  },
  assistantText: {
    color: '#e5e5e5',
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#333',
  },
  toolBlock: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 10,
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: '#333366',
  },
  toolLabel: {
    color: '#7c7cff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  toolCallItem: {
    marginTop: 4,
  },
  toolFnName: {
    color: '#a5b4fc',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  toolContent: {
    color: '#bbb',
    fontSize: 12,
  },
});
