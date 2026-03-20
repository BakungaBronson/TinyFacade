import React, {useCallback, useEffect, useState} from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  exists,
  ExternalDirectoryPath,
  DocumentDirectoryPath,
} from '@dr.pogodin/react-native-fs';
import {HF_MODEL_CATALOG, type HFModelRepo, type ModelVariant} from '../constants/huggingface';
import {useModelDownloader} from '../hooks/useModelDownloader';

const DOWNLOAD_DIR =
  Platform.OS === 'android' ? ExternalDirectoryPath : DocumentDirectoryPath;

type Props = {
  onDownloaded: () => void;
};

export function DownloadTab({onDownloaded}: Props) {
  const {status, progress, error, startDownload, cancelDownload, reset} =
    useModelDownloader();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [existingFiles, setExistingFiles] = useState<Set<string>>(new Set());

  const checkExisting = useCallback(async () => {
    const found = new Set<string>();
    for (const repo of HF_MODEL_CATALOG) {
      for (const v of repo.variants) {
        const path = `${DOWNLOAD_DIR}/${v.filename}`;
        try {
          if (await exists(path)) {
            found.add(v.filename);
          }
        } catch {}
      }
    }
    setExistingFiles(found);
  }, []);

  useEffect(() => {
    checkExisting();
  }, [checkExisting]);

  const handleDownload = useCallback(
    async (repo: HFModelRepo, variant: ModelVariant) => {
      const id = `${repo.id}/${variant.quantization}`;
      setDownloadingId(id);
      reset();
      const result = await startDownload(repo.repo, variant.filename);
      if (result) {
        setExistingFiles(prev => new Set([...prev, variant.filename]));
        onDownloaded();
      }
      setDownloadingId(null);
    },
    [startDownload, reset, onDownloaded],
  );

  const handleCancel = useCallback(() => {
    cancelDownload();
    setDownloadingId(null);
  }, [cancelDownload]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {HF_MODEL_CATALOG.map(repo => (
        <View key={repo.id} style={styles.repoCard}>
          <Text style={styles.repoName}>{repo.name}</Text>
          <Text style={styles.repoDesc}>{repo.description}</Text>
          {repo.variants.map(variant => {
            const variantId = `${repo.id}/${variant.quantization}`;
            const isDownloading =
              downloadingId === variantId && status === 'downloading';
            const isDownloaded = existingFiles.has(variant.filename);

            return (
              <View key={variant.quantization} style={styles.variantRow}>
                <View style={styles.variantInfo}>
                  <Text style={styles.quantLabel}>
                    {variant.quantization}
                  </Text>
                  <Text style={styles.sizeLabel}>{variant.sizeLabel}</Text>
                </View>
                {isDownloaded ? (
                  <Text style={styles.checkmark}>Downloaded</Text>
                ) : isDownloading ? (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {width: `${Math.round(progress * 100)}%`},
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {Math.round(progress * 100)}%
                    </Text>
                    <TouchableOpacity
                      onPress={handleCancel}
                      style={styles.cancelBtn}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.downloadBtn}
                    onPress={() => handleDownload(repo, variant)}
                    disabled={status === 'downloading'}>
                    <Text style={styles.downloadBtnText}>Download</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      ))}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  repoCard: {
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  repoName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  repoDesc: {
    color: '#888',
    fontSize: 12,
    marginBottom: 10,
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  variantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantLabel: {
    color: '#e5e5e5',
    fontSize: 14,
    fontWeight: '600',
  },
  sizeLabel: {
    color: '#666',
    fontSize: 12,
  },
  checkmark: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginLeft: 12,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 3,
  },
  progressText: {
    color: '#888',
    fontSize: 11,
    width: 36,
    textAlign: 'right',
  },
  cancelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cancelText: {
    color: '#d9534f',
    fontSize: 12,
  },
  downloadBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  downloadBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    color: '#d9534f',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
});
