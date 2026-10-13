// ============================================================
// POST /api/seo/page-audit — Real-time single page & draft SEO audit
// Analyzes live content directly from the editor
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { generateRequestId } from '@/lib/utils';
import { requireFeature } from '@/lib/platform/platform-auth';
import { auditSinglePage } from '@/lib/seo';

export async function POST(request: NextRequest) {
  const auth = await requireFeature(request, 'advanced_seo');
  if ('response' in auth) return auth.response;
  const id = generateRequestId();
  const start = Date.now();

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const {
      url = '/',
      title = '',
      slug = '',
      content = '',
      excerpt = '',
      seoTitle = '',
      seoDescription = '',
      focusKeyword = '',
      canonicalUrl = '',
      robotsDirectives = 'index, follow',
      featuredImageUrl = '',
      authorName = '',
      authorBio = '',
      publishedAt,
      updatedAt,
      structuredDataJson = '',
      siteDomain = '',
    } = body;

    const result = auditSinglePage({
      url: url || (slug ? `/${slug}` : '/draft-page'),
      title: title || 'Untitled',
      slug,
      content,
      excerpt,
      seoTitle,
      seoDescription,
      focusKeyword,
      canonicalUrl,
      robotsDirectives,
      featuredImageUrl,
      authorName,
      authorBio,
      publishedAt,
      updatedAt,
      structuredDataJson,
      siteDomain,
    });

    return NextResponse.json({
      data: result,
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
        duration: Date.now() - start,
      },
    });
  } catch (error: any) {
    console.error(`[SEO:PAGE_AUDIT] ${id} —`, error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error?.message || 'Failed to execute page SEO audit',
        },
        meta: { requestId: id },
      },
      { status: 500 },
    );
  }
}
