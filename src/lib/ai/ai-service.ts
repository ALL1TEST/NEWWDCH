// ============================================================
// AI SERVICE — Unified interface for all AI providers
// ============================================================

import { db } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/encryption';
import { getProviderConfig, type ProviderModel } from './providers';
import type { Prisma } from '@prisma/client';

// -------------------- Types --------------------

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  providerId: string;
  modelId?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  jsonMode?: boolean;
  stream?: boolean;
  siteId?: string;
  userId?: string;
}

export interface ChatResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  durationMs: number;
  providerName: string;
}

export interface HealthCheckResult {
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  latencyMs: number;
  error?: string;
  availableModels?: ProviderModel[];
}

// -------------------- Core AI Service --------------------

export async function executeChat(req: ChatRequest): Promise<ChatResponse> {
  const provider = await db.aiProvider.findUnique({
    where: { id: req.providerId },
    include: { models: true },
  });

  if (!provider) throw new Error('Provider not found');
  if (!provider.isActive) throw new Error('Provider is disabled');
  if (!provider.apiKeyEncrypted) throw new Error('API key not configured');

  const apiKey = await decrypt(provider.apiKeyEncrypted);
  const config = getProviderConfig(provider.kind);
  const baseUrl = provider.baseUrl || config.defaultBaseUrl;
  const modelId = req.modelId || provider.models.find(m => m.isDefault)?.modelId || provider.models[0]?.modelId;
  if (!modelId) throw new Error('No model available');

  const startTime = Date.now();
  let inputTokens = 0;
  let outputTokens = 0;
  let content = '';

  try {
    if (provider.kind === 'ANTHROPIC') {
      const result = await callAnthropic(baseUrl, apiKey, modelId, req.messages, {
        temperature: req.temperature,
        maxTokens: req.maxTokens,
        jsonMode: req.jsonMode,
      });
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
      content = result.content;
    } else if (provider.kind === 'GEMINI') {
      const result = await callGemini(baseUrl, apiKey, modelId, req.messages, {
        temperature: req.temperature,
        maxTokens: req.maxTokens,
        jsonMode: req.jsonMode,
      });
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
      content = result.content;
    } else if (provider.kind === 'AZURE_OPENAI') {
      const azureConfig = JSON.parse(provider.config || '{}');
      const result = await callOpenAI(
        `${baseUrl}/openai/deployments/${azureConfig.deployment || modelId}`,
        apiKey,
        modelId,
        req.messages,
        { temperature: req.temperature, maxTokens: req.maxTokens, jsonMode: req.jsonMode, apiVersion: provider.apiVersion || '2024-02-01' },
      );
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
      content = result.content;
    } else {
      // OpenAI-compatible (OpenAI, Groq, DeepSeek, OpenRouter, Ollama)
      const result = await callOpenAI(baseUrl, apiKey, modelId, req.messages, {
        temperature: req.temperature,
        maxTokens: req.maxTokens,
        topP: req.topP,
        frequencyPenalty: req.frequencyPenalty,
        presencePenalty: req.presencePenalty,
        jsonMode: req.jsonMode,
      });
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
      content = result.content;
    }
  } catch (err) {
    // Try fallback providers
    const fallbacks = await db.aiProviderFallback.findMany({
      where: { providerId: provider.id },
      include: { fallback: { include: { models: true } } },
      orderBy: { priority: 'asc' },
    });

    for (const fb of fallbacks) {
      if (!fb.fallback.isActive || !fb.fallback.apiKeyEncrypted) continue;
      try {
        const fbApiKey = await decrypt(fb.fallback.apiKeyEncrypted);
        const fbConfig = getProviderConfig(fb.fallback.kind);
        const fbBaseUrl = fb.fallback.baseUrl || fbConfig.defaultBaseUrl;
        const fbModel = req.modelId || fb.fallback.models.find(m => m.isDefault)?.modelId || fb.fallback.models[0]?.modelId;
        if (!fbModel) continue;

        const result = await callOpenAI(fbBaseUrl, fbApiKey, fbModel, req.messages, {
          temperature: req.temperature,
          maxTokens: req.maxTokens,
          jsonMode: req.jsonMode,
        });
        inputTokens = result.inputTokens;
        outputTokens = result.outputTokens;
        content = result.content;
        break;
      } catch {
        continue;
      }
    }

    if (!content) throw err;
  }

  const durationMs = Date.now() - startTime;
  const totalTokens = inputTokens + outputTokens;
  const model = provider.models.find(m => m.modelId === modelId);
  const costUsd = model
    ? (inputTokens / 1000) * (model.inputCostPer1k || 0) + (outputTokens / 1000) * (model.outputCostPer1k || 0)
    : 0;

  // Update provider
  await db.aiProvider.update({
    where: { id: provider.id },
    data: {
      lastUsedAt: new Date(),
      latencyMs: durationMs,
      connectionStatus: 'CONNECTED',
      lastError: null,
    },
  });

  // Log the request
  await db.aiLog.create({
    data: {
      providerId: provider.id,
      providerName: provider.name,
      modelId,
      question: req.messages.map(m => m.content).join('\n'),
      response: content,
      inputTokens,
      outputTokens,
      totalTokens,
      costUsd,
      durationMs,
      status: 'success',
      siteId: req.siteId,
      userId: req.userId,
    },
  });

  return {
    content,
    model: modelId,
    inputTokens,
    outputTokens,
    totalTokens,
    costUsd,
    durationMs,
    providerName: provider.name,
  };
}

// -------------------- Provider-specific call implementations --------------------

async function callOpenAI(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; topP?: number; frequencyPenalty?: number; presencePenalty?: number; jsonMode?: boolean; apiVersion?: string } = {},
) {
  const url = opts.apiVersion
    ? `${baseUrl}?api-version=${opts.apiVersion}`
    : `${baseUrl}/chat/completions`;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 2048,
  };
  if (opts.topP !== undefined) body.top_p = opts.topP;
  if (opts.frequencyPenalty !== undefined) body.frequency_penalty = opts.frequencyPenalty;
  if (opts.presencePenalty !== undefined) body.presence_penalty = opts.presencePenalty;
  if (opts.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
  };
}

async function callAnthropic(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; jsonMode?: boolean } = {},
) {
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMsgs = messages.filter(m => m.role !== 'system');

  const body: Record<string, unknown> = {
    model,
    messages: chatMsgs.map(m => ({ role: m.role, content: m.content })),
    max_tokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0.7,
  };
  if (systemMsg) body.system = systemMsg.content;

  const res = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  return {
    content: data.content?.[0]?.text || '',
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
  };
}

async function callGemini(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; jsonMode?: boolean } = {},
) {
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMsgs = messages.filter(m => m.role !== 'system');

  const body: Record<string, unknown> = {
    contents: chatMsgs.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens ?? 2048,
    },
  };

  const res = await fetch(
    `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    inputTokens: data.usageMetadata?.promptTokenCount || 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
  };
}

// -------------------- Health Check --------------------

export async function healthCheck(providerId: string): Promise<HealthCheckResult> {
  const provider = await db.aiProvider.findUnique({ where: { id: providerId } });
  if (!provider) throw new Error('Provider not found');
  if (!provider.apiKeyEncrypted) return { status: 'DISCONNECTED', latencyMs: 0, error: 'No API key configured' };

  const apiKey = await decrypt(provider.apiKeyEncrypted);
  const config = getProviderConfig(provider.kind);
  const baseUrl = provider.baseUrl || config.defaultBaseUrl;

  const start = Date.now();
  try {
    let models: ProviderModel[] = [];

    if (provider.kind === 'ANTHROPIC') {
      // Anthropic has no models endpoint, just test with a simple request
      const res = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      models = config.defaultModels;
    } else if (provider.kind === 'GEMINI') {
      const res = await fetch(`${baseUrl}/models?key=${apiKey}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      models = config.defaultModels;
    } else if (config.modelsEndpoint) {
      const res = await fetch(`${baseUrl}${config.modelsEndpoint}`, {
        headers: provider.kind === 'OLLAMA' ? {} : { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.data) {
        models = data.data.map((m: { id: string }) => ({
          modelId: m.id, name: m.id, contextLength: 0,
          inputCostPer1k: 0, outputCostPer1k: 0,
          supportsImages: false, supportsVision: false,
          supportsFunctionCalling: false, supportsJsonMode: false,
          supportsStreaming: true, supportsTools: false,
        }));
      }
    }

    const latencyMs = Date.now() - start;

    await db.aiProvider.update({
      where: { id: providerId },
      data: {
        connectionStatus: 'CONNECTED',
        latencyMs,
        lastHealthCheckAt: new Date(),
        lastError: null,
      },
    });

    return { status: 'CONNECTED', latencyMs, availableModels: models };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';

    await db.aiProvider.update({
      where: { id: providerId },
      data: {
        connectionStatus: 'ERROR',
        latencyMs,
        lastError: errorMsg,
        lastHealthCheckAt: new Date(),
      },
    });

    return { status: 'ERROR', latencyMs, error: errorMsg };
  }
}

// -------------------- Sync Models --------------------

export async function syncModels(providerId: string): Promise<number> {
  const provider = await db.aiProvider.findUnique({ where: { id: providerId } });
  if (!provider) throw new Error('Provider not found');
  if (!provider.apiKeyEncrypted) throw new Error('No API key');

  const apiKey = await decrypt(provider.apiKeyEncrypted);
  const config = getProviderConfig(provider.kind);
  const baseUrl = provider.baseUrl || config.defaultBaseUrl;

  let fetchedModels: ProviderModel[] = config.defaultModels;

  // Try to fetch from API if endpoint exists
  if (config.modelsEndpoint && provider.kind !== 'ANTHROPIC' && provider.kind !== 'AZURE_OPENAI') {
    try {
      const res = await fetch(`${baseUrl}${config.modelsEndpoint}`, {
        headers: provider.kind === 'OLLAMA' ? {} : { 'Authorization': `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          const existingIds = new Set(config.defaultModels.map(m => m.modelId));
          const newModels = data.data
            .filter((m: { id: string }) => !existingIds.has(m.id))
            .map((m: { id: string }) => ({
              modelId: m.id, name: m.id, contextLength: 0,
              inputCostPer1k: 0, outputCostPer1k: 0,
              supportsImages: false, supportsVision: false,
              supportsFunctionCalling: false, supportsJsonMode: false,
              supportsStreaming: true, supportsTools: false,
            }));
          fetchedModels = [...config.defaultModels, ...newModels];
        }
      }
    } catch { /* use defaults */ }
  }

  // Upsert models
  let count = 0;
  for (const model of fetchedModels) {
    await db.aiModel.upsert({
      where: { providerId_modelId: { providerId, modelId: model.modelId } },
      update: { name: model.name, contextLength: model.contextLength, inputCostPer1k: model.inputCostPer1k, outputCostPer1k: model.outputCostPer1k, supportsImages: model.supportsImages, supportsVision: model.supportsVision, supportsFunctionCalling: model.supportsFunctionCalling, supportsJsonMode: model.supportsJsonMode, supportsStreaming: model.supportsStreaming, supportsTools: model.supportsTools, lastSyncedAt: new Date() },
      create: { providerId, modelId: model.modelId, name: model.name, contextLength: model.contextLength, inputCostPer1k: model.inputCostPer1k, outputCostPer1k: model.outputCostPer1k, supportsImages: model.supportsImages, supportsVision: model.supportsVision, supportsFunctionCalling: model.supportsFunctionCalling, supportsJsonMode: model.supportsJsonMode, supportsStreaming: model.supportsStreaming, supportsTools: model.supportsTools, lastSyncedAt: new Date() },
    });
    count++;
  }

  await db.aiProvider.update({
    where: { id: providerId },
    data: { lastSyncAt: new Date() },
  });

  return count;
}

// -------------------- Encrypt/Save API Key --------------------

export async function saveProviderApiKey(providerId: string, apiKey: string): Promise<void> {
 const encrypted = await encrypt(apiKey);
  await db.aiProvider.update({
    where: { id: providerId },
    data: { apiKeyEncrypted: encrypted },
  });
}

// -------------------- Usage Analytics --------------------

export async function getUsageAnalytics(siteId?: string, period: 'day' | 'week' | 'month' = 'month') {
  const now = new Date();
  const periodStart = new Date();
  if (period === 'day') periodStart.setHours(now.getHours() - 24);
  else if (period === 'week') periodStart.setDate(now.getDate() - 7);
  else periodStart.setMonth(now.getMonth() - 1);

  const where: Prisma.AiLogWhereInput = {
    createdAt: { gte: periodStart },
    ...(siteId ? { siteId } : {}),
  };

  const [totalCount, totalTokens, totalCost, errorCount, avgDuration] = await Promise.all([
    db.aiLog.count({ where }),
    db.aiLog.aggregate({ where, _sum: { totalTokens: true, inputTokens: true, outputTokens: true } }),
    db.aiLog.aggregate({ where, _sum: { costUsd: true } }),
    db.aiLog.count({ where: { ...where, status: 'error' } }),
    db.aiLog.aggregate({ where: { ...where, status: 'success' }, _avg: { durationMs: true } }),
  ]);

  // Provider breakdown
  const providerBreakdown = await db.aiLog.groupBy({
    by: ['providerName'],
    where,
    _sum: { totalTokens: true, costUsd: true, inputTokens: true, outputTokens: true },
    _count: true,
    orderBy: { _sum: { costUsd: 'desc' } },
  });

  // Model breakdown
  const modelBreakdown = await db.aiLog.groupBy({
    by: ['modelId'],
    where,
    _sum: { totalTokens: true, costUsd: true },
    _count: true,
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });

  // Daily usage chart
  const dailyUsage = await db.$queryRawUnsafe<Array<{ date: string; count: number; tokens: number; cost: number }>>(`
    SELECT DATE(createdAt) as date, COUNT(*) as count, COALESCE(SUM(totalTokens), 0) as tokens, COALESCE(SUM(costUsd), 0) as cost
    FROM AiLog
    WHERE createdAt >= ?
    ${siteId ? 'AND siteId = ?' : ''}
    GROUP BY DATE(createdAt)
    ORDER BY date ASC
  `, periodStart.toISOString(), ...(siteId ? [siteId] : []));

  return {
    totalRequests: totalCount,
    totalTokens: totalTokens._sum.totalTokens || 0,
    inputTokens: totalTokens._sum.inputTokens || 0,
    outputTokens: totalTokens._sum.outputTokens || 0,
    totalCost: totalCost._sum.costUsd || 0,
    errorCount,
    successRate: totalCount > 0 ? ((totalCount - errorCount) / totalCount) * 100 : 100,
    avgDurationMs: Math.round(avgDuration._avg.durationMs || 0),
    providerBreakdown,
    modelBreakdown,
    dailyUsage,
  };
}

// -------------------- Marketplace Prompt Packs --------------------

// -------------------- Image Generation -------------------

export interface ImageGenerationRequest {
  providerId: string;
  modelId?: string;
  prompt: string;
  negativePrompt?: string;
  size?: string;           // e.g. "1024x1024", "1792x1024", "1024x1792"
  quality?: string;        // "standard" | "hd"
  style?: string;          // "vivid" | "natural"
  n?: number;              // number of images (1-10, DALL-E 3 forces 1)
  responseFormat?: string; // "url" | "b64_json"
  siteId?: string;
  userId?: string;
}

export interface GeneratedImage {
  url: string | null;
  base64: string | null;
  revisedPrompt: string | null;
}

export interface ImageGenerationResponse {
  images: GeneratedImage[];
  model: string;
  costUsd: number;
  durationMs: number;
  providerName: string;
  providerKind: string;
}

// Approximate cost per image (USD) for known models, keyed by model then size
const IMAGE_MODEL_COSTS: Record<string, Record<string, number>> = {
  'dall-e-2': { '256x256': 0.016, '512x512': 0.016, '1024x1024': 0.02 },
  'dall-e-3': { '1024x1024': 0.040, '1792x1024': 0.080, '1024x1792': 0.080 },
  'gpt-image-1': { '1024x1024': 0.040, '1536x1024': 0.080, '1024x1536': 0.080 },
};

function getImageCost(modelId: string, size: string): number {
  const modelCosts = IMAGE_MODEL_COSTS[modelId];
  if (modelCosts) {
    return modelCosts[size] ?? modelCosts['1024x1024'] ?? 0.04;
  }
  // Fallback: use default estimate
  return 0.04;
}

async function callOpenAIImageGeneration(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  opts: {
    negativePrompt?: string;
    size?: string;
    quality?: string;
    style?: string;
    n?: number;
    responseFormat?: string;
    apiVersion?: string;
  } = {},
): Promise<{ images: GeneratedImage[] }> {
  const url = opts.apiVersion
    ? `${baseUrl}/images/generations?api-version=${opts.apiVersion}`
    : `${baseUrl}/images/generations`;

  const body: Record<string, unknown> = {
    model,
    prompt,
    n: opts.n ?? 1,
    size: opts.size ?? '1024x1024',
    response_format: opts.responseFormat ?? 'url',
  };

  if (opts.quality) body.quality = opts.quality;
  if (opts.style) body.style = opts.style;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Image generation API error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  const images: GeneratedImage[] = (data.data ?? []).map((item: Record<string, unknown>) => ({
    url: (item.url as string) ?? null,
    base64: (item.b64_json as string) ?? null,
    revisedPrompt: (item.revised_prompt as string) ?? null,
  }));

  return { images };
}

async function callGeminiImageGeneration(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  opts: {
    negativePrompt?: string;
    size?: string;
    n?: number;
    responseFormat?: string;
  } = {},
): Promise<{ images: GeneratedImage[] }> {
  // Parse size to aspect ratio for Gemini Imagen
  const sizeParts = (opts.size ?? '1024x1024').split('x');
  const width = parseInt(sizeParts[0] ?? '1024', 10);
  const height = parseInt(sizeParts[1] ?? '1024', 10);
  let ratio: string;
  if (Math.abs(width - height) < 100) {
    ratio = '1:1'; // square
  } else {
    ratio = width >= height ? '16:9' : '9:16';
  }

  // Gemini uses Imagen via the generateContent endpoint with image generation config
  // or the dedicated Imagen predict endpoint
  const res = await fetch(
    `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          // @ts-expect-error -- Gemini-specific field
          imageGenerationConfig: {
            numberOfImages: opts.n ?? 1,
            aspectRatio: ratio,
          },
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini image generation error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  const images: GeneratedImage[] = [];

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData) {
      images.push({
        url: null,
        base64: part.inlineData.data ?? null,
        revisedPrompt: prompt,
      });
    }
  }

  // Fallback: if no image parts returned, throw
  if (images.length === 0) {
    throw new Error('No images were generated by Gemini');
  }

  return { images };
}

export async function executeImageGeneration(req: ImageGenerationRequest): Promise<ImageGenerationResponse> {
  const provider = await db.aiProvider.findUnique({
    where: { id: req.providerId },
    include: { models: true },
  });

  if (!provider) throw new Error('Provider not found');
  if (!provider.isActive) throw new Error('Provider is disabled');
  if (!provider.apiKeyEncrypted) throw new Error('API key not configured');

  const apiKey = await decrypt(provider.apiKeyEncrypted);
  const config = getProviderConfig(provider.kind);
  const baseUrl = provider.baseUrl || config.defaultBaseUrl;
  const modelId = req.modelId || provider.models.find(m => m.isDefault)?.modelId || provider.models[0]?.modelId;
  if (!modelId) throw new Error('No model available');

  const startTime = Date.now();
  let images: GeneratedImage[] = [];
  let usedProvider = provider;

  try {
    if (provider.kind === 'GEMINI') {
      const result = await callGeminiImageGeneration(baseUrl, apiKey, modelId, req.prompt, {
        negativePrompt: req.negativePrompt,
        size: req.size,
        n: req.n,
        responseFormat: req.responseFormat,
      });
      images = result.images;
    } else if (provider.kind === 'AZURE_OPENAI') {
      const azureConfig = JSON.parse(provider.config || '{}');
      const result = await callOpenAIImageGeneration(
        `${baseUrl}/openai/deployments/${azureConfig.deployment || modelId}`,
        apiKey,
        modelId,
        req.prompt,
        { size: req.size, quality: req.quality, style: req.style, n: req.n, responseFormat: req.responseFormat, apiVersion: provider.apiVersion || '2024-02-01' },
      );
      images = result.images;
    } else if (
      provider.kind === 'OPENAI' ||
      provider.kind === 'OPENROUTER' ||
      provider.kind === 'GROQ' ||
      provider.kind === 'DEEPSEEK' ||
      provider.kind === 'OLLAMA'
    ) {
      const result = await callOpenAIImageGeneration(baseUrl, apiKey, modelId, req.prompt, {
        negativePrompt: req.negativePrompt,
        size: req.size,
        quality: req.quality,
        style: req.style,
        n: req.n,
        responseFormat: req.responseFormat,
      });
      images = result.images;
    } else {
      // Attempt OpenAI-compatible for unknown providers
      const result = await callOpenAIImageGeneration(baseUrl, apiKey, modelId, req.prompt, {
        negativePrompt: req.negativePrompt,
        size: req.size,
        quality: req.quality,
        style: req.style,
        n: req.n,
        responseFormat: req.responseFormat,
      });
      images = result.images;
    }
  } catch (err) {
    // Try fallback providers for image generation
    const fallbacks = await db.aiProviderFallback.findMany({
      where: { providerId: provider.id },
      include: { fallback: { include: { models: true } } },
      orderBy: { priority: 'asc' },
    });

    for (const fb of fallbacks) {
      if (!fb.fallback.isActive || !fb.fallback.apiKeyEncrypted) continue;
      try {
        const fbApiKey = await decrypt(fb.fallback.apiKeyEncrypted);
        const fbBaseUrl = fb.fallback.baseUrl || getProviderConfig(fb.fallback.kind).defaultBaseUrl;
        const fbModel = req.modelId || fb.fallback.models.find(m => m.isDefault)?.modelId || fb.fallback.models[0]?.modelId;
        if (!fbModel) continue;

        const result = await callOpenAIImageGeneration(fbBaseUrl, fbApiKey, fbModel, req.prompt, {
          size: req.size, quality: req.quality, style: req.style, n: req.n, responseFormat: req.responseFormat,
        });
        images = result.images;
        usedProvider = fb.fallback;
        break;
      } catch {
        continue;
      }
    }

    if (images.length === 0) throw err;
  }

  const durationMs = Date.now() - startTime;
  const size = req.size ?? '1024x1024';
  const n = images.length;
  const costUsd = n * getImageCost(modelId, size);

  // Update provider stats
  await db.aiProvider.update({
    where: { id: usedProvider.id },
    data: {
      lastUsedAt: new Date(),
      latencyMs: durationMs,
      connectionStatus: 'CONNECTED',
      lastError: null,
    },
  });

  // Log the request
  await db.aiLog.create({
    data: {
      providerId: usedProvider.id,
      providerName: usedProvider.name,
      modelId,
      question: `[IMAGE] ${req.prompt}`,
      response: JSON.stringify({
        imagesGenerated: n,
        size,
        format: req.responseFormat ?? 'url',
        model: modelId,
      }),
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsd,
      durationMs,
      status: 'success',
      siteId: req.siteId,
      userId: req.userId,
    },
  });

  return {
    images,
    model: modelId,
    costUsd,
    durationMs,
    providerName: usedProvider.name,
    providerKind: usedProvider.kind,
  };
}

// -------------------- Marketplace Prompt Packs --------------------

export const MARKETPLACE_PACKS = [
  {
    packName: 'SEO Pack',
    slug: 'seo-pack',
    category: 'SEO',
    description: 'Essential prompts for SEO content optimization',
    prompts: JSON.stringify([
      { name: 'Meta Description Generator', category: 'SEO', systemPrompt: 'You are an SEO expert.', userPrompt: 'Generate an SEO-optimized meta description for: {{title}}. Keep it under 160 characters.', variables: '[{"name":"title","label":"Page Title","type":"text","required":true}]' },
      { name: 'SEO Optimizer', category: 'SEO', systemPrompt: 'You are an SEO content specialist.', userPrompt: 'Analyze and optimize this content for SEO: {{content}}. Target keyword: {{keyword}}.', variables: '[{"name":"content","label":"Content","type":"textarea","required":true},{"name":"keyword","label":"Target Keyword","type":"text","required":true}]' },
      { name: 'Keyword Suggestions', category: 'SEO', systemPrompt: 'You are a keyword research expert.', userPrompt: 'Suggest 20 related keywords for: {{keyword}} in {{language}}.', variables: '[{"name":"keyword","label":"Seed Keyword","type":"text","required":true},{"name":"language","label":"Language","type":"text","default":"English"}]' },
    ]),
  },
  {
    packName: 'Blogging Pack',
    slug: 'blogging-pack',
    category: 'Blogging',
    description: 'Complete blog writing and editing prompts',
    prompts: JSON.stringify([
      { name: 'Blog Writer', category: 'CONTENT_GENERATION', systemPrompt: 'You are a professional blog writer.', userPrompt: 'Write a comprehensive blog post about: {{topic}}. Target audience: {{audience}}. Tone: {{tone}}. Word count: {{word_count}}.', variables: '[{"name":"topic","label":"Topic","type":"text","required":true},{"name":"audience","label":"Target Audience","type":"text","default":"General readers"},{"name":"tone","label":"Tone","type":"text","default":"Professional"},{"name":"word_count","label":"Word Count","type":"number","default":1000}]' },
      { name: 'Blog Post Rewriter', category: 'CONTENT_GENERATION', systemPrompt: 'You are a content editor.', userPrompt: 'Rewrite the following blog post to improve clarity and engagement: {{content}}', variables: '[{"name":"content","label":"Blog Content","type":"textarea","required":true}]' },
      { name: 'Blog Outline Generator', category: 'CONTENT_GENERATION', systemPrompt: 'You are a content strategist.', userPrompt: 'Create a detailed outline for a blog post about: {{topic}}', variables: '[{"name":"topic","label":"Topic","type":"text","required":true}]' },
    ]),
  },
  {
    packName: 'Marketing Pack',
    slug: 'marketing-pack',
    category: 'Marketing',
    description: 'Marketing copy and campaign prompts',
    prompts: JSON.stringify([
      { name: 'Product Description', category: 'MARKETING', systemPrompt: 'You are a copywriter.', userPrompt: 'Write a compelling product description for: {{product}}. Features: {{features}}. Target audience: {{audience}}.', variables: '[{"name":"product","label":"Product Name","type":"text","required":true},{"name":"features","label":"Key Features","type":"textarea","required":true},{"name":"audience","label":"Target Audience","type":"text"}]' },
      { name: 'Ad Copy Generator', category: 'MARKETING', systemPrompt: 'You are an advertising copywriter.', userPrompt: 'Generate 5 ad copies for: {{product}}. Platform: {{platform}}. Goal: {{goal}}.', variables: '[{"name":"product","label":"Product","type":"text","required":true},{"name":"platform","label":"Platform","type":"text","default":"Google Ads"},{"name":"goal","label":"Campaign Goal","type":"text","default":"Conversions"}]' },
    ]),
  },
  {
    packName: 'Social Media Pack',
    slug: 'social-media-pack',
    category: 'Social Media',
    description: 'Social media content creation prompts',
    prompts: JSON.stringify([
      { name: 'Facebook Post', category: 'SOCIAL_MEDIA', systemPrompt: 'You are a social media manager.', userPrompt: 'Create an engaging Facebook post about: {{topic}}. Include relevant hashtags.', variables: '[{"name":"topic","label":"Topic","type":"text","required":true}]' },
      { name: 'Pinterest Pin', category: 'SOCIAL_MEDIA', systemPrompt: 'You are a Pinterest marketing expert.', userPrompt: 'Create a Pinterest pin description for: {{topic}}. Include keywords and hashtags.', variables: '[{"name":"topic","label":"Topic","type":"text","required":true}]' },
      { name: 'Social Post', category: 'SOCIAL_MEDIA', systemPrompt: 'You are a social media strategist.', userPrompt: 'Create a social media post for {{platform}} about: {{topic}}. Tone: {{tone}}.', variables: '[{"name":"platform","label":"Platform","type":"text","required":true},{"name":"topic","label":"Topic","type":"text","required":true},{"name":"tone","label":"Tone","type":"text","default":"Engaging"}]' },
    ]),
  },
  {
    packName: 'Email Marketing Pack',
    slug: 'email-marketing-pack',
    category: 'Email',
    description: 'Email marketing and newsletter prompts',
    prompts: JSON.stringify([
      { name: 'Newsletter', category: 'EMAIL', systemPrompt: 'You are an email marketing expert.', userPrompt: 'Write a newsletter about: {{topic}}. Audience: {{audience}}.', variables: '[{"name":"topic","label":"Topic","type":"text","required":true},{"name":"audience","label":"Audience","type":"text","default":"Subscribers"}]' },
      { name: 'Email Subject Line', category: 'EMAIL', systemPrompt: 'You are an email marketing specialist.', userPrompt: 'Generate 10 compelling email subject lines for: {{topic}}.', variables: '[{"name":"topic","label":"Email Topic","type":"text","required":true}]' },
    ]),
  },
];
