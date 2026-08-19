// ============================================================
// AI PROVIDER CONFIGURATIONS
// ============================================================

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
      { modelId: 'gpt-4o', name: 'GPT-4o', contextLength: 128000, inputCostPer1k: 0.0025, outputCostPer1k: 0.01, supportsImages: true, supportsVision: true, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
      { modelId: 'gpt-4o-mini', name: 'GPT-4o Mini', contextLength: 128000, inputCostPer1k: 0.00015, outputCostPer1k: 0.0006, supportsImages: true, supportsVision: true, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
      { modelId: 'gpt-4.1', name: 'GPT-4.1', contextLength: 1047576, inputCostPer1k: 0.002, outputCostPer1k: 0.008, supportsImages: false, supportsVision: true, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
      { modelId: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', contextLength: 1047576, inputCostPer1k: 0.0004, outputCostPer1k: 0.0016, supportsImages: false, supportsVision: true, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
      { modelId: 'o3-mini', name: 'o3-mini', contextLength: 200000, inputCostPer1k: 0.0011, outputCostPer1k: 0.0044, supportsImages: false, supportsVision: false, supportsFunctionCalling: true, supportsJsonMode: false, supportsStreaming: false, supportsTools: true },
    ],
  },
  ANTHROPIC: {
    kind: 'ANTHROPIC',
    name: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    modelsEndpoint: '',
    chatEndpoint: '/messages',
    helpText: 'Enter your Anthropic API key from console.anthropic.com',
    icon: 'Anthropic',
    defaultModels: [
      { modelId: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextLength: 200000, inputCostPer1k: 0.003, outputCostPer1k: 0.015, supportsImages: true, supportsVision: true, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
      { modelId: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextLength: 200000, inputCostPer1k: 0.003, outputCostPer1k: 0.015, supportsImages: true, supportsVision: true, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
      { modelId: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextLength: 200000, inputCostPer1k: 0.001, outputCostPer1k: 0.005, supportsImages: true, supportsVision: true, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
      { modelId: 'claude-opus-4-20250514', name: 'Claude Opus 4', contextLength: 200000, inputCostPer1k: 0.015, outputCostPer1k: 0.075, supportsImages: true, supportsVision: true, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
    ],
  },
  GEMINI: {
    kind: 'GEMINI',
    name: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    modelsEndpoint: '/models',
    chatEndpoint: '',
    helpText: 'Enter your Google AI API key from aistudio.google.com',
    icon: 'Gemini',
    defaultModels: [
      { modelId: 'gemini-2.5-pro-preview-06-05', name: 'Gemini 2.5 Pro', contextLength: 1048576, inputCostPer1k: 0.00125, outputCostPer1k: 0.01, supportsImages: true, supportsVision: true, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
      { modelId: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash', contextLength: 1048576, inputCostPer1k: 0.00015, outputCostPer1k: 0.0006, supportsImages: true, supportsVision: true, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
      { modelId: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextLength: 1048576, inputCostPer1k: 0.0001, outputCostPer1k: 0.0004, supportsImages: true, supportsVision: true, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
    ],
  },
  OPENROUTER: {
    kind: 'OPENROUTER',
    name: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions',
    helpText: 'Enter your OpenRouter API key from openrouter.ai',
    icon: 'OpenRouter',
    defaultModels: [
      { modelId: 'openrouter/auto', name: 'Auto (Best Available)', contextLength: 128000, inputCostPer1k: 0.001, outputCostPer1k: 0.003, supportsImages: true, supportsVision: true, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
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
      { modelId: 'qwen-qwq-32b', name: 'Qwen QwQ 32B', contextLength: 131072, inputCostPer1k: 0.00029, outputCostPer1k: 0.00039, supportsImages: false, supportsVision: false, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: true },
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
      { modelId: 'deepseek-chat', name: 'DeepSeek Chat (V3)', contextLength: 131072, inputCostPer1k: 0.00014, outputCostPer1k: 0.00028, supportsImages: false, supportsVision: false, supportsFunctionCalling: true, supportsJsonMode: true, supportsStreaming: true, supportsTools: false },
      { modelId: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)', contextLength: 131072, inputCostPer1k: 0.00055, outputCostPer1k: 0.00219, supportsImages: false, supportsVision: false, supportsFunctionCalling: false, supportsJsonMode: false, supportsStreaming: true, supportsTools: false },
    ],
  },
  OLLAMA: {
    kind: 'OLLAMA',
    name: 'Ollama (Local)',
    defaultBaseUrl: 'http://localhost:11434/v1',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions',
    helpText: 'Enter your Ollama server URL (default: http://localhost:11434)',
    icon: 'Ollama',
    defaultModels: [],
  },
  AZURE_OPENAI: {
    kind: 'AZURE_OPENAI',
    name: 'Azure OpenAI',
    defaultBaseUrl: '',
    modelsEndpoint: '',
    chatEndpoint: '',
    helpText: 'Enter your Azure OpenAI endpoint and API key from portal.azure.com',
    icon: 'Azure',
    defaultModels: [],
  },
};

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
