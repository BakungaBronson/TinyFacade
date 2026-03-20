import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {ModelStatus} from '../types/chat';

type Props = {
  status: ModelStatus;
  progress: number;
  modelName?: string;
  onChangeModel?: () => void;
  toolCallingEnabled?: boolean;
  onToolsPress?: () => void;
  activeToolName?: string | null;
};

const STATUS_CONFIG: Record<ModelStatus, {label: string; color: string}> = {
  idle: {label: 'No model loaded', color: '#888'},
  loading: {label: 'Loading model...', color: '#f0ad4e'},
  ready: {label: 'Ready', color: '#5cb85c'},
  error: {label: 'Error loading model', color: '#d9534f'},
};

export function ModelStatusBar({
  status,
  progress,
  modelName,
  onChangeModel,
  toolCallingEnabled,
  onToolsPress,
  activeToolName,
}: Props) {
  const config = STATUS_CONFIG[status];

  let label: string;
  if (status === 'loading') {
    label = `Loading model... ${Math.round(progress * 100)}%`;
  } else if (status === 'ready' && modelName) {
    label = modelName;
  } else {
    label = config.label;
  }

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.left}>
          <View style={[styles.dot, {backgroundColor: config.color}]} />
          <Text style={styles.text} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <View style={styles.right}>
          {status === 'ready' && onToolsPress && (
            <TouchableOpacity
              onPress={onToolsPress}
              style={[
                styles.toolToggle,
                toolCallingEnabled && styles.toolToggleActive,
              ]}
              hitSlop={8}>
              <Text
                style={[
                  styles.toolToggleText,
                  toolCallingEnabled && styles.toolToggleTextActive,
                ]}>
                Tools
              </Text>
            </TouchableOpacity>
          )}
          {status === 'ready' && onChangeModel && (
            <TouchableOpacity onPress={onChangeModel} hitSlop={8}>
              <Text style={styles.changeText}>Change</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {activeToolName && (
        <Text style={styles.toolStatus}>Calling {activeToolName}...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  text: {
    color: '#ccc',
    fontSize: 13,
    flexShrink: 1,
  },
  changeText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '600',
  },
  toolToggle: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#444',
  },
  toolToggleActive: {
    backgroundColor: '#2563eb33',
    borderColor: '#2563eb',
  },
  toolToggleText: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
  },
  toolToggleTextActive: {
    color: '#2563eb',
  },
  toolStatus: {
    color: '#a5b4fc',
    fontSize: 11,
    marginTop: 4,
  },
});
