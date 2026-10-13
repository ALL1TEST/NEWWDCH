// ============================================================
// CMS-Native SEO System: GEO / AI Search Readiness Engine
// Aligned with Google AI Optimization Guide & LLM Citation Retrieval
// ============================================================

import { GeoCitabilitySignals, SeoFinding } from './types';
import { PageType, ContentIntent } from './page-type-detector';

export interface GeoAnalysisInput {
  url: string;
  title: string;
  content: string; // HTML or Markdown
  pageType?: PageType;
  intent?: ContentIntent;
}

const QUESTION_HEADING_REGEX = /<h[2-4][^>]*?>\s*(what|how|why|who|when|where|is|can|does|which|are|should|will)\b[^<]*\??<\/h[2-4]>/gi;
const ALL_HEADING_REGEX = /<h[2-4][^>]*?>(.*?)<\/h[2-4]>/gi;

export function analyzeGeoCitability(input: GeoAnalysisInput): {
  geo: GeoCitabilitySignals;
  findings: SeoFinding[];
} {
  const content = input.content || '';
  const findings: SeoFinding[] = [];
  const recommendations: string[] = [];
  const pageType = input.pageType || 'ARTICLE';
  const intent = input.intent || 'INFORMATIONAL';

  // GEO answer extraction is primarily relevant for editorial articles and long guides
  const isEditorial = pageType === 'ARTICLE' || pageType === 'BLOG_POST';

  // 1. Heading Analysis
  const allHeadings = content.match(ALL_HEADING_REGEX) || [];
  const questionHeadings = content.match(QUESTION_HEADING_REGEX) || [];
  const questionHeadingsRatio = allHeadings.length > 0
    ? Math.round((questionHeadings.length / allHeadings.length) * 100) / 100
    : 0;

  // 2. Section and Passage Citability Analysis
  // Extract all paragraphs (stripping HTML)
  const paragraphs = content
    .split(/<\/p>|<br\s*\/?>|\n\n/)
    .map((p) => p.replace(/<[^>]*>/g, '').trim())
    .filter((p) => p.length > 30);

  // Evaluate self-contained answer quality:
  // An answer passage is self-contained if:
  // - It has sufficient substantive explanation (35-220 words; not rigidly bound to 80-200)
  // - It does not start with dependent/anaphoric connectors (e.g. "This means", "They also")
  // - It directly defines, explains, or answers the topic with standalone context
  const DEPENDENT_START_REGEX = /^(this means|that's why|they also|as mentioned|furthermore|moreover|on the other hand|in addition|consequently|for this reason|so|and)\b/i;
  const DEFINITION_EXPLANATION_REGEX = /\b(is defined as|refers to|means|is a|is an|consists of|comes from|are characterized by|occurs when|works by|provides|results from|causes|require|requires|involves|includes|composed of|serves to)\b/i;

  let selfContainedPassagesCount = 0;
  for (const para of paragraphs) {
    const words = para.split(/\s+/).length;
    // Flexible word count: 35-220 words is suitable for an answer passage
    if (words >= 35 && words <= 220) {
      const isDependent = DEPENDENT_START_REGEX.test(para);
      const hasExplanation = DEFINITION_EXPLANATION_REGEX.test(para) || para.includes(':') || words >= 50;
      if (!isDependent && hasExplanation) {
        selfContainedPassagesCount++;
      }
    }
  }

  // 3. Structural Readability & Structured Answers
  const hasBulletPoints = /<ul\b|<ol\b/i.test(content) || /^\s*[-*]\s+/m.test(content);
  const hasComparisonTables = /<table\b/i.test(content);
  const hasDefinitions = DEFINITION_EXPLANATION_REGEX.test(content);
  const headingDepth = allHeadings.length;

  // Count sections structured with headings + direct bullet lists/tables (structured answer blocks)
  const listMatches = content.match(/<h[2-4][^>]*>[\s\S]*?(?:<ul|<ol|<table)/gi) || [];
  const structuredAnswersCount = listMatches.length;

  // 4. Quotable facts & statistics count
  const factsMatches = content.match(/\b\d+(\.\d+)?%|\b\d{4}\b|\b\$\d+(\.\d+)?|\b\d+\s*(users|customers|seconds|ms|times|fold|percent)\b/gi) || [];
  const quotableFactsCount = factsMatches.length;

  // 5. Entity clarity
  let entityClarityScore = 50;
  if (hasDefinitions) entityClarityScore += 25;
  if (allHeadings.length >= 3) entityClarityScore += 25;
  entityClarityScore = Math.min(100, entityClarityScore);

  // 6. Passage citability score (rewards both standalone narrative passages and structured answers)
  let passageCitabilityScore = 50;
  if (selfContainedPassagesCount >= 1) passageCitabilityScore += 20;
  if (selfContainedPassagesCount >= 2) passageCitabilityScore += 15;
  if (structuredAnswersCount >= 2) passageCitabilityScore += 15;
  if (quotableFactsCount >= 2) passageCitabilityScore += 10;
  passageCitabilityScore = Math.min(100, passageCitabilityScore);

  // 7. Calculate overall GEO score
  let overallGeoScore = Math.round(
    passageCitabilityScore * 0.40 +
    (questionHeadingsRatio > 0.2 ? 90 : 50) * 0.25 +
    (hasBulletPoints ? 90 : 40) * 0.15 +
    entityClarityScore * 0.20
  );
  overallGeoScore = Math.max(0, Math.min(100, overallGeoScore));

  // Generate actionable findings (strictly INFO opportunities for editorial content)
  if (isEditorial && allHeadings.length > 2 && questionHeadingsRatio < 0.2) {
    const rec = 'Consider adding question-based headings (e.g. "How does X work?") to improve AI answer extraction.';
    recommendations.push(rec);
    findings.push({
      id: `geo-heading-q-${Math.random().toString(36).substring(2, 7)}`,
      ruleId: 'geo-question-headings',
      pageType,
      intent,
      category: 'GEO_AI_SEARCH',
      severity: 'INFO',
      title: 'AI Answer Extraction Opportunity',
      problem: 'Subheadings could be formatted as natural search questions',
      issue: 'Few question-form headings for AI search retrieval',
      explanation: 'AI search engines (Google AI Overviews, Perplexity, ChatGPT) frequently match conversational queries against explicit question headings.',
      recommendation: rec,
      affectedUrl: input.url,
      affected_url: input.url,
      detectedValue: `${questionHeadings.length} of ${allHeadings.length} headings are questions (${Math.round(questionHeadingsRatio * 100)}%)`,
      detected_value: `${questionHeadings.length} of ${allHeadings.length} headings are questions (${Math.round(questionHeadingsRatio * 100)}%)`,
      expectedValue: 'At least 20-30% question-based headings where appropriate',
      expected_value: 'At least 20-30% question-based headings',
      verificationMethod: 'Inspect H2/H3 text for interrogative words (What, How, Why)',
      verification_method: 'Inspect H2/H3 text for interrogative words (What, How, Why)',
      evidence: `Found ${questionHeadings.length} question-formatted headings out of ${allHeadings.length} total headings.`,
      confidence: 0.8,
      expected_impact: 'LOW',
    });
  }

  // Refined GEO Rule: evaluate self-contained answer quality
  // STRONG: Multiple (>= 2) self-contained answer passages exist -> No finding.
  // GOOD: At least 1 strong answer passage exists and the article is well-proportioned (<= 3 headings) -> No finding.
  // OPPORTUNITY: Article has 0 standalone answer passages, or multiple major sections rely on short paragraphs/bullets -> Create INFO finding.
  const isStrong = selfContainedPassagesCount >= 2;
  const isCompactGood = selfContainedPassagesCount >= 1 && allHeadings.length <= 3;

  if (isEditorial && paragraphs.length >= 3 && !isStrong && !isCompactGood) {
    const rec = 'Consider adding 1–3 concise, self-contained answer passages where they naturally improve the article (e.g. a direct summary paragraph beneath key headings).';
    recommendations.push(rec);

    const problemText = structuredAnswersCount > 0
      ? 'Some sections could provide clearer self-contained answers for AI search'
      : 'Content has limited self-contained answer passages for AI search';

    const evidenceText = structuredAnswersCount > 0
      ? 'Several major sections rely on short paragraphs and bullet lists rather than standalone answer passages.'
      : `Analyzed article sections; content relies primarily on brief fragmented paragraphs without standalone answer passages.`;

    findings.push({
      id: `geo-passage-${Math.random().toString(36).substring(2, 7)}`,
      ruleId: 'geo-answer-passages',
      pageType,
      intent,
      category: 'GEO_AI_SEARCH',
      severity: 'INFO',
      title: 'AI Search Answer Passage Opportunity',
      problem: problemText,
      issue: 'Limited self-contained answer passages for AI search',
      explanation: 'Generative AI search engines (such as Google AI Overviews and Perplexity) prioritize self-contained passages that directly answer a user\'s query without requiring surrounding context. This is an AI quotation opportunity, not a search ranking penalty.',
      recommendation: rec,
      affectedUrl: input.url,
      affected_url: input.url,
      detectedValue: `${selfContainedPassagesCount} standalone answer passage(s); ${structuredAnswersCount} structured list/table section(s)`,
      detected_value: `${selfContainedPassagesCount} standalone answer passage(s); ${structuredAnswersCount} structured section(s)`,
      expectedValue: 'Consider adding 1–3 concise, self-contained answer passages where they naturally improve the article.',
      expected_value: 'Consider adding 1–3 concise, self-contained answer passages where they naturally improve the article.',
      verificationMethod: 'Review sections beneath major headings for complete explanations that can be quoted independently by AI',
      verification_method: 'Inspect sections beneath major headings for standalone direct answers',
      evidence: evidenceText,
      confidence: 0.85,
      expected_impact: 'LOW',
    });
  }

  if (isEditorial && !hasBulletPoints && content.length > 1200) {
    const rec = 'Consider breaking lengthy explanatory text into structured bullet points or key takeaway lists to increase machine parseability.';
    recommendations.push(rec);
    findings.push({
      id: `geo-bullets-${Math.random().toString(36).substring(2, 7)}`,
      ruleId: 'geo-structured-takeaways',
      pageType,
      intent,
      category: 'GEO_AI_SEARCH',
      severity: 'INFO',
      title: 'Structured Takeaways Opportunity',
      problem: 'Long guide does not contain bulleted or numbered summary lists',
      issue: 'No structured lists or key takeaway blocks',
      explanation: 'Bulleted lists provide high-density semantic tokens that generative engines prioritize when synthesizing step-by-step summaries.',
      recommendation: rec,
      affectedUrl: input.url,
      affected_url: input.url,
      detectedValue: '0 <ul> or <ol> elements found',
      detected_value: 'No <ul> or <ol> elements found',
      expectedValue: 'At least 1 structured list in long-form guides',
      expected_value: 'At least 1 structured list',
      verificationMethod: 'Check content for bulleted or numbered summary lists',
      verification_method: 'Check content for bulleted or numbered summary lists',
      evidence: 'Parsed HTML and markdown; no list elements detected.',
      confidence: 0.8,
      expected_impact: 'LOW',
    });
  }

  return {
    geo: {
      score: overallGeoScore,
      passageCitabilityScore,
      selfContainedPassagesCount,
      questionHeadingsRatio,
      entityClarityScore,
      structuralReadability: {
        hasBulletPoints,
        hasComparisonTables,
        hasDefinitions,
        headingDepth,
      },
      quotableFactsCount,
      recommendations,
    },
    findings,
  };
}
