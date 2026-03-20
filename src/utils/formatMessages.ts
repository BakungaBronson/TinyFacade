import type {ChatMessage} from '../types/chat';
import {SYSTEM_PROMPT} from '../constants/model';

type LlamaMessagePart =
  | {type: 'text'; text: string}
  | {type: 'image_url'; image_url: {url: string}};

type LlamaMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | LlamaMessagePart[];
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {name: string; arguments: string};
  }>;
  tool_call_id?: string;
};

/**
 * Converts app ChatMessage[] to llama.rn message format.
 * Images are included as image_url content parts so getFormattedChat()
 * can extract paths and inject <__media__> markers automatically.
 */
export function formatMessages(
  messages: ChatMessage[],
  systemPrompt?: string,
): LlamaMessage[] {
  const formatted: LlamaMessage[] = [
    {role: 'system', content: systemPrompt ?? SYSTEM_PROMPT},
  ];

  for (const msg of messages) {
    if (msg.role === 'tool') {
      formatted.push({
        role: 'tool',
        content: msg.text || '',
        tool_call_id: msg.tool_call_id,
      });
      continue;
    }

    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      formatted.push({
        role: 'assistant',
        content: msg.text || '',
        tool_calls: msg.tool_calls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      });
      continue;
    }

    if (msg.image) {
      const parts: LlamaMessagePart[] = [
        {type: 'image_url', image_url: {url: msg.image}},
        {type: 'text', text: msg.text || 'Describe this image.'},
      ];
      formatted.push({
        role: msg.role as 'user' | 'assistant',
        content: parts,
      });
    } else {
      formatted.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.text || '',
      });
    }
  }

  return formatted;
}
