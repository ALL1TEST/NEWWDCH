// ============================================================
// POST /api/seo/ai-assist/apply — Apply AI Fix to CMS Content
// Mutates the actual CMS record, re-audits the page, and only
// marks the finding resolved if verified by the re-audit.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { requireFeatureAllowStaff } from '@/lib/platform/platform-auth';
import { auditSinglePage } from '@/lib/seo/audit-engine';
import { extractRuleId } from '@/lib/seo/verifier';
import { publishArticleToConnectedSite } from '@/lib/connection/site-publisher';

export async function POST(request: NextRequest) {
  const auth = await requireFeatureAllowStaff(request, 'advanced_seo');
  if ('response' in auth) return auth.response;
  const id = generateRequestId();

  try {
    const body = await request.json().catch(() => ({}));
    const { issueId, targetField, proposedValue } = body;

    if (!issueId || !targetField || proposedValue === undefined) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'issueId, targetField, and proposedValue are required.',
          },
          meta: { requestId: id },
        },
        { status: 400 },
      );
    }

    const issue = await db.seoIssue.findUnique({ where: { id: issueId } });
    if (!issue) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'SEO issue not found.' }, meta: { requestId: id } },
        { status: 404 },
      );
    }

    // Locate CMS ContentItem
    let contentItem = issue.resourceId
      ? await db.contentItem.findUnique({ where: { id: issue.resourceId } })
      : null;

    if (!contentItem && issue.pageUrl) {
      const urlParts = issue.pageUrl.split('/').filter(Boolean);
      const potentialSlug = urlParts[urlParts.length - 1] || '';
      if (potentialSlug) {
        contentItem = await db.contentItem.findFirst({
          where: { slug: potentialSlug, deletedAt: null },
        });
      }
    }

    if (!contentItem) {
      return NextResponse.json(
        {
          error: {
            code: 'CONTENT_NOT_FOUND',
            message: 'Unable to locate a matching CMS article or page record to apply changes.',
          },
          meta: { requestId: id },
        },
        { status: 404 },
      );
    }

    // 1. Mutate CMS Record
    const updatePayload: Record<string, any> = {
      [targetField]: proposedValue,
      updatedAt: new Date(),
    };

    const updatedItem = await db.contentItem.update({
      where: { id: contentItem.id },
      data: updatePayload,
      include: {
        contentType: { select: { slug: true, name: true } },
        author: { select: { name: true } },
        authorProfile: { select: { displayName: true, bio: true } },
        featuredImage: { select: { url: true } },
      },
    });

    // 2. Sync to connected site if available
    try {
      await publishArticleToConnectedSite(updatedItem.id, updatedItem.siteId);
    } catch (err: any) {
      console.warn(`[SEO:AI_APPLY] Sync to connected site returned: ${err.message}`);
    }

    // 3. Re-run SEO Check to verify actual resolution
    const ruleId = extractRuleId(issue.recommendation || '', issue.problem || '');

    let domain = 'verdantt.vercel.app';
    try {
      if (issue.pageUrl.startsWith('http')) {
        domain = new URL(issue.pageUrl).hostname;
      }
    } catch {
      // default
    }

    const reAuditResult = auditSinglePage({
      url: issue.pageUrl,
      title: updatedItem.title,
      slug: updatedItem.slug,
      contentType: updatedItem.contentType?.slug === 'page' ? 'page' : 'article',
      content: updatedItem.content || '',
      excerpt: updatedItem.excerpt || undefined,
      seoTitle: updatedItem.seoTitle || undefined,
      seoDescription: updatedItem.seoDescription || undefined,
      focusKeyword: updatedItem.focusKeyword || undefined,
      authorName: updatedItem.authorProfile?.displayName || updatedItem.author?.name || undefined,
      authorBio: updatedItem.authorProfile?.bio || undefined,
      siteDomain: domain,
    });

    // 3. Check if target rule finding still exists
    const stillPresent = reAuditResult.findings.some(
      (f) => f.ruleId === ruleId || (f.problem && f.problem.toLowerCase() === issue.problem.toLowerCase())
    );

    let isResolved = false;
    if (!stillPresent) {
      isResolved = true;
      const verifiedAt = new Date().toISOString();
      await db.seoIssue.update({
        where: { id: issue.id },
        data: {
          isResolved: true,
          recommendation: `${issue.recommendation}\n[RESOLVED_AT]: ${verifiedAt}\n[VERIFICATION_RESULT]: VERIFIED`,
          updatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      data: {
        issueId: issue.id,
        contentId: updatedItem.id,
        mutatedField: targetField,
        isResolved,
        remainingFindingsCount: reAuditResult.findings.length,
        message: isResolved
          ? 'AI change applied and finding verified as resolved.'
          : 'AI change was applied, but the finding is still detected.',
      },
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error(`[SEO:AI_APPLY] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error?.message || 'Failed to apply AI changes to CMS' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
