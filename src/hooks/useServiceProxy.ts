import {useEffect} from 'react';
import {Platform} from 'react-native';
import type {LlamaContext} from 'llama.rn';
import {
  InferenceServiceBridge,
  type ExternalInferenceRequest,
  type ExternalLoadRequest,
  type ExternalRegisterToolRequest,
  type ExternalUnregisterToolRequest,
} from '../native/InferenceService';
import type {ChatMessage} from '../types/chat';
import {runToolCallingLoop} from '../utils/runToolCallingLoop';
import {toolRegistry} from '../utils/toolRegistry';

/**
 * Normalize external messages ({role, content}) to ChatMessage format
 * that formatMessages() expects ({id, role, text, timestamp}).
 */
function normalizeToChatMessages(
  rawMessages: Array<{role: string; content: string}>,
): ChatMessage[] {
  return rawMessages.map((msg, i) => ({
    id: `ext-${Date.now()}-${i}`,
    role: msg.role as ChatMessage['role'],
    text: msg.content ?? '',
    timestamp: Date.now(),
  }));
}

function syncToolsToKotlin() {
  const defs = toolRegistry.getAllDefinitions();
  InferenceServiceBridge.updateAvailableTools(JSON.stringify(defs));
}

export function useServiceProxy(getContext: () => LlamaContext | null) {
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    // Push initial tool definitions to Kotlin cache on mount
    syncToolsToKotlin();

    const inferSub = InferenceServiceBridge.addExternalInferenceRequestListener(
      async (request: ExternalInferenceRequest) => {
        const context = getContext();
        if (!context) {
          InferenceServiceBridge.deliverError('No model loaded');
          return;
        }

        try {
          const rawMessages = JSON.parse(request.messagesJson);
          const stopSequences = JSON.parse(request.stopSequences || '[]');

          if (request.enableTools) {
            // Normalize {role,content} → ChatMessage {id,role,text,timestamp}
            // so formatMessages() can read msg.text correctly
            const chatMessages = normalizeToChatMessages(rawMessages);

            // Tool calling path: run the full orchestration loop
            const result = await runToolCallingLoop(
              context,
              chatMessages,
              toolRegistry.getAllDefinitions(),
              token => {
                InferenceServiceBridge.deliverToken(token);
              },
              _toolName => {
                // Tool status is internal — AIDL client just sees tokens
              },
              {
                n_predict: request.nPredict,
                temperature: request.temperature,
                top_p: request.topP,
                stop: stopSequences,
              },
            );

            InferenceServiceBridge.deliverComplete(
              result?.text ?? '',
              JSON.stringify(result?.timings ?? {}),
            );
          } else {
            // Plain completion path (existing behavior) — raw {role,content}
            // is what llama.rn context.completion() expects
            const result = await context.completion(
              {
                messages: rawMessages,
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
          }
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
        const context = getContext();
        if (context) {
          InferenceServiceBridge.deliverModelLoaded(true);
        } else {
          // Use deliverModelLoaded(false) — deliverError targets
          // pendingInferenceCallback, not pendingLoadCallback
          InferenceServiceBridge.deliverModelLoaded(false);
        }
      },
    );

    const releaseSub = InferenceServiceBridge.addExternalReleaseRequestListener(
      () => {
        console.warn(
          '[ServiceProxy] External release request ignored — model lifecycle is managed by main app',
        );
      },
    );

    const registerToolSub =
      InferenceServiceBridge.addExternalRegisterToolListener(
        (request: ExternalRegisterToolRequest) => {
          try {
            const definition = JSON.parse(request.toolDefinitionJson);
            const action = JSON.parse(request.actionJson);
            toolRegistry.register(definition, action);
            syncToolsToKotlin();
          } catch (err: any) {
            console.warn(
              '[ServiceProxy] Failed to register external tool:',
              err?.message,
            );
          }
        },
      );

    const unregisterToolSub =
      InferenceServiceBridge.addExternalUnregisterToolListener(
        (request: ExternalUnregisterToolRequest) => {
          toolRegistry.unregister(request.toolName);
          syncToolsToKotlin();
        },
      );

    return () => {
      inferSub?.remove();
      stopSub?.remove();
      loadSub?.remove();
      releaseSub?.remove();
      registerToolSub?.remove();
      unregisterToolSub?.remove();
    };
  }, [getContext]);
}
