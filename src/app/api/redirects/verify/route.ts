// ============================================================
// POST /api/redirects/verify — Verify redirect live on public site
// Checks real public HTTP 301 and destination responsiveness
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { verifyRedirectLive } from '@/lib/seo/redirect-engine';
import { requireFeature } from '@/lib/platform/platform-auth';

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
      // Empty body allowed if verifying by id
    }

    let fromPath = body.fromPath;
    let toPath = body.toPath;

    if (body.id && (!fromPath || !toPath)) {
      const redirect = await db.redirect.findUnique({
        where: { id: body.id },
      });
      if (!redirect) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Redirect not found' } },
          { status: 404 },
        );
      }
      fromPath = redirect.fromPath;
      toPath = redirect.toPath;
    }

    if (!fromPath || !toPath) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'fromPath and toPath or id required' } },
        { status: 400 },
      );
    }

    const verification = await verifyRedirectLive({
      fromPath,
      toPath,
      baseUrl: 'https://verdantt.vercel.app',
    });

    return NextResponse.json({
      data: verification,
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
        duration: Date.now() - start,
      },
    });
  } catch (error: any) {
    console.error(`[REDIRECTS:VERIFY] ${id} —`, error);
    return NextResponse.json(
      {
        error: { code: 'INTERNAL_ERROR', message: error.message || 'Verification failed' },
        meta: { requestId: id, timestamp: new Date().toISOString() },
      },
      { status: 500 },
    );
  }
}
