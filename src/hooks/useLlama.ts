import {useCallback, useEffect, useRef, useState} from 'react';
import {initLlama, type LlamaContext, type NativeCompletionResult} from 'llama.rn';
import type {ChatMessage, ModelStatus} from '../types/chat';
import {LLAMA_PARAMS, COMPLETION_PARAMS, MMPROJ_PATH} from '../constants/model';
import {formatMessages} from '../utils/formatMessages';
import {InferenceServiceBridge} from '../native/InferenceService';

export function useLlama(modelPath: string | null) {
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle');
  const [loadProgress, setLoadProgress] = useState(0);
  const contextRef = useRef<LlamaContext | null>(null);
  const isGeneratingRef = useRef(false);
  const cachedSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!modelPath) {
      setModelStatus('idle');
      setLoadProgress(0);
      return;
    }

    let cancelled = false;

    async function loadModel() {
      // Release any previous context before loading a new model
      if (contextRef.current) {
        contextRef.current.release();
        contextRef.current = null;
      }
      cachedSessionIdRef.current = null;

      setModelStatus('loading');
      setLoadProgress(0);
      console.warn('[TinyFacade] Loading model from:', modelPath);
      console.warn('[TinyFacade] Mmproj path:', MMPROJ_PATH);
      try {
        const context = await initLlama(
          {
            model: modelPath!,
            ...LLAMA_PARAMS,
          },
          (progress: number) => {
            if (!cancelled) {
              setLoadProgress(progress);
            }
          },
        );

        if (cancelled) {
          context.release();
          return;
        }

        if (MMPROJ_PATH) {
          console.warn('[TinyFacade] Initializing multimodal...');
          await context.initMultimodal({
            path: MMPROJ_PATH,
            use_gpu: true,
            image_max_tokens: 1024,
          });
        } else {
          console.warn('[TinyFacade] Text-only mode (no mmproj)');
        }

        if (cancelled) {
          context.release();
          return;
        }

        contextRef.current = context;
        await InferenceServiceBridge.registerModel(context.id, modelPath!);

        // Diagnostic: log model tool calling capabilities
        try {
          const model = (context as any).model;
          console.warn('[TinyFacade] Model info:', JSON.stringify(model, null, 2));
          console.warn('[TinyFacade] Jinja supported:', (context as any).isJinjaSupported?.());
          if (model?.chatTemplates) {
            console.warn('[TinyFacade] Chat templates:', JSON.stringify(model.chatTemplates, null, 2));
          }
        } catch (e: any) {
          console.warn('[TinyFacade] Could not read model info:', e?.message);
        }

        console.warn('[TinyFacade] Ready! (registered with service)');
        setModelStatus('ready');
      } catch (err: any) {
        console.warn(
          '[TinyFacade] Failed to load model:',
          err?.message || err,
        );
        if (!cancelled) {
          setModelStatus('error');
        }
      }
    }

    loadModel();

    return () => {
      cancelled = true;
      InferenceServiceBridge.unregisterModel();
      contextRef.current?.release();
      contextRef.current = null;
      cachedSessionIdRef.current = null;
    };
  }, [modelPath]);

  const getContext = useCallback((): LlamaContext | null => {
    return contextRef.current;
  }, []);

  const sendMessage = useCallback(
    async (
      messages: ChatMessage[],
      onToken: (token: string) => void,
    ): Promise<NativeCompletionResult | null> => {
      const context = contextRef.current;
      if (!context || isGeneratingRef.current) {
        return null;
      }

      isGeneratingRef.current = true;

      try {
        const formatted = formatMessages(messages);

        const result = await context.completion(
          {
            messages: formatted as any,
            ...COMPLETION_PARAMS,
          },
          (tokenData) => {
            if (tokenData.token) {
              onToken(tokenData.token);
            }
          },
        );

        return result;
      } finally {
        isGeneratingRef.current = false;
      }
    },
    [],
  );

  const clearCacheIfNeeded = useCallback(async (sessionId: string) => {
    const context = contextRef.current;
    if (!context) {
      return;
    }
    if (cachedSessionIdRef.current !== null && cachedSessionIdRef.current !== sessionId) {
      await context.clearCache(false);
    }
    cachedSessionIdRef.current = sessionId;
  }, []);

  const stopGeneration = useCallback(() => {
    contextRef.current?.stopCompletion();
  }, []);

  return {modelStatus, loadProgress, sendMessage, stopGeneration, getContext, clearCacheIfNeeded};
}
