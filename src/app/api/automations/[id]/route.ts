// GET/PATCH/DELETE /api/automations/[id]
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod/v4';
import { requireFeature } from '@/lib/platform/platform-auth';

function reqId() { return 'req_' + nanoid(8); }
type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().or(z.literal('')),
  triggerType: z.enum(['MANUAL', 'SCHEDULED']).optional(),
  scheduleConfig: z.string().optional(),
  workflowConfig: z.string().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'FAILED']).optional(),
});

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireFeature(request, 'automation');
  if ('response' in auth) return auth.response;
  const id = reqId();
  try {
    const { id: automationId } = await context.params;
    const item = await db.automation.findUnique({ where: { id: automationId }, include: { runs: { orderBy: { createdAt: 'desc' }, take: 20 } } });
    if (!item) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Automation not found' }, meta: { requestId: id } }, { status: 404 });
    return NextResponse.json({ data: item, meta: { requestId: id } });
  } catch (error) {
    console.error(`[AUTOMATIONS:GET] ${id} —`, error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch automation' }, meta: { requestId: id } }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireFeature(request, 'automation');
  if ('response' in auth) return auth.response;
  const id = reqId();
  try {
    const { id: automationId } = await context.params;
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON' }, meta: { requestId: id } }, { status: 400 }); }

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, meta: { requestId: id } }, { status: 400 });

    const d = parsed.data;
    const data: Record<string, unknown> = {};
    if (d.name !== undefined) data.name = d.name;
    if (d.description !== undefined) data.description = d.description;
    if (d.triggerType !== undefined) data.triggerType = d.triggerType;
    if (d.scheduleConfig !== undefined) data.scheduleConfig = d.scheduleConfig;
    if (d.workflowConfig !== undefined) data.workflowConfig = d.workflowConfig;
    if (d.status !== undefined) data.status = d.status;

    // Recalculate nextRunAt if schedule changed
    if (d.scheduleConfig !== undefined && d.triggerType === 'SCHEDULED') {
      try {
        const cfg = JSON.parse(d.scheduleConfig);
        if (cfg.time) {
          const [h, m] = cfg.time.split(':').map(Number);
          const next = new Date(); next.setHours(h || 9, m || 0, 0, 0);
          if (next <= new Date()) next.setDate(next.getDate() + 1);
          data.nextRunAt = next;
        }
      } catch {}
    }

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
    await db.automation.delete({ where: { id: automationId } });
    return NextResponse.json({ data: { deleted: true }, meta: { requestId: id } });
  } catch (error) {
    console.error(`[AUTOMATIONS:DELETE] ${id} —`, error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete automation' }, meta: { requestId: id } }, { status: 500 });
  }
}
