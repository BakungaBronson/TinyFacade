import React, {useEffect, useRef} from 'react';
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {TOOL_DEFINITIONS} from '../constants/toolDefinitions';

type Props = {
  visible: boolean;
  onClose: () => void;
  globalEnabled: boolean;
  enabledTools: Record<string, boolean>;
  onToggleGlobal: () => void;
  onToggleTool: (toolName: string) => void;
};

function humanizeName(name: string): string {
  return name
    .replace(/^get_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function ToolSettingsPanel({
  visible,
  onClose,
  globalEnabled,
  enabledTools,
  onToggleGlobal,
  onToggleTool,
}: Props) {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[styles.panel, {transform: [{translateY}]}]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Tools</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text style={styles.closeButton}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Global toggle */}
          <View style={styles.globalRow}>
            <View style={styles.globalInfo}>
              <Text style={styles.globalLabel}>Enable Tool Calling</Text>
              <Text style={styles.globalDesc}>
                Allow the model to use tools during conversations
              </Text>
            </View>
            <Switch
              value={globalEnabled}
              onValueChange={onToggleGlobal}
              trackColor={{false: '#333', true: '#2563eb'}}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.divider} />

          {/* Tool list */}
          <ScrollView
            style={styles.toolList}
            contentContainerStyle={styles.toolListContent}>
            {TOOL_DEFINITIONS.map(tool => {
              const name = tool.function.name;
              const enabled = enabledTools[name] !== false;
              const dimmed = !globalEnabled;

              return (
                <View
                  key={name}
                  style={[styles.toolRow, dimmed && styles.toolRowDimmed]}>
                  <View style={styles.toolInfo}>
                    <Text
                      style={[
                        styles.toolName,
                        dimmed && styles.textDimmed,
                      ]}>
                      {humanizeName(name)}
                    </Text>
                    <Text
                      style={[
                        styles.toolDesc,
                        dimmed && styles.textDimmed,
                      ]}
                      numberOfLines={2}>
                      {tool.function.description}
                    </Text>
                  </View>
                  <Switch
                    value={enabled}
                    onValueChange={() => onToggleTool(name)}
                    disabled={!globalEnabled}
                    trackColor={{false: '#333', true: '#2563eb'}}
                    thumbColor="#fff"
                  />
                </View>
              );
            })}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Add more tools by editing toolDefinitions.ts and toolExecutor.ts
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  panel: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    paddingBottom: 34, // safe area bottom
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  globalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  globalInfo: {
    flex: 1,
    marginRight: 12,
  },
  globalLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  globalDesc: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#333',
    marginHorizontal: 20,
  },
  toolList: {
    flexGrow: 0,
  },
  toolListContent: {
    paddingVertical: 8,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  toolRowDimmed: {
    opacity: 0.4,
  },
  toolInfo: {
    flex: 1,
    marginRight: 12,
  },
  toolName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  toolDesc: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  textDimmed: {
    color: '#555',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333',
  },
  footerText: {
    color: '#555',
    fontSize: 11,
    textAlign: 'center',
  },
});
