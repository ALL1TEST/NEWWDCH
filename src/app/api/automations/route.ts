// GET/POST /api/automations — List and create automations
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { requireAuth } from '@/lib/platform/platform-auth';
import { hasFeature, forbiddenResponse } from '@/lib/platform/entitlements';
import { getSiteWhere, getSiteFromRequest, getActivePlanSiteId } from '@/lib/site-context';
import { calculateNextRun, validateScheduleNotPassed } from '@/lib/automation/scheduler-utils';
import { startSchedulerDaemon } from '@/lib/automation/scheduler-daemon';

function reqId() { return 'req_' + nanoid(8); }

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional().or(z.literal('')),
  triggerType: z.enum(['MANUAL', 'SCHEDULED']).default('MANUAL'),
  scheduleConfig: z.string().default('{}'),
  workflowConfig: z.string().default('{}'),
  createdById: z.string().optional(),
  siteId: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  // Server-side entitlement enforcement: the 'automation' feature must be
  // granted by the user's plan (or an owner billing bypass / override).
  // A Beta user hitting this endpoint directly is denied with 403.
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;
  const allowed = await hasFeature(auth.user, 'automation');
  if (!allowed) return forbiddenResponse('automation');
  startSchedulerDaemon();
  const id = reqId();
  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize')) || 25));
    const search = sp.get('search')?.trim() || '';
    const status = sp.get('status') || undefined;

    const siteFilter = await getSiteWhere(request);
    const where: Record<string, unknown> = {
      ...siteFilter,
    };
    if (search) where.name = { contains: search };
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      db.automation.findMany({
        where,
        include: {
          runs: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { id: true, status: true, startedAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.automation.count({ where }),
    ]);

    const mappedItems = items.map((a: any) => ({
      ...a,
      latestRunStatus: a.runs?.[0]?.status || null,
      latestRunId: a.runs?.[0]?.id || null,
    }));

    return NextResponse.json({ data: mappedItems, meta: { requestId: id, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } } });
  } catch (error) {
    console.error(`[AUTOMATIONS:LIST] ${id} —`, error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch automations' }, meta: { requestId: id } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Server-side entitlement enforcement (same as GET).
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;
  const allowed = await hasFeature(auth.user, 'automation');
  if (!allowed) return forbiddenResponse('automation');
  startSchedulerDaemon();
  const id = reqId();
  try {
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON' }, meta: { requestId: id } }, { status: 400 }); }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, meta: { requestId: id } }, { status: 400 });

    const d = parsed.data;
    let createdById = d.createdById;
    if (!createdById) { const u = await db.user.findFirst({ select: { id: true } }); createdById = u?.id; if (!createdById) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'No user found' }, meta: { requestId: id } }, { status: 400 }); }

    // Resolve siteId from body, request context, or user's active plan site
    const requestSiteId = await getSiteFromRequest(request);
    let siteId = d.siteId || requestSiteId;
    if (!siteId && auth.user) {
      siteId = await getActivePlanSiteId(auth.user);
    }

    // Validate and calculate nextRunAt for scheduled automations
    let nextRunAt: Date | null = null;
    if (d.triggerType === 'SCHEDULED') {
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
      nextRunAt = scheduleValidation.scheduledDate;
    }

    const item = await db.automation.create({
      data: {
        name: d.name,
        description: d.description || '',
        triggerType: d.triggerType,
        scheduleConfig: d.scheduleConfig,
        workflowConfig: d.workflowConfig,
        createdById,
        siteId: siteId || null,
        nextRunAt,
      },
    });

    return NextResponse.json({ data: item, meta: { requestId: id } }, { status: 201 });
  } catch (error) {
    console.error(`[AUTOMATIONS:CREATE] ${id} —`, error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create automation' }, meta: { requestId: id } }, { status: 500 });
  }
}
