import {useEffect} from 'react';
import {Platform} from 'react-native';
import type {LlamaContext} from 'llama.rn';
import {
  InferenceServiceBridge,
  type ExternalInferenceRequest,
  type ExternalLoadRequest,
} from '../native/InferenceService';

export function useServiceProxy(getContext: () => LlamaContext | null) {
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const inferSub = InferenceServiceBridge.addExternalInferenceRequestListener(
      async (request: ExternalInferenceRequest) => {
        const context = getContext();
        if (!context) {
          InferenceServiceBridge.deliverError('No model loaded');
          return;
        }

        try {
          const messages = JSON.parse(request.messagesJson);
          const stopSequences = JSON.parse(request.stopSequences || '[]');

          const result = await context.completion(
            {
              messages,
              n_predict: request.nPredict,
              temperature: request.temperature,
              top_p: request.topP,
              stop: stopSequences,
            },
            tokenData => {
              if (tokenData.token) {
                InferenceServiceBridge.deliverToken(tokenData.token);
              }
            },
          );

          InferenceServiceBridge.deliverComplete(
            result.text,
            JSON.stringify(result.timings ?? {}),
          );
        } catch (err: any) {
          InferenceServiceBridge.deliverError(
            err?.message || 'Unknown inference error',
          );
        }
      },
    );

    const stopSub = InferenceServiceBridge.addExternalStopRequestListener(
      () => {
        getContext()?.stopCompletion();
      },
    );

    const loadSub = InferenceServiceBridge.addExternalLoadRequestListener(
      async (_request: ExternalLoadRequest) => {
        // The main app manages model loading via useLlama.
        // If a model is already loaded, the binder handles it directly.
        // If we get here, the external client wants a model that isn't loaded yet.
        // We can't force the main app to load a different model from here,
        // so report the current state.
        const context = getContext();
        if (context) {
          InferenceServiceBridge.deliverModelLoaded(true);
        } else {
          InferenceServiceBridge.deliverError(
            'No model loaded in main app. Please open the app and load a model first.',
          );
        }
      },
    );

    const releaseSub = InferenceServiceBridge.addExternalReleaseRequestListener(
      () => {
        // External clients shouldn't release the main app's model.
        // This is a no-op to prevent external clients from disrupting the main app.
        console.warn(
          '[ServiceProxy] External release request ignored — model lifecycle is managed by main app',
        );
      },
    );

    return () => {
      inferSub?.remove();
      stopSub?.remove();
      loadSub?.remove();
      releaseSub?.remove();
    };
  }, [getContext]);
}
