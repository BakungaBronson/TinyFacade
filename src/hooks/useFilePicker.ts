import {useCallback, useState} from 'react';
import {Platform} from 'react-native';
import {pick, isErrorWithCode, errorCodes} from '@react-native-documents/picker';
import {
  copyFile,
  exists,
  ExternalDirectoryPath,
  DocumentDirectoryPath,
} from '@dr.pogodin/react-native-fs';

export type PickerState = 'idle' | 'picking' | 'copying' | 'done' | 'error';

export type PickedModel = {
  name: string;
  path: string;
};

const APP_MODEL_DIR =
  Platform.OS === 'android' ? ExternalDirectoryPath : DocumentDirectoryPath;

export function useFilePicker() {
  const [pickerState, setPickerState] = useState<PickerState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pickedModel, setPickedModel] = useState<PickedModel | null>(null);

  const pickModel = useCallback(async (): Promise<PickedModel | null> => {
    setError(null);
    setPickerState('picking');

    try {
      const [result] = await pick({
        type: ['*/*'],
      });

      const fileName = result.name ?? '';
      if (!fileName.toLowerCase().endsWith('.gguf')) {
        setError('Please select a .gguf model file.');
        setPickerState('error');
        return null;
      }

      const uri = result.uri;
      const destPath = `${APP_MODEL_DIR}/${fileName}`;

      // On Android, SAF returns content:// URIs — copy to app storage
      if (Platform.OS === 'android' && uri.startsWith('content://')) {
        const alreadyExists = await exists(destPath);
        if (!alreadyExists) {
          setPickerState('copying');
          await copyFile(uri, destPath);
        }
      } else if (Platform.OS === 'ios') {
        // iOS: if from an external provider (iCloud, Files), copy locally
        const alreadyExists = await exists(destPath);
        if (!alreadyExists && uri !== destPath) {
          setPickerState('copying');
          await copyFile(uri, destPath);
        }
      }

      const model: PickedModel = {name: fileName, path: destPath};
      setPickedModel(model);
      setPickerState('done');
      return model;
    } catch (err: any) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        setPickerState('idle');
        return null;
      }
      console.warn('[FilePicker] Error:', err?.message || err);
      setError(err?.message || 'Failed to import model file.');
      setPickerState('error');
      return null;
    }
  }, []);

  const resetPicker = useCallback(() => {
    setPickerState('idle');
    setError(null);
    setPickedModel(null);
  }, []);

  return {pickerState, error, pickedModel, pickModel, resetPicker};
}
