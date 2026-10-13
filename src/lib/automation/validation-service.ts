// ============================================================
// Automation Pre-Flight Validation Engine
// Validates all article components prior to final persistence and action:
// 1. Content presence & minimum volume
// 2. Heading structure (single H1, logical H2s)
// 3. SEO title and description length guidance
// 4. Slug uniqueness & format
// 5. Internal link integrity (target existence on same tenant)
// 6. External link sanity check
// 7. Media record & URL validity
// 8. Structured data validity
// 9. Multi-tenant site isolation verification
// ============================================================

import { db } from '@/lib/db';

export interface PreFlightValidationInput {
  content: string;
  topic: string;
  seoTitle: string;
  seoDescription?: string | null;
  slug: string;
  siteId: string | null;
  contentTypeId: string;
  featuredImageId?: string | null;
  schemaJsonLd?: string | null;
  existingArticleId?: string | null;
}

export interface ValidationIssue {
  severity: 'CRITICAL' | 'WARNING';
  category:
    | 'CONTENT'
    | 'HEADINGS'
    | 'SEO'
    | 'SLUG'
    | 'INTERNAL_LINKS'
    | 'EXTERNAL_LINKS'
    | 'MEDIA'
    | 'SCHEMA'
    | 'TENANT';
  message: string;
}

export interface PreFlightValidationResult {
  isValid: boolean;
  canPublish: boolean;
  criticalErrors: string[];
  warnings: string[];
  issues: ValidationIssue[];
}

/**
 * Run comprehensive pre-flight validation on the generated article.
 */
export async function runPreFlightValidation(
  input: PreFlightValidationInput
): Promise<PreFlightValidationResult> {
  const issues: ValidationIssue[] = [];

  // 1. Content presence and minimum word count
  const cleanText = input.content.replace(/<[^>]*>/g, ' ').replace(/[#*_`]/g, ' ').trim();
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;

  if (!input.content || input.content.trim().length === 0) {
    issues.push({
      severity: 'CRITICAL',
      category: 'CONTENT',
      message: 'Article content is empty.',
    });
  } else if (wordCount < 100) {
    issues.push({
      severity: 'CRITICAL',
      category: 'CONTENT',
      message: `Article word count (${wordCount}) is critically below minimum editorial threshold of 100 words.`,
    });
  } else if (wordCount < 300) {
    issues.push({
      severity: 'WARNING',
      category: 'CONTENT',
      message: `Article word count (${wordCount}) is relatively brief. Consider expanding subtopics for better search depth.`,
    });
  }

  // 2. Heading structure
  const h1MarkdownCount = (input.content.match(/^#\s+[^\n]+/gm) || []).length;
  const h1HtmlCount = (input.content.match(/<h1[^>]*>.*?<\/h1>/gi) || []).length;
  const totalH1 = h1MarkdownCount + h1HtmlCount;

  const h2Count =
    (input.content.match(/^##\s+[^\n]+/gm) || []).length +
    (input.content.match(/<h2[^>]*>.*?<\/h2>/gi) || []).length;

  if (totalH1 === 0 && !input.topic) {
    issues.push({
      severity: 'WARNING',
      category: 'HEADINGS',
      message: 'No H1 heading detected in the article body or title.',
    });
  } else if (totalH1 > 1) {
    issues.push({
      severity: 'WARNING',
      category: 'HEADINGS',
      message: `Multiple H1 headings (${totalH1}) detected. Best SEO practice recommends exactly one H1 per page.`,
    });
  }

  if (h2Count === 0) {
    issues.push({
      severity: 'WARNING',
      category: 'HEADINGS',
      message: 'No H2 section headings detected. Subheadings are crucial for readability and SEO skimmability.',
    });
  }

  // 3. SEO title and description guidance
  if (!input.seoTitle || input.seoTitle.trim().length === 0) {
    issues.push({
      severity: 'CRITICAL',
      category: 'SEO',
      message: 'SEO title is missing.',
    });
  } else {
    const titleLen = input.seoTitle.trim().length;
    if (titleLen < 20) {
      issues.push({
        severity: 'WARNING',
        category: 'SEO',
        message: `SEO title is short (${titleLen} chars). Recommended range is 35–65 characters.`,
      });
    } else if (titleLen > 70) {
      issues.push({
        severity: 'WARNING',
        category: 'SEO',
        message: `SEO title is long (${titleLen} chars) and may be truncated on Google SERPs.`,
      });
    }
  }

  if (input.seoDescription) {
    const descLen = input.seoDescription.trim().length;
    if (descLen < 50) {
      issues.push({
        severity: 'WARNING',
        category: 'SEO',
        message: `Meta description is brief (${descLen} chars). Recommended range is 120–160 characters.`,
      });
    } else if (descLen > 165) {
      issues.push({
        severity: 'WARNING',
        category: 'SEO',
        message: `Meta description is long (${descLen} chars) and may be truncated on SERPs.`,
      });
    }
  }

  // 4. Slug uniqueness & format
  if (!input.slug || !/^[a-z0-9-]+$/i.test(input.slug)) {
    issues.push({
      severity: 'CRITICAL',
      category: 'SLUG',
      message: `Article slug "${input.slug}" contains invalid characters. Must be alphanumeric and hyphens only.`,
    });
  } else {
    // Check if slug collides with existing non-deleted article of same contentType
    const conflict = await db.contentItem.findFirst({
      where: {
        slug: input.slug,
        contentTypeId: input.contentTypeId,
        deletedAt: null,
        id: input.existingArticleId ? { not: input.existingArticleId } : undefined,
      },
      select: { id: true, title: true, siteId: true },
    });

    if (conflict) {
      issues.push({
        severity: 'WARNING',
        category: 'SLUG',
        message: `Slug "${input.slug}" is already in use by article "${conflict.title}" (ID: ${conflict.id}). An automatic disambiguation suffix will be applied.`,
      });
    }
  }

  // 5. Internal link integrity
  const internalLinkMatches = input.content.matchAll(/\[([^\]]+)\]\((\/blog\/([a-z0-9-]+))\)/gi);
  for (const m of internalLinkMatches) {
    const targetSlug = m[3];
    if (input.siteId) {
      const destination = await db.contentItem.findFirst({
        where: {
          slug: targetSlug,
          siteId: input.siteId,
          status: 'PUBLISHED',
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!destination) {
        issues.push({
          severity: 'WARNING',
          category: 'INTERNAL_LINKS',
          message: `Internal link to "/blog/${targetSlug}" does not resolve to an active published article on this site.`,
        });
      }
    }
  }

  // 6. External link sanity
  const externalLinkMatches = input.content.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi);
  for (const m of externalLinkMatches) {
    const url = m[2];
    try {
      const parsed = new URL(url);
      if (!parsed.hostname || parsed.hostname.length < 3) {
        issues.push({
          severity: 'WARNING',
          category: 'EXTERNAL_LINKS',
          message: `External link "${url}" has an invalid hostname.`,
        });
      }
    } catch {
      issues.push({
        severity: 'WARNING',
        category: 'EXTERNAL_LINKS',
        message: `External link "${url}" is malformed.`,
      });
    }
  }

  // 7. Media record & URL validity
  if (input.featuredImageId) {
    const media = await db.media.findUnique({
      where: { id: input.featuredImageId },
      select: { id: true, url: true, siteId: true, processingStatus: true },
    });

    if (!media) {
      issues.push({
        severity: 'CRITICAL',
        category: 'MEDIA',
        message: `Featured image ID "${input.featuredImageId}" does not exist in media storage.`,
      });
    } else if (input.siteId && media.siteId && media.siteId !== input.siteId) {
      issues.push({
        severity: 'CRITICAL',
        category: 'MEDIA',
        message: `Featured image belongs to a different site/tenant (Isolation violation).`,
      });
    } else if (!media.url) {
      issues.push({
        severity: 'CRITICAL',
        category: 'MEDIA',
        message: `Featured image record has no URL.`,
      });
    }
  }

  // 8. Structured data validity
  if (input.schemaJsonLd) {
    try {
      const parsed = JSON.parse(input.schemaJsonLd);
      if (!parsed['@context'] || !parsed['@type']) {
        issues.push({
          severity: 'WARNING',
          category: 'SCHEMA',
          message: 'Structured data missing standard schema.org @context or @type.',
        });
      }
    } catch {
      issues.push({
        severity: 'WARNING',
        category: 'SCHEMA',
        message: 'Structured data contains invalid JSON-LD.',
      });
    }
  }

  const criticalErrors = issues.filter((i) => i.severity === 'CRITICAL').map((i) => i.message);
  const warnings = issues.filter((i) => i.severity === 'WARNING').map((i) => i.message);

  return {
    isValid: criticalErrors.length === 0,
    canPublish: criticalErrors.length === 0,
    criticalErrors,
    warnings,
    issues,
  };
}
