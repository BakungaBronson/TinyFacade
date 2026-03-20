import {useCallback} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {encrypt, decrypt} from '../utils/crypto';

/**
 * AsyncStorage wrapper that encrypts values before write and decrypts after read.
 * Uses device keystore-backed key via crypto.ts.
 */
export function useEncryptedStorage() {
  const setItem = useCallback(async (key: string, value: string) => {
    const encrypted = await encrypt(value);
    await AsyncStorage.setItem(key, encrypted);
  }, []);

  const getItem = useCallback(async (key: string): Promise<string | null> => {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return null;
    }
    try {
      return await decrypt(raw);
    } catch {
      // If decryption fails (e.g. key changed), return null
      console.warn('[EncryptedStorage] Decryption failed for key:', key);
      return null;
    }
  }, []);

  const removeItem = useCallback(async (key: string) => {
    await AsyncStorage.removeItem(key);
  }, []);

  const multiGet = useCallback(
    async (keys: string[]): Promise<[string, string | null][]> => {
      const pairs = await AsyncStorage.multiGet(keys);
      const results: [string, string | null][] = [];
      for (const [key, raw] of pairs) {
        if (raw) {
          try {
            results.push([key, await decrypt(raw)]);
          } catch {
            results.push([key, null]);
          }
        } else {
          results.push([key, null]);
        }
      }
      return results;
    },
    [],
  );

  return {setItem, getItem, removeItem, multiGet};
}
