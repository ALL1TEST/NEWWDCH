// ============================================================
// Verified Resolve Engine for SEO Audit
// Re-executes the exact SEO check against current state.
// Only marks a finding as resolved if verified by the SEO rules.
// ============================================================

import { db } from '@/lib/db';
import { auditSinglePage, SinglePageAuditInput } from '@/lib/seo/audit-engine';
import { getFindingFixCapability } from '@/lib/seo/capability';

export interface VerificationResult {
  isResolved: boolean;
  status: 'RESOLVED' | 'VERIFICATION_FAILED' | 'MANUAL_VERIFICATION_REQUIRED';
  message: string;
  canAutoVerify: boolean;
  currentEvidence?: string;
  ruleId: string;
  verifiedAt: string;
}

const MANUAL_UNVERIFIABLE_RULES = new Set([
  'eeat-experience-signals',
  'eeat-author-attribution',
  'eeat-external-citations',
]);

import { crawlPage, RedirectHop } from '@/lib/seo/crawler';

async function safeFetchLiveHtml(url: string, timeoutMs = 4000): Promise<{ status: number; html?: string; finalUrl?: string; redirectChain?: RedirectHop[] }> {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { status: 0 };
  }

  try {
    const crawl = await crawlPage(url, { timeoutMs });
    return {
      status: crawl.httpStatus,
      html: crawl.html,
      finalUrl: crawl.finalResolvedUrl,
      redirectChain: crawl.redirectChain,
    };
  } catch {
    return { status: 0 };
  }
}

export function extractRuleId(recommendation: string, problem: string): string {
  const ruleMatch = recommendation.match(/\[RULE_ID\]:\s*([^\n]+)/);
  if (ruleMatch && ruleMatch[1].trim()) {
    return ruleMatch[1].trim();
  }

  const p = problem.toLowerCase();
  if (p.includes('canonical')) return 'canonical-missing';
  if (p.includes('meta description')) return 'meta-description-missing';
  if (p.includes('title tag') || p.includes('meta title')) return 'meta-title-missing';
  if (p.includes('h1 heading') || p.includes('missing h1')) return 'h1-missing';
  if (p.includes('multiple h1')) return 'h1-multiple';
  if (p.includes('answer passages') || p.includes('self-contained')) return 'geo-answer-passages';
  if (p.includes('question-form headings') || p.includes('question headings')) return 'geo-question-headings';
  if (p.includes('first-hand experience') || p.includes('testing signals')) return 'eeat-experience-signals';
  if (p.includes('author attribution') || p.includes('author credentials')) return 'eeat-author-attribution';
  if (p.includes('external source citations') || p.includes('citations')) return 'eeat-external-citations';
  if (p.includes('schema') || p.includes('structured data')) return 'schema-article-missing';
  if (p.includes('robots') || p.includes('noindex')) return 'robots-noindex-directive';
  if (p.includes('404')) return 'http-status-404';
  if (p.includes('image is missing descriptive alt') || p.includes('alt attribute')) return 'image-alt-missing';

  return 'generic-seo-rule';
}

export async function verifyAndResolveFinding(issueId: string): Promise<VerificationResult> {
  const verifiedAt = new Date().toISOString();

  // 1. Load finding
  const issue = await db.seoIssue.findUnique({ where: { id: issueId } });
  if (!issue) {
    throw new Error('SEO issue not found.');
  }

  // 2. Identify rule
  const ruleId = extractRuleId(issue.recommendation || '', issue.problem || '');

  // 3. Check for unsupported / manual verification rules
  if (MANUAL_UNVERIFIABLE_RULES.has(ruleId)) {
    return {
      isResolved: false,
      status: 'MANUAL_VERIFICATION_REQUIRED',
      canAutoVerify: false,
      message: 'Automatic verification is not available for this finding yet. Please resolve it manually.',
      ruleId,
      verifiedAt,
    };
  }

  // 4. Load current state of the page / CMS record
  let contentItem = issue.resourceId
    ? await db.contentItem.findUnique({
        where: { id: issue.resourceId },
        include: {
          contentType: { select: { slug: true, name: true } },
          author: { select: { name: true } },
          authorProfile: { select: { displayName: true, bio: true } },
          featuredImage: { select: { url: true } },
        },
      })
    : null;

  if (!contentItem && issue.pageUrl) {
    const urlParts = issue.pageUrl.split('/').filter(Boolean);
    const potentialSlug = urlParts[urlParts.length - 1] || '';
    if (potentialSlug) {
      contentItem = await db.contentItem.findFirst({
        where: { slug: potentialSlug, deletedAt: null },
        include: {
          contentType: { select: { slug: true, name: true } },
          author: { select: { name: true } },
          authorProfile: { select: { displayName: true, bio: true } },
          featuredImage: { select: { url: true } },
        },
      });
    }
  }

  // Fetch SEO Config if CMS item exists
  const seoConfig = contentItem
    ? await db.seoConfig.findFirst({
        where: { resourceType: 'content', resourceId: contentItem.id },
      })
    : null;

  // Probe live web page if URL is external/public
  const liveResult = await safeFetchLiveHtml(issue.pageUrl);

  let siteDomain = 'verdantt.vercel.app';
  try {
    if (issue.pageUrl.startsWith('http')) {
      siteDomain = new URL(issue.pageUrl).hostname;
    }
  } catch {
    // fallback
  }

  const isPage = contentItem?.contentType?.slug === 'page' || ['about', 'contact', 'privacy-policy', 'terms'].includes(contentItem?.slug || '');

  // 5. Build audit input and execute the exact existing SEO rule engine
  const targetUrl = liveResult.finalUrl || issue.pageUrl;
  const auditInput: SinglePageAuditInput = {
    url: targetUrl,
    requestedUrl: issue.pageUrl,
    finalResolvedUrl: targetUrl,
    redirectChain: liveResult.redirectChain,
    title: contentItem?.title || '',
    slug: contentItem?.slug,
    contentType: isPage ? 'page' : 'article',
    content: contentItem?.content || '',
    excerpt: contentItem?.excerpt || undefined,
    seoTitle: contentItem?.seoTitle || undefined,
    seoDescription: contentItem?.seoDescription || undefined,
    focusKeyword: contentItem?.focusKeyword || undefined,
    canonicalUrl: seoConfig?.canonicalUrl || undefined,
    robotsDirectives: seoConfig?.robots || undefined,
    featuredImageUrl: contentItem?.featuredImage?.url || undefined,
    authorName: contentItem?.authorProfile?.displayName || contentItem?.author?.name || undefined,
    authorBio: contentItem?.authorProfile?.bio || undefined,
    publishedAt: contentItem?.publishedAt || undefined,
    updatedAt: contentItem?.updatedAt || undefined,
    structuredDataJson: seoConfig?.structuredData || undefined,
    siteDomain,
    httpStatus: liveResult.status > 0 ? liveResult.status : undefined,
    liveHtml: liveResult.html,
  };

  const reAuditResult = auditSinglePage(auditInput);

  // 6. Check if the issue is still detected by the SEO rules
  const matchingFinding = reAuditResult.findings.find((f) => {
    if (f.ruleId === ruleId) return true;
    if (f.problem && f.problem.toLowerCase() === issue.problem.toLowerCase()) return true;
    return false;
  });

  // 7. Evaluate verification outcome
  if (matchingFinding) {
    // Issue is STILL DETECTED: DO NOT mark resolved!
    return {
      isResolved: false,
      status: 'VERIFICATION_FAILED',
      canAutoVerify: true,
      message: 'Finding is still unresolved. The SEO check detected the issue again.',
      currentEvidence: matchingFinding.evidence || matchingFinding.detectedValue || 'The SEO issue is still present on the page.',
      ruleId,
      verifiedAt,
    };
  }

  // Issue is NO LONGER DETECTED: Mark resolved in database!
  await db.seoIssue.update({
    where: { id: issue.id },
    data: {
      isResolved: true,
      recommendation: `${issue.recommendation}\n[RESOLVED_AT]: ${verifiedAt}\n[VERIFICATION_RESULT]: VERIFIED`,
      updatedAt: new Date(),
    },
  });

  return {
    isResolved: true,
    status: 'RESOLVED',
    canAutoVerify: true,
    message: 'Finding verified and resolved successfully.',
    ruleId,
    verifiedAt,
  };
}
