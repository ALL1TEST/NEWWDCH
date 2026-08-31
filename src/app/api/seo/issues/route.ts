// ============================================================
// GET  /api/seo/issues      — List SEO issues (paginated, filterable)
// POST /api/seo/issues      — Create issue / trigger full audit
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { z } from 'zod/v4';
import { getSiteWhere } from '@/lib/site-context';
import { requireFeature } from '@/lib/platform/platform-auth';

// ---------- validation ------------------------------------------------

const createSchema = z.object({
  severity: z.enum(['CRITICAL', 'WARNING', 'INFO']).default('WARNING'),
  resourceType: z.string().min(1, 'Resource type is required'),
  resourceId: z.string().optional(),
  pageUrl: z.string().min(1, 'Page URL is required').max(2048),
  problem: z.string().min(1, 'Problem description is required'),
  recommendation: z.string().min(1, 'Recommendation is required'),
  isResolved: z.boolean().default(false),
});

const SORTABLE = new Set(['createdAt', 'updatedAt', 'severity', 'resourceType', 'pageUrl', 'isResolved']);

// =====================================================================
// GET — list
// =====================================================================

export async function GET(request: NextRequest) {
  const auth = await requireFeature(request, 'advanced_seo');
  if ('response' in auth) return auth.response;
  const id = generateRequestId();
  const start = Date.now();

  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const sort = SORTABLE.has(sp.get('sort') ?? '') ? sp.get('sort')! : 'createdAt';
    const order = sp.get('order') === 'asc' ? 'asc' : 'desc';
    const severity = sp.get('severity') || undefined;
    const isResolved = sp.get('isResolved');
    const search = sp.get('search') || '';

    const siteFilter = await getSiteWhere(request);
    const where: Record<string, unknown> = { ...siteFilter };
    if (severity) where.severity = severity;
    if (isResolved !== null && isResolved !== undefined && isResolved !== '') {
      where.isResolved = isResolved === 'true';
    }
    if (search) {
      where.OR = [
        { pageUrl: { contains: search } },
        { problem: { contains: search } },
        { recommendation: { contains: search } },
      ];
    }

    const orderBy: Record<string, string> = { [sort]: order };

    const [items, total] = await Promise.all([
      db.seoIssue.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.seoIssue.count({ where }),
    ]);

    return NextResponse.json({
      data: { data: items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } },
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
        duration: Date.now() - start,
      },
    });
  } catch (error) {
    console.error(`[SEO:ISSUES:LIST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch SEO issues' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}

// =====================================================================
// POST — create or audit
// =====================================================================

export async function POST(request: NextRequest) {
  const auth = await requireFeature(request, 'advanced_seo');
  if ('response' in auth) return auth.response;
  const id = generateRequestId();
  const start = Date.now();

  try {
    const sp = new URL(request.url).searchParams;
    const action = sp.get('action') || '';

    // Full audit action: scan content and create SEO issues
    if (action === 'audit') {
      const siteFilter = await getSiteWhere(request);
      const siteId = siteFilter.siteId;

      const publishedItems = await db.contentItem.findMany({
        where: { ...siteFilter, status: 'PUBLISHED', deletedAt: null },
        select: {
          id: true,
          title: true,
          slug: true,
          content: true,
          seoTitle: true,
          seoDescription: true,
          excerpt: true,
          featuredImageId: true,
          siteId: true,
        },
      });

      // Fetch SEO configs for all published items
      const resourceIds = publishedItems.map((p) => p.id);
      const seoConfigs = resourceIds.length > 0
        ? await db.seoConfig.findMany({
            where: { resourceType: 'content', resourceId: { in: resourceIds }, ...siteFilter },
            select: { resourceId: true, canonicalUrl: true, ogImageId: true },
          })
        : [];
      const seoConfigMap = new Map(seoConfigs.map((c) => [c.resourceId, c]));

      // Fetch site for domain checks
      const site = siteId
        ? await db.site.findFirst({ where: { id: siteId }, select: { domain: true } })
        : null;
      const siteDomain = site?.domain || null;

      const issues: { severity: 'CRITICAL' | 'WARNING' | 'INFO'; resourceType: string; resourceId: string; pageUrl: string; problem: string; recommendation: string }[] = [];

      for (const item of publishedItems) {
        const pageUrl = `/${item.slug}`;
        const seoConfig = seoConfigMap.get(item.id);

        // ---- EXISTING CHECKS ----

        // Check for missing meta title
        if (!item.seoTitle || item.seoTitle.trim() === '') {
          issues.push({
            severity: 'WARNING',
            resourceType: 'content',
            resourceId: item.id,
            pageUrl,
            problem: 'Missing meta title',
            recommendation: 'Add a descriptive meta title between 30-60 characters for better click-through rates in search results.',
          });
        } else if (item.seoTitle.length > 60) {
          issues.push({
            severity: 'INFO',
            resourceType: 'content',
            resourceId: item.id,
            pageUrl,
            problem: `Meta title too long (${item.seoTitle.length} characters)`,
            recommendation: 'Shorten the meta title to under 60 characters to avoid truncation in search results.',
          });
        }

        // Check for missing meta description
        if (!item.seoDescription || item.seoDescription.trim() === '') {
          issues.push({
            severity: 'WARNING',
            resourceType: 'content',
            resourceId: item.id,
            pageUrl,
            problem: 'Missing meta description',
            recommendation: 'Add a compelling meta description between 120-160 characters to improve search result appearances.',
          });
        } else if (item.seoDescription.length > 160) {
          issues.push({
            severity: 'INFO',
            resourceType: 'content',
            resourceId: item.id,
            pageUrl,
            problem: `Meta description too long (${item.seoDescription.length} characters)`,
            recommendation: 'Shorten the meta description to under 160 characters.',
          });
        }

        // Check for missing H1
        if (!item.content || !item.content.includes('<h1')) {
          issues.push({
            severity: 'WARNING',
            resourceType: 'content',
            resourceId: item.id,
            pageUrl,
            problem: 'Missing H1 heading',
            recommendation: 'Add an H1 heading that includes your target keyword for better SEO structure.',
          });
        }

        // Check for missing featured image
        if (!item.featuredImageId) {
          issues.push({
            severity: 'INFO',
            resourceType: 'content',
            resourceId: item.id,
            pageUrl,
            problem: 'No featured image set',
            recommendation: 'Add a featured image with proper alt text to improve social sharing and user engagement.',
          });
        }

        // ---- NEW CHECKS ----

        // Missing canonical URL
        if (!seoConfig || !seoConfig.canonicalUrl || seoConfig.canonicalUrl.trim() === '') {
          issues.push({
            severity: 'WARNING',
            resourceType: 'content',
            resourceId: item.id,
            pageUrl,
            problem: 'Missing canonical URL',
            recommendation: 'Set a canonical URL to avoid duplicate content issues and consolidate link equity.',
          });
        }

        // Missing OG image (no featuredImage and no ogImage in SeoConfig)
        if (!item.featuredImageId && (!seoConfig || !seoConfig.ogImageId)) {
          issues.push({
            severity: 'WARNING',
            resourceType: 'content',
            resourceId: item.id,
            pageUrl,
            problem: 'Missing OG image',
            recommendation: 'Add an Open Graph image for better appearance when shared on social media platforms.',
          });
        }

        // Images without ALT text
        if (item.content) {
          const imgTagRegex = /<img\s[^>]*?>/gi;
          const imgTags = item.content.match(imgTagRegex) || [];
          const imagesWithoutAlt = imgTags.filter((tag) => {
            // Check if alt attribute exists and is not empty
            const altMatch = tag.match(/alt\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/i);
            if (!altMatch) return true; // No alt attribute
            const altVal = altMatch[1] ?? altMatch[2] ?? altMatch[3];
            return !altVal || altVal.trim() === '';
          });
          if (imagesWithoutAlt.length > 0) {
            issues.push({
              severity: 'WARNING',
              resourceType: 'content',
              resourceId: item.id,
              pageUrl,
              problem: `${imagesWithoutAlt.length} image(s) without ALT text`,
              recommendation: `Add descriptive alt text to ${imagesWithoutAlt.length} image(s) for better accessibility and SEO.`,
            });
          }
        }

        // Too short content (< 300 characters)
        const contentText = item.content ? item.content.replace(/<[^>]*?>/g, '').trim() : '';
        if (contentText.length > 0 && contentText.length < 300) {
          issues.push({
            severity: 'WARNING',
            resourceType: 'content',
            resourceId: item.id,
            pageUrl,
            problem: `Content too short (${contentText.length} characters)`,
            recommendation: 'Aim for at least 300 characters of quality content to rank well for target keywords.',
          });
        }

        // No internal links
        if (item.content) {
          const internalLinkRegex = /<a\s[^>]*?href\s*=\s*"\//gi;
          const internalLinks = item.content.match(internalLinkRegex) || [];
          if (internalLinks.length === 0) {
            issues.push({
              severity: 'WARNING',
              resourceType: 'content',
              resourceId: item.id,
              pageUrl,
              problem: 'No internal links',
              recommendation: 'Add internal links to other pages on your site to improve navigation and SEO structure.',
            });
          } else if (internalLinks.length < 2) {
            issues.push({
              severity: 'INFO',
              resourceType: 'content',
              resourceId: item.id,
              pageUrl,
              problem: 'Too few internal links',
              recommendation: 'Add more internal links (at least 2) to improve site structure and user navigation.',
            });
          }
        }

        // H2 structure issues (has H1 but no H2)
        if (item.content && item.content.includes('<h1') && !item.content.includes('<h2')) {
          issues.push({
            severity: 'INFO',
            resourceType: 'content',
            resourceId: item.id,
            pageUrl,
            problem: 'H2 structure issue',
            recommendation: 'Add H2 subheadings to break up content and improve readability and SEO structure.',
          });
        }
      }

      // Check for duplicate titles
      const titleMap = new Map<string, string[]>();
      for (const item of publishedItems) {
        const existing = titleMap.get(item.title) || [];
        existing.push(item.id);
        titleMap.set(item.title, existing);
      }
      for (const [title, ids] of titleMap.entries()) {
        if (ids.length > 1) {
          for (const rid of ids) {
            issues.push({
              severity: 'WARNING',
              resourceType: 'content',
              resourceId: rid,
              pageUrl: `/${publishedItems.find(p => p.id === rid)?.slug || ''}`,
              problem: `Duplicate title: "${title}"`,
              recommendation: 'Each page should have a unique title. Modify the title to be distinct from other pages.',
            });
          }
        }
      }

      // Check for duplicate canonical URLs
      const canonicalMap = new Map<string, string[]>();
      for (const config of seoConfigs) {
        if (config.canonicalUrl && config.canonicalUrl.trim() !== '') {
          const existing = canonicalMap.get(config.canonicalUrl) || [];
          existing.push(config.resourceId);
          canonicalMap.set(config.canonicalUrl, existing);
        }
      }
      for (const [canonUrl, ids] of canonicalMap.entries()) {
        if (ids.length > 1) {
          for (const rid of ids) {
            issues.push({
              severity: 'CRITICAL',
              resourceType: 'content',
              resourceId: rid,
              pageUrl: `/${publishedItems.find(p => p.id === rid)?.slug || ''}`,
              problem: `Duplicate canonical URL: "${canonUrl}"`,
              recommendation: 'Each page should have a unique canonical URL. Multiple pages pointing to the same canonical can cause indexing issues.',
            });
          }
        }
      }

      // Check for external canonical URLs
      if (siteDomain) {
        for (const config of seoConfigs) {
          if (config.canonicalUrl && config.canonicalUrl.trim() !== '') {
            try {
              const url = new URL(config.canonicalUrl);
              if (url.hostname !== siteDomain) {
                issues.push({
                  severity: 'CRITICAL',
                  resourceType: 'content',
                  resourceId: config.resourceId,
                  pageUrl: `/${publishedItems.find(p => p.id === config.resourceId)?.slug || ''}`,
                  problem: `External canonical URL: "${config.canonicalUrl}"`,
                  recommendation: 'The canonical URL points to a different domain. This tells search engines that the content lives on another site, which may not be intended.',
                });
              }
            } catch {
              // Invalid URL, skip
            }
          }
        }
      }

      // ---------- upsert persistence (replaces delete + create) ----------
      // Instead of deleting and recreating (which destroys history, timestamps,
      // and resolution state), we upsert: update existing matches, create new
      // ones, and mark no-longer-detected issues as resolved.
      // All persistence runs inside a single transaction for atomicity.
      const auditResult = await db.$transaction(async (tx) => {
        // Get all existing issues for this site (or globally in all-sites mode)
        const existingIssues = await tx.seoIssue.findMany({ where: siteFilter });

        // Build a map of existing issues by (pageUrl + problem) for quick lookup.
        // This is the deterministic key that identifies the same issue across runs.
        const existingMap = new Map<string, (typeof existingIssues)[number]>();
        for (const ei of existingIssues) {
          existingMap.set(`${ei.pageUrl}::${ei.problem}`, ei);
        }

        // Track which existing issues we've seen in this audit run
        const seenIds = new Set<string>();
        const toCreate: {
          severity: 'CRITICAL' | 'WARNING' | 'INFO';
          resourceType: string;
          resourceId: string;
          pageUrl: string;
          problem: string;
          recommendation: string;
          siteId?: string;
        }[] = [];

        for (const newIssue of issues) {
          const key = `${newIssue.pageUrl}::${newIssue.problem}`;
          const existing = existingMap.get(key);
          if (existing) {
            // Match found: update recommendation + severity.
            // Keep id, createdAt, and isResolved untouched (preserve history).
            seenIds.add(existing.id);
            await tx.seoIssue.update({
              where: { id: existing.id },
              data: {
                recommendation: newIssue.recommendation,
                severity: newIssue.severity,
                // If the issue is detected again but was previously resolved,
                // reopen it because the problem still exists.
                ...(existing.isResolved ? { isResolved: false } : {}),
              },
            });
          } else {
            // No match: this is a truly new issue — queue for creation
            toCreate.push({ ...newIssue, siteId: siteId || undefined });
          }
        }

        // Existing issues NOT detected this audit run were fixed since the last
        // audit. Mark them as resolved (skip ones already resolved).
        const staleIds = existingIssues
          .filter((ei) => !seenIds.has(ei.id) && !ei.isResolved)
          .map((ei) => ei.id);

        if (staleIds.length > 0) {
          await tx.seoIssue.updateMany({
            where: { id: { in: staleIds } },
            data: { isResolved: true },
          });
        }

        // Bulk-create only the genuinely new issues
        if (toCreate.length > 0) {
          await tx.seoIssue.createMany({ data: toCreate });
        }

        return {
          audited: publishedItems.length,
          issuesFound: issues.length,
          created: toCreate.length,
          updated: seenIds.size,
          resolved: staleIds.length,
        };
      });

      return NextResponse.json({
        data: {
          audited: auditResult.audited,
          issuesFound: auditResult.issuesFound,
          created: auditResult.created,
          updated: auditResult.updated,
          resolved: auditResult.resolved,
          message: `Audited ${auditResult.audited} pages, found ${auditResult.issuesFound} SEO issues (${auditResult.created} new, ${auditResult.updated} updated, ${auditResult.resolved} resolved)`,
        },
        meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
      });
    }

    // Default: create single issue
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
        { status: 400 },
      );
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid input data',
            details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          },
          meta: { requestId: id, timestamp: new Date().toISOString() },
        },
        { status: 400 },
      );
    }

    const d = parsed.data;
    const siteFilter = await getSiteWhere(request);

    const item = await db.seoIssue.create({
      data: {
        severity: d.severity,
        resourceType: d.resourceType,
        resourceId: d.resourceId,
        pageUrl: d.pageUrl,
        problem: d.problem,
        recommendation: d.recommendation,
        isResolved: d.isResolved,
        siteId: siteFilter.siteId || undefined,
      },
    });

    return NextResponse.json({ data: item, meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start } }, { status: 201 });
  } catch (error) {
    console.error(`[SEO:ISSUES:CREATE] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create SEO issue' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
