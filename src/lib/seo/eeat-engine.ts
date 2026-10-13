// ============================================================
// CMS-Native SEO System: E-E-A-T Analysis Engine
// Grounded in Google's Search Quality Rater Guidelines & Helpful Content Guide
// ============================================================

import { EeatSignals, SeoFinding } from './types';
import { PageType, ContentIntent } from './page-type-detector';

export interface EeatInput {
  url: string;
  title: string;
  content: string; // HTML or Markdown
  authorName?: string;
  authorBio?: string;
  publishedAt?: string | Date;
  updatedAt?: string | Date;
  pageType?: PageType;
  intent?: ContentIntent;
}

const FIRST_HAND_KEYWORDS = [
  'in our testing',
  'we tested',
  'our review',
  'we found',
  'in our experience',
  'case study',
  'hands-on',
  'our analysis',
  'benchmark',
  'results showed',
  'we tried',
  'our team',
  'real-world',
];

export function analyzeEeat(input: EeatInput): {
  eeat: EeatSignals;
  findings: SeoFinding[];
} {
  const plainText = input.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const lowerText = plainText.toLowerCase();
  const wordCount = plainText ? plainText.split(/\s+/).length : 0;
  const findings: SeoFinding[] = [];
  const pageType = input.pageType || 'ARTICLE';
  const intent = input.intent || 'INFORMATIONAL';

  const isEditorial = pageType === 'ARTICLE' || pageType === 'BLOG_POST';
  const isAbout = pageType === 'ABOUT';
  const isUtilityOrLegal = pageType === 'CONTACT' || pageType === 'LEGAL' || pageType === 'PRIVACY' || pageType === 'TERMS';

  // 1. Experience
  let firstHandMatches = 0;
  for (const kw of FIRST_HAND_KEYWORDS) {
    if (lowerText.includes(kw)) firstHandMatches++;
  }
  const hasOriginalMedia = /<img\s[^>]*?>/i.test(input.content) || /<video/i.test(input.content);
  const hasCaseStudiesOrMetrics = /\b(\d+(\.\d+)?%|\$\d+|\d+\s*users|\d+\s*days|\d+\s*hours)\b/i.test(plainText);
  const hasFirstHandEvidence = firstHandMatches > 0;

  let experienceScore = 40;
  if (hasFirstHandEvidence) experienceScore += 30;
  if (hasCaseStudiesOrMetrics) experienceScore += 20;
  if (hasOriginalMedia) experienceScore += 10;
  experienceScore = Math.min(100, experienceScore);

  // Only articles are expected to show first-hand testing notes
  if (isEditorial && !hasFirstHandEvidence && wordCount > 400) {
    findings.push({
      id: `eeat-exp-${Math.random().toString(36).substring(2, 7)}`,
      ruleId: 'eeat-experience-signals',
      pageType,
      intent,
      category: 'EEAT',
      severity: 'INFO',
      title: 'First-Hand Experience Opportunity',
      problem: 'Limited first-hand experience signals detected in editorial article',
      issue: 'Limited first-hand experience signals detected',
      explanation: 'Google values first-hand experience (e.g. testing notes, unique observations, real data) to distinguish original insights from regurgitated content.',
      recommendation: 'Incorporate personal testing observations, case examples, or direct evidence of using the subject matter.',
      affectedUrl: input.url,
      affected_url: input.url,
      detectedValue: `${firstHandMatches} experience indicators found in ${wordCount} words`,
      detected_value: `${firstHandMatches} experience indicators`,
      expectedValue: 'At least 1-2 authentic first-hand observations or testing insights',
      expected_value: 'At least 1-2 authentic first-hand observations',
      verificationMethod: 'Review article for authentic pronouns and specific testing/usage context',
      verification_method: 'Review article for authentic pronouns and specific testing/usage context',
      evidence: `Keyword scan found ${firstHandMatches} first-hand markers in text.`,
      confidence: 0.85,
      expected_impact: 'LOW',
    });
  }

  // 2. Expertise
  const hasAuthorBio = !!(input.authorBio && input.authorBio.trim().length > 20);
  const hasAuthorCredentials = !!(
    hasAuthorBio &&
    /\b(expert|specialist|consultant|phd|certified|years of experience|lead|director|founder|author|editor)\b/i.test(input.authorBio || '')
  );
  const hasTopicalDepth = wordCount >= 700;

  // About page checks organization & mission instead of individual article author
  const hasOrgMission = isAbout && (lowerText.includes('mission') || lowerText.includes('founded') || lowerText.includes('our team') || lowerText.includes('who we are'));
  const hasContactSignals = isAbout && (lowerText.includes('contact') || lowerText.includes('email') || lowerText.includes('location'));

  let expertiseScore = 40;
  if (isAbout) {
    if (hasOrgMission) expertiseScore += 35;
    if (hasContactSignals) expertiseScore += 25;
  } else if (!isUtilityOrLegal) {
    if (input.authorName) expertiseScore += 20;
    if (hasAuthorBio) expertiseScore += 25;
    if (hasAuthorCredentials) expertiseScore += 15;
  } else {
    expertiseScore = 90; // Utility / legal pages don't need bylines
  }
  if (hasTopicalDepth) expertiseScore += 10;
  expertiseScore = Math.min(100, expertiseScore);

  // Author attribution check: STRICTLY for editorial articles
  if (isEditorial && !input.authorName) {
    findings.push({
      id: `eeat-no-author-${Math.random().toString(36).substring(2, 7)}`,
      ruleId: 'eeat-author-attribution',
      pageType,
      intent,
      category: 'EEAT',
      severity: 'WARNING',
      title: 'Missing Author Attribution',
      problem: 'Editorial article lacks a named author attribution',
      issue: 'Anonymous or missing author attribution',
      explanation: 'Author transparency is a core pillar of E-E-A-T. Articles without clear human authorship carry less credibility in competitive niches.',
      recommendation: 'Assign a named author profile with an expert bio and relevant credentials.',
      affectedUrl: input.url,
      affected_url: input.url,
      detectedValue: 'Author field is empty',
      detected_value: 'No author assigned',
      expectedValue: 'Named author profile with credentials',
      expected_value: 'Named author profile with credentials',
      verificationMethod: 'Check author byline and author bio schema',
      verification_method: 'Check author byline and author bio schema',
      evidence: 'No author name provided in article metadata or content byline.',
      confidence: 0.95,
      expected_impact: 'HIGH',
    });
  }

  // 3. Authoritativeness & Outbound Citations
  const externalLinkMatches = input.content.match(/href\s*=\s*(?:"(https?:\/\/[^"]*)"|'(https?:\/\/[^']*)')/gi) || [];
  const outboundCitationsCount = externalLinkMatches.length;
  const hasReputableCitations = outboundCitationsCount > 0;

  let authoritativenessScore = isUtilityOrLegal ? 90 : 50;
  if (outboundCitationsCount >= 1) authoritativenessScore += 25;
  if (outboundCitationsCount >= 3) authoritativenessScore += 25;
  authoritativenessScore = Math.min(100, authoritativenessScore);

  // Only editorial articles are expected to cite external sources
  if (isEditorial && outboundCitationsCount === 0 && wordCount > 500) {
    findings.push({
      id: `eeat-citations-${Math.random().toString(36).substring(2, 7)}`,
      ruleId: 'eeat-external-citations',
      pageType,
      intent,
      category: 'EEAT',
      severity: 'INFO',
      title: 'External Citations Opportunity',
      problem: 'No outbound citations to external sources detected in long-form article',
      issue: 'Zero external source citations',
      explanation: 'Authoritative content cites primary data sources, documentation, or authoritative studies to validate factual assertions.',
      recommendation: 'Consider citing 1-3 reputable external sources or primary references to back up statistics and claims.',
      affectedUrl: input.url,
      affected_url: input.url,
      detectedValue: '0 outbound citations found',
      detected_value: '0 outbound citations',
      expectedValue: '1-3 authoritative references where applicable',
      expected_value: '1-3 authoritative references',
      verificationMethod: 'Inspect outbound <a> tags for authoritative target domains',
      verification_method: 'Inspect outbound <a> tags for authoritative target domains',
      evidence: 'Parsed 0 external links with http/https targets in content body.',
      confidence: 0.9,
      expected_impact: 'LOW',
    });
  }

  // 4. Trustworthiness
  const hasPublishedDate = !!input.publishedAt;
  const hasUpdatedDate = !!input.updatedAt;
  const hasContactOrPolicyContext = true; // Handled at site/template level

  let trustScore = 50;
  if (hasPublishedDate) trustScore += 25;
  if (hasUpdatedDate) trustScore += 25;
  trustScore = Math.min(100, trustScore);

  const overallEeatScore = Math.round(
    experienceScore * 0.25 +
    expertiseScore * 0.25 +
    authoritativenessScore * 0.25 +
    trustScore * 0.25
  );

  return {
    eeat: {
      score: overallEeatScore,
      experience: {
        hasFirstHandEvidence,
        hasCaseStudiesOrMetrics,
        hasOriginalMedia,
        score: experienceScore,
      },
      expertise: {
        hasAuthorBio,
        hasAuthorCredentials,
        hasTopicalDepth,
        score: expertiseScore,
      },
      authoritativeness: {
        outboundCitationsCount,
        hasReputableCitations,
        score: authoritativenessScore,
      },
      trustworthiness: {
        hasPublishedDate,
        hasUpdatedDate,
        hasContactOrPolicyContext,
        wordCount,
        score: trustScore,
      },
      heuristics: {
        who: input.authorName ? `Authored by ${input.authorName}` : 'Missing author attribution',
        how: hasFirstHandEvidence ? 'Contains direct first-hand evidence' : 'Aggregated/descriptive structure',
        why: 'Created to provide comprehensive user value',
      },
    },
    findings,
  };
}
