// ============================================================
// CMS-Native SEO System: Transparent Scoring Engine
// Category-weighted, falsifiable deduction logic
// ============================================================

import {
  CategoryScore,
  SeoCategory,
  SeoFinding,
  SeoSeverity,
} from './types';

export const CATEGORY_CONFIG: Record<
  SeoCategory,
  { name: string; weight: number }
> = {
  TECHNICAL: { name: 'Technical SEO', weight: 0.20 },
  ON_PAGE: { name: 'On-Page SEO', weight: 0.25 },
  CONTENT_QUALITY: { name: 'Content Quality', weight: 0.15 },
  EEAT: { name: 'E-E-A-T Authority', weight: 0.15 },
  GEO_AI_SEARCH: { name: 'AI Search & GEO', weight: 0.15 },
  SCHEMA: { name: 'Schema & Structured Data', weight: 0.05 },
  INTERNAL_LINKING: { name: 'Internal Linking', weight: 0.03 },
  IMAGE_SEO: { name: 'Image Optimization', weight: 0.02 },
};

export const SEVERITY_DEDUCTIONS: Record<string, number> = {
  CRITICAL: 15,
  WARNING: 6,
  HIGH: 8,
  MEDIUM: 4,
  INFO: 0, // INFO is an optimization tip/insight, not a penalty
  LOW: 2,
};

export function calculateCategoryScores(findings: SeoFinding[]): {
  overallScore: number;
  grade: 'EXCELLENT' | 'GOOD' | 'NEEDS_WORK' | 'CRITICAL';
  categories: CategoryScore[];
  severitySummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    warning?: number;
    info?: number;
  };
} {
  const categoryFindingsMap = new Map<SeoCategory, SeoFinding[]>();

  for (const cat of Object.keys(CATEGORY_CONFIG) as SeoCategory[]) {
    categoryFindingsMap.set(cat, []);
  }

  const severitySummary = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    warning: 0,
    info: 0,
  };

  for (const finding of findings) {
    const list = categoryFindingsMap.get(finding.category) || [];
    list.push(finding);
    categoryFindingsMap.set(finding.category, list);

    switch (finding.severity) {
      case 'CRITICAL':
        severitySummary.critical++;
        break;
      case 'WARNING':
        severitySummary.warning++;
        severitySummary.high++;
        break;
      case 'HIGH':
        severitySummary.high++;
        severitySummary.warning++;
        break;
      case 'MEDIUM':
        severitySummary.medium++;
        break;
      case 'INFO':
        severitySummary.info++;
        severitySummary.low++;
        break;
      case 'LOW':
        severitySummary.low++;
        severitySummary.info++;
        break;
    }
  }

  let totalWeightedScore = 0;
  let totalWeights = 0;
  const categories: CategoryScore[] = [];

  for (const [cat, config] of Object.entries(CATEGORY_CONFIG) as [SeoCategory, { name: string; weight: number }][]) {
    const catFindings = categoryFindingsMap.get(cat) || [];
    let deduction = 0;
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };

    for (const f of catFindings) {
      deduction += SEVERITY_DEDUCTIONS[f.severity] ?? 0;
      if (f.severity === 'CRITICAL') counts.critical++;
      else if (f.severity === 'HIGH' || f.severity === 'WARNING') counts.high++;
      else if (f.severity === 'MEDIUM') counts.medium++;
      else counts.low++;
    }

    const catScore = Math.max(0, Math.min(100, Math.round(100 - deduction)));
    categories.push({
      category: cat,
      name: config.name,
      score: catScore,
      weight: config.weight,
      findingsCount: counts,
    });

    totalWeightedScore += catScore * config.weight;
    totalWeights += config.weight;
  }

  const normalizedOverall = Math.round(totalWeightedScore / totalWeights);
  const overallScore = Math.max(0, Math.min(100, normalizedOverall));

  let grade: 'EXCELLENT' | 'GOOD' | 'NEEDS_WORK' | 'CRITICAL' = 'EXCELLENT';
  if (overallScore < 50) grade = 'CRITICAL';
  else if (overallScore < 70) grade = 'NEEDS_WORK';
  else if (overallScore < 85) grade = 'GOOD';

  return {
    overallScore,
    grade,
    categories,
    severitySummary,
  };
}
