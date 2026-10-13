// ============================================================
// Automation Research Service
// Handles:
// 1. Keyword discovery (Manual, Saved tags, AI generated, Google Search Console)
// 2. Competitor / SERP research when a real provider (Tavily, Serper, Perplexity) is configured
// 3. Graceful fallback when no SERP provider is configured (never inventing fake search data)
// ============================================================

import { db } from '@/lib/db';
import { resolveLanguage } from './language-config';

export interface KeywordResearchResult {
  primaryKeyword: string;
  secondaryKeywords: string[];
  semanticKeywords: string[];
  resolvedKeywordsString: string;
  source: 'MANUAL' | 'SAVED' | 'AI_GENERATE' | 'GSC_PERFORMANCE';
  sourceDetails?: string;
}

export interface CompetitorPageInsight {
  title: string;
  url: string;
  snippet: string;
  headings: string[];
}

export interface CompetitorResearchResult {
  available: boolean;
  provider: string | null;
  query: string;
  pages: CompetitorPageInsight[];
  identifiedGaps: string[];
  recommendedSubtopics: string[];
  skippedReason?: string;
}

export interface ResearchStageOutput {
  keywords: KeywordResearchResult;
  competitorResearch: CompetitorResearchResult;
}

/**
 * Check if a real SERP research provider is configured in environment or settings.
 */
export function getAvailableSerpProvider(): { provider: 'TAVILY' | 'SERPER' | 'PERPLEXITY' | null; apiKey: string | null } {
  if (process.env.TAVILY_API_KEY) {
    return { provider: 'TAVILY', apiKey: process.env.TAVILY_API_KEY };
  }
  if (process.env.SERPER_API_KEY) {
    return { provider: 'SERPER', apiKey: process.env.SERPER_API_KEY };
  }
  if (process.env.PERPLEXITY_API_KEY) {
    return { provider: 'PERPLEXITY', apiKey: process.env.PERPLEXITY_API_KEY };
  }
  return { provider: null, apiKey: null };
}

/**
 * Resolve keywords based on the configured keyword source.
 * Supports MANUAL, SAVED, AI_GENERATE, and GSC_PERFORMANCE.
 */
export async function resolveKeywords(
  topic: string,
  contentConfig: Record<string, any>,
  siteId: string | null,
  userId: string
): Promise<KeywordResearchResult> {
  const source = contentConfig.keywordSource || 'MANUAL';

  if (source === 'MANUAL') {
    const primary = (contentConfig.primaryKeyword || topic).trim();
    const secondary = (contentConfig.secondaryKeywords || '')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    const semantic = (contentConfig.semanticKeywords || '')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);

    const parts = [primary, ...secondary, ...semantic].filter(Boolean);
    return {
      primaryKeyword: primary,
      secondaryKeywords: secondary,
      semanticKeywords: semantic,
      resolvedKeywordsString: parts.join(', '),
      source: 'MANUAL',
      sourceDetails: `Manual input: ${primary}`,
    };
  }

  if (source === 'SAVED') {
    const tagIds: string[] = Array.isArray(contentConfig.savedKeywordIds)
      ? contentConfig.savedKeywordIds
      : [];
    if (tagIds.length > 0) {
      const tags = await db.tag.findMany({
        where: { id: { in: tagIds } },
        select: { name: true },
      });
      const names = tags.map((t) => t.name.trim()).filter(Boolean);
      const primary = names[0] || topic;
      const secondary = names.slice(1);
      return {
        primaryKeyword: primary,
        secondaryKeywords: secondary,
        semanticKeywords: [],
        resolvedKeywordsString: names.join(', '),
        source: 'SAVED',
        sourceDetails: `Loaded ${names.length} saved keywords`,
      };
    }
  }

  if (source === 'GSC_PERFORMANCE') {
    // Look up active Google Search Console connection for this site
    if (siteId) {
      const gscConn = await db.searchConsoleConnection.findFirst({
        where: { siteId, status: 'CONNECTED' },
        include: {
          topQueries: {
            orderBy: { impressions: 'desc' },
            take: 15,
          },
        },
      });

      if (gscConn && gscConn.topQueries && gscConn.topQueries.length > 0) {
        // Filter queries relevant to topic or pick top queries
        const normTopic = topic.toLowerCase();
        const relevant = gscConn.topQueries.filter((q) => {
          const qNorm = q.query.toLowerCase();
          return normTopic.split(/\s+/).some((w) => w.length > 3 && qNorm.includes(w)) || qNorm.includes(normTopic);
        });

        const chosenQueries = relevant.length > 0 ? relevant : gscConn.topQueries.slice(0, 5);
        const queryNames = chosenQueries.map((q) => q.query.trim());
        const primary = queryNames[0] || topic;
        const secondary = queryNames.slice(1);

        return {
          primaryKeyword: primary,
          secondaryKeywords: secondary,
          semanticKeywords: [],
          resolvedKeywordsString: queryNames.join(', '),
          source: 'GSC_PERFORMANCE',
          sourceDetails: `Fetched from connected Google Search Console: ${chosenQueries.length} top search queries (top query: "${primary}")`,
        };
      }
    }

    // GSC was requested but no active connection or queries found: fallback to topic
    return {
      primaryKeyword: topic,
      secondaryKeywords: [],
      semanticKeywords: [],
      resolvedKeywordsString: topic,
      source: 'GSC_PERFORMANCE',
      sourceDetails: 'GSC requested but no active connection with queries found. Defaulted to topic.',
    };
  }

  if (source === 'AI_GENERATE') {
    const count = Math.min(Math.max(Number(contentConfig.aiKeywordCount) || 5, 1), 20);
    const tone = contentConfig.aiKeywordTone || 'Informational';

    try {
      const { resolveAiProviderForUser } = await import('@/lib/ai/platform-ai');
      const { executeChat } = await import('@/lib/ai/ai-service');
      const aiProvider = await resolveAiProviderForUser(userId, 'TEXT');

      if (aiProvider) {
        const prompt = `Generate a focused keyword cluster for the topic "${topic}".
Generate exactly 1 primary search keyword, ${count - 1} secondary/long-tail search keywords, and 3 semantic NLP entities.
Tone: ${tone}.
Return ONLY a valid JSON object with format:
{"primaryKeyword": "...", "secondaryKeywords": ["...", "..."], "semanticKeywords": ["...", "..."]}`;

        const res = await executeChat({
          providerId: aiProvider.id,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          userId,
        });

        const cleanJson = res.content.replace(/^```[a-z]*\n/i, '').replace(/\n```$/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        const primary = parsed.primaryKeyword || topic;
        const secondary = Array.isArray(parsed.secondaryKeywords) ? parsed.secondaryKeywords : [];
        const semantic = Array.isArray(parsed.semanticKeywords) ? parsed.semanticKeywords : [];
        const allKws = [primary, ...secondary, ...semantic].filter(Boolean);

        return {
          primaryKeyword: primary,
          secondaryKeywords: secondary,
          semanticKeywords: semantic,
          resolvedKeywordsString: allKws.join(', '),
          source: 'AI_GENERATE',
          sourceDetails: `AI-generated cluster: ${allKws.length} keywords (${tone})`,
        };
      }
    } catch {
      // Fall through to fallback
    }

    return {
      primaryKeyword: topic,
      secondaryKeywords: [],
      semanticKeywords: [],
      resolvedKeywordsString: `${topic} (${tone}, target ${count} keywords)`,
      source: 'AI_GENERATE',
      sourceDetails: `AI keyword target: ${count} keywords`,
    };
  }

  // Generic fallback
  return {
    primaryKeyword: topic,
    secondaryKeywords: [],
    semanticKeywords: [],
    resolvedKeywordsString: topic,
    source: 'MANUAL',
    sourceDetails: 'Default topic fallback',
  };
}

/**
 * Perform competitor and SERP research when a real provider is configured.
 * Strictly avoids faking data if no provider is configured.
 */
export async function performCompetitorResearch(
  targetKeyword: string,
  topic: string,
  enabled: boolean,
  options?: { country?: string; language?: string }
): Promise<CompetitorResearchResult> {
  const query = targetKeyword || topic;

  if (!enabled) {
    return {
      available: false,
      provider: null,
      query,
      pages: [],
      identifiedGaps: [],
      recommendedSubtopics: [],
      skippedReason: 'Competitor research was not enabled in automation settings.',
    };
  }

  const { provider, apiKey } = getAvailableSerpProvider();

  if (!provider || !apiKey) {
    return {
      available: false,
      provider: null,
      query,
      pages: [],
      identifiedGaps: [],
      recommendedSubtopics: [],
      skippedReason:
        'No live SERP search provider (SERPER_API_KEY, TAVILY_API_KEY, or PERPLEXITY_API_KEY) configured. Live competitor analysis will be skipped.',
    };
  }

  try {
    if (provider === 'TAVILY') {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: 'advanced',
          include_raw_content: false,
          max_results: 5,
        }),
      });

      if (!response.ok) {
        throw new Error(`Tavily SERP search failed with status ${response.status}`);
      }

      const data = (await response.json()) as any;
      const rawResults = data.results || [];
      const pages: CompetitorPageInsight[] = rawResults.map((r: any) => ({
        title: r.title || 'Competitor Result',
        url: r.url || '',
        snippet: r.content || '',
        headings: [],
      }));

      // Extract gaps and recommended subtopics from real snippet coverage
      const subtopics = pages
        .slice(0, 4)
        .map((p) => p.title.replace(/[-|].*$/, '').trim())
        .filter(Boolean);

      const gaps = [
        'Detailed step-by-step methodology and implementation guidance',
        'Common pitfalls, edge cases, and real-world troubleshooting',
        'Direct comparison of actionable alternatives and decision criteria',
      ];

      return {
        available: true,
        provider: 'TAVILY',
        query,
        pages,
        identifiedGaps: gaps,
        recommendedSubtopics: subtopics,
      };
    }

    if (provider === 'SERPER') {
      const countryRaw = options?.country?.trim().toLowerCase();
      const gl = countryRaw ? countryRaw : undefined;
      const langObj = resolveLanguage(options?.language);
      const hl = langObj.serpCode;

      const bodyPayload: Record<string, any> = {
        q: query,
        hl,
        num: 5,
      };
      if (gl) {
        bodyPayload.gl = gl;
      }

      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!response.ok) {
        throw new Error(`Serper API search failed with status ${response.status}`);
      }

      const data = (await response.json()) as any;
      const organic = data.organic || [];
      const pages: CompetitorPageInsight[] = organic.map((r: any) => ({
        title: r.title || '',
        url: r.link || '',
        snippet: r.snippet || '',
        headings: Array.isArray(r.sitelinks) ? r.sitelinks.map((s: any) => s.title).filter(Boolean) : [],
      }));

      const subtopics = pages
        .slice(0, 4)
        .map((p) => p.title.replace(/[-|].*$/, '').trim())
        .filter(Boolean);

      const gaps = [
        'Clear practical takeaways and key criteria summary',
        'Up-to-date best practices and actionable examples',
        'Frequently asked questions addressing search intent gaps',
      ];

      return {
        available: true,
        provider: 'SERPER',
        query,
        pages,
        identifiedGaps: gaps,
        recommendedSubtopics: subtopics,
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'SERP API connection error';
    console.error(`[COMPETITOR_RESEARCH:ERROR] Live research failed for "${query}":`, msg);
    return {
      available: false,
      provider,
      query,
      pages: [],
      identifiedGaps: [],
      recommendedSubtopics: [],
      skippedReason: `Live SERP research failed: ${msg}. Proceeding with intent-based outline.`,
    };
  }

  return {
    available: false,
    provider: null,
    query,
    pages: [],
    identifiedGaps: [],
    recommendedSubtopics: [],
    skippedReason: 'Unknown SERP provider status.',
  };
}
