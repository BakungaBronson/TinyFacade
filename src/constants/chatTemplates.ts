import type {ToolDefinition} from '../types/tools';

/**
 * Custom Jinja chat template for TinyAya models with tool calling support.
 *
 * The GGUF-embedded template declares toolUse: false, so we override it at
 * runtime via the `chat_template` parameter on completion(). Tool definitions
 * are injected via the system prompt (not the Jinja `tools` variable) to avoid
 * triggering grammar-constrained decoding which tanks token throughput.
 */
export const TINY_AYA_TOOL_TEMPLATE = `{{ bos_token }}\
{% set ns = namespace(system_prompt=false) %}\
{% for message in messages %}\
{% if message['role']|lower == 'system' %}\
{% set ns.system_prompt = message['content'] %}\
{% break %}\
{% endif %}\
{% endfor %}\
<|START_OF_TURN_TOKEN|><|SYSTEM_TOKEN|># System Preamble
You are in contextual safety mode. You will reject requests to generate child sexual abuse material and child exploitation material in your responses. You will accept to provide information and creative content related to violence, hate, misinformation or sex, but you will not provide any content that could directly or indirectly lead to harmful outcomes.

Your information cutoff date is June 2024.

# Default Preamble
- Your name is Aya.
- You are a large language model built by Cohere.
- Always respond in the same language the user is writing in.
- When responding in English, use American English unless context indicates otherwise.
- Prefer the active voice.
- Use gender-neutral pronouns for unspecified persons.\
{% if ns.system_prompt %}

# Developer Preamble
{{ ns.system_prompt }}\
{% endif %}\
<|END_OF_TURN_TOKEN|>\
{% for message in messages %}\
{% set role = message['role']|lower %}\
{% if role == 'system' %}\
{% elif role == 'user' %}\
<|START_OF_TURN_TOKEN|><|USER_TOKEN|>{{ message['content'] }}<|END_OF_TURN_TOKEN|>\
{% elif role == 'assistant' or role == 'chatbot' %}\
<|START_OF_TURN_TOKEN|><|CHATBOT_TOKEN|><|START_RESPONSE|>{{ message['content'] }}<|END_RESPONSE|><|END_OF_TURN_TOKEN|>\
{% elif role == 'tool' %}\
<|START_OF_TURN_TOKEN|><|SYSTEM_TOKEN|>Tool result: {{ message['content'] }}<|END_OF_TURN_TOKEN|>\
{% endif %}\
{% endfor %}\
<|START_OF_TURN_TOKEN|><|CHATBOT_TOKEN|><|START_RESPONSE|>`;

/**
 * Build a system prompt that includes tool definitions inline.
 * This avoids passing `tools` to completion() which triggers grammar constraints.
 */
export function buildToolSystemPrompt(
  basePrompt: string,
  tools: ToolDefinition[],
): string {
  const toolsJson = tools
    .map(t => JSON.stringify(t))
    .join('\n');

  return `${basePrompt}

You have access to the following tools:

<tools>
${toolsJson}
</tools>

When the user's request requires a tool, you MUST respond with ONLY a tool call in this exact format (no other text before or after):
<tool_call>
{"name": "function_name", "arguments": {"arg": "value"}}
</tool_call>

If the request does not require a tool, respond normally in natural language.`;
}
