import {useCallback} from 'react';
import type {LlamaContext, NativeCompletionResult} from 'llama.rn';
import type {ChatMessage} from '../types/chat';
import type {ToolDefinition} from '../types/tools';
import {MAX_TOOL_ITERATIONS, MAX_TOOL_CALLS} from '../types/tools';
import {COMPLETION_PARAMS, TOOL_CALLING_SYSTEM_PROMPT} from '../constants/model';
import {TINY_AYA_TOOL_TEMPLATE, buildToolSystemPrompt} from '../constants/chatTemplates';
import {formatMessages} from '../utils/formatMessages';
import {parseToolCalls} from '../utils/parseToolCalls';
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

      // Bake tool definitions into the system prompt instead of passing
      // `tools` to completion() — avoids grammar-constrained decoding overhead
      const systemPrompt = buildToolSystemPrompt(
        TOOL_CALLING_SYSTEM_PROMPT,
        enabledTools,
      );

      let currentMessages = [...messages];
      let lastResult: NativeCompletionResult | null = null;
      let totalToolCalls = 0;

      for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        // After tool execution, drop tool defs from prompt to save context space.
        // The model already called the tool — it just needs to respond with the result.
        const prompt = iteration === 0
          ? systemPrompt
          : 'You are a helpful AI assistant. You just called a tool and received the result below. Respond naturally to the user using that result.';
        const formatted = formatMessages(currentMessages, prompt);

        console.warn('[ToolCalling] Iteration', iteration);

        const result = await context.completion(
          {
            messages: formatted as any,
            ...COMPLETION_PARAMS,
            stop: [
              ...COMPLETION_PARAMS.stop,
              '<|END_OF_TURN_TOKEN|>',
            ],
            chat_template: TINY_AYA_TOOL_TEMPLATE,
            jinja: true,
          },
          (tokenData) => {
            if (tokenData.token) {
              onToken(tokenData.token);
            }
          },
        );

        lastResult = result;

        // First check native tool_calls (future-proof for models that support it)
        let toolCalls = (result as any).tool_calls as
          | ToolCallRaw[]
          | undefined;

        // Fall back to parsing <tool_call> blocks from raw text
        if (!toolCalls || toolCalls.length === 0) {
          const parsed = parseToolCalls(result.text);
          if (parsed.toolCalls.length > 0) {
            toolCalls = parsed.toolCalls;
            (lastResult as any).text = parsed.cleanText;
            console.warn('[ToolCalling] Parsed', toolCalls.length, 'tool call(s) from text');
          }
        }

        if (!toolCalls || toolCalls.length === 0) {
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

          console.warn('[ToolCalling] Tool', tc.function.name, '→', toolResult);

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
