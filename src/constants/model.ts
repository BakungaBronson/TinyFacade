import {ExternalDirectoryPath, DocumentDirectoryPath} from '@dr.pogodin/react-native-fs';
import {Platform} from 'react-native';

// Android: files live in /sdcard/Android/data/com.llamavision/files/
// iOS: files live in the app's Documents directory
const BASE_DIR = Platform.OS === 'android' ? ExternalDirectoryPath : DocumentDirectoryPath;

export const MODEL_PATH = `${BASE_DIR}/tiny-aya-fire-tools-q4_k_m.gguf`;
export const MMPROJ_PATH: string | null = null; // text-only model, no vision projector

export const LLAMA_PARAMS = {
  n_ctx: 2048,
  n_gpu_layers: 99,
  use_mlock: false, // must be false — locking 2.5GB prevents OS paging, causing OOM
  use_mmap: true, // keep model in filesystem page cache for faster reloads
  ctx_shift: false, // required for multimodal
} as const;

export const COMPLETION_PARAMS = {
  n_predict: 512,
  temperature: 0.7,
  top_p: 0.9,
  stop: ['<|end|>', '<|eot_id|>', '</s>', '<|END_RESPONSE|>'] as string[],
};

export const SYSTEM_PROMPT =
  'You are a helpful vision assistant. When given an image, describe what you see in detail. Answer questions about images accurately and concisely.';

export const TOOL_CALLING_SYSTEM_PROMPT =
  'You are a helpful AI assistant with access to tools. When the user asks a question that can be answered using a tool, use the appropriate tool. Always respond naturally after receiving tool results. Do not make up information — use tools to get real data.';
