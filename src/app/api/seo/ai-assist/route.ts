// ============================================================
// POST /api/seo/ai-assist — AI SEO Assistant Endpoint
// Powers intent, gaps, headings, schema, E-E-A-T & GEO recommendations
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { generateRequestId } from '@/lib/utils';
import { requireFeatureAllowStaff } from '@/lib/platform/platform-auth';
import { runAiSeoAssistant, AiSeoAction } from '@/lib/seo/ai-seo-service';

export async function POST(request: NextRequest) {
  const auth = await requireFeatureAllowStaff(request, 'ai_platform');
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
      action,
      title = '',
      content = '',
      excerpt = '',
      focusKeyword = '',
      url = '',
      authorName = '',
      schemaType = 'Article',
    } = body;

    if (!action) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'SEO action is required.' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    if (!title && !content) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Article title or content is required.' }, meta: { requestId: id } },
        { status: 400 },
      );
    }

    const aiRes = await runAiSeoAssistant({
      action: action as AiSeoAction,
      title,
      content,
      excerpt,
      focusKeyword,
      url,
      authorName,
      schemaType,
      userId: auth.user.id,
    });

    if (!aiRes.success) {
      return NextResponse.json(
        {
          error: {
            code: 'AI_EXECUTION_ERROR',
            message: aiRes.error || 'Failed to generate AI SEO recommendation',
          },
          meta: { requestId: id },
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      data: aiRes.result,
      meta: {
        requestId: id,
        timestamp: new Date().toISOString(),
        duration: Date.now() - start,
      },
    });
  } catch (error: any) {
    console.error(`[SEO:AI_ASSIST] ${id} —`, error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error?.message || 'An unexpected error occurred during AI SEO execution',
        },
        meta: { requestId: id },
      },
      { status: 500 },
    );
  }
}
