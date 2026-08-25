// ============================================================
// AI PROVIDER CONFIGURATIONS
// ============================================================
// Only 5 provider kinds are supported. Legacy kinds (OPENROUTER,
// OLLAMA, AZURE_OPENAI) have been removed.

export interface ProviderConfig {
  kind: string;
  name: string;
  defaultBaseUrl: string;
  modelsEndpoint: string;
  chatEndpoint: string;
  helpText: string;
  icon: string;
  defaultModels: ProviderModel[];
}

export interface ProviderModel {
  modelId: string;
  name: string;
  contextLength: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
  supportsImages: boolean;
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
  supportsJsonMode: boolean;
  supportsStreaming: boolean;
  supportsTools: boolean;
}

export const PROVIDER_KINDS = ['OPENAI', 'ANTHROPIC', 'GEMINI', 'GROQ', 'DEEPSEEK', 'CUSTOM'] as const;

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  OPENAI: {
    kind: 'OPENAI',
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions',
    helpText: 'Enter your OpenAI API key from platform.openai.com',
    icon: 'OpenAI',
    defaultModels: [
      { modelId: 'gpt-5', name: 'GPT-5', contextLength: 256000, inputCostPer1k: 0.005, outputCostPer1k: 0.015, supportsImages: true, supportsVision: true, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
      { modelId: 'gpt-5-mini', name: 'GPT-5 mini', contextLength: 256000, inputCostPer1k: 0.0003, outputCostPer1k: 0.0009, supportsImages: true, supportsVision: true, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
      { modelId: 'gpt-4.1', name: 'GPT-4.1', contextLength: 1047576, inputCostPer1k: 0.002, outputCostPer1k: 0.008, supportsImages: false, supportsVision: true, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
      { modelId: 'gpt-4.1-mini', name: 'GPT-4.1 mini', contextLength: 1047576, inputCostPer1k: 0.0004, outputCostPer1k: 0.0016, supportsImages: false, supportsVision: true, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
      { modelId: 'gpt-image-1', name: 'GPT Image', contextLength: 0, inputCostPer1k: 0, outputCostPer1k: 0.04, supportsImages: true, supportsVision: false, supportsFunctionCalling: false, supportsJsonMode: false, supportsStreaming: false, supportsTools: false },
      { modelId: 'dall-e-3', name: 'DALL-E 3', contextLength: 0, inputCostPer1k: 0, outputCostPer1k: 0.04, supportsImages: true, supportsVision: false, supportsFunctionCalling: false, supportsJsonMode: false, supportsStreaming: false, supportsTools: false },
    ],
  },
  ANTHROPIC: {
    kind: 'ANTHROPIC',
    name: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    modelsEndpoint: '', // Anthropic has no /models endpoint
    chatEndpoint: '/messages',
    helpText: 'Enter your Anthropic API key from console.anthropic.com',
    icon: 'Anthropic',
    defaultModels: [
      { modelId: 'claude-sonnet-4-20250514', name: 'Claude Sonnet', contextLength: 200000, inputCostPer1k: 0.003, outputCostPer1k: 0.015, supportsImages: true, supportsVision: true, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
      { modelId: 'claude-3-5-haiku-20241022', name: 'Claude Haiku', contextLength: 200000, inputCostPer1k: 0.001, outputCostPer1k: 0.005, supportsImages: true, supportsVision: true, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
      { modelId: 'claude-opus-4-20250514', name: 'Claude Opus', contextLength: 200000, inputCostPer1k: 0.015, outputCostPer1k: 0.075, supportsImages: true, supportsVision: true, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
    ],
  },
  GEMINI: {
    kind: 'GEMINI',
    name: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    modelsEndpoint: '/models',
    chatEndpoint: '', // constructed dynamically per model
    helpText: 'Enter your Google AI API key from aistudio.google.com',
    icon: 'Gemini',
    defaultModels: [
      { modelId: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextLength: 1048576, inputCostPer1k: 0.00125, outputCostPer1k: 0.01, supportsImages: true, supportsVision: true, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
      { modelId: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextLength: 1048576, inputCostPer1k: 0.00015, outputCostPer1k: 0.0006, supportsImages: true, supportsVision: true, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
      { modelId: 'gemini-2.0-flash-image', name: 'Gemini Image', contextLength: 0, inputCostPer1k: 0, outputCostPer1k: 0.039, supportsImages: true, supportsVision: false, supportsFunctionCalling: false, supportsJsonMode: false, supportsStreaming: false, supportsTools: false },
    ],
  },
  GROQ: {
    kind: 'GROQ',
    name: 'Groq',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions',
    helpText: 'Enter your Groq API key from console.groq.com',
    icon: 'Groq',
    defaultModels: [
      { modelId: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextLength: 131072, inputCostPer1k: 0.00059, outputCostPer1k: 0.00079, supportsImages: false, supportsVision: false, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
      { modelId: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', contextLength: 131072, inputCostPer1k: 0.00005, outputCostPer1k: 0.00008, supportsImages: false, supportsVision: false, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
      { modelId: 'llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout', contextLength: 131072, inputCostPer1k: 0.00011, outputCostPer1k: 0.00034, supportsImages: false, supportsVision: true, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
    ],
  },
  DEEPSEEK: {
    kind: 'DEEPSEEK',
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions',
    helpText: 'Enter your DeepSeek API key from platform.deepseek.com',
    icon: 'DeepSeek',
    defaultModels: [
      { modelId: 'deepseek-chat', name: 'DeepSeek V3', contextLength: 131072, inputCostPer1k: 0.00014, outputCostPer1k: 0.00028, supportsImages: false, supportsVision: false, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: false },
      { modelId: 'deepseek-reasoner', name: 'DeepSeek R1', contextLength: 131072, inputCostPer1k: 0.00055, outputCostPer1k: 0.00219, supportsImages: false, supportsVision: false, supportsFunctionCalling: false, supportsJsonMode: false, supportsStreaming: true, supportsTools: false },
    ],
  },
  CUSTOM: {
    // Custom OpenAI-compatible provider. The admin configures the Base URL
    // and API key; we treat it as an OpenAI-compatible endpoint for chat,
    // models listing, and image generation.
    kind: 'CUSTOM',
    name: 'Custom',
    defaultBaseUrl: '', // Admin must provide — no default
    modelsEndpoint: '/models', // OpenAI-compatible models endpoint
    chatEndpoint: '/chat/completions', // OpenAI-compatible chat endpoint
    helpText: 'Enter the Base URL and API key for your OpenAI-compatible provider (e.g. https://api.example.com/v1).',
    icon: 'Settings',
    defaultModels: [], // No defaults — models are synced from the provider's /models endpoint
  },
};

// Set of model IDs that are image-generation models (type IMAGE).
// Used by syncModels to correctly type synced models.
export const IMAGE_MODEL_IDS = new Set([
  'gpt-image-1',
  'dall-e-3',
  'dall-e-2',
  'gemini-2.0-flash-image',
  'gemini-image-gen',
]);

export function getProviderConfig(kind: string): ProviderConfig {
  return PROVIDER_CONFIGS[kind] ?? {
    kind,
    name: kind,
    defaultBaseUrl: '',
    modelsEndpoint: '',
    chatEndpoint: '',
    helpText: '',
    icon: 'Settings',
    defaultModels: [],
  };
}

export function isImageModelId(modelId: string): boolean {
  return IMAGE_MODEL_IDS.has(modelId);
}
