import {useCallback, useEffect, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {exists} from '@dr.pogodin/react-native-fs';

const STORAGE_KEY = '@tinyfacade/model';

export type PersistedModel = {
  name: string;
  path: string;
};

type StorageState = 'loading' | 'ready';

export function useModelStorage() {
  const [storageState, setStorageState] = useState<StorageState>('loading');
  const [persistedModel, setPersistedModel] = useState<PersistedModel | null>(
    null,
  );

  useEffect(() => {
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: PersistedModel = JSON.parse(raw);
          const fileExists = await exists(parsed.path);
          if (fileExists) {
            setPersistedModel(parsed);
          } else {
            console.warn(
              '[ModelStorage] Persisted file missing, clearing:',
              parsed.path,
            );
            await AsyncStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (err) {
        console.warn('[ModelStorage] Failed to load persisted model:', err);
      } finally {
        setStorageState('ready');
      }
    }

    load();
  }, []);

  const persistModel = useCallback(async (model: PersistedModel) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(model));
      setPersistedModel(model);
    } catch (err) {
      console.warn('[ModelStorage] Failed to persist model:', err);
    }
  }, []);

  const clearPersistedModel = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setPersistedModel(null);
    } catch (err) {
      console.warn('[ModelStorage] Failed to clear persisted model:', err);
    }
  }, []);

  return {storageState, persistedModel, persistModel, clearPersistedModel};
}
