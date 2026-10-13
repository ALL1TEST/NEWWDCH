// ============================================================
// GET  /api/seo/snapshots — Retrieve SEO audit snapshots & drift comparison
// POST /api/seo/snapshots — Save new SEO audit snapshot
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { generateRequestId } from '@/lib/utils';
import { getSiteWhere } from '@/lib/site-context';
import { requireFeature } from '@/lib/platform/platform-auth';
import { getAuditSnapshots, saveAuditSnapshot } from '@/lib/seo/drift-tracker';

export async function GET(request: NextRequest) {
  const auth = await requireFeature(request, 'advanced_seo');
  if ('response' in auth) return auth.response;
  const id = generateRequestId();
  const start = Date.now();

  try {
    const siteFilter = await getSiteWhere(request);
    const result = await getAuditSnapshots(siteFilter.siteId);

    return NextResponse.json({
      data: result,
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
        duration: Date.now() - start,
      },
    });
  } catch (error: any) {
    console.error(`[SEO:SNAPSHOTS:GET] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error?.message || 'Failed to fetch SEO snapshots' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireFeature(request, 'advanced_seo');
  if ('response' in auth) return auth.response;
  const id = generateRequestId();
  const start = Date.now();

  try {
    const siteFilter = await getSiteWhere(request);
    const body = await request.json().catch(() => ({}));

    const {
      overallScore = 0,
      categoryScores = {},
      totalIssues = 0,
      criticalIssues = 0,
      highIssues = 0,
      mediumIssues = 0,
      lowIssues = 0,
      auditedPagesCount = 0,
    } = body;

    const saved = await saveAuditSnapshot({
      siteId: siteFilter.siteId,
      overallScore,
      categoryScores,
      totalIssues,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      auditedPagesCount,
    });

    return NextResponse.json({
      data: saved,
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
        duration: Date.now() - start,
      },
    });
  } catch (error: any) {
    console.error(`[SEO:SNAPSHOTS:POST] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error?.message || 'Failed to save SEO snapshot' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
