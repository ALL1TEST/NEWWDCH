'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getApi } from '@/lib/api-client';

// ============================================================
// CLIENT AI STATE — the plan's AI connection, client side.
// ============================================================
// Server-side source of truth: /api/ai/client/workspace.
//   • aiPlatform  — the plan includes Platform AI → the client may
//     USE the platform-provided AI tools (content editor assistant,
//     AI Ideas, AI Generate in Media) which run on the Platform
//     Admin's configured provider/model internally, with usage
//     subject to the plan's AI Articles/month + AI Images/month
//     limits. NEVER grants the Admin User → AI page.
//   • aiClient    — the plan includes Client's Own AI API → the
//     client may configure their OWN AI provider connections, and
//     this is the entitlement that shows the Admin User → AI page
//     (the sidebar / command palette / #ai route guard key off
//     usePlanEntitlements + MODULE_FEATURE_MAP, never off aiPlatform),
//     never mixed with Platform AI and never consuming its limits.
//   • mode        — 'unlimited' (platform staff) | 'platform' |
//     'client' (own API only) | 'none'.
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

/** The client AI state (Platform AI entitlement + remaining usage). */
export function useAiWorkspace() {
  return useQuery({
    queryKey: AI_WORKSPACE_QUERY_KEY,
    queryFn: () => getApi<AiWorkspaceState>('/api/ai/client/workspace'),
    staleTime: 30_000,
  });
}

/** Invalidate the workspace state (e.g. after a generation, so the
 *  remaining-usage refreshes). */
export function useInvalidateAiWorkspace() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: AI_WORKSPACE_QUERY_KEY });
}
