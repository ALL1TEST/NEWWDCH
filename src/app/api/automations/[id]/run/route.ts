// POST /api/automations/[id]/run — Trigger an automation run
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { executeAutomation } from '@/lib/automation/automation-service';
import { recoverStaleRuns } from '@/lib/automation/scheduler-utils';
import { requireFeature } from '@/lib/platform/platform-auth';

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
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Automation not found' }, meta: { requestId: id } }, { status: 404 });
    }

    const { canUserAccessAutomation } = await import('@/lib/site-context');
    const hasAccess = await canUserAccessAutomation(auth.user, automation);
    if (!hasAccess) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'You do not have access to this automation or its tenant site' }, meta: { requestId: id } },
        { status: 403 }
      );
    }

    // Auto-recover any orphaned runs older than 15 minutes before checking active
    await recoverStaleRuns(15);

    // Check for duplicate concurrent execution
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const activeRun = await db.automationRun.findFirst({
      where: {
        automationId,
        status: 'RUNNING',
        startedAt: { gte: fifteenMinutesAgo },
      },
    });

    if (activeRun) {
      return NextResponse.json(
        {
          error: {
            code: 'ALREADY_RUNNING',
            message: 'An execution is already in progress for this automation. Please wait for it to complete.',
          },
          meta: { requestId: id, runId: activeRun.id },
        },
        { status: 409 }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {}
    const overrideQuota = Boolean(body?.overrideQuota);

    // Check daily quota unless override requested
    const { getAutomationDailyStats } = await import('@/lib/automation/scheduler-utils');
    const dailyStats = await getAutomationDailyStats(automationId, automation.scheduleConfig);

    if (dailyStats.remainingToday <= 0 && !overrideQuota) {
      return NextResponse.json(
        {
          error: {
            code: 'DAILY_QUOTA_REACHED',
            message: `Daily article target of ${dailyStats.dailyTarget} articles has already been reached for today (${dailyStats.timezone}). Completed: ${dailyStats.completedToday}/${dailyStats.dailyTarget}.`,
          },
          data: { dailyStats, canOverride: true },
          meta: { requestId: id },
        },
        { status: 409 }
      );
    }

    // Create a persistent run record BEFORE starting expensive processing
    const run = await db.automationRun.create({
      data: {
        automationId,
        status: 'RUNNING',
        startedAt: new Date(),
        logsJson: JSON.stringify([
          {
            timestamp: new Date().toISOString(),
            step: 'QUEUED',
            message: overrideQuota
              ? 'Manual execution enqueued via Run Now (Quota override)'
              : `Manual execution enqueued via Run Now (${dailyStats.remainingToday} article(s) remaining for today)`,
            level: 'info',
          },
        ]),
      },
    });

    // Update automation stats
    await db.automation.update({
      where: { id: automationId },
      data: { totalRuns: { increment: 1 }, lastRunAt: new Date() },
    });

    // Execute the automation workflow asynchronously
    executeAutomation(automationId, run.id, { overrideQuota }).catch((err) => {
      console.error(`[AUTOMATION:RUN] ${id} async execution failure:`, err);
    });

    return NextResponse.json({
      data: { runId: run.id, status: 'RUNNING', message: 'Automation execution started' },
      meta: { requestId: id },
    });
  } catch (error) {
    console.error(`[AUTOMATIONS:RUN] ${id} —`, error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to start automation' }, meta: { requestId: id } }, { status: 500 });
  }
}
