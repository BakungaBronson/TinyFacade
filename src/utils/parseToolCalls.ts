type ParsedToolCall = {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
};

type ParseResult = {
  toolCalls: ParsedToolCall[];
  cleanText: string;
};

/**
 * Extract <tool_call>...</tool_call> blocks from raw model output.
 * Returns parsed tool calls and the remaining text with blocks stripped.
 */
export function parseToolCalls(text: string): ParseResult {
  const toolCalls: ParsedToolCall[] = [];
  const regex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    try {
      const json = JSON.parse(match[1]);
      const name = json.name || json.function?.name;
      const args = json.arguments || json.function?.arguments || {};

      if (name) {
        toolCalls.push({
          id: `tc-${Date.now()}-${toolCalls.length}`,
          function: {
            name,
            arguments: typeof args === 'string' ? args : JSON.stringify(args),
          },
        });
      }
    } catch {
      console.warn('[parseToolCalls] Failed to parse tool call JSON:', match[1]);
    }
  }

  // Strip tool_call blocks from the text for display
  const cleanText = text
    .replace(/<tool_call>\s*[\s\S]*?\s*<\/tool_call>/g, '')
    .replace(/<\|END_RESPONSE\|>/g, '')
    .replace(/<\|END_OF_TURN_TOKEN\|>/g, '')
    .trim();

  return {toolCalls, cleanText};
}
