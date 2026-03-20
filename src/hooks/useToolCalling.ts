import {useCallback} from 'react';
import type {LlamaContext, NativeCompletionResult} from 'llama.rn';
import type {ChatMessage} from '../types/chat';
import type {ToolDefinition} from '../types/tools';
import {runToolCallingLoop} from '../utils/runToolCallingLoop';

export function useToolCalling(
  getContext: () => LlamaContext | null,
  enabledTools: ToolDefinition[],
) {
  const executeWithTools = useCallback(
    async (
      messages: ChatMessage[],
      onToken: (token: string) => void,
      onToolStatus: (toolName: string | null) => void,
    ): Promise<NativeCompletionResult | null> => {
      const context = getContext();
      if (!context) {
        return null;
      }

      return runToolCallingLoop(
        context,
        messages,
        enabledTools,
        onToken,
        onToolStatus,
      );
    },
    [getContext, enabledTools],
  );

  return {executeWithTools};
}
