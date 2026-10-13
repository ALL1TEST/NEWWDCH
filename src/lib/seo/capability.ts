// ============================================================
// Finding Capability Classification Engine
// Categorizes SEO findings into:
// - AUTO_FIXABLE: Technical issues handled via settings/generators (e.g. canonical, schema)
// - AI_FIXABLE: Content/editorial issues where AI safely drafts real improvements (meta description, titles, GEO passages)
// - MANUAL: Issues requiring human research, real-world credentials, or genuine first-hand experience
// - INFORMATIONAL: Non-critical informational observations
// ============================================================

export type FindingFixCapability = 'AUTO_FIXABLE' | 'AI_FIXABLE' | 'MANUAL' | 'INFORMATIONAL';

export interface FindingFixCapabilityInfo {
  capability: FindingFixCapability;
  label: string;
  isAiFixable: boolean;
  requiresManualAction: boolean;
  explanation: string;
}

export function getFindingFixCapability(finding: {
  ruleId?: string;
  problem?: string;
  severity?: string;
  recommendation?: string;
}): FindingFixCapabilityInfo {
  const ruleId = (finding.ruleId || '').toLowerCase();
  const problem = (finding.problem || '').toLowerCase();
  const recommendation = (finding.recommendation || '').toLowerCase();
  const severity = (finding.severity || '').toUpperCase();

  // 1. MANUAL (Safety & E-E-A-T Integrity Guardrail)
  // NEVER fabricate first-hand experience, credentials, human authorship, or real citations.
  const isEeatManual =
    ruleId.startsWith('eeat-') ||
    problem.includes('first-hand experience') ||
    problem.includes('testing signals') ||
    problem.includes('author attribution') ||
    problem.includes('external source citations') ||
    problem.includes('author credentials') ||
    recommendation.includes('first-hand') ||
    recommendation.includes('original photos') ||
    recommendation.includes('author bio');

  const isTechnicalManual =
    ruleId.includes('http-status-404') ||
    ruleId.includes('http-status-5xx') ||
    ruleId.includes('image-alt-missing') ||
    ruleId.includes('content-depth-article') || // severely thin content needs human writer
    ruleId.includes('content-depth-about') ||
    ruleId.includes('content-depth-contact') ||
    problem.includes('404') ||
    problem.includes('500') ||
    problem.includes('image is missing descriptive alt');

  if (isEeatManual) {
    return {
      capability: 'MANUAL',
      label: 'Manual Action Required',
      isAiFixable: false,
      requiresManualAction: true,
      explanation: 'Authentic first-hand testing, author credentials, and citations must come from real human contributors and cannot be fabricated by AI.',
    };
  }

  if (isTechnicalManual) {
    return {
      capability: 'MANUAL',
      label: 'Manual Action Required',
      isAiFixable: false,
      requiresManualAction: true,
      explanation: 'Resolving this finding requires human editorial authoring or webmaster configuration.',
    };
  }

  // 2. AUTO_FIXABLE / TECHNICAL
  // Mechanical/configuration updates that do not need LLM creative text generation
  const isAutoFixable =
    ruleId.includes('canonical') ||
    ruleId.includes('schema') ||
    ruleId.includes('robots') ||
    ruleId.includes('sitemap') ||
    problem.includes('canonical') ||
    problem.includes('schema.org') ||
    problem.includes('json-ld') ||
    problem.includes('robots.txt') ||
    problem.includes('noindex');

  if (isAutoFixable) {
    return {
      capability: 'AUTO_FIXABLE',
      label: 'Technical / Auto-Fixable',
      isAiFixable: false,
      requiresManualAction: false,
      explanation: 'This technical configuration can be set in site settings or generated via canonical/schema tools.',
    };
  }

  // 3. AI_FIXABLE
  // Editorial and copy optimizations where AI can safely propose real content modifications
  const isAiFixable =
    ruleId.includes('meta-description') ||
    ruleId.includes('meta-title') ||
    ruleId.includes('geo-answer-passages') ||
    ruleId.includes('geo-question-headings') ||
    ruleId.includes('geo-structured-takeaways') ||
    ruleId.includes('h1-missing') ||
    ruleId.includes('h1-multiple') ||
    ruleId.includes('heading-hierarchy') ||
    problem.includes('meta description') ||
    problem.includes('title tag') ||
    problem.includes('answer passages') ||
    problem.includes('question-form headings') ||
    problem.includes('self-contained answer') ||
    problem.includes('h1') ||
    problem.includes('heading');

  if (isAiFixable) {
    return {
      capability: 'AI_FIXABLE',
      label: 'AI Fix Available',
      isAiFixable: true,
      requiresManualAction: false,
      explanation: 'AI can analyze the article and propose a concrete content or metadata change for your review.',
    };
  }

  // 4. INFORMATIONAL
  if (severity === 'INFO') {
    return {
      capability: 'INFORMATIONAL',
      label: 'Informational',
      isAiFixable: false,
      requiresManualAction: false,
      explanation: 'This is an optional observation or advisory recommendation.',
    };
  }

  // Default fallback
  return {
    capability: 'MANUAL',
    label: 'Manual Action Required',
    isAiFixable: false,
    requiresManualAction: true,
    explanation: 'Manual review required to verify and apply adjustments.',
  };
}
