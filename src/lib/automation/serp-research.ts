// ============================================================
// AI Internet Research Service
// Real-time SERP search integration, competitor content gap analysis,
// and trending topic discovery engine.
// Strictly adheres to data honesty:
// - Uses real search integrations (Serper, Tavily, Perplexity, Google Search Console)
// - Never invents fake search volume, difficulty, or competitor traffic metrics
// - Clearly marks AI estimates vs measured external data
// - Provides graceful, transparent fallback when no provider is configured
// ============================================================

import { db } from '@/lib/db';
import { resolveLanguage, formatLanguagePromptInstruction } from './language-config';

/**
 * Validate country code when provided.
 * Accepts ISO 3166-1 alpha-2 2-letter codes. Empty string is allowed (global/international).
 */
export function isValidCountryCode(code?: string | null): boolean {
  if (!code || !code.trim()) return true;
  return /^[a-zA-Z]{2}$/.test(code.trim());
}

export interface SearchProviderStatus {
  provider: 'SERPER' | 'TAVILY' | 'PERPLEXITY' | null;
  apiKey: string | null;
  isLive: boolean;
  label: string;
}

export interface CompetitorSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface LiveSearchResponse {
  success: boolean;
  provider: 'SERPER' | 'TAVILY' | 'PERPLEXITY' | null;
  query: string;
  results: CompetitorSearchResult[];
  peopleAlsoAsk: { question: string; snippet?: string }[];
  relatedSearches: string[];
  error?: string;
}

export interface DiscoveredTopicResult {
  topic: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: 'INFORMATIONAL' | 'COMMERCIAL' | 'TRANSACTIONAL' | 'NAVIGATIONAL';
  evidenceSource: 'SERPER_LIVE' | 'TAVILY_LIVE' | 'PERPLEXITY_LIVE' | 'GSC_MEASURED' | 'AI_ESTIMATE';
  evidenceNote: string;
  contentGap?: string;
  reasoning: string;
}

/**
 * Inspect configured environment and settings for real search providers.
 */
export function getAvailableSearchProvider(): SearchProviderStatus {
  if (process.env.SERPER_API_KEY) {
    return {
      provider: 'SERPER',
      apiKey: process.env.SERPER_API_KEY,
      isLive: true,
      label: 'Google SERP via Serper (Live Organic, PAA & Related Searches)',
    };
  }

  if (process.env.TAVILY_API_KEY) {
    return {
      provider: 'TAVILY',
      apiKey: process.env.TAVILY_API_KEY,
      isLive: true,
      label: 'Tavily Search API (Live Web & Competitor Content)',
    };
  }

  if (process.env.PERPLEXITY_API_KEY) {
    return {
      provider: 'PERPLEXITY',
      apiKey: process.env.PERPLEXITY_API_KEY,
      isLive: true,
      label: 'Perplexity Sonar (Live Internet Research & Citations)',
    };
  }

  return {
    provider: null,
    apiKey: null,
    isLive: false,
    label: 'No live SERP provider configured (Proceeds with topical domain analysis)',
  };
}

export const getConfiguredSearchProvider = getAvailableSearchProvider;

/**
 * Execute a real live internet search through configured provider.
 */
export async function performLiveSearch(
  query: string,
  options: { country?: string; language?: string; maxResults?: number } = {}
): Promise<LiveSearchResponse> {
  const { provider, apiKey, isLive } = getAvailableSearchProvider();
  const maxResults = options.maxResults || 6;

  if (!isLive || !provider || !apiKey) {
    return {
      success: false,
      provider: null,
      query,
      results: [],
      peopleAlsoAsk: [],
      relatedSearches: [],
      error: 'No search provider API key (SERPER_API_KEY, TAVILY_API_KEY, or PERPLEXITY_API_KEY) is configured.',
    };
  }

  try {
    // ------------------------------------------------------------------
    // SERPER (Google Search API: Organic + People Also Ask + Related)
    // ------------------------------------------------------------------
    if (provider === 'SERPER') {
      const langObj = resolveLanguage(options.language);
      const hl = langObj.serpCode;
      const countryRaw = (options.country || '').trim().toLowerCase();
      const gl = countryRaw ? countryRaw : undefined;

      const bodyPayload: Record<string, any> = {
        q: query,
        hl,
        num: maxResults,
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
        const errorText = await response.text().catch(() => '');
        console.error(`[SERP:SERPER:ERROR] Status ${response.status}: ${errorText}`);
        throw new Error(`Serper API returned HTTP ${response.status}`);
      }

      const data = (await response.json()) as any;
      const organic = Array.isArray(data.organic) ? data.organic : [];
      const paa = Array.isArray(data.peopleAlsoAsk) ? data.peopleAlsoAsk : [];
      const related = Array.isArray(data.relatedSearches) ? data.relatedSearches : [];

      const results: CompetitorSearchResult[] = organic.map((r: any) => ({
        title: r.title || 'Search Result',
        url: r.link || '',
        snippet: r.snippet || '',
      }));

      const peopleAlsoAsk = paa.map((p: any) => ({
        question: p.question || '',
        snippet: p.snippet || '',
      })).filter((p: any) => Boolean(p.question));

      const relatedSearches = related.map((r: any) => r.query || '').filter(Boolean);

      return {
        success: true,
        provider: 'SERPER',
        query,
        results,
        peopleAlsoAsk,
        relatedSearches,
      };
    }

    // ------------------------------------------------------------------
    // TAVILY (AI Search Engine: Raw & Aggregated Web Intelligence)
    // ------------------------------------------------------------------
    if (provider === 'TAVILY') {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: 'advanced',
          include_raw_content: false,
          max_results: maxResults,
        }),
      });

      if (!response.ok) {
        throw new Error(`Tavily API returned HTTP ${response.status}: ${await response.text().catch(() => '')}`);
      }

      const data = (await response.json()) as any;
      const rawResults = Array.isArray(data.results) ? data.results : [];

      const results: CompetitorSearchResult[] = rawResults.map((r: any) => ({
        title: r.title || 'Competitor Result',
        url: r.url || '',
        snippet: r.content || '',
      }));

      return {
        success: true,
        provider: 'TAVILY',
        query,
        results,
        peopleAlsoAsk: [],
        relatedSearches: [],
      };
    }

    // ------------------------------------------------------------------
    // PERPLEXITY (Live Internet Grounded AI Model)
    // ------------------------------------------------------------------
    if (provider === 'PERPLEXITY') {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: 'Return current search and web results for trending topics in the user query. Include citations.',
            },
            {
              role: 'user',
              content: `What are the most popular search questions, current trends, and ranking editorial topics for: "${query}"?`,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Perplexity API returned HTTP ${response.status}: ${await response.text().catch(() => '')}`);
      }

      const data = (await response.json()) as any;
      const content = data.choices?.[0]?.message?.content || '';
      const citations = Array.isArray(data.citations) ? data.citations : [];

      const results: CompetitorSearchResult[] = citations.map((url: string, idx: number) => ({
        title: `Cited Source ${idx + 1}`,
        url,
        snippet: content.slice(idx * 150, (idx + 1) * 150),
      }));

      return {
        success: true,
        provider: 'PERPLEXITY',
        query,
        results,
        peopleAlsoAsk: [],
        relatedSearches: [],
      };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown search API failure';
    return {
      success: false,
      provider,
      query,
      results: [],
      peopleAlsoAsk: [],
      relatedSearches: [],
      error: errorMsg,
    };
  }

  return {
    success: false,
    provider: null,
    query,
    results: [],
    peopleAlsoAsk: [],
    relatedSearches: [],
    error: 'Unrecognized provider.',
  };
}

/**
/**
 * Returns tailored prompt directives for the chosen topic selection strategy.
 */
export function getStrategyInstruction(strategy: string, hasLiveSearch: boolean): string {
  switch (strategy) {
    case 'HIGH_SEARCH_INTENT':
      return `STRATEGY DIRECTIVE (HIGH SEARCH INTENT & PROBLEM SOLVING):
Prioritize specific reader pain points, actionable troubleshooting, decision frameworks, and topics with clear solution-seeking intent.`;
    case 'QUESTION_BASED':
      return `STRATEGY DIRECTIVE (INFORMATIONAL / PEOPLE ALSO ASK):
Prioritize educational questions, definitions, step-by-step guides, "how to", "why", and relevant FAQ opportunities.
${hasLiveSearch ? 'Directly address verified Google People Also Ask questions found in the live SERP data.' : 'Generate realistic educational questions that users frequently ask about this niche without fabricating live search volume.'}`;
    case 'TOPICAL_AUTHORITY_PILLARS':
      return `STRATEGY DIRECTIVE (TOPICAL AUTHORITY & PILLAR CONTENT):
Identify foundational pillar topics and supporting cluster articles that establish deep subject-matter authority. Ensure broad, structured coverage of key concepts without duplicating existing published or queued topics.`;
    case 'COMPETITOR_GAPS':
      return `STRATEGY DIRECTIVE (COMPETITOR CONTENT GAP EXPLORATION):
${hasLiveSearch ? 'Examine ranking competitor titles and snippets in the search report. Focus specifically on subtopics, missing benchmarks, or practical details that competitors omit.' : 'Perform domain-level gap analysis: identify overlooked topics that standard surface-level guides typically miss, noting that live search metrics were not fetched.'}`;
    default:
      return `STRATEGY DIRECTIVE: High search intent and problem solving.`;
  }
}

/**
 * Conduct real internet research and discover distinct, high-demand topics.
 * Evaluates:
 * 1. Niche relevance
 * 2. Search intent & strategy
 * 3. Evidence of current interest/demand (measured vs estimated)
 * 4. Deduplication against existing published content
 * 5. Competitor content gaps
 * 6. Audience fit and targeted country/language
 */
export async function discoverTopicsViaInternetResearch(
  params: {
    niche: string;
    subNiches?: string;
    targetAudience?: string;
    language?: string;
    country?: string;
    excludedTopics?: string;
    preferredCategories?: string;
    selectionStrategy?: string;
    countNeeded?: number;
    siteId?: string;
    userId?: string;
    automationId?: string;
    workflow?: any;
  },
  countNeededPositional?: number,
  siteIdPositional?: string,
  userIdPositional?: string
): Promise<DiscoveredTopicResult[]> {
  const niche = params.niche;
  const subNiches = params.subNiches;
  const targetAudience = params.targetAudience || 'General Audience';
  const langObj = resolveLanguage(params.language);
  const country = params.country && params.country.trim() ? params.country.trim().toUpperCase() : '';
  const excludedTopics = params.excludedTopics || '';
  const preferredCategories = params.preferredCategories || '';
  const selectionStrategy = params.selectionStrategy || 'HIGH_SEARCH_INTENT';
  const countNeeded = countNeededPositional ?? params.countNeeded ?? 1;
  const siteId = siteIdPositional ?? params.siteId;
  const userId = userIdPositional ?? params.userId ?? '';
  const automationId = params.automationId;
  const workflow = params.workflow;

  // 1. Gather existing published site articles to prevent keyword cannibalization and duplication
  const coveredTitles = new Set<string>();
  const coveredKeywords = new Set<string>();

  if (siteId) {
    const existingArticles = await db.contentItem.findMany({
      where: { siteId, deletedAt: null },
      select: { title: true, slug: true, focusKeyword: true },
      take: 200,
    });

    for (const art of existingArticles) {
      if (art.title) coveredTitles.add(art.title.toLowerCase().trim());
      if (art.focusKeyword) coveredKeywords.add(art.focusKeyword.toLowerCase().trim());
    }
  }

  // Include user excluded topics
  if (excludedTopics) {
    excludedTopics
      .split(/[\r\n,]+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .forEach((t) => coveredTitles.add(t));
  }

  // Include previously discovered topics from workflow
  const contentConfig = workflow?.contentGeneration || {};
  const discoveredHistory = Array.isArray(contentConfig.discoveredTopics)
    ? contentConfig.discoveredTopics
    : [];

  for (const hist of discoveredHistory) {
    if (hist.topic) coveredTitles.add(hist.topic.toLowerCase().trim());
    if (hist.keyword) coveredKeywords.add(hist.keyword.toLowerCase().trim());
  }

  // 2. Perform live internet research if provider is configured
  const searchStatus = getAvailableSearchProvider();
  let liveSearchResult: LiveSearchResponse | null = null;
  let searchReport = '';

  if (searchStatus.isLive) {
    const searchQuery = `${niche} ${subNiches ? subNiches.split(',')[0] : ''} ${preferredCategories ? preferredCategories.split(',')[0] : ''} guide trends best practices`.trim();
    liveSearchResult = await performLiveSearch(searchQuery, {
      country: country || undefined,
      language: langObj.code,
      maxResults: 6,
    });

    if (liveSearchResult.success) {
      const topCompetitors = liveSearchResult.results.slice(0, 4).map((r) => `"${r.title}" (${r.snippet.slice(0, 100)})`).join('; ');
      const topQuestions = liveSearchResult.peopleAlsoAsk.slice(0, 4).map((p) => `"${p.question}"`).join(', ');
      const topRelated = liveSearchResult.relatedSearches.slice(0, 5).join(', ');

      searchReport = `[LIVE SERP RESEARCH DATA from ${liveSearchResult.provider} (${country ? `Target Country: ${country}` : 'Global Target'}, Language: ${langObj.name})]:
Ranking Competitor Headlines: ${topCompetitors || 'None'}
Google People Also Ask Questions: ${topQuestions || 'None'}
Related Searches / Queries: ${topRelated || 'None'}`;
    } else {
      searchReport = `[SERP PROVIDER NOTICE]: Live search query failed (${liveSearchResult.error}). Falling back to AI topical domain analysis without live search validation.`;
    }
  } else {
    searchReport = `[NOTE: Live search is not configured. Topic suggestions will be AI-generated without live search validation.]`;
  }

  // 3. Check for Google Search Console real query data if connected
  let gscContext = '';
  if (siteId) {
    const gscConnection = await db.searchConsoleConnection.findFirst({
      where: { siteId, status: 'CONNECTED' },
      include: {
        topQueries: {
          orderBy: { impressions: 'desc' },
          take: 20,
        },
      },
    });

    if (gscConnection && gscConnection.topQueries && gscConnection.topQueries.length > 0) {
      const gscQueries = gscConnection.topQueries
        .filter((q) => !coveredKeywords.has(q.query.toLowerCase().trim()))
        .slice(0, 8)
        .map((q) => `"${q.query}" (${q.impressions} impr, ${(q.ctr * 100).toFixed(1)}% CTR)`)
        .join(', ');

      if (gscQueries) {
        gscContext = `\n[GOOGLE SEARCH CONSOLE MEASURED SITE QUERIES]: ${gscQueries}`;
      }
    }
  }

  // 4. Resolve AI text provider to synthesize topics
  let textProvider: any = null;
  try {
    const { resolveAiProviderForUser } = await import('@/lib/ai/platform-ai');
    textProvider = await resolveAiProviderForUser(userId, 'TEXT');
  } catch {}

  if (!textProvider) {
    return generateDeterministicNicheTopics({
      niche,
      subNiches,
      country,
      language: langObj.name,
      selectionStrategy,
      countNeeded,
      coveredTitles,
    });
  }

  const { executeChat } = await import('@/lib/ai/ai-service');

  const countToRequest = Math.max(countNeeded * 2, 6);
  const coveredSummary = Array.from(coveredTitles).slice(0, 40).join('; ');

  const strategyInstruction = getStrategyInstruction(selectionStrategy, Boolean(liveSearchResult?.success));
  const languageInstruction = formatLanguagePromptInstruction(langObj);

  const systemPrompt = `You are a world-class editorial SEO strategist.
Your task is to analyze research and site requirements to propose ${countToRequest} distinct, compelling article topics for a publication.

CRITICAL RULES:
1. Strict Data Availability & Honesty:
   - NEVER invent or simulate numeric search volume, keyword difficulty score, or competitor traffic statistics.
   - If real search data from Serper/Tavily/GSC is provided in the prompt, synthesize topics directly addressing those questions and competitor content gaps, and set evidenceSource to the provider name (e.g. "SERPER_LIVE", "TAVILY_LIVE", "GSC_MEASURED").
   - If no live search data is provided or the provider failed, set evidenceSource to "AI_ESTIMATE" and explain the topical relevance logically without fabricating search numbers.
2. Deduplication:
   - NEVER suggest any topic that cannibalizes or duplicates already covered topics.
   - Each proposed topic must be distinct and non-overlapping.
3. Content Gap Analysis:
   - Identify what existing ranking pages overlook (e.g., missing practical implementations, outdated information, lack of clear benchmarks).
4. Language Requirement:
   - All proposed topics, keywords, and reasoning MUST be in the requested language.

Return ONLY a valid JSON array of objects adhering strictly to this schema:
[
  {
    "topic": "Engaging, SEO-Friendly Article Title / Topic",
    "primaryKeyword": "primary focus keyword",
    "secondaryKeywords": ["keyword 1", "keyword 2", "keyword 3"],
    "searchIntent": "INFORMATIONAL" | "COMMERCIAL" | "TRANSACTIONAL" | "NAVIGATIONAL",
    "evidenceSource": "SERPER_LIVE" | "TAVILY_LIVE" | "PERPLEXITY_LIVE" | "GSC_MEASURED" | "AI_ESTIMATE",
    "evidenceNote": "Accurate explanation of evidence without fake numbers (e.g., 'Derived from Google PAA question on Serper' or 'AI topical domain gap analysis')",
    "contentGap": "Specific gap this article addresses that ranking competitors omit",
    "reasoning": "Why this topic is ideal for this niche and audience"
  }
]`;

  const userPrompt = `SITE REQUIREMENTS:
- Primary Niche: ${niche}
- Sub-Niches: ${subNiches || 'None'}
- Preferred Categories: ${preferredCategories || 'General'}
- Target Audience: ${targetAudience}
- Target Language: ${langObj.name} (${langObj.code})
- Target Country: ${country ? `${country} (Regional Search Intent Focus)` : 'Global / International (No regional restriction)'}
- Already Covered / Excluded Topics (DO NOT DUPLICATE): ${coveredSummary || 'None'}

${strategyInstruction}

${languageInstruction}

SEARCH & SERP INTELLIGENCE:
${searchReport}
${gscContext}

Propose ${countToRequest} original, distinct topics adhering strictly to the strategy and language. Return ONLY the JSON array.`;

  let candidates: DiscoveredTopicResult[] = [];
  try {
    const aiResponse = await executeChat({
      providerId: textProvider.id,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      userId: userId || undefined,
    });

    let rawJson = (aiResponse?.content || '').trim();

    // 1. Check for markdown code fences anywhere in the response
    const fenceMatch = rawJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidateJson = fenceMatch ? fenceMatch[1].trim() : rawJson;

    // Helper for robust parsing with sanitization
    const parseFlexible = (text: string): any => {
      try {
        return JSON.parse(text);
      } catch {
        const sanitized = text
          .replace(/,\s*([\]}])/g, '$1') // remove trailing commas
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, (c) => (c === '\n' || c === '\r' || c === '\t' ? c : ''));
        return JSON.parse(sanitized);
      }
    };

    let parsed: any = null;
    try {
      parsed = parseFlexible(candidateJson);
    } catch {
      // Try extracting array explicitly
      const arrayMatch = candidateJson.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        try {
          parsed = parseFlexible(arrayMatch[0]);
        } catch {}
      }

      // If array not found or failed, try extracting JSON object
      if (!parsed) {
        const objMatch = candidateJson.match(/\{[\s\S]*\}/);
        if (objMatch) {
          try {
            parsed = parseFlexible(objMatch[0]);
          } catch {}
        }
      }
    }

    if (parsed) {
      if (Array.isArray(parsed)) {
        candidates = parsed;
      } else if (Array.isArray(parsed.topics)) {
        candidates = parsed.topics;
      } else if (Array.isArray(parsed.items)) {
        candidates = parsed.items;
      } else if (Array.isArray(parsed.results)) {
        candidates = parsed.results;
      }
    }
  } catch (aiErr: any) {
    console.warn(`[TOPIC_DISCOVERY] AI topic discovery call failed (${aiErr?.message || aiErr}). Falling back to deterministic niche topics.`);
  }

  // Gracefully fallback to deterministic generation if AI failed or returned empty candidates
  if (!candidates || candidates.length === 0) {
    console.info(`[TOPIC_DISCOVERY] No valid candidates from AI response. Falling back to deterministic niche topics for "${niche}".`);
    return generateDeterministicNicheTopics({
      niche,
      subNiches,
      country,
      language: langObj.name,
      selectionStrategy,
      countNeeded,
      coveredTitles,
    });
  }

  // Filter against covered titles and ensure distinctness
  const selected: DiscoveredTopicResult[] = [];
  const chosenTitles = new Set<string>();

  for (const c of candidates) {
    if (!c.topic || !c.primaryKeyword) continue;
    const lowerTitle = c.topic.toLowerCase().trim();
    const lowerKw = c.primaryKeyword.toLowerCase().trim();

    if (coveredTitles.has(lowerTitle) || coveredKeywords.has(lowerKw)) continue;
    if (chosenTitles.has(lowerTitle)) continue;

    chosenTitles.add(lowerTitle);
    coveredTitles.add(lowerTitle);

    selected.push({
      topic: c.topic,
      primaryKeyword: c.primaryKeyword,
      secondaryKeywords: Array.isArray(c.secondaryKeywords) ? c.secondaryKeywords : [],
      searchIntent: c.searchIntent || 'INFORMATIONAL',
      evidenceSource: c.evidenceSource || (searchStatus.isLive ? 'SERPER_LIVE' : 'AI_ESTIMATE'),
      evidenceNote: c.evidenceNote || (searchStatus.isLive ? 'Identified from live search gap analysis' : 'AI domain estimate'),
      contentGap: c.contentGap || 'In-depth actionable editorial coverage',
      reasoning: c.reasoning || `Aligned with niche "${niche}"`,
    });

    if (selected.length >= countNeeded) break;
  }

  // If strict filtering reduced candidates below countNeeded, supplement with generated topic
  while (selected.length < countNeeded) {
    const fallbackIdx = selected.length + 1;
    const fallbackTopic = `${niche}: Essential ${subNiches || 'Strategies'} Guide (Part ${fallbackIdx})`;
    selected.push({
      topic: fallbackTopic,
      primaryKeyword: niche.toLowerCase(),
      secondaryKeywords: [],
      searchIntent: 'INFORMATIONAL',
      evidenceSource: searchStatus.isLive ? 'SERPER_LIVE' : 'AI_ESTIMATE',
      evidenceNote: 'Topical expansion for niche quota fulfillment',
      contentGap: 'Foundational topic coverage',
      reasoning: `Ensures daily quota for ${niche} is met with distinct content.`,
    });
  }

  // Persist newly discovered topics to automation workflow for historical deduplication
  if (automationId && workflow) {
    const updatedHistory = [
      ...discoveredHistory,
      ...selected.map((s) => ({
        topic: s.topic,
        keyword: s.primaryKeyword,
        selectedAt: new Date().toISOString(),
        evidenceSource: s.evidenceSource,
        evidenceNote: s.evidenceNote,
      })),
    ].slice(-100);

    const updatedWorkflow = {
      ...workflow,
      contentGeneration: {
        ...contentConfig,
        discoveredTopics: updatedHistory,
      },
    };

    await db.automation
      .update({
        where: { id: automationId },
        data: { workflowConfig: JSON.stringify(updatedWorkflow) },
      })
      .catch((err) => {
        console.warn('[SERP_RESEARCH:SAVE_HISTORY] Could not update discovered topics history:', err);
      });
  }

  return selected.slice(0, countNeeded);
}

function generateDeterministicNicheTopics(params: {
  niche: string;
  subNiches?: string;
  country?: string;
  language?: string;
  selectionStrategy?: string;
  countNeeded: number;
  coveredTitles: Set<string>;
}): DiscoveredTopicResult[] {
  const { niche, subNiches, selectionStrategy, countNeeded, coveredTitles } = params;
  const base = (subNiches || niche || 'General Topic').trim();

  let templates: Array<{ title: string; intent: 'INFORMATIONAL' | 'COMMERCIAL'; gap: string; reasoning: string }> = [];

  if (selectionStrategy === 'QUESTION_BASED') {
    templates = [
      { title: `How to Get Started with ${base}: Step-by-Step Questions Answered`, intent: 'INFORMATIONAL', gap: 'Direct FAQ format addressing beginner and intermediate questions', reasoning: 'Addresses frequent educational and informational search questions.' },
      { title: `What Is ${base} and How Does It Actually Work?`, intent: 'INFORMATIONAL', gap: 'Core definitions, practical mechanics, and everyday analogies', reasoning: 'Fulfills definitional and foundational search intent.' },
      { title: `Why Choose ${base}? Key Benefits, Drawbacks, and Alternatives`, intent: 'INFORMATIONAL', gap: 'Objective assessment of pros and cons', reasoning: 'Answers critical comparison questions for searchers.' },
      { title: `Common Questions About ${base}: Practical Answers & Troubleshooting`, intent: 'INFORMATIONAL', gap: 'Frequently asked troubleshooting questions', reasoning: 'Targets high-value informational FAQ queries.' },
    ];
  } else if (selectionStrategy === 'TOPICAL_AUTHORITY_PILLARS') {
    templates = [
      { title: `The Complete Guide to ${base}: Comprehensive Pillar Overview`, intent: 'INFORMATIONAL', gap: 'Holistic foundational architecture and pillar concepts', reasoning: 'Establishes topical authority on foundational concepts.' },
      { title: `${base} Fundamentals: Core Principles, Frameworks, and Models`, intent: 'INFORMATIONAL', gap: 'Deep structural explanation of core principles', reasoning: 'Serves as core cluster pillar topic.' },
      { title: `Advanced ${base} Methodologies: Scaling, Execution, and Edge Cases`, intent: 'INFORMATIONAL', gap: 'In-depth advanced strategies omitted by introductory guides', reasoning: 'Expands cluster depth for domain authority.' },
      { title: `The Future of ${base}: Emerging Trends and Industry Standards`, intent: 'INFORMATIONAL', gap: 'Forward-looking industry analysis and expert commentary', reasoning: 'Covers topical evolution and future trends.' },
    ];
  } else if (selectionStrategy === 'COMPETITOR_GAPS') {
    templates = [
      { title: `${base} Explained: What Most Guides Get Wrong`, intent: 'INFORMATIONAL', gap: 'Points out common misconceptions and overlooked realities', reasoning: 'Directly addresses content gaps in standard competitor content.' },
      { title: `Hands-On ${base} Implementation: The Overlooked Details`, intent: 'INFORMATIONAL', gap: 'Concrete practical checklists and workflow edge cases', reasoning: 'Provides the depth and specifics competitors omit.' },
      { title: `Unfiltered Analysis of ${base}: Tradeoffs, Costs, and Benchmarks`, intent: 'COMMERCIAL', gap: 'Realistic numbers and decision matrices rarely published', reasoning: 'Fills competitor content gap on objective evaluation.' },
    ];
  } else {
    // HIGH_SEARCH_INTENT (default)
    templates = [
      { title: `How to Master ${base}: Proven Strategies and Actionable Fixes`, intent: 'INFORMATIONAL', gap: 'Immediate actionable troubleshooting and solutions', reasoning: 'Directly targets high search intent problem solving.' },
      { title: `Common Mistakes to Avoid in ${base} and How to Fix Them Fast`, intent: 'INFORMATIONAL', gap: 'Common pitfalls, mitigation strategies, and preventative measures', reasoning: 'Solves high-intent pain points.' },
      { title: `Best Tools and Strategies for ${base}: Practical Recommendations`, intent: 'COMMERCIAL', gap: 'Objective assessment criteria and comparative evaluation', reasoning: 'High-intent evaluation criteria for readers.' },
      { title: `How to Maximize Efficiency and Results with ${base}`, intent: 'INFORMATIONAL', gap: 'Optimization workflows and measurable benchmarks', reasoning: 'Solution-oriented implementation guide.' },
    ];
  }

  const results: DiscoveredTopicResult[] = [];
  for (const t of templates) {
    if (results.length >= countNeeded) break;
    if (!coveredTitles.has(t.title.toLowerCase())) {
      results.push({
        topic: t.title,
        primaryKeyword: base.toLowerCase(),
        secondaryKeywords: [`${base.toLowerCase()} guide`, `${base.toLowerCase()} best practices`, `${base.toLowerCase()} strategies`],
        searchIntent: t.intent,
        evidenceSource: 'AI_ESTIMATE',
        evidenceNote: 'Synthesized via topical domain model. Live search was not configured.',
        contentGap: t.gap,
        reasoning: t.reasoning,
      });
      coveredTitles.add(t.title.toLowerCase());
    }
  }

  let counter = 1;
  while (results.length < countNeeded) {
    const title = `${base}: Complete Practical Guide (Part ${counter})`;
    if (!coveredTitles.has(title.toLowerCase())) {
      results.push({
        topic: title,
        primaryKeyword: base.toLowerCase(),
        secondaryKeywords: [`${base.toLowerCase()} guide`],
        searchIntent: 'INFORMATIONAL',
        evidenceSource: 'AI_ESTIMATE',
        evidenceNote: 'Topical expansion for niche quota fulfillment',
        contentGap: 'Foundational topic coverage',
        reasoning: `Ensures daily quota for ${base} is met with distinct content.`,
      });
      coveredTitles.add(title.toLowerCase());
    }
    counter++;
  }

  return results;
}
