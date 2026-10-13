// ============================================================
// CMS-Native SEO System: Core Types & Interfaces
// Adapted from Claude SEO architecture & methodology
// ============================================================

import { PageType, ContentIntent } from './page-type-detector';
export type { PageType, ContentIntent };

export type SeoSeverity = 'CRITICAL' | 'WARNING' | 'INFO' | 'HIGH' | 'MEDIUM' | 'LOW';

export type SeoCategory =
  | 'TECHNICAL'
  | 'ON_PAGE'
  | 'CONTENT_QUALITY'
  | 'EEAT'
  | 'SCHEMA'
  | 'GEO_AI_SEARCH'
  | 'INTERNAL_LINKING'
  | 'IMAGE_SEO';

export interface SeoFinding {
  id: string;
  ruleId?: string;
  pageType?: PageType;
  intent?: ContentIntent;
  category: SeoCategory;
  severity: SeoSeverity;
  title?: string;
  problem?: string; // Standardized problem description
  issue: string; // Backwards compatible with existing UI
  explanation: string;
  recommendation: string;
  affectedUrl?: string;
  affected_url: string; // Backwards compatible
  detectedValue?: string;
  detected_value: string; // Backwards compatible
  expectedValue?: string;
  expected_value: string; // Backwards compatible
  verificationMethod?: string;
  verification_method: string; // Backwards compatible
  evidence?: string;
  confidence?: number; // 0 to 1
  expected_impact?: 'HIGH' | 'MEDIUM' | 'LOW';
  resourceId?: string;
  resourceType?: string;
  isResolved?: boolean;
  requestedUrl?: string;
  finalResolvedUrl?: string;
  redirectChain?: { statusCode: number; url: string; location?: string; toUrl?: string }[];
}

export interface CategoryScore {
  category: SeoCategory;
  name: string;
  score: number; // 0-100
  weight: number; // e.g. 0.25
  findingsCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface EeatSignals {
  score: number; // 0-100
  experience: {
    hasFirstHandEvidence: boolean;
    hasCaseStudiesOrMetrics: boolean;
    hasOriginalMedia: boolean;
    score: number;
  };
  expertise: {
    hasAuthorBio: boolean;
    hasAuthorCredentials: boolean;
    hasTopicalDepth: boolean;
    score: number;
  };
  authoritativeness: {
    outboundCitationsCount: number;
    hasReputableCitations: boolean;
    score: number;
  };
  trustworthiness: {
    hasPublishedDate: boolean;
    hasUpdatedDate: boolean;
    hasContactOrPolicyContext: boolean;
    wordCount: number;
    score: number;
  };
  heuristics: {
    who: string; // Author clarity
    how: string; // Content creation method/evidence
    why: string; // Content purpose (user benefit vs search-only)
  };
}

export interface GeoCitabilitySignals {
  score: number; // 0-100
  passageCitabilityScore: number;
  selfContainedPassagesCount: number; // 130-170 word concise answer blocks
  questionHeadingsRatio: number; // Ratio of H2/H3s that are questions (Who/What/How/Why)
  entityClarityScore: number;
  structuralReadability: {
    hasBulletPoints: boolean;
    hasComparisonTables: boolean;
    hasDefinitions: boolean;
    headingDepth: number;
  };
  quotableFactsCount: number;
  recommendations: string[];
}

export interface HeadingItem {
  level: number; // 1, 2, 3, 4, 5, 6
  text: string;
  id?: string;
}

export interface HeadingStructureAnalysis {
  isValid: boolean;
  h1Count: number;
  h1Text?: string;
  headings: HeadingItem[];
  hierarchyIssues: string[];
  skippedLevels: boolean;
}

export interface KeywordCoverageAnalysis {
  keyword: string;
  inTitle: boolean;
  inDescription: boolean;
  inH1: boolean;
  inFirstParagraph: boolean;
  inSlug: boolean;
  count: number;
  density: number; // percentage
  status: 'OPTIMAL' | 'UNDER_OPTIMIZED' | 'OVER_OPTIMIZED' | 'MISSING';
}

export interface SinglePageSeoAuditResult {
  url: string;
  title?: string;
  overallScore: number; // 0-100
  grade: 'EXCELLENT' | 'GOOD' | 'NEEDS_WORK' | 'CRITICAL';
  categories: CategoryScore[];
  findings: SeoFinding[];
  headingStructure: HeadingStructureAnalysis;
  keywordAnalysis?: KeywordCoverageAnalysis;
  eeat: EeatSignals;
  geo: GeoCitabilitySignals;
  technical: {
    wordCount: number;
    readingTimeMinutes: number;
    imagesCount: number;
    imagesWithoutAlt: number;
    internalLinksCount: number;
    externalLinksCount: number;
    hasCanonical: boolean;
    canonicalUrl?: string;
    hasSchema: boolean;
    schemaTypes: string[];
    robotsDirectives: string;
    metaTitleLength: number;
    metaDescriptionLength: number;
  };
}

export interface SiteAuditSummary {
  siteId?: string;
  auditedPagesCount: number;
  overallScore: number;
  grade: 'EXCELLENT' | 'GOOD' | 'NEEDS_WORK' | 'CRITICAL';
  categories: CategoryScore[];
  severitySummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  topFindings: SeoFinding[];
  auditedAt: string;
}

export interface SeoAuditSnapshot {
  id: string;
  siteId?: string;
  overallScore: number;
  categoryScores: Record<string, number>;
  totalIssues: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  auditedPagesCount: number;
  createdAt: string;
}

export interface SchemaValidationItem {
  type: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  jsonLd: Record<string, unknown>;
  isDeprecated?: boolean;
  deprecationNotice?: string;
}
