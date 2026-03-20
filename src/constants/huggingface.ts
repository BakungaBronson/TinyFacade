export type ModelVariant = {
  quantization: string;
  filename: string;
  sizeBytes: number;
  sizeLabel: string;
};

export type HFModelRepo = {
  id: string;
  repo: string;
  name: string;
  description: string;
  variants: ModelVariant[];
};

function buildDownloadUrl(repo: string, filename: string): string {
  return `https://huggingface.co/${repo}/resolve/main/${filename}`;
}

export function getDownloadUrl(repo: string, filename: string): string {
  return buildDownloadUrl(repo, filename);
}

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

function sizeLabel(bytes: number): string {
  if (bytes >= GB) {
    return `${(bytes / GB).toFixed(1)} GB`;
  }
  return `${(bytes / MB).toFixed(0)} MB`;
}

function variant(
  quantization: string,
  filename: string,
  sizeBytes: number,
): ModelVariant {
  return {quantization, filename, sizeBytes, sizeLabel: sizeLabel(sizeBytes)};
}

export const HF_MODEL_CATALOG: HFModelRepo[] = [
  {
    id: 'aya-global',
    repo: 'CohereForAI/aya-expanse-8b-GGUF',
    name: 'Aya Expanse 8B (Global)',
    description: '23 languages, general-purpose multilingual model',
    variants: [
      variant('Q4_0', 'aya-expanse-8b-Q4_0.gguf', 4.66 * GB),
      variant('Q4_K_M', 'aya-expanse-8b-Q4_K_M.gguf', 4.92 * GB),
      variant('Q8_0', 'aya-expanse-8b-Q8_0.gguf', 8.54 * GB),
    ],
  },
  {
    id: 'command-r7b',
    repo: 'bartowski/c4ai-command-r7b-12-2024-GGUF',
    name: 'Command R7B',
    description: 'Compact 7B model with tool calling support',
    variants: [
      variant('Q4_0', 'c4ai-command-r7b-12-2024-Q4_0.gguf', 4.09 * GB),
      variant('Q4_K_M', 'c4ai-command-r7b-12-2024-Q4_K_M.gguf', 4.36 * GB),
      variant('Q8_0', 'c4ai-command-r7b-12-2024-Q8_0.gguf', 7.48 * GB),
    ],
  },
  {
    id: 'smollm2-360m',
    repo: 'bartowski/SmolLM2-360M-Instruct-GGUF',
    name: 'SmolLM2 360M',
    description: 'Ultra-small 360M model for fast on-device inference',
    variants: [
      variant('Q4_K_M', 'SmolLM2-360M-Instruct-Q4_K_M.gguf', 254 * MB),
      variant('Q8_0', 'SmolLM2-360M-Instruct-Q8_0.gguf', 386 * MB),
    ],
  },
  {
    id: 'smollm2-1.7b',
    repo: 'bartowski/SmolLM2-1.7B-Instruct-GGUF',
    name: 'SmolLM2 1.7B',
    description: 'Small 1.7B model, good balance of size and capability',
    variants: [
      variant('Q4_K_M', 'SmolLM2-1.7B-Instruct-Q4_K_M.gguf', 1.1 * GB),
      variant('Q8_0', 'SmolLM2-1.7B-Instruct-Q8_0.gguf', 1.83 * GB),
    ],
  },
];
