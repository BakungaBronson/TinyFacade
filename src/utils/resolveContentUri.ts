import {Platform} from 'react-native';
import {CachesDirectoryPath, copyFile} from '@dr.pogodin/react-native-fs';

/**
 * Resolves a content:// URI to a local file:// path.
 *
 * On Android, image pickers return content:// URIs which cannot be opened
 * by native code using fopen(). This copies the file to the app's cache
 * directory and returns a file:// path that llama.rn can read.
 *
 * On iOS, URIs are already file:// paths — passed through unchanged.
 */
export async function resolveContentUri(uri: string): Promise<string> {
  if (Platform.OS !== 'android') {
    return uri;
  }

  if (!uri.startsWith('content://')) {
    return uri;
  }

  const destPath = `${CachesDirectoryPath}/llama_image_${Date.now()}.jpg`;
  await copyFile(uri, destPath);
  return `file://${destPath}`;
}
