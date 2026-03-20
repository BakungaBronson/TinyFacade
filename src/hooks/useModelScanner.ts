import {useCallback, useEffect, useState} from 'react';
import {Platform} from 'react-native';
import {
  readDir,
  ExternalDirectoryPath,
  DocumentDirectoryPath,
  DownloadDirectoryPath,
} from '@dr.pogodin/react-native-fs';

export type ScannedModel = {
  name: string;
  path: string;
};

type ScanState = 'scanning' | 'done';

export function useModelScanner() {
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [models, setModels] = useState<ScannedModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<ScannedModel | null>(null);

  const scan = useCallback(async () => {
    setScanState('scanning');
    const found: ScannedModel[] = [];

    const dirsToScan =
      Platform.OS === 'android'
        ? [ExternalDirectoryPath, DownloadDirectoryPath]
        : [DocumentDirectoryPath];

    for (const dir of dirsToScan) {
      try {
        const files = await readDir(dir);
        for (const file of files) {
          if (
            file.isFile() &&
            file.name.toLowerCase().endsWith('.gguf')
          ) {
            found.push({name: file.name, path: file.path});
          }
        }
      } catch {
        // Directory may not exist or be unreadable — skip
      }
    }

    setModels(found);
    if (found.length === 1) {
      setSelectedModel(found[0]);
    }
    setScanState('done');
    return found;
  }, []);

  useEffect(() => {
    scan();
  }, [scan]);

  const selectModel = useCallback((model: ScannedModel) => {
    setSelectedModel(model);
  }, []);

  return {scanState, models, selectedModel, selectModel, rescan: scan};
}
