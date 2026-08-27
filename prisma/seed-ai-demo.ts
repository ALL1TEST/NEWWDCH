// ============================================================
// AI SECTION SEED SCRIPT — Test/Demo Data
// ============================================================
// Creates 5 providers (all Connected + Active), 13 models (11 text + 2 image),
// 3 prompt templates, and default AI settings. Uses FAKE API keys only.
// Idempotent: safe to run multiple times (uses upsert with stable IDs).
// ============================================================

import { db } from '../src/lib/db';
import { encrypt } from '../src/lib/encryption';

async function main() {
  // ---- Resolve a createdById (required FK to User) ----
  let creator = await db.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
  if (!creator) creator = await db.user.findFirst({ select: { id: true } });
  if (!creator) throw new Error('No user found — cannot seed AI data (createdById is required)');
  const createdById = creator.id;
  console.log(`Using createdById: ${createdById}`);

  // ---- Clean up old seed data from previous session ----
  // These all used the `seed-` ID prefix and are test data, not real user data.
  console.log('Cleaning up old seed data...');
  await db.promptTemplateVersion.deleteMany({ where: { template: { id: { startsWith: 'seed-' } } } }).catch(() => {});
  await db.promptTemplate.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  await db.aiModel.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  await db.aiProvider.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  console.log('  Old seed data cleaned.');

  // ============================================================
  // 1. AI PROVIDERS — 5 providers, all Connected + Active
  // ============================================================
  console.log('\nCreating providers...');

  const providers = {
    openai: await db.aiProvider.upsert({
      where: { id: 'ai-openai-test' },
      update: {
        name: 'OpenAI Test',
        kind: 'OPENAI',
        baseUrl: 'https://api.openai.com/v1',
        apiKeyEncrypted: await encrypt('sk-test-openai-fake-key-1234567890'),
        isActive: true,
        isDefault: true,
        connectionStatus: 'CONNECTED',
        latencyMs: 120,
        lastSyncAt: new Date(),
        lastHealthCheckAt: new Date(),
        lastError: null,
      },
      create: {
        id: 'ai-openai-test',
        name: 'OpenAI Test',
        kind: 'OPENAI',
        baseUrl: 'https://api.openai.com/v1',
        apiKeyEncrypted: await encrypt('sk-test-openai-fake-key-1234567890'),
        isActive: true,
        isDefault: true,
        connectionStatus: 'CONNECTED',
        latencyMs: 120,
        lastSyncAt: new Date(),
        lastHealthCheckAt: new Date(),
        createdById,
      },
    }),
    anthropic: await db.aiProvider.upsert({
      where: { id: 'ai-anthropic-test' },
      update: {
        name: 'Anthropic Test',
        kind: 'ANTHROPIC',
        baseUrl: 'https://api.anthropic.com/v1',
        apiKeyEncrypted: await encrypt('sk-ant-test-anthropic-fake-key-1234567890'),
        isActive: true,
        isDefault: false,
        connectionStatus: 'CONNECTED',
        latencyMs: 95,
        lastSyncAt: new Date(),
        lastHealthCheckAt: new Date(),
        lastError: null,
      },
      create: {
        id: 'ai-anthropic-test',
        name: 'Anthropic Test',
        kind: 'ANTHROPIC',
        baseUrl: 'https://api.anthropic.com/v1',
        apiKeyEncrypted: await encrypt('sk-ant-test-anthropic-fake-key-1234567890'),
        isActive: true,
        isDefault: false,
        connectionStatus: 'CONNECTED',
        latencyMs: 95,
        lastSyncAt: new Date(),
        lastHealthCheckAt: new Date(),
        createdById,
      },
    }),
    gemini: await db.aiProvider.upsert({
      where: { id: 'ai-gemini-test' },
      update: {
        name: 'Google Gemini Test',
        kind: 'GEMINI',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKeyEncrypted: await encrypt('AIza-test-gemini-fake-key-1234567890'),
        isActive: true,
        isDefault: false,
        connectionStatus: 'CONNECTED',
        latencyMs: 180,
        lastSyncAt: new Date(),
        lastHealthCheckAt: new Date(),
        lastError: null,
      },
      create: {
        id: 'ai-gemini-test',
        name: 'Google Gemini Test',
        kind: 'GEMINI',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKeyEncrypted: await encrypt('AIza-test-gemini-fake-key-1234567890'),
        isActive: true,
        isDefault: false,
        connectionStatus: 'CONNECTED',
        latencyMs: 180,
        lastSyncAt: new Date(),
        lastHealthCheckAt: new Date(),
        createdById,
      },
    }),
    groq: await db.aiProvider.upsert({
      where: { id: 'ai-groq-test' },
      update: {
        name: 'Groq Test',
        kind: 'GROQ',
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKeyEncrypted: await encrypt('gsk-test-groq-fake-key-1234567890'),
        isActive: true,
        isDefault: false,
        connectionStatus: 'CONNECTED',
        latencyMs: 45,
        lastSyncAt: new Date(),
        lastHealthCheckAt: new Date(),
        lastError: null,
      },
      create: {
        id: 'ai-groq-test',
        name: 'Groq Test',
        kind: 'GROQ',
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKeyEncrypted: await encrypt('gsk-test-groq-fake-key-1234567890'),
        isActive: true,
        isDefault: false,
        connectionStatus: 'CONNECTED',
        latencyMs: 45,
        lastSyncAt: new Date(),
        lastHealthCheckAt: new Date(),
        createdById,
      },
    }),
    deepseek: await db.aiProvider.upsert({
      where: { id: 'ai-deepseek-test' },
      update: {
        name: 'DeepSeek Test',
        kind: 'DEEPSEEK',
        baseUrl: 'https://api.deepseek.com/v1',
        apiKeyEncrypted: await encrypt('ds-test-deepseek-fake-key-1234567890'),
        isActive: true,
        isDefault: false,
        connectionStatus: 'CONNECTED',
        latencyMs: 210,
        lastSyncAt: new Date(),
        lastHealthCheckAt: new Date(),
        lastError: null,
      },
      create: {
        id: 'ai-deepseek-test',
        name: 'DeepSeek Test',
        kind: 'DEEPSEEK',
        baseUrl: 'https://api.deepseek.com/v1',
        apiKeyEncrypted: await encrypt('ds-test-deepseek-fake-key-1234567890'),
        isActive: true,
        isDefault: false,
        connectionStatus: 'CONNECTED',
        latencyMs: 210,
        lastSyncAt: new Date(),
        lastHealthCheckAt: new Date(),
        createdById,
      },
    }),
  };

  console.log('  ✓ OpenAI Test (OPENAI, Connected, Active, Default)');
  console.log('  ✓ Anthropic Test (ANTHROPIC, Connected, Active)');
  console.log('  ✓ Google Gemini Test (GEMINI, Connected, Active)');
  console.log('  ✓ Groq Test (GROQ, Connected, Active)');
  console.log('  ✓ DeepSeek Test (DEEPSEEK, Connected, Active)');

  // ============================================================
  // 2. AI MODELS — 11 text + 2 image = 13 models
  // ============================================================
  console.log('\nCreating models...');

  type ModelSpec = {
    id: string;
    name: string;
    modelId: string;
    providerId: string;
    type: 'TEXT' | 'IMAGE';
    isActive: boolean;
    isDefault: boolean;
    contextLength?: number;
    inputCostPer1k?: number;
    outputCostPer1k?: number;
    supportsVision?: boolean;
    supportsFunctionCalling?: boolean;
    supportsImages?: boolean;
  };

  const modelSpecs: ModelSpec[] = [
    // ---- OpenAI Test ----
    { id: 'm-openai-gpt5', name: 'GPT-5', modelId: 'gpt-5', providerId: providers.openai.id, type: 'TEXT', isActive: true, isDefault: true, contextLength: 256000, inputCostPer1k: 0.005, outputCostPer1k: 0.015, supportsVision: true, supportsFunctionCalling: true, supportsImages: true },
    { id: 'm-openai-gpt5-mini', name: 'GPT-5 mini', modelId: 'gpt-5-mini', providerId: providers.openai.id, type: 'TEXT', isActive: true, isDefault: false, contextLength: 256000, inputCostPer1k: 0.0003, outputCostPer1k: 0.0009, supportsVision: true, supportsFunctionCalling: true, supportsImages: true },
    { id: 'm-openai-gpt4-1', name: 'GPT-4.1', modelId: 'gpt-4.1', providerId: providers.openai.id, type: 'TEXT', isActive: true, isDefault: false, contextLength: 1047576, inputCostPer1k: 0.002, outputCostPer1k: 0.008, supportsVision: true, supportsFunctionCalling: true },
    { id: 'm-openai-gpt-image', name: 'GPT Image', modelId: 'gpt-image-1', providerId: providers.openai.id, type: 'IMAGE', isActive: true, isDefault: true, supportsImages: true },

    // ---- Anthropic Test ----
    { id: 'm-anthropic-sonnet', name: 'Claude Sonnet', modelId: 'claude-sonnet-4-20250514', providerId: providers.anthropic.id, type: 'TEXT', isActive: true, isDefault: true, contextLength: 200000, inputCostPer1k: 0.003, outputCostPer1k: 0.015, supportsVision: true, supportsFunctionCalling: true, supportsImages: true },
    { id: 'm-anthropic-haiku', name: 'Claude Haiku', modelId: 'claude-3-5-haiku-20241022', providerId: providers.anthropic.id, type: 'TEXT', isActive: true, isDefault: false, contextLength: 200000, inputCostPer1k: 0.001, outputCostPer1k: 0.005, supportsVision: true, supportsFunctionCalling: true, supportsImages: true },

    // ---- Google Gemini Test ----
    { id: 'm-gemini-pro', name: 'Gemini 2.5 Pro', modelId: 'gemini-2.5-pro', providerId: providers.gemini.id, type: 'TEXT', isActive: true, isDefault: true, contextLength: 1048576, inputCostPer1k: 0.00125, outputCostPer1k: 0.01, supportsVision: true, supportsFunctionCalling: true, supportsImages: true },
    { id: 'm-gemini-flash', name: 'Gemini 2.5 Flash', modelId: 'gemini-2.5-flash', providerId: providers.gemini.id, type: 'TEXT', isActive: true, isDefault: false, contextLength: 1048576, inputCostPer1k: 0.00015, outputCostPer1k: 0.0006, supportsVision: true, supportsFunctionCalling: true, supportsImages: true },
    { id: 'm-gemini-image', name: 'Gemini Image', modelId: 'gemini-2.0-flash-image', providerId: providers.gemini.id, type: 'IMAGE', isActive: true, isDefault: false, supportsImages: true },

    // ---- Groq Test ----
    { id: 'm-groq-llama-33-70b', name: 'Llama 3.3 70B', modelId: 'llama-3.3-70b-versatile', providerId: providers.groq.id, type: 'TEXT', isActive: true, isDefault: true, contextLength: 131072, inputCostPer1k: 0.00059, outputCostPer1k: 0.00079, supportsFunctionCalling: true },
    { id: 'm-groq-llama-4-scout', name: 'Llama 4 Scout', modelId: 'llama-4-scout-17b-16e-instruct', providerId: providers.groq.id, type: 'TEXT', isActive: true, isDefault: false, contextLength: 131072, inputCostPer1k: 0.00011, outputCostPer1k: 0.00034, supportsVision: true, supportsFunctionCalling: true },

    // ---- DeepSeek Test ----
    { id: 'm-deepseek-v3', name: 'DeepSeek V3', modelId: 'deepseek-chat', providerId: providers.deepseek.id, type: 'TEXT', isActive: true, isDefault: true, contextLength: 131072, inputCostPer1k: 0.00014, outputCostPer1k: 0.00028, supportsFunctionCalling: true },
    { id: 'm-deepseek-r1', name: 'DeepSeek R1', modelId: 'deepseek-reasoner', providerId: providers.deepseek.id, type: 'TEXT', isActive: true, isDefault: false, contextLength: 131072, inputCostPer1k: 0.00055, outputCostPer1k: 0.00219 },
  ];

  for (const m of modelSpecs) {
    await db.aiModel.upsert({
      where: { id: m.id },
      update: {
        providerId: m.providerId,
        name: m.name,
        modelId: m.modelId,
        type: m.type,
        isActive: m.isActive,
        isDefault: m.isDefault,
        contextLength: m.contextLength ?? null,
        inputCostPer1k: m.inputCostPer1k ?? null,
        outputCostPer1k: m.outputCostPer1k ?? null,
        supportsVision: m.supportsVision ?? false,
        supportsFunctionCalling: m.supportsFunctionCalling ?? false,
        supportsImages: m.supportsImages ?? false,
        lastSyncedAt: new Date(),
      },
      create: {
        id: m.id,
        providerId: m.providerId,
        name: m.name,
        modelId: m.modelId,
        type: m.type,
        isActive: m.isActive,
        isDefault: m.isDefault,
        contextLength: m.contextLength ?? null,
        inputCostPer1k: m.inputCostPer1k ?? null,
        outputCostPer1k: m.outputCostPer1k ?? null,
        supportsVision: m.supportsVision ?? false,
        supportsFunctionCalling: m.supportsFunctionCalling ?? false,
        supportsImages: m.supportsImages ?? false,
        lastSyncedAt: new Date(),
      },
    });
  }

  console.log(`  ✓ Created ${modelSpecs.length} models:`);
  console.log('    OpenAI Test: GPT-5 (default text), GPT-5 mini, GPT-4.1, GPT Image (default image)');
  console.log('    Anthropic Test: Claude Sonnet (default), Claude Haiku');
  console.log('    Google Gemini Test: Gemini 2.5 Pro (default), Gemini 2.5 Flash, Gemini Image');
  console.log('    Groq Test: Llama 3.3 70B (default), Llama 4 Scout');
  console.log('    DeepSeek Test: DeepSeek V3 (default), DeepSeek R1');

  // ============================================================
  // 3. AI SETTINGS — Default Provider / Model / Image Provider / Image Model
  // ============================================================
  console.log('\nUpdating AI settings...');

  await db.aiSettings.upsert({
    where: { scope: 'global' },
    update: {
      defaultProviderId: providers.openai.id,
      defaultModelId: 'm-openai-gpt5',
      imageProviderId: providers.openai.id,
      imageModelId: 'm-openai-gpt-image',
      defaultTemperature: 0.7,
      defaultMaxTokens: 2048,
      streamingEnabled: true,
      jsonModeEnabled: false,
      functionCallingEnabled: true,
    },
    create: {
      scope: 'global',
      defaultProviderId: providers.openai.id,
      defaultModelId: 'm-openai-gpt5',
      imageProviderId: providers.openai.id,
      imageModelId: 'm-openai-gpt-image',
      defaultTemperature: 0.7,
      defaultMaxTokens: 2048,
      streamingEnabled: true,
      jsonModeEnabled: false,
      functionCallingEnabled: true,
    },
  });

  console.log('  ✓ Default Provider: OpenAI Test');
  console.log('  ✓ Default Model: GPT-5');
  console.log('  ✓ Default Image Provider: OpenAI Test');
  console.log('  ✓ Default Image Model: GPT Image');

  // ============================================================
  // 4. PROMPT TEMPLATES — 3 test prompts
  // ============================================================
  console.log('\nCreating prompts...');

  type PromptSpec = {
    id: string;
    name: string;
    category: 'CONTENT_GENERATION' | 'SEO' | 'IMAGE_GENERATION';
    description: string;
    tags: string[];
    variables: Record<string, unknown>;
    systemPrompt: string;
    userPrompt: string;
    providerId: string;
    modelId: string;
    temperature: number;
    maxTokens: number;
    isFavorite: boolean;
  };

  const promptSpecs: PromptSpec[] = [
    {
      id: 'p-blog-article-writer',
      name: 'Blog Article Writer',
      category: 'CONTENT_GENERATION',
      description: 'Generate a complete, SEO-optimized blog article from a topic and target audience.',
      tags: ['blog', 'seo', 'writing'],
      variables: { topic: '', audience: 'general', tone: 'professional', wordCount: 800 },
      systemPrompt: 'You are an expert blog writer who creates engaging, well-structured, SEO-optimized articles. Always include a compelling headline, an introduction that hooks the reader, clear section headings, and a strong conclusion with a call to action.',
      userPrompt: 'Write a {{wordCount}}-word blog article about "{{topic}}" for a {{audience}} audience. Use a {{tone}} tone. Include 3-5 section headings and a conclusion.',
      providerId: providers.openai.id,
      modelId: 'm-openai-gpt5',
      temperature: 0.7,
      maxTokens: 2048,
      isFavorite: true,
    },
    {
      id: 'p-seo-meta-description',
      name: 'SEO Meta Description',
      category: 'SEO',
      description: 'Generate a concise, keyword-rich meta description for a given page title and target keyword.',
      tags: ['seo', 'meta', 'description'],
      variables: { pageTitle: '', targetKeyword: '', maxLength: 160 },
      systemPrompt: 'You are an SEO specialist. Write compelling meta descriptions that are exactly between 150-160 characters, include the target keyword naturally, and encourage click-through. Return only the meta description text, no quotes or extra commentary.',
      userPrompt: 'Write a meta description (max {{maxLength}} characters) for a page titled "{{pageTitle}}" targeting the keyword "{{targetKeyword}}".',
      providerId: providers.openai.id,
      modelId: 'm-openai-gpt5-mini',
      temperature: 0.4,
      maxTokens: 100,
      isFavorite: false,
    },
    {
      id: 'p-image-prompt-generator',
      name: 'Image Prompt Generator',
      category: 'IMAGE_GENERATION',
      description: 'Transform a simple concept into a detailed, vivid image generation prompt.',
      tags: ['image', 'generation'],
      variables: { concept: '', style: 'photorealistic', aspectRatio: '16:9' },
      systemPrompt: 'You are a prompt engineer specializing in image generation. Transform simple concepts into detailed, vivid prompts that produce high-quality images. Include details about composition, lighting, style, mood, and technical specs.',
      userPrompt: 'Create a detailed image generation prompt for: "{{concept}}". Style: {{style}}. Aspect ratio: {{aspectRatio}}. Return only the prompt text.',
      providerId: providers.gemini.id,
      modelId: 'm-gemini-pro',
      temperature: 0.8,
      maxTokens: 300,
      isFavorite: true,
    },
  ];

  for (const p of promptSpecs) {
    // Delete existing versions first (can't upsert nested create with unique constraint easily)
    await db.promptTemplateVersion.deleteMany({ where: { templateId: p.id } }).catch(() => {});

    await db.promptTemplate.upsert({
      where: { id: p.id },
      update: {
        name: p.name,
        category: p.category,
        description: p.description,
        tags: JSON.stringify(p.tags),
        variables: JSON.stringify(p.variables),
        systemPrompt: p.systemPrompt,
        userPrompt: p.userPrompt,
        providerId: p.providerId,
        modelId: p.modelId,
        temperature: p.temperature,
        maxTokens: p.maxTokens,
        isActive: true,
        isFavorite: p.isFavorite,
        isShared: true,
      },
      create: {
        id: p.id,
        name: p.name,
        category: p.category,
        description: p.description,
        tags: JSON.stringify(p.tags),
        variables: JSON.stringify(p.variables),
        systemPrompt: p.systemPrompt,
        userPrompt: p.userPrompt,
        providerId: p.providerId,
        modelId: p.modelId,
        temperature: p.temperature,
        maxTokens: p.maxTokens,
        isActive: true,
        isFavorite: p.isFavorite,
        isShared: true,
        version: 1,
        usageCount: Math.floor(Math.random() * 50) + 1,
        createdById,
        versions: {
          create: {
            version: 1,
            systemPrompt: p.systemPrompt,
            userPrompt: p.userPrompt,
            variables: JSON.stringify(p.variables),
            temperature: p.temperature,
            maxTokens: p.maxTokens,
            createdById,
          },
        },
      },
    });
  }

  console.log('  ✓ Blog Article Writer (Content Generation) → OpenAI Test / GPT-5');
  console.log('  ✓ SEO Meta Description (SEO) → OpenAI Test / GPT-5 mini');
  console.log('  ✓ Image Prompt Generator (Image Generation) → Google Gemini Test / Gemini 2.5 Pro');

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n========================================');
  console.log('AI SEED COMPLETE');
  console.log('========================================');
  console.log(`Providers: 5 (all Connected + Active)`);
  console.log(`Models: ${modelSpecs.length} (11 text + 2 image)`);
  console.log(`Prompts: ${promptSpecs.length}`);
  console.log(`Settings: default=OpenAI Test/GPT-5, image=OpenAI Test/GPT Image`);
  console.log('========================================');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
