// ============================================================
// CMS-Native SEO System: AI SEO Assistant Service
// Directly connects to the CMS's existing AI Provider infrastructure
// ============================================================

import { resolveAiProviderForUser } from '@/lib/ai/platform-ai';
import { executeChat, rankCandidateModels } from '@/lib/ai/ai-service';

export type AiSeoAction =
  | 'OPTIMIZE_METADATA'
  | 'ANALYZE_SEARCH_INTENT'
  | 'SUGGEST_OUTLINE'
  | 'DETECT_CONTENT_Gaps'
  | 'IMPROVE_EEAT'
  | 'IMPROVE_GEO'
  | 'GENERATE_SCHEMA';

export interface AiSeoRequest {
  action: AiSeoAction;
  title: string;
  content?: string;
  excerpt?: string;
  focusKeyword?: string;
  url?: string;
  authorName?: string;
  schemaType?: string;
  userId: string;
}

export async function runAiSeoAssistant(request: AiSeoRequest): Promise<{
  success: boolean;
  result: Record<string, unknown> | string;
  error?: string;
}> {
  // Resolve active provider from existing platform/user configuration
  const activeProvider = await resolveAiProviderForUser(request.userId, 'TEXT');
  if (!activeProvider) {
    return {
      success: false,
      result: {},
      error: 'No active AI Provider configured. Please configure an AI Provider under Platform Admin > AI.',
    };
  }

  const rankedCandidates = rankCandidateModels(activeProvider.models, 'TEXT_GENERATION');
  const textModel = rankedCandidates[0]
    ?? activeProvider.models.find((m) => m.isActive && (m.isDefaultText || m.isDefault) && m.type?.toUpperCase() === 'TEXT')
    ?? activeProvider.models.find((m) => m.isActive && m.type?.toUpperCase() === 'TEXT');

  const cleanSample = (request.content || request.excerpt || '').replace(/<[^>]*>/g, ' ').slice(0, 2000).trim();

  let systemPrompt = '';
  let userPrompt = '';

  switch (request.action) {
    case 'OPTIMIZE_METADATA': {
      systemPrompt = `You are a world-class SEO specialist and copywriter.
Generate high-CTR, search-optimized meta tags for the given article.
Output ONLY valid JSON:
{
  "seoTitle": "Engaging title between 40-60 characters incorporating the target keyword",
  "seoDescription": "Compelling meta description between 120-155 characters with a clear call-to-action",
  "focusKeywords": ["primary keyword", "secondary keyword 1", "secondary keyword 2"],
  "rationale": "Brief 1-sentence explanation of why this drives clicks"
}
Do NOT include markdown formatting or backticks around the JSON.`;
      userPrompt = `Title: "${request.title}"
Target Keyword: "${request.focusKeyword || 'None specified'}"
Content snippet: "${cleanSample}"`;
      break;
    }

    case 'ANALYZE_SEARCH_INTENT': {
      systemPrompt = `You are an SEO search intent and semantic clustering analyst.
Analyze the user search intent for the given article.
Output ONLY valid JSON:
{
  "primaryIntent": "INFORMATIONAL" | "TRANSACTIONAL" | "COMMERCIAL" | "NAVIGATIONAL",
  "explanation": "Why searchers look for this query",
  "targetAudience": "Who is searching for this",
  "relatedQuestions": ["Question 1 searchers ask?", "Question 2?", "Question 3?"],
  "keywordClusters": ["keyword cluster 1", "keyword cluster 2", "keyword cluster 3"]
}
Do NOT include markdown formatting or backticks around the JSON.`;
      userPrompt = `Article Title: "${request.title}"
Focus Keyword: "${request.focusKeyword || ''}"
Content: "${cleanSample}"`;
      break;
    }

    case 'SUGGEST_OUTLINE': {
      systemPrompt = `You are an elite SEO Content Architect.
Generate a structured heading outline (H2 and H3) optimized for search engines and AI Overviews.
At least 30% of headings should be direct question queries (What, How, Why).
Output ONLY valid JSON:
{
  "outline": [
    {
      "level": "H2",
      "heading": "Heading title",
      "purpose": "What this section satisfies",
      "isQuestion": true | false
    }
  ],
  "targetWordCount": 1200,
  "keyTakeaways": ["Key takeaway point 1", "Key takeaway point 2"]
}
Do NOT include markdown formatting or backticks around the JSON.`;
      userPrompt = `Topic: "${request.title}"
Target Keyword: "${request.focusKeyword || ''}"
Existing notes: "${cleanSample.slice(0, 500)}"`;
      break;
    }

    case 'DETECT_CONTENT_Gaps': {
      systemPrompt = `You are a competitive SEO Content Analyst.
Identify topical gaps, missing perspectives, and unanswered questions in the current draft.
Output ONLY valid JSON:
{
  "missingTopics": ["Topic 1 that competitors cover", "Topic 2 missing"],
  "unansweredQuestions": ["Specific question the article fails to answer"],
  "aiSearchGaps": ["Area lacking direct fact/definition for AI citability"],
  "suggestedAdditions": "Concrete recommendation of what section to add"
}
Do NOT include markdown formatting or backticks around the JSON.`;
      userPrompt = `Title: "${request.title}"
Content: "${cleanSample}"`;
      break;
    }

    case 'IMPROVE_EEAT': {
      systemPrompt = `You are a Search Quality Rater Guidelines and E-E-A-T expert.
Evaluate and generate recommendations to elevate Experience, Expertise, Authoritativeness, and Trustworthiness.
Output ONLY valid JSON:
{
  "experienceEnhancements": "Specific first-hand testing or case example to add",
  "expertiseEnhancements": "Author credentials or technical depth improvements",
  "authoritativeSourcesToCite": ["Source 1 with topic", "Source 2 with topic"],
  "trustSignals": "Transparency or citation improvements to make"
}
Do NOT include markdown formatting or backticks around the JSON.`;
      userPrompt = `Title: "${request.title}"
Author: "${request.authorName || 'Not specified'}"
Content: "${cleanSample}"`;
      break;
    }

    case 'IMPROVE_GEO': {
      systemPrompt = `You are a Generative Engine Optimization (GEO) and AI Search Retrieval specialist.
Transform the article's core answer into a self-contained, highly citable answer block (~120-150 words) suitable for Google AI Overviews and LLM quotation.
Output ONLY valid JSON:
{
  "summaryAnswerBlock": "Direct, factual 120-150 word answer that directly addresses the core user question with zero fluff",
  "quotableStatistics": ["Stat or benchmark fact 1", "Stat 2"],
  "comparisonTableSuggested": true | false,
  "definitionSentence": "X is a Y that does Z."
}
Do NOT include markdown formatting or backticks around the JSON.`;
      userPrompt = `Title: "${request.title}"
Content: "${cleanSample}"`;
      break;
    }

    case 'GENERATE_SCHEMA': {
      const sType = request.schemaType || 'Article';
      systemPrompt = `You are a Schema.org JSON-LD expert.
Generate clean, valid, production-ready Schema.org JSON-LD for type "${sType}".
Output ONLY the raw JSON-LD object (with "@context": "https://schema.org").
Do NOT wrap in markdown backticks or html script tags.`;
      userPrompt = `Type: "${sType}"
Title: "${request.title}"
URL: "${request.url || 'https://example.com/page'}"
Author: "${request.authorName || 'Author'}"
Summary: "${cleanSample.slice(0, 300)}"`;
      break;
    }

    default:
      return { success: false, result: {}, error: 'Unknown SEO action' };
  }

  try {
    const chatRes = await executeChat({
      providerId: activeProvider.id,
      modelId: textModel?.id,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.25,
      maxTokens: 800,
      userId: request.userId,
    });

    let rawOutput = chatRes.content.trim();
    if (rawOutput.startsWith('```')) {
      rawOutput = rawOutput.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    try {
      const parsed = JSON.parse(rawOutput);
      return { success: true, result: parsed };
    } catch {
      return { success: true, result: { raw: rawOutput } };
    }
  } catch (err: any) {
    return {
      success: false,
      result: {},
      error: err?.message || 'Failed to execute AI SEO request',
    };
  }
}
