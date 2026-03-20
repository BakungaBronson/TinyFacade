import {useEffect, useState} from 'react';
import {Platform, PermissionsAndroid, type Permission} from 'react-native';

export function usePermissions() {
  const [permissionsReady, setPermissionsReady] = useState(
    Platform.OS !== 'android',
  );

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const requestPermissions = async () => {
      const permissions: Permission[] = [];

      if (Number(Platform.Version) >= 33) {
        permissions.push(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        );
      } else {
        permissions.push(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        );
      }

      try {
        await PermissionsAndroid.requestMultiple(permissions);
      } catch (e) {
        console.warn('Permission request error:', e);
      } finally {
        setPermissionsReady(true);
      }
    };

    requestPermissions();
  }, []);

  return {permissionsReady};
}
