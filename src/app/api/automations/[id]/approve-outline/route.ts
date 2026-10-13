// POST /api/automations/[id]/approve-outline — Approve outline and resume article writing
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { requireFeature } from '@/lib/platform/platform-auth';
import { approveOutlineAndResume } from '@/lib/automation/automation-service';
import { canUserAccessAutomation } from '@/lib/site-context';

function reqId() { return 'req_' + nanoid(8); }
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireFeature(request, 'automation');
  if ('response' in auth) return auth.response;
  const id = reqId();

  try {
    const { id: automationId } = await context.params;
    const automation = await db.automation.findUnique({ where: { id: automationId } });
    if (!automation) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Automation not found' }, meta: { requestId: id } },
        { status: 404 }
      );
    }

    const hasAccess = await canUserAccessAutomation(auth.user, automation);
    if (!hasAccess) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'You do not have access to this automation' }, meta: { requestId: id } },
        { status: 403 }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' }, meta: { requestId: id } },
        { status: 400 }
      );
    }

    const { runId, outline } = body;
    if (!runId) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'runId is required' }, meta: { requestId: id } },
        { status: 400 }
      );
    }

    const result = await approveOutlineAndResume({
      automationId,
      runId,
      userId: auth.user.id,
      outline,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'EXECUTION_FAILED', message: result.error || 'Failed to resume execution' }, meta: { requestId: id } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        success: true,
        articleId: result.articleId,
      },
      meta: { requestId: id },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: err?.message || 'Internal server error' }, meta: { requestId: id } },
      { status: 500 }
    );
  }
}
