// ============================================================
// POST /api/seo/auto-fix — Technical SEO Auto-Fix Endpoint
// Executes deterministic server-side fix, updates CMS & Verdant,
// verifies public live page, and resolves finding only if verified.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { generateRequestId } from '@/lib/utils';
import { requireFeatureAllowStaff } from '@/lib/platform/platform-auth';
import { executeAutoFix } from '@/lib/seo/auto-fix';

export async function POST(request: NextRequest) {
  const auth = await requireFeatureAllowStaff(request, 'advanced_seo');
  if ('response' in auth) return auth.response;
  const requestId = generateRequestId();

  try {
    const body = await request.json().catch(() => ({}));
    const { findingId, issueId, ruleId } = body;
    const targetFindingId = findingId || issueId;

    if (!targetFindingId) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'findingId is required.',
          },
          meta: { requestId },
        },
        { status: 400 },
      );
    }

    const userId = (auth as any).user?.id || 'admin-user';

    const result = await executeAutoFix({
      findingId: targetFindingId,
      ruleId,
      userId,
    });

    return NextResponse.json({
      data: result,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error(`[SEO:AUTO_FIX] ${requestId} —`, error);
    return NextResponse.json(
      {
        error: {
          code: 'AUTO_FIX_ERROR',
          message: error?.message || 'Failed to execute technical auto-fix.',
        },
        meta: { requestId },
      },
      { status: 500 },
    );
  }
}
