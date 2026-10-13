// GET/PATCH/DELETE /api/automations/[id]
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { requireFeature } from '@/lib/platform/platform-auth';
import { calculateNextRun, validateScheduleNotPassed } from '@/lib/automation/scheduler-utils';
import { startSchedulerDaemon } from '@/lib/automation/scheduler-daemon';

function reqId() { return 'req_' + nanoid(8); }
type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().or(z.literal('')),
  triggerType: z.enum(['MANUAL', 'SCHEDULED']).optional(),
  scheduleConfig: z.string().optional(),
  workflowConfig: z.string().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'FAILED']).optional(),
  nextRunAt: z.string().nullable().optional(),
});

import { canUserAccessAutomation } from '@/lib/site-context';

export async function GET(request: NextRequest, context: RouteContext) {
  startSchedulerDaemon();
  const auth = await requireFeature(request, 'automation');
  if ('response' in auth) return auth.response;
  const id = reqId();
  try {
    const { id: automationId } = await context.params;
    const item = await db.automation.findUnique({
      where: { id: automationId },
      include: { runs: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
    if (!item) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Automation not found' }, meta: { requestId: id } }, { status: 404 });
    }

    const hasAccess = await canUserAccessAutomation(auth.user, item);
    if (!hasAccess) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Access to this automation is denied' }, meta: { requestId: id } }, { status: 403 });
    }

    // Compute accurate persisted run statistics and daily counters
    const articleIds = (item.runs || [])
      .map((r) => r.generatedArticleId)
      .filter(Boolean) as string[];

    const [totalRuns, successfulRuns, failedRuns, articlesGenerated, dailyStats, articles] = await Promise.all([
      db.automationRun.count({ where: { automationId } }),
      db.automationRun.count({ where: { automationId, status: 'COMPLETED' } }),
      db.automationRun.count({ where: { automationId, status: 'FAILED' } }),
      db.automationRun.count({ where: { automationId, generatedArticleId: { not: null } } }),
      import('@/lib/automation/scheduler-utils').then((m) => m.getAutomationDailyStats(automationId, item.scheduleConfig)),
      articleIds.length > 0
        ? db.contentItem.findMany({
            where: { id: { in: articleIds } },
            select: { id: true, status: true, title: true, slug: true, scheduledAt: true, publishedAt: true },
          })
        : Promise.resolve([]),
    ]);

    const articleMap = new Map((articles as any[]).map((a) => [a.id, a]));

    const enrichedRuns = item.runs.map((r) => {
      const art = r.generatedArticleId ? articleMap.get(r.generatedArticleId) : null;
      return {
        ...r,
        articleStatus: art?.status || null,
        scheduledAt: art?.scheduledAt || null,
        publishedAt: art?.publishedAt || null,
      };
    });

    const enriched = {
      ...item,
      runs: enrichedRuns,
      totalRuns,
      successfulRuns,
      failedRuns,
      articlesGenerated,
      dailyStats,
    };

    return NextResponse.json({ data: enriched, meta: { requestId: id } });
  } catch (error) {
    console.error(`[AUTOMATIONS:GET] ${id} —`, error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch automation' }, meta: { requestId: id } }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  startSchedulerDaemon();
  const auth = await requireFeature(request, 'automation');
  if ('response' in auth) return auth.response;
  const id = reqId();
  try {
    const { id: automationId } = await context.params;
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON' }, meta: { requestId: id } }, { status: 400 }); }

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, meta: { requestId: id } }, { status: 400 });

    const current = await db.automation.findUnique({ where: { id: automationId } });
    if (!current) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Automation not found' }, meta: { requestId: id } }, { status: 404 });
    }

    const hasAccess = await canUserAccessAutomation(auth.user, current);
    if (!hasAccess) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Access to update this automation is denied' }, meta: { requestId: id } }, { status: 403 });
    }

    const d = parsed.data;
    const data: Record<string, unknown> = {};
    if (d.name !== undefined) data.name = d.name;
    if (d.description !== undefined) data.description = d.description;
    if (d.triggerType !== undefined) data.triggerType = d.triggerType;
    if (d.scheduleConfig !== undefined) data.scheduleConfig = d.scheduleConfig;
    if (d.workflowConfig !== undefined) data.workflowConfig = d.workflowConfig;
    if (d.status !== undefined) data.status = d.status;

    const targetTrigger = d.triggerType ?? current.triggerType;
    const targetSchedule = d.scheduleConfig ?? current.scheduleConfig;
    const targetStatus = d.status ?? current.status;

    // Validate and recalculate nextRunAt if schedule changed, or when resuming from PAUSED to ACTIVE
    if (d.scheduleConfig !== undefined && targetTrigger === 'SCHEDULED') {
      const scheduleValidation = validateScheduleNotPassed(d.scheduleConfig);
      if (!scheduleValidation.isValid) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: scheduleValidation.error || 'This date and time has already passed. Please choose a future date and time.',
            },
            meta: { requestId: id },
          },
          { status: 400 }
        );
      }
      data.nextRunAt = scheduleValidation.scheduledDate;
    } else if (d.nextRunAt !== undefined) {
      data.nextRunAt = d.nextRunAt ? new Date(d.nextRunAt) : null;
    } else if (targetTrigger === 'SCHEDULED') {
      if (targetStatus === 'ACTIVE') {
        try {
          data.nextRunAt = calculateNextRun(targetSchedule, undefined, { advancePastNow: false });
        } catch {
          data.nextRunAt = null;
        }
      } else {
        // Paused automations should not have an active pending trigger
        data.nextRunAt = null;
      }
    } else {
      data.nextRunAt = null;
    }

    data.updatedAt = new Date();
    const item = await db.automation.update({ where: { id: automationId }, data });
    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[AUTOMATIONS:UPDATE] ${id} —`, error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update automation' }, meta: { requestId: id } }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireFeature(request, 'automation');
  if ('response' in auth) return auth.response;
  const id = reqId();
  try {
    const { id: automationId } = await context.params;
    const current = await db.automation.findUnique({ where: { id: automationId } });
    if (!current) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Automation not found' }, meta: { requestId: id } }, { status: 404 });
    }

    const hasAccess = await canUserAccessAutomation(auth.user, current);
    if (!hasAccess) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Access to delete this automation is denied' }, meta: { requestId: id } }, { status: 403 });
    }

    await db.automation.delete({ where: { id: automationId } });
    return NextResponse.json({ data: { deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[AUTOMATIONS:DELETE] ${id} —`, error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete automation' }, meta: { requestId: id } }, { status: 500 });
  }
}
