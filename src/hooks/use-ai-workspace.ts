'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getApi, postApi } from '@/lib/api-client';

// ============================================================
// CLIENT AI WORKSPACE STATE — the client AI experience source of
// truth (server-side computed via /api/ai/client/workspace).
// ============================================================
// The strict Platform Admin / Client separation on the client side:
//   • aiPlatform  — the plan includes Platform AI → the client may
//     USE the AI tools (generate content/images, SEO tools) with
//     usage subject to the plan's AI limits.
//   • aiClient    — the plan includes Client's Own AI API → the
//     client may configure their OWN AI provider connections (never
//     mixed with Platform AI, never consuming its limits).
//   • mode        — 'unlimited' (platform staff) | 'platform' |
//     'client' (own API only — platform AI tools locked) | 'none'.
//
// While the query is loading, `data` is undefined — callers should
// treat that as "unknown yet" (fail-open for cosmetics only; the
// server enforces the real permissions on every endpoint).

export interface AiWorkspaceState {
  mode: 'unlimited' | 'platform' | 'client' | 'none';
  entitlements: { aiPlatform: boolean; aiClient: boolean };
  plan: { id: string; name: string };
  limits: { aiArticlesPerMonth: number; aiImagesPerMonth: number };
  usage: { articles: number; images: number };
}

export const AI_WORKSPACE_QUERY_KEY = ['ai-client-workspace'] as const;

/** The client AI workspace state (entitlements + remaining usage). */
export function useAiWorkspace() {
  return useQuery({
    queryKey: AI_WORKSPACE_QUERY_KEY,
    queryFn: () => getApi<AiWorkspaceState>('/api/ai/client/workspace'),
    staleTime: 30_000,
  });
}

/** Invalidate the workspace state (e.g. after a generation, so the
 *  remaining-usage meters refresh). */
export function useInvalidateAiWorkspace() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: AI_WORKSPACE_QUERY_KEY });
}

// -------------------- AI draft handoff --------------------

/** sessionStorage key for handing an AI-generated draft from the AI
 *  Tools workspace to the article editor ("Use in new article"). */
export const AI_DRAFT_HANDOFF_KEY = 'cms_ai_handoff';

export interface AiDraftHandoff {
  title: string;
  content: string;
}

export function writeAiDraftHandoff(draft: AiDraftHandoff) {
  try {
    sessionStorage.setItem(AI_DRAFT_HANDOFF_KEY, JSON.stringify(draft));
  } catch {
    // storage unavailable — non-fatal
  }
}

export function consumeAiDraftHandoff(): AiDraftHandoff | null {
  try {
    const raw = sessionStorage.getItem(AI_DRAFT_HANDOFF_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(AI_DRAFT_HANDOFF_KEY);
    const parsed = JSON.parse(raw) as Partial<AiDraftHandoff>;
    if (typeof parsed.title === 'string' && typeof parsed.content === 'string') {
      return { title: parsed.title, content: parsed.content };
    }
  } catch {
    // ignore
  }
  return null;
}

// -------------------- Types for the client AI tools --------------------

export interface AiGeneratedDraft {
  content: string;
  wordCount: number;
}

export interface AiArticleIdea {
  title: string;
  seoOpportunity: number;
  topicRelevance: number;
  competition: string;
  contentPotential: string;
  searchIntent: string;
  primaryKeyword: string;
  keywords: string[];
  description: string;
  suggestedAngle: string;
  tags: string[];
}

export interface AiGeneratedImage {
  id: string;
  url: string;
  originalName: string;
}

// -------------------- Client AI tool API wrappers --------------------

/** Generate Article — POST /api/content/ai-generate */
export async function generateArticle(input: {
  title: string;
  brief?: string;
  keywords?: string;
  writingStyle: string;
  targetLength: string;
  numberOfDrafts?: number;
  includeCta?: boolean;
}): Promise<AiGeneratedDraft[]> {
  const result = await postApi<{ drafts?: AiGeneratedDraft[] }>('/api/content/ai-generate', {
    title: input.title,
    brief: input.brief || '',
    keywords: input.keywords || '',
    writingStyle: input.writingStyle,
    targetLength: input.targetLength,
    numberOfDrafts: input.numberOfDrafts ?? 1,
    includeCta: input.includeCta ?? false,
  });
  return result?.drafts ?? [];
}

/** Text tools (Generate Title / Outline / Rewrite / Improve / SEO
 *  Title / SEO Description / …) — POST /api/content/ai-edit-selection */
export async function editTextWithAi(input: {
  text: string;
  action: string;
  context?: string;
}): Promise<string> {
  const result = await postApi<{ editedText: string }>('/api/content/ai-edit-selection', {
    text: input.text,
    action: input.action,
    context: input.context || '',
  });
  return result?.editedText ?? '';
}

/** Generate AI Images — POST /api/media/generate (platform SDK;
 *  images are saved straight into the client's media library). */
export async function generateAiImages(input: {
  prompt: string;
  aspectRatio: string;
  count: number;
}): Promise<AiGeneratedImage[]> {
  const result = await postApi<AiGeneratedImage[]>('/api/media/generate', {
    prompt: input.prompt,
    aspectRatio: input.aspectRatio,
    count: input.count,
  });
  return Array.isArray(result) ? result : [];
}

/** Generate Article Ideas — POST /api/content/ai-ideas */
export async function generateArticleIdeas(input: {
  niche?: string;
  keywords?: string;
  count?: number;
}): Promise<AiArticleIdea[]> {
  const result = await postApi<{ ideas?: AiArticleIdea[] }>('/api/content/ai-ideas', {
    niche: input.niche || undefined,
    keywords: input.keywords || undefined,
    count: input.count ?? 6,
  });
  return result?.ideas ?? [];
}
