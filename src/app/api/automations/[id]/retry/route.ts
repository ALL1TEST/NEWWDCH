// POST /api/automations/[id]/retry — Safely retry a failed automation run
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { executeAutomation } from '@/lib/automation/automation-service';
import { requireFeature } from '@/lib/platform/platform-auth';

function reqId() {
  return 'req_' + nanoid(8);
}
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireFeature(request, 'automation');
  if ('response' in auth) return auth.response;
  const id = reqId();

  try {
    const { id: automationId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const runId = body.runId;

    const automation = await db.automation.findUnique({ where: { id: automationId } });
    if (!automation) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Automation not found' }, meta: { requestId: id } },
        { status: 404 }
      );
    }

    const { canUserAccessAutomation } = await import('@/lib/site-context');
    const hasAccess = await canUserAccessAutomation(auth.user, automation);
    if (!hasAccess) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'You do not have access to this automation or its tenant site' }, meta: { requestId: id } },
        { status: 403 }
      );
    }

    let targetRun: any = null;
    if (runId) {
      targetRun = await db.automationRun.findFirst({
        where: { id: runId, automationId },
      });
      if (!targetRun) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Run not found for this automation' }, meta: { requestId: id } },
          { status: 404 }
        );
      }
    } else {
      // Pick the latest failed run
      targetRun = await db.automationRun.findFirst({
        where: { automationId, status: 'FAILED' },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!targetRun) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'No failed run available to retry' }, meta: { requestId: id } },
        { status: 400 }
      );
    }

    // Create a new retry run linked to previous run to prevent duplicate articles
    const retryRun = await db.automationRun.create({
      data: {
        automationId,
        status: 'RUNNING',
        startedAt: new Date(),
        generatedArticleId: targetRun.generatedArticleId, // Preserve previous article link if any for idempotency
        logsJson: JSON.stringify([
          {
            timestamp: new Date().toISOString(),
            step: 'RETRY',
            message: `Retrying run ${targetRun.id} (Previous failed stage: ${targetRun.failedStep || 'Unknown'})`,
            level: 'info',
          },
        ]),
      },
    });

    // Fire execution async
    executeAutomation(automationId, retryRun.id).catch((err) => {
      console.error(`[AUTOMATION:RETRY] ${id} async execution failure:`, err);
    });

    return NextResponse.json({
      data: {
        runId: retryRun.id,
        status: 'RUNNING',
        message: `Retry started for previous run ${targetRun.id}`,
      },
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[AUTOMATIONS:RETRY] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to retry automation run' }, meta: { requestId: id } },
      { status: 500 }
    );
  }
}
