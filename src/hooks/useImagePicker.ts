import {useCallback, useState} from 'react';
import {launchImageLibrary} from 'react-native-image-picker';
import type {PendingImage} from '../types/chat';
import {resolveContentUri} from '../utils/resolveContentUri';

export function useImagePicker() {
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);

  const pickImage = useCallback(async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
    });

    if (result.didCancel || !result.assets?.length) {
      return;
    }

    const asset = result.assets[0];
    if (!asset.uri) {
      return;
    }

    // Resolve content:// URIs on Android to file:// paths
    const resolvedUri = await resolveContentUri(asset.uri);

    setPendingImage({
      uri: resolvedUri,
      originalUri: asset.uri,
    });
  }, []);

  const clearImage = useCallback(() => {
    setPendingImage(null);
  }, []);

  return {pendingImage, pickImage, clearImage};
}
