// ============================================================
// POST /api/seo/issues/[id]/verify-resolve — Verified Resolve
// Re-executes the exact SEO rule check against the live/current state.
// Only marks resolved if genuinely fixed; never trusts client blind flag.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { generateRequestId } from '@/lib/utils';
import { requireFeatureAllowStaff } from '@/lib/platform/platform-auth';
import { verifyAndResolveFinding } from '@/lib/seo/verifier';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireFeatureAllowStaff(request, 'advanced_seo');
  if ('response' in auth) return auth.response;
  const id = generateRequestId();
  const start = Date.now();

  try {
    const { id: issueId } = await context.params;

    if (!issueId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'issueId is required.' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const verificationResult = await verifyAndResolveFinding(issueId);

    return NextResponse.json({
      data: verificationResult,
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
        duration: Date.now() - start,
      },
    });
  } catch (error: any) {
    console.error(`[SEO:VERIFY_RESOLVE] ${id} —`, error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error?.message || 'Failed to verify and resolve SEO issue.',
        },
        meta: { requestId: id },
      },
      { status: 500 },
    );
  }
}
