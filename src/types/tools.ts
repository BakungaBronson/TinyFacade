export type ToolParameterProperty = {
  type: string;
  description: string;
  enum?: string[];
};

export type ToolParameters = {
  type: 'object';
  properties: Record<string, ToolParameterProperty>;
  required?: string[];
};

export type ToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolParameters;
  };
};

export type ToolResult = {
  tool_call_id: string;
  content: string;
};

export const MAX_TOOL_ITERATIONS = 3;
export const MAX_TOOL_CALLS = 5;
