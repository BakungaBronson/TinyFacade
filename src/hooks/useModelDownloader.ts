import {useCallback, useRef, useState} from 'react';
import {Platform} from 'react-native';
import {
  downloadFile,
  stopDownload,
  exists,
  ExternalDirectoryPath,
  DocumentDirectoryPath,
} from '@dr.pogodin/react-native-fs';
import {getDownloadUrl} from '../constants/huggingface';

export type DownloadStatus = 'idle' | 'downloading' | 'done' | 'error';

const DOWNLOAD_DIR =
  Platform.OS === 'android' ? ExternalDirectoryPath : DocumentDirectoryPath;

export function useModelDownloader() {
  const [status, setStatus] = useState<DownloadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [bytesWritten, setBytesWritten] = useState(0);
  const [contentLength, setContentLength] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const jobIdRef = useRef<number | null>(null);

  const startDownload = useCallback(
    async (repo: string, filename: string): Promise<string | null> => {
      const destPath = `${DOWNLOAD_DIR}/${filename}`;

      const alreadyExists = await exists(destPath);
      if (alreadyExists) {
        setStatus('done');
        setProgress(1);
        return destPath;
      }

      setStatus('downloading');
      setProgress(0);
      setBytesWritten(0);
      setContentLength(0);
      setError(null);

      const url = getDownloadUrl(repo, filename);

      try {
        const result = downloadFile({
          fromUrl: url,
          toFile: destPath,
          progress: (res) => {
            setContentLength(res.contentLength);
            setBytesWritten(res.bytesWritten);
            if (res.contentLength > 0) {
              setProgress(res.bytesWritten / res.contentLength);
            }
          },
          progressInterval: 500,
          begin: (res) => {
            setContentLength(res.contentLength);
            jobIdRef.current = res.jobId;
          },
        });

        jobIdRef.current = result.jobId;
        const response = await result.promise;

        if (response.statusCode === 200) {
          setStatus('done');
          setProgress(1);
          return destPath;
        } else {
          setError(`Download failed (HTTP ${response.statusCode})`);
          setStatus('error');
          return null;
        }
      } catch (err: any) {
        if (err?.message?.includes('cancelled') || err?.message?.includes('aborted')) {
          setStatus('idle');
          setProgress(0);
        } else {
          setError(err?.message || 'Download failed');
          setStatus('error');
        }
        return null;
      } finally {
        jobIdRef.current = null;
      }
    },
    [],
  );

  const cancelDownload = useCallback(() => {
    if (jobIdRef.current !== null) {
      stopDownload(jobIdRef.current);
      jobIdRef.current = null;
    }
    setStatus('idle');
    setProgress(0);
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setProgress(0);
    setBytesWritten(0);
    setContentLength(0);
    setError(null);
  }, []);

  return {
    status,
    progress,
    bytesWritten,
    contentLength,
    error,
    startDownload,
    cancelDownload,
    reset,
  };
}
