export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

export type PendingImage = {
  uri: string; // resolved file:// URI
  originalUri: string; // original URI from picker
};

export type MessageTimings = {
  predicted_per_second?: number;
  prompt_ms?: number;
  predicted_ms?: number;
  predicted_n?: number;
};

export type ToolCall = {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  text: string;
  image?: string; // file:// URI for display
  timestamp: number;
  timings?: MessageTimings;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};
