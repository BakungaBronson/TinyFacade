import React, {useState} from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import type {ScannedModel} from '../hooks/useModelScanner';
import type {PickerState} from '../hooks/useFilePicker';
import {CopyOverlay} from './CopyOverlay';
import {DownloadTab} from './DownloadTab';

type Props = {
  scanState: 'scanning' | 'done';
  models: ScannedModel[];
  onSelectModel: (model: ScannedModel) => void;
  onBrowse: () => void;
  onRescan: () => void;
  pickerState: PickerState;
  pickerError: string | null;
};

type Tab = 'device' | 'download';

export function ModelPicker({
  scanState,
  models,
  onSelectModel,
  onBrowse,
  onRescan,
  pickerState,
  pickerError,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('device');
  const isScanning = scanState === 'scanning';
  const noneFound = !isScanning && models.length === 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select a Model</Text>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'device' && styles.activeTab]}
          onPress={() => setActiveTab('device')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'device' && styles.activeTabText,
            ]}>
            On Device
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'download' && styles.activeTab]}
          onPress={() => setActiveTab('download')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'download' && styles.activeTabText,
            ]}>
            Download
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'device' ? (
        <View style={styles.deviceContent}>
          <Text style={styles.subtitle}>
            {isScanning
              ? 'Scanning for models...'
              : noneFound
                ? 'No .gguf models found on device'
                : `Found ${models.length} model${models.length > 1 ? 's' : ''}`}
          </Text>

          {!isScanning && models.length > 0 && (
            <ScrollView style={styles.modelList}>
              {models.map(model => (
                <TouchableOpacity
                  key={model.path}
                  style={styles.modelItem}
                  onPress={() => onSelectModel(model)}>
                  <Text style={styles.modelName} numberOfLines={1}>
                    {model.name}
                  </Text>
                  <Text style={styles.modelPath} numberOfLines={1}>
                    {model.path}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={onBrowse}
              disabled={
                pickerState === 'picking' || pickerState === 'copying'
              }>
              <Text style={styles.primaryButtonText}>Browse Files</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={onRescan}
              disabled={isScanning}>
              <Text style={styles.secondaryButtonText}>
                {isScanning ? 'Scanning...' : 'Rescan'}
              </Text>
            </TouchableOpacity>
          </View>

          {pickerError && (
            <Text style={styles.errorText}>{pickerError}</Text>
          )}
        </View>
      ) : (
        <DownloadTab
          onDownloaded={() => {
            onRescan();
            setActiveTab('device');
          }}
        />
      )}

      {pickerState === 'copying' && <CopyOverlay />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 40,
    backgroundColor: '#111',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: '#1e1e1e',
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#2563eb',
  },
  tabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  deviceContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  modelList: {
    maxHeight: 200,
    width: '100%',
    marginBottom: 16,
  },
  modelItem: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  modelName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  modelPath: {
    color: '#666',
    fontSize: 11,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#444',
  },
  secondaryButtonText: {
    color: '#aaa',
    fontSize: 15,
  },
  errorText: {
    color: '#d9534f',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
});
