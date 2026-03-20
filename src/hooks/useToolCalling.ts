import {useCallback} from 'react';
import type {LlamaContext, NativeCompletionResult} from 'llama.rn';
import type {ChatMessage} from '../types/chat';
import type {ToolDefinition} from '../types/tools';
import {MAX_TOOL_ITERATIONS, MAX_TOOL_CALLS} from '../types/tools';
import {COMPLETION_PARAMS, TOOL_CALLING_SYSTEM_PROMPT} from '../constants/model';
import {formatMessages} from '../utils/formatMessages';
import {executeTool} from '../utils/toolExecutor';

type ToolCallRaw = {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
};

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

      let currentMessages = [...messages];
      let lastResult: NativeCompletionResult | null = null;
      let totalToolCalls = 0;

      for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        const formatted = formatMessages(
          currentMessages,
          TOOL_CALLING_SYSTEM_PROMPT,
        );

        const result = await context.completion(
          {
            messages: formatted as any,
            ...COMPLETION_PARAMS,
            tool_choice: 'auto' as any,
            tools: enabledTools as any,
          },
          (tokenData) => {
            if (tokenData.token) {
              onToken(tokenData.token);
            }
          },
        );

        lastResult = result;

        // Check if the model wants to call tools
        const toolCalls = (result as any).tool_calls as
          | ToolCallRaw[]
          | undefined;

        if (!toolCalls || toolCalls.length === 0) {
          // No tool calls — we're done
          break;
        }

        // Cap total tool calls
        totalToolCalls += toolCalls.length;
        if (totalToolCalls > MAX_TOOL_CALLS) {
          break;
        }

        // Add assistant message with tool calls
        const assistantMsg: ChatMessage = {
          id: `tc-${Date.now()}`,
          role: 'assistant',
          text: result.text || '',
          timestamp: Date.now(),
          tool_calls: toolCalls.map(tc => ({
            id: tc.id,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        };
        currentMessages.push(assistantMsg);

        // Execute each tool call
        for (const tc of toolCalls) {
          onToolStatus(tc.function.name);

          const toolResult = await executeTool(
            tc.function.name,
            tc.function.arguments,
          );

          const toolMsg: ChatMessage = {
            id: `tr-${Date.now()}-${tc.id}`,
            role: 'tool',
            text: toolResult,
            timestamp: Date.now(),
            tool_call_id: tc.id,
          };
          currentMessages.push(toolMsg);
        }

        onToolStatus(null);
      }

      return lastResult;
    },
    [getContext, enabledTools],
  );

  return {executeWithTools};
}
