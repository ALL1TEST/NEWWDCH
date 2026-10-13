// ============================================================
// CMS-Native SEO System: Comprehensive Page & Site Audit Engine
// Professional, Evidence-Based, Page-Type & Search-Intent Aware
// ============================================================

import {
  HeadingStructureAnalysis,
  KeywordCoverageAnalysis,
  SeoFinding,
  SinglePageSeoAuditResult,
} from './types';
import { calculateCategoryScores } from './scoring';
import { analyzeEeat } from './eeat-engine';
import { analyzeGeoCitability } from './geo-engine';
import {
  detectPageTypeAndIntent,
  PageType,
  ContentIntent,
} from './page-type-detector';
import { buildPublicUrl } from './url-utils';

export interface PageAuditInput {
  url: string;
  requestedUrl?: string;
  finalResolvedUrl?: string;
  redirectChain?: { statusCode: number; url: string; location?: string; toUrl?: string }[];
  title: string;
  slug?: string;
  contentType?: string; // 'article' | 'page' | 'product' etc.
  pageType?: PageType;
  intent?: ContentIntent;
  content: string; // HTML or Markdown
  excerpt?: string;
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  robotsDirectives?: string;
  featuredImageUrl?: string;
  authorName?: string;
  authorBio?: string;
  publishedAt?: string | Date;
  updatedAt?: string | Date;
  structuredDataJson?: string;
  siteDomain?: string;
  httpStatus?: number;
  liveHtml?: string;
  finalUrl?: string;
}

export function auditSinglePage(input: PageAuditInput): SinglePageSeoAuditResult {
  const effectiveUrl = input.finalResolvedUrl || input.finalUrl || input.url;
  const requestedUrl = input.requestedUrl || input.url;
  const redirectChain = input.redirectChain || [];

  const content = input.content || '';
  const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = plainText ? plainText.split(/\s+/).length : 0;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));
  const rawFindings: SeoFinding[] = [];

  // ============================================================
  // 0. Page Type & Search Intent Detection
  // ============================================================
  const detected = (input.pageType && input.intent)
    ? { pageType: input.pageType, intent: input.intent, confidence: 1.0, reason: 'Explicitly provided classification' }
    : detectPageTypeAndIntent({
        url: effectiveUrl,
        slug: input.slug,
        title: input.title,
        contentType: input.contentType,
        content: input.content,
      });

  const pageType: PageType = detected.pageType;
  const intent: ContentIntent = detected.intent;
  const isEditorial = pageType === 'ARTICLE' || pageType === 'BLOG_POST';
  const isAbout = pageType === 'ABOUT';
  const isContact = pageType === 'CONTACT';
  const isLegal = pageType === 'LEGAL' || pageType === 'PRIVACY' || pageType === 'TERMS';
  const isHome = pageType === 'HOME';
  const isProduct = pageType === 'PRODUCT' || pageType === 'PRODUCT_CATEGORY';

  const fullTargetUrl = buildPublicUrl(effectiveUrl, { domain: input.siteDomain });

  // ============================================================
  // 1. Live HTTP & Status Code Check (when live fetch is active)
  // ============================================================
  if (input.httpStatus !== undefined) {
    if (input.httpStatus === 404 || input.httpStatus === 410) {
      rawFindings.push({
        id: `status-404-${Math.random().toString(36).substring(2, 7)}`,
        ruleId: 'http-status-404',
        pageType,
        intent,
        category: 'TECHNICAL',
        severity: 'CRITICAL',
        title: 'Page Not Found (HTTP 404)',
        problem: `Live page returned HTTP status ${input.httpStatus}`,
        issue: `Live page returned HTTP ${input.httpStatus}`,
        explanation: 'A 404 HTTP status indicates the page is inaccessible to search engine crawlers and users.',
        recommendation: 'Ensure the public route exists and is properly served by the connected web application.',
        affectedUrl: fullTargetUrl,
        affected_url: fullTargetUrl,
        detectedValue: `HTTP ${input.httpStatus}`,
        detected_value: `HTTP ${input.httpStatus}`,
        expectedValue: 'HTTP 200 OK',
        expected_value: 'HTTP 200 OK',
        verificationMethod: `curl -I ${fullTargetUrl}`,
        verification_method: `curl -I ${fullTargetUrl}`,
        evidence: `Server response status code: ${input.httpStatus} on ${fullTargetUrl}`,
        confidence: 1.0,
        expected_impact: 'HIGH',
      });
    } else if (input.httpStatus >= 500) {
      rawFindings.push({
        id: `status-5xx-${Math.random().toString(36).substring(2, 7)}`,
        ruleId: 'http-status-5xx',
        pageType,
        intent,
        category: 'TECHNICAL',
        severity: 'CRITICAL',
        title: 'Server Error (HTTP 5xx)',
        problem: `Live page returned server error ${input.httpStatus}`,
        issue: `Live page returned HTTP ${input.httpStatus}`,
        explanation: 'Server 5xx errors halt crawling and degrade search indexing immediately.',
        recommendation: 'Investigate application error logs to resolve backend server failures.',
        affectedUrl: fullTargetUrl,
        affected_url: fullTargetUrl,
        detectedValue: `HTTP ${input.httpStatus}`,
        detected_value: `HTTP ${input.httpStatus}`,
        expectedValue: 'HTTP 200 OK',
        expected_value: 'HTTP 200 OK',
        verificationMethod: `curl -I ${fullTargetUrl}`,
        verification_method: `curl -I ${fullTargetUrl}`,
        evidence: `Server response status code: ${input.httpStatus} on ${fullTargetUrl}`,
        confidence: 1.0,
        expected_impact: 'HIGH',
      });
    }
  }

  // ============================================================
  // Extract real metadata from live HTML if provided
  const liveTitle = input.liveHtml ? input.liveHtml.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() : undefined;
  const liveDesc = input.liveHtml
    ? (input.liveHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ||
       input.liveHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1]?.trim())
    : undefined;
  const liveCanonical = input.liveHtml
    ? (input.liveHtml.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]?.trim() ||
       input.liveHtml.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1]?.trim())
    : undefined;

  const metaTitle = (input.seoTitle || liveTitle || input.title || '').trim();
  const metaDesc = (input.seoDescription || liveDesc || input.excerpt || '').trim();

  // Meta Title
  if (!metaTitle) {
    rawFindings.push({
      id: `title-missing-${Math.random().toString(36).substring(2, 7)}`,
      ruleId: 'meta-title-missing',
      pageType,
      intent,
      category: 'ON_PAGE',
      severity: 'CRITICAL',
      title: 'Missing Meta Title',
      problem: 'Page lacks a clickable meta title headline',
      issue: 'Missing Meta Title',
      explanation: 'Search engines display the meta title as the primary clickable headline in search results (SERPs).',
      recommendation: 'Provide a descriptive meta title between 30 and 60 characters incorporating your target keyword.',
      affectedUrl: fullTargetUrl,
      affected_url: fullTargetUrl,
      detectedValue: 'Empty (0 characters)',
      detected_value: 'Empty (0 characters)',
      expectedValue: '30-60 characters',
      expected_value: '30-60 characters',
      verificationMethod: 'Inspect <title> element in page HTML or SERP preview',
      verification_method: 'Inspect <title> element in page HTML or SERP preview',
      evidence: 'No title tag or SEO title configuration found.',
      confidence: 1.0,
      expected_impact: 'HIGH',
    });
  } else if (metaTitle.length < 25 && !isHome) {
    rawFindings.push({
      id: `title-short-${Math.random().toString(36).substring(2, 7)}`,
      ruleId: 'meta-title-short',
      pageType,
      intent,
      category: 'ON_PAGE',
      severity: 'INFO',
      title: 'Short Meta Title',
      problem: `Meta title is relatively short (${metaTitle.length} characters)`,
      issue: `Meta title is short (${metaTitle.length} characters)`,
      explanation: 'Short titles may underutilize SERP real estate to convey relevant context or brand identity.',
      recommendation: 'Consider expanding the title to 30-60 characters to include context or brand identity.',
      affectedUrl: fullTargetUrl,
      affected_url: fullTargetUrl,
      detectedValue: `${metaTitle.length} characters ("${metaTitle}")`,
      detected_value: `${metaTitle.length} characters ("${metaTitle}")`,
      expectedValue: '30-60 characters',
      expected_value: '30-60 characters',
      verificationMethod: 'Check title character length in SEO editor',
      verification_method: 'Check title character length in SEO editor',
      evidence: `Title text "${metaTitle}" has length ${metaTitle.length}.`,
      confidence: 0.9,
      expected_impact: 'LOW',
    });
  } else if (metaTitle.length > 65) {
    rawFindings.push({
      id: `title-long-${Math.random().toString(36).substring(2, 7)}`,
      ruleId: 'meta-title-long',
      pageType,
      intent,
      category: 'ON_PAGE',
      severity: 'INFO',
      title: 'Long Meta Title Truncation Risk',
      problem: `Meta title may truncate (${metaTitle.length} characters)`,
      issue: `Meta title may truncate (${metaTitle.length} characters)`,
      explanation: 'Desktop and mobile SERP snippets typically truncate headlines beyond 60 characters (~600px width).',
      recommendation: 'Keep the most important keywords within the first 60 characters.',
      affectedUrl: fullTargetUrl,
      affected_url: fullTargetUrl,
      detectedValue: `${metaTitle.length} characters`,
      detected_value: `${metaTitle.length} characters`,
      expectedValue: 'Under 60 characters',
      expected_value: 'Under 60 characters',
      verificationMethod: 'Verify SERP snippet preview in editor',
      verification_method: 'Verify SERP snippet preview in editor',
      evidence: `Meta title length is ${metaTitle.length} characters, exceeding recommended 60 chars.`,
      confidence: 0.9,
      expected_impact: 'LOW',
    });
  }

  // Meta Description
  if (!metaDesc) {
    rawFindings.push({
      id: `desc-missing-${Math.random().toString(36).substring(2, 7)}`,
      ruleId: 'meta-description-missing',
      pageType,
      intent,
      category: 'ON_PAGE',
      severity: 'WARNING',
      title: 'Missing Meta Description',
      problem: 'Page lacks a dedicated meta description',
      issue: 'Missing Meta Description',
      explanation: 'Without a dedicated meta description, search engines dynamically extract arbitrary snippets which often leads to lower organic CTR.',
      recommendation: 'Craft an engaging, action-oriented meta description between 120 and 160 characters summarizing the page value.',
      affectedUrl: fullTargetUrl,
      affected_url: fullTargetUrl,
      detectedValue: 'Empty (0 characters)',
      detected_value: 'Empty (0 characters)',
      expectedValue: '120-160 characters',
      expected_value: '120-160 characters',
      verificationMethod: 'Inspect meta[name="description"] in HTML head',
      verification_method: 'Inspect meta[name="description"] in HTML head',
      evidence: 'No meta[name="description"] found in page head.',
      confidence: 1.0,
      expected_impact: 'HIGH',
    });
  } else if (metaDesc.length < 60) {
    rawFindings.push({
      id: `desc-short-${Math.random().toString(36).substring(2, 7)}`,
      ruleId: 'meta-description-short',
      pageType,
      intent,
      category: 'ON_PAGE',
      severity: 'INFO',
      title: 'Brief Meta Description',
      problem: `Meta description is relatively brief (${metaDesc.length} characters)`,
      issue: `Meta description is short (${metaDesc.length} characters)`,
      explanation: 'Brief descriptions provide limited context to persuade searchers to click your link over competitors.',
      recommendation: 'Expand the description with a clear call-to-action to reach 120-160 characters.',
      affectedUrl: fullTargetUrl,
      affected_url: fullTargetUrl,
      detectedValue: `${metaDesc.length} characters`,
      detected_value: `${metaDesc.length} characters`,
      expectedValue: '120-160 characters',
      expected_value: '120-160 characters',
      verificationMethod: 'Check description counter in SEO panel',
      verification_method: 'Check description counter in SEO panel',
      evidence: `Description length is ${metaDesc.length} characters.`,
      confidence: 0.85,
      expected_impact: 'LOW',
    });
  } else if (metaDesc.length > 165) {
    rawFindings.push({
      id: `desc-long-${Math.random().toString(36).substring(2, 7)}`,
      ruleId: 'meta-description-long',
      pageType,
      intent,
      category: 'ON_PAGE',
      severity: 'INFO',
      title: 'Long Meta Description',
      problem: `Meta description exceeds 165 characters (${metaDesc.length} characters)`,
      issue: `Meta description exceeds 160 characters (${metaDesc.length} characters)`,
      explanation: 'Descriptions beyond 160 characters are typically truncated with an ellipsis on search results.',
      recommendation: 'Trim to under 160 characters while keeping the primary call-to-action early in the copy.',
      affectedUrl: fullTargetUrl,
      affected_url: fullTargetUrl,
      detectedValue: `${metaDesc.length} characters`,
      detected_value: `${metaDesc.length} characters`,
      expectedValue: '120-160 characters',
      expected_value: '120-160 characters',
      verificationMethod: 'Check SERP mobile/desktop preview',
      verification_method: 'Check SERP mobile/desktop preview',
      evidence: `Description character length is ${metaDesc.length}.`,
      confidence: 0.9,
      expected_impact: 'LOW',
    });
  }

  // ============================================================
  // 3. Heading Structure Analysis
  // ============================================================
  const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings: { level: number; text: string }[] = [];
  // Use live rendered HTML as primary source because it represents the true rendered DOM (including template H1).
  // Fall back to CMS content if live HTML is not available.
  const headingSource = (input.liveHtml && input.liveHtml.trim().length > 0)
    ? input.liveHtml
    : (content && content.trim().length > 0)
    ? content
    : '';
  let hMatch: RegExpExecArray | null;

  while ((hMatch = headingRegex.exec(headingSource)) !== null) {
    headings.push({
      level: parseInt(hMatch[1], 10),
      text: hMatch[2].replace(/<[^>]*>/g, '').trim(),
    });
  }

  // When live HTML is not available, check if the CMS document title acts as the page's primary H1
  if (!input.liveHtml && input.title && input.title.trim().length > 0 && !headings.some((h) => h.level === 1)) {
    headings.unshift({
      level: 1,
      text: input.title.trim(),
    });
  }

  const h1List = headings.filter((h) => h.level === 1);
  const hierarchyIssues: string[] = [];
  let skippedLevels = false;

  if (h1List.length === 0) {
    rawFindings.push({
      id: `h1-missing-${Math.random().toString(36).substring(2, 7)}`,
      ruleId: 'h1-missing',
      pageType,
      intent,
      category: 'ON_PAGE',
      severity: 'WARNING',
      title: 'Missing H1 Heading',
      problem: 'Page content has no <h1> heading tag',
      issue: 'Missing H1 heading in content',
      explanation: 'The H1 element communicates the primary subject of the page to search algorithms and assistive technologies.',
      recommendation: 'Add exactly one H1 heading that clearly reflects the title and primary topic of the document.',
      affectedUrl: fullTargetUrl,
      affected_url: fullTargetUrl,
      detectedValue: '0 H1 tags',
      detected_value: '0 H1 tags',
      expectedValue: 'Exactly 1 H1 tag',
      expected_value: 'Exactly 1 H1 tag',
      verificationMethod: 'Inspect headings list in HTML or Heading Inspector',
      verification_method: 'Inspect headings list in the Heading Inspector tree',
      evidence: 'Parsed content HTML; found zero <h1> elements.',
      confidence: 1.0,
      expected_impact: 'HIGH',
    });
    hierarchyIssues.push('No H1 heading found in content.');
  } else if (h1List.length > 1) {
    rawFindings.push({
      id: `h1-multiple-${Math.random().toString(36).substring(2, 7)}`,
      ruleId: 'h1-multiple',
      pageType,
      intent,
      category: 'ON_PAGE',
      severity: 'WARNING',
      title: 'Multiple H1 Headings',
      problem: `Multiple H1 headings detected (${h1List.length} found)`,
      issue: `Multiple H1 headings detected (${h1List.length} found)`,
      explanation: 'Best practice for clear semantic document hierarchy is a single primary H1 with sub-sections styled as H2/H3.',
      recommendation: 'Consolidate down to one main H1 heading and downgrade secondary sections to H2.',
      affectedUrl: fullTargetUrl,
      affected_url: fullTargetUrl,
      detectedValue: `${h1List.length} H1 tags`,
      detected_value: `${h1List.length} H1 tags`,
      expectedValue: 'Exactly 1 H1 tag',
      expected_value: 'Exactly 1 H1 tag',
      verificationMethod: 'Review headings tree in Heading Inspector',
      verification_method: 'Review headings tree in Heading Inspector',
      evidence: `Found ${h1List.length} distinct <h1> tags in content body.`,
      confidence: 1.0,
      expected_impact: 'MEDIUM',
    });
    hierarchyIssues.push(`Found ${h1List.length} H1 headings. Keep exactly one.`);
  }

  // Check skipped levels
  for (let i = 0; i < headings.length - 1; i++) {
    const current = headings[i].level;
    const next = headings[i + 1].level;
    if (next > current + 1) {
      skippedLevels = true;
      hierarchyIssues.push(`Skipped heading level: H${current} jumped to H${next} ("${headings[i + 1].text}").`);
    }
  }

  if (skippedLevels) {
    rawFindings.push({
      id: `heading-skipped-${Math.random().toString(36).substring(2, 7)}`,
      ruleId: 'heading-hierarchy-skipped',
      pageType,
      intent,
      category: 'ON_PAGE',
      severity: 'INFO',
      title: 'Skipped Heading Level',
      problem: 'Skipped heading hierarchy level detected',
      issue: 'Skipped heading hierarchy level detected',
      explanation: 'Skipping levels (e.g. going from H2 directly to H4) degrades machine readability and screen reader assistive navigation.',
      recommendation: 'Ensure headings increment sequentially (H1 → H2 → H3) without skipping intermediate levels.',
      affectedUrl: fullTargetUrl,
      affected_url: fullTargetUrl,
      detectedValue: hierarchyIssues.filter((s) => s.includes('Skipped')).join('; '),
      detected_value: hierarchyIssues.filter((s) => s.includes('Skipped')).join('; '),
      expectedValue: 'Sequential heading nesting (H1 → H2 → H3)',
      expected_value: 'Sequential heading nesting (H1 → H2 → H3)',
      verificationMethod: 'Review Heading Hierarchy tree in editor SEO panel',
      verification_method: 'Review Heading Hierarchy tree in editor SEO panel',
      evidence: hierarchyIssues.filter((s) => s.includes('Skipped')).join('; '),
      confidence: 0.85,
      expected_impact: 'LOW',
    });
  }

  const headingStructure: HeadingStructureAnalysis = {
    isValid: h1List.length === 1 && !skippedLevels,
    h1Count: h1List.length,
    h1Text: h1List[0]?.text,
    headings,
    hierarchyIssues,
    skippedLevels,
  };

  // ============================================================
  // 4. Keyword Coverage & Prominence
  // ============================================================
  let keywordAnalysis: KeywordCoverageAnalysis | undefined;
  if (input.focusKeyword && input.focusKeyword.trim()) {
    const kw = input.focusKeyword.trim().toLowerCase();
    const inTitle = metaTitle.toLowerCase().includes(kw);
    const inDescription = metaDesc.toLowerCase().includes(kw);
    const inH1 = (h1List[0]?.text || '').toLowerCase().includes(kw);
    const inSlug = (input.slug || input.url).toLowerCase().includes(kw.replace(/\s+/g, '-'));

    const firstWords = plainText.split(/\s+/).slice(0, 150).join(' ').toLowerCase();
    const inFirstParagraph = firstWords.includes(kw);

    const kwRegex = new RegExp(`\\b${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
    const matches = plainText.match(kwRegex) || [];
    const count = matches.length;
    const density = wordCount > 0 ? Math.round((count / wordCount) * 1000) / 10 : 0;

    let status: 'OPTIMAL' | 'UNDER_OPTIMIZED' | 'OVER_OPTIMIZED' | 'MISSING' = 'OPTIMAL';
    if (count === 0) status = 'MISSING';
    else if (density < 0.5) status = 'UNDER_OPTIMIZED';
    else if (density > 2.8) status = 'OVER_OPTIMIZED';

    keywordAnalysis = {
      keyword: input.focusKeyword.trim(),
      inTitle,
      inDescription,
      inH1,
      inFirstParagraph,
      inSlug,
      count,
      density,
      status,
    };

    if (isEditorial && status === 'MISSING') {
      rawFindings.push({
        id: `kw-missing-${Math.random().toString(36).substring(2, 7)}`,
        ruleId: 'keyword-missing-content',
        pageType,
        intent,
        category: 'CONTENT_QUALITY',
        severity: 'WARNING',
        title: 'Focus Keyword Missing',
        problem: `Focus keyword "${input.focusKeyword}" is completely absent from content`,
        issue: `Focus keyword "${input.focusKeyword}" is completely absent from content`,
        explanation: 'Search intent alignment requires target topics to be naturally represented in body copy.',
        recommendation: `Incorporate "${input.focusKeyword}" naturally within the title, intro, and body.`,
        affectedUrl: fullTargetUrl,
        affected_url: fullTargetUrl,
        detectedValue: '0 occurrences in content',
        detected_value: '0 occurrences in content',
        expectedValue: 'At least 1-3 natural occurrences',
        expected_value: 'At least 1-3 natural occurrences',
        verificationMethod: 'Search content text for keyword phrase',
        verification_method: 'Search content text for keyword phrase',
        evidence: `Full-text search for "${input.focusKeyword}" yielded 0 matches across ${wordCount} words.`,
        confidence: 0.95,
        expected_impact: 'HIGH',
      });
    } else if (isEditorial && status === 'OVER_OPTIMIZED') {
      rawFindings.push({
        id: `kw-stuffing-${Math.random().toString(36).substring(2, 7)}`,
        ruleId: 'keyword-stuffing',
        pageType,
        intent,
        category: 'CONTENT_QUALITY',
        severity: 'WARNING',
        title: 'High Keyword Density',
        problem: `High keyword density detected (${density}%) for "${input.focusKeyword}"`,
        issue: `High keyword density detected (${density}%) for "${input.focusKeyword}"`,
        explanation: 'Keyword density exceeding 2.5% can trigger algorithmic keyword-stuffing penalties per Google Search Essentials.',
        recommendation: 'Replace repetitive keyword mentions with contextual synonyms, pronouns, or semantic variants.',
        affectedUrl: fullTargetUrl,
        affected_url: fullTargetUrl,
        detectedValue: `${density}% density (${count} times in ${wordCount} words)`,
        detected_value: `${density}% density (${count} times in ${wordCount} words)`,
        expectedValue: '0.8% - 2.0% density',
        expected_value: '0.8% - 2.0% density',
        verificationMethod: 'Inspect Keyword Density indicator in SEO panel',
        verification_method: 'Inspect Keyword Density indicator in SEO panel',
        evidence: `Keyword "${input.focusKeyword}" appears ${count} times out of ${wordCount} words (${density}%).`,
        confidence: 0.9,
        expected_impact: 'MEDIUM',
      });
    }

    if (isEditorial && !inTitle) {
      rawFindings.push({
        id: `kw-not-in-title-${Math.random().toString(36).substring(2, 7)}`,
        ruleId: 'keyword-missing-title',
        pageType,
        intent,
        category: 'ON_PAGE',
        severity: 'INFO',
        title: 'Keyword in Title Opportunity',
        problem: `Focus keyword not found in Meta Title`,
        issue: `Focus keyword not found in Meta Title`,
        explanation: 'Placing the target keyword near the beginning of the title tag is a helpful topical relevance signal.',
        recommendation: `Include "${input.focusKeyword}" within the meta title headline.`,
        affectedUrl: fullTargetUrl,
        affected_url: fullTargetUrl,
        detectedValue: `Title does not contain "${input.focusKeyword}"`,
        detected_value: `Title does not contain "${input.focusKeyword}"`,
        expectedValue: `Meta title includes "${input.focusKeyword}"`,
        expected_value: `Meta title includes "${input.focusKeyword}"`,
        verificationMethod: 'Inspect Meta Title in editor',
        verification_method: 'Inspect Meta Title in editor',
        evidence: `Meta title "${metaTitle}" does not contain target keyword "${input.focusKeyword}".`,
        confidence: 0.85,
        expected_impact: 'MEDIUM',
      });
    }
  }

  // ============================================================
  // 5. Page-Type-Aware Content Depth Rules
  // ============================================================
  // CRITICAL RULE: Never globally flag "less than X words = Critical".
  // Content depth is strictly evaluated relative to page type and search intent.
  if (isEditorial) {
    if (wordCount < 180) {
      rawFindings.push({
        id: `content-depth-${Math.random().toString(36).substring(2, 7)}`,
        ruleId: 'content-depth-article',
        pageType,
        intent,
        category: 'CONTENT_QUALITY',
        severity: 'WARNING',
        title: 'Thin Editorial Content',
        problem: `Article content is very brief (${wordCount} words)`,
        issue: `Thin editorial content detected (${wordCount} words)`,
        explanation: 'Informational articles and guides typically require sufficient topical depth (at least 350-500 words) to satisfy user search queries.',
        recommendation: 'Expand the article with practical guidance, explanations, and answers to common user questions.',
        affectedUrl: fullTargetUrl,
        affected_url: fullTargetUrl,
        detectedValue: `${wordCount} words`,
        detected_value: `${wordCount} words`,
        expectedValue: 'At least 350-500+ words for informational guides',
        expected_value: 'At least 350-500+ words for informational guides',
        verificationMethod: 'Review word count in content editor',
        verification_method: 'Review word count in content editor',
        evidence: `Extracted ${wordCount} words from editorial body copy.`,
        confidence: 0.95,
        expected_impact: 'HIGH',
      });
    } else if (wordCount < 350) {
      rawFindings.push({
        id: `content-depth-mod-${Math.random().toString(36).substring(2, 7)}`,
        ruleId: 'content-depth-article-moderate',
        pageType,
        intent,
        category: 'CONTENT_QUALITY',
        severity: 'INFO',
        title: 'Moderate Content Depth',
        problem: `Content length is relatively concise for an article (${wordCount} words)`,
        issue: `Content length is relatively concise (${wordCount} words)`,
        explanation: 'While concise guides can be helpful, comprehensive depth often ranks more reliably for competitive informational search queries.',
        recommendation: 'Evaluate whether adding practical examples or step-by-step guidance would provide more user value.',
        affectedUrl: fullTargetUrl,
        affected_url: fullTargetUrl,
        detectedValue: `${wordCount} words`,
        detected_value: `${wordCount} words`,
        expectedValue: '400-800 words for comprehensive coverage',
        expected_value: '400-800 words for comprehensive coverage',
        verificationMethod: 'Review topic coverage against top search competitors',
        verification_method: 'Review topic coverage against top search competitors',
        evidence: `Content body has ${wordCount} words.`,
        confidence: 0.8,
        expected_impact: 'LOW',
      });
    }
  } else if (isAbout) {
    // About pages: 200+ words is completely natural and valid. Only brief notice if under 50 words.
    if (wordCount < 50) {
      rawFindings.push({
        id: `content-about-short-${Math.random().toString(36).substring(2, 7)}`,
        ruleId: 'content-depth-about',
        pageType,
        intent,
        category: 'CONTENT_QUALITY',
        severity: 'INFO',
        title: 'Concise About Page',
        problem: 'Content length is relatively short for this page type',
        issue: 'Content length is relatively short for this page type',
        explanation: 'The page is relatively concise, but content length alone is not a critical SEO issue for an About page.',
        recommendation: 'Improve content only if additional useful company/trust information is available.',
        affectedUrl: fullTargetUrl,
        affected_url: fullTargetUrl,
        detectedValue: `${wordCount} words`,
        detected_value: `${wordCount} words`,
        expectedValue: '50-300 words of clear brand mission & identity',
        expected_value: '50-300 words of clear brand mission & identity',
        verificationMethod: 'Inspect About page story and team details',
        verification_method: 'Inspect About page story and team details',
        evidence: `Body text contains ${wordCount} words.`,
        confidence: 0.8,
        expected_impact: 'LOW',
      });
    }
  } else if (isContact) {
    // Contact pages: short forms are standard. Only notice if under 20 words.
    if (wordCount < 20) {
      rawFindings.push({
        id: `content-contact-short-${Math.random().toString(36).substring(2, 7)}`,
        ruleId: 'content-depth-contact',
        pageType,
        intent,
        category: 'CONTENT_QUALITY',
        severity: 'INFO',
        title: 'Minimal Contact Information',
        problem: 'Contact page has very minimal text copy',
        issue: 'Contact page has minimal text copy',
        explanation: 'Contact pages typically need clear communication channels, support hours, or response time expectations.',
        recommendation: 'Include expected response times and alternative contact channels.',
        affectedUrl: fullTargetUrl,
        affected_url: fullTargetUrl,
        detectedValue: `${wordCount} words`,
        detected_value: `${wordCount} words`,
        expectedValue: 'Clear contact channels and support details',
        expected_value: 'Clear contact channels and support details',
        verificationMethod: 'Inspect Contact page form and contact channels',
        verification_method: 'Inspect Contact page form and contact channels',
        evidence: `Parsed ${wordCount} words on contact page.`,
        confidence: 0.8,
        expected_impact: 'LOW',
      });
    }
  }

  // ============================================================
  // 6. Image SEO & Alt Text (Respects decorative images)
  // ============================================================
  const imgRegex = /<img\s([^>]*?)>/gi;
  let totalImages = 0;
  let imagesWithoutAlt = 0;
  let imgMatch: RegExpExecArray | null;

  while ((imgMatch = imgRegex.exec(content)) !== null) {
    totalImages++;
    const attrs = imgMatch[1];
    
    // Check if explicitly marked decorative
    const isDecorative = /role\s*=\s*["']presentation["']/i.test(attrs) ||
      /aria-hidden\s*=\s*["']true["']/i.test(attrs) ||
      /alt\s*=\s*["']\s*["']/i.test(attrs); // Empty alt is standard HTML5 for decorative graphics

    const altMatch = attrs.match(/alt\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/i);
    const hasAltAttr = !!altMatch;
    const altVal = altMatch ? (altMatch[1] ?? altMatch[2] ?? altMatch[3] ?? '') : '';

    if (!hasAltAttr || (!isDecorative && altVal.trim() === '')) {
      if (!isDecorative) {
        imagesWithoutAlt++;
      }
    }
  }

  if (imagesWithoutAlt > 0) {
    rawFindings.push({
      id: `img-alt-${Math.random().toString(36).substring(2, 7)}`,
      ruleId: 'image-alt-missing',
      pageType,
      intent,
      category: 'IMAGE_SEO',
      severity: 'WARNING',
      title: 'Missing Image Alt Text',
      problem: `${imagesWithoutAlt} image${imagesWithoutAlt > 1 ? 's' : ''} missing descriptive alt text`,
      issue: `${imagesWithoutAlt} image${imagesWithoutAlt > 1 ? 's' : ''} missing descriptive alt text`,
      explanation: 'Search crawlers cannot interpret graphic visuals directly; descriptive alt text provides crucial context for Image Search and accessibility.',
      recommendation: 'Add concise, descriptive alt attributes explaining what each graphic depicts (or mark purely decorative images with alt="").',
      affectedUrl: fullTargetUrl,
      affected_url: fullTargetUrl,
      detectedValue: `${imagesWithoutAlt} of ${totalImages} images lack alt attributes`,
      detected_value: `${imagesWithoutAlt} of ${totalImages} images lack alt text`,
      expectedValue: '100% of informative images have descriptive alt text',
      expected_value: '100% of images have descriptive alt text',
      verificationMethod: 'Inspect <img> tags in page HTML or Media Manager',
      verification_method: 'Inspect image properties in Media Manager or editor',
      evidence: `Found ${imagesWithoutAlt} <img> tags without alt attribute or descriptive content.`,
      confidence: 0.95,
      expected_impact: 'MEDIUM',
    });
  }

  // ============================================================
  // 7. Canonical URL Directive
  // ============================================================
  const hasCanonical = input.liveHtml !== undefined
    ? !!liveCanonical
    : !!((input.canonicalUrl && input.canonicalUrl.trim()) || liveCanonical);
  if (!hasCanonical) {
    rawFindings.push({
      id: `canonical-missing-${Math.random().toString(36).substring(2, 7)}`,
      ruleId: 'canonical-missing',
      pageType,
      intent,
      category: 'TECHNICAL',
      severity: 'WARNING',
      title: 'Missing Canonical URL Directive',
      problem: 'Missing canonical URL directive',
      issue: 'Missing canonical URL directive',
      explanation: 'A self-referencing canonical URL informs Google which URL is authoritative, preventing duplicate content dilution across URL parameters or protocol variants.',
      recommendation: `Add <link rel="canonical" href="${fullTargetUrl}"> in the page <head>.`,
      affectedUrl: fullTargetUrl,
      affected_url: fullTargetUrl,
      detectedValue: 'Canonical URL not configured',
      detected_value: 'Canonical URL not configured',
      expectedValue: `One absolute canonical URL (${fullTargetUrl})`,
      expected_value: 'Explicit canonical URL declared',
      verificationMethod: 'Re-run page audit and confirm canonical matches the final URL',
      verification_method: 'Check Canonical URL field in SEO tab',
      evidence: 'No canonical link element detected in page <head> or SEO configuration.',
      confidence: 1.0,
      expected_impact: 'HIGH',
    });
  }

  // ============================================================
  // 8. Robots Directives
  // ============================================================
  const robots = (input.robotsDirectives || 'index, follow').toLowerCase();
  if (robots.includes('noindex')) {
    const isIntentionallyNoindex = isLegal || pageType === 'SEARCH' || pageType === 'ARCHIVE';
    rawFindings.push({
      id: `robots-noindex-${Math.random().toString(36).substring(2, 7)}`,
      ruleId: isIntentionallyNoindex ? 'robots-intentional-noindex' : 'robots-noindex-directive',
      pageType,
      intent,
      category: 'TECHNICAL',
      severity: isIntentionallyNoindex ? 'INFO' : 'CRITICAL',
      title: isIntentionallyNoindex ? 'Page Excluded from Index' : 'Unintentional Noindex Directive',
      problem: `Page has "noindex" directive enabled (${robots})`,
      issue: 'Page has "noindex" directive enabled',
      explanation: isIntentionallyNoindex
        ? 'This page is intentionally configured not to appear in public search indexes.'
        : 'A noindex directive instructs search engines to permanently drop or exclude this page from organic search indexes.',
      recommendation: isIntentionallyNoindex
        ? 'No action needed if this page is intended to be private or unindexed.'
        : 'Ensure noindex is intended; remove noindex if you want this page to rank in search results.',
      affectedUrl: fullTargetUrl,
      affected_url: fullTargetUrl,
      detectedValue: `robots="${robots}"`,
      detected_value: `robots="${robots}"`,
      expectedValue: isIntentionallyNoindex ? 'noindex (acceptable for private/legal pages)' : 'index, follow for organic content',
      expected_value: 'index, follow for organic content',
      verificationMethod: 'Inspect meta[name="robots"] or X-Robots-Tag HTTP header',
      verification_method: 'Inspect Robots Directives dropdown in editor',
      evidence: `Robots directive is set to "${robots}".`,
      confidence: 1.0,
      expected_impact: isIntentionallyNoindex ? 'LOW' : 'HIGH',
    });
  }

  // ============================================================
  // 9. Schema.org Structured Data (Page-Type Aware)
  // ============================================================
  let hasSchema = false;
  const schemaTypes: string[] = [];
  if (input.structuredDataJson) {
    try {
      const parsed = JSON.parse(input.structuredDataJson);
      hasSchema = true;
      if (parsed['@type']) schemaTypes.push(String(parsed['@type']));
    } catch {
      rawFindings.push({
        id: `schema-syntax-err-${Math.random().toString(36).substring(2, 7)}`,
        ruleId: 'schema-syntax-error',
        pageType,
        intent,
        category: 'SCHEMA',
        severity: 'WARNING',
        title: 'Invalid Schema JSON-LD Syntax',
        problem: 'Structured Data contains malformed JSON-LD syntax',
        issue: 'Invalid JSON-LD syntax in Structured Data',
        explanation: 'Malformed JSON causes search engine parsers to silently fail and discard rich snippet eligibility.',
        recommendation: 'Fix JSON syntax or use the Schema Generator to create clean, valid JSON-LD.',
        affectedUrl: fullTargetUrl,
        affected_url: fullTargetUrl,
        detectedValue: 'Syntax error parsing JSON-LD',
        detected_value: 'Syntax error parsing JSON-LD',
        expectedValue: 'Valid JSON-LD schema',
        expected_value: 'Valid JSON-LD schema',
        verificationMethod: 'Validate with Google Rich Results Test',
        verification_method: 'Validate with Google Rich Results Test tool',
        evidence: 'JSON.parse threw a syntax exception on structuredData string.',
        confidence: 1.0,
        expected_impact: 'HIGH',
      });
    }
  }

  // Check live HTML for JSON-LD or Schema.org Microdata (e.g. itemscope itemtype="https://schema.org/Article")
  if (!hasSchema && input.liveHtml) {
    if (
      input.liveHtml.includes('application/ld+json') ||
      /itemType=["']https?:\/\/schema\.org\/(Article|NewsArticle|BlogPosting|WebPage|Organization)/i.test(input.liveHtml) ||
      /itemtype=["']https?:\/\/schema\.org\/(Article|NewsArticle|BlogPosting|WebPage|Organization)/i.test(input.liveHtml)
    ) {
      hasSchema = true;
    }
  }

  // Schema absence check tailored to page type
  if (!hasSchema) {
    if (isEditorial) {
      rawFindings.push({
        id: `schema-missing-${Math.random().toString(36).substring(2, 7)}`,
        ruleId: 'schema-article-missing',
        pageType,
        intent,
        category: 'SCHEMA',
        severity: 'WARNING',
        title: 'Missing Article Schema',
        problem: 'No Article or BlogPosting JSON-LD structured data configured',
        issue: 'No Schema.org structured data configured',
        explanation: 'Article schema enables Google rich results including headline, image, publish date, and author entity connections.',
        recommendation: 'Apply Article or BlogPosting JSON-LD schema to this page.',
        affectedUrl: fullTargetUrl,
        affected_url: fullTargetUrl,
        detectedValue: '0 schema types declared',
        detected_value: '0 schema types declared',
        expectedValue: 'Valid Article or BlogPosting schema',
        expected_value: 'Valid Article or WebPage schema',
        verificationMethod: 'Inspect <script type="application/ld+json"> in page HTML',
        verification_method: 'Check Structured Data tab in editor',
        evidence: 'No JSON-LD structured data found for editorial article.',
        confidence: 0.95,
        expected_impact: 'MEDIUM',
      });
    } else if (isAbout || isHome) {
      rawFindings.push({
        id: `schema-org-missing-${Math.random().toString(36).substring(2, 7)}`,
        ruleId: 'schema-org-missing',
        pageType,
        intent,
        category: 'SCHEMA',
        severity: 'INFO',
        title: 'Organization Schema Opportunity',
        problem: 'No Organization or WebSite schema declared',
        issue: 'No Organization or WebSite schema declared',
        explanation: 'Organization schema strengthens brand entity knowledge graph recognition in Google Knowledge Panels.',
        recommendation: 'Add Organization or WebSite JSON-LD schema with logo, brand name, and social links.',
        affectedUrl: fullTargetUrl,
        affected_url: fullTargetUrl,
        detectedValue: '0 schema types declared',
        detected_value: '0 schema types declared',
        expectedValue: 'Organization or WebSite schema',
        expected_value: 'Organization or WebSite schema',
        verificationMethod: 'Validate with Google Rich Results Test',
        verification_method: 'Check Structured Data tab in editor',
        evidence: 'No JSON-LD Organization schema declared.',
        confidence: 0.85,
        expected_impact: 'LOW',
      });
    }
  }

  // ============================================================
  // 10. E-E-A-T and GEO Engines (Page-Type Aware)
  // ============================================================
  const eeatResult = analyzeEeat({
    url: fullTargetUrl,
    title: input.title,
    content,
    authorName: input.authorName,
    authorBio: input.authorBio,
    publishedAt: input.publishedAt,
    updatedAt: input.updatedAt,
    pageType,
    intent,
  });
  rawFindings.push(...eeatResult.findings);

  const geoResult = analyzeGeoCitability({
    url: fullTargetUrl,
    title: input.title,
    content,
    pageType,
    intent,
  });
  rawFindings.push(...geoResult.findings);

  // ============================================================
  // 11. Internal Links & Orphan Protection
  // ============================================================
  const internalLinkMatches = content.match(/href\s*=\s*(?:"(\/[^"]*)"|'(\/[^']*)')/gi) || [];
  const externalLinkMatches = content.match(/href\s*=\s*(?:"(https?:\/\/[^"]*)"|'(https?:\/\/[^']*)')/gi) || [];

  // ============================================================
  // 12. Deduplication and Normalization
  // ============================================================
  const seenRuleKeys = new Set<string>();
  const findings: SeoFinding[] = [];

  for (const f of rawFindings) {
    const key = `${f.ruleId || f.issue}::${f.affected_url}`;
    if (!seenRuleKeys.has(key)) {
      seenRuleKeys.add(key);
      findings.push({
        ...f,
        pageType,
        intent,
        affectedUrl: f.affectedUrl || f.affected_url,
        detectedValue: f.detectedValue || f.detected_value,
        expectedValue: f.expectedValue || f.expected_value,
        verificationMethod: f.verificationMethod || f.verification_method,
        problem: f.problem || f.issue,
        confidence: f.confidence ?? 0.9,
        requestedUrl: f.requestedUrl || requestedUrl,
        finalResolvedUrl: f.finalResolvedUrl || input.finalResolvedUrl || fullTargetUrl,
        redirectChain: f.redirectChain || (redirectChain.length > 0 ? redirectChain : undefined),
      });
    }
  }

  // Calculate scores
  const scoreResult = calculateCategoryScores(findings);

  return {
    url: fullTargetUrl,
    title: input.title,
    overallScore: scoreResult.overallScore,
    grade: scoreResult.grade,
    categories: scoreResult.categories,
    findings,
    headingStructure,
    keywordAnalysis,
    eeat: eeatResult.eeat,
    geo: geoResult.geo,
    technical: {
      wordCount,
      readingTimeMinutes,
      imagesCount: totalImages,
      imagesWithoutAlt,
      internalLinksCount: internalLinkMatches.length,
      externalLinksCount: externalLinkMatches.length,
      hasCanonical,
      canonicalUrl: input.canonicalUrl,
      hasSchema,
      schemaTypes,
      robotsDirectives: robots,
      metaTitleLength: metaTitle.length,
      metaDescriptionLength: metaDesc.length,
    },
  };
}
