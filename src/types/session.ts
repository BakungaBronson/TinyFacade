import type {ChatMessage} from './chat';

export type ChatSession = {
  id: string;
  title: string;
  modelPath: string;
  modelName: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  archived: boolean;
};
