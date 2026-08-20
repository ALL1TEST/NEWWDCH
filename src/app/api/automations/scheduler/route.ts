// POST /api/automations/scheduler — Check for due automations and trigger them
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { executeAutomation } from '@/lib/automation/automation-service';

function reqId() { return 'req_' + nanoid(8); }

export async function POST(request: NextRequest) {
  const id = reqId();
  try {
    const now = new Date();
    // Find all active scheduled automations that are due
    const dueAutomations = await db.automation.findMany({
      where: {
        status: 'ACTIVE',
        triggerType: 'SCHEDULED',
        nextRunAt: { lte: now },
      },
    });

    const results: { automationId: string; name: string; success: boolean; message: string }[] = [];

    for (const automation of dueAutomations) {
      try {
        // Create a run record
        const run = await db.automationRun.create({
          data: { automationId: automation.id, status: 'RUNNING', startedAt: now },
        });

        // Update automation stats
        await db.automation.update({
          where: { id: automation.id },
          data: { totalRuns: { increment: 1 }, lastRunAt: now },
        });

        // Execute async
        executeAutomation(automation.id, run.id).catch(async (err) => {
          console.error(`[AUTOMATION:SCHEDULER] ${id} —`, err);
          await db.automationRun.update({
            where: { id: run.id },
            data: { status: 'FAILED', finishedAt: new Date(), errorMessage: err instanceof Error ? err.message : 'Unknown error' },
          });
          await db.automation.update({
            where: { id: automation.id },
            data: { failedRuns: { increment: 1 } },
          });
        });

        // Calculate next run
        let nextRunAt: Date | null = null;
        try {
          const cfg = JSON.parse(automation.scheduleConfig);
          if (cfg.time) {
            const [h, m] = cfg.time.split(':').map(Number);
            const next = new Date(now); next.setHours(h || 9, m || 0, 0, 0);
            if (next <= now) next.setDate(next.getDate() + 1);
            nextRunAt = next;
          }
        } catch {}

        await db.automation.update({
          where: { id: automation.id },
          data: { nextRunAt },
        });

        results.push({ automationId: automation.id, name: automation.name, success: true, message: `Run started: ${run.id}` });
      } catch (err) {
        results.push({ automationId: automation.id, name: automation.name, success: false, message: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    return NextResponse.json({ data: { processed: results.length, results }, meta: { requestId: id, timestamp: now.toISOString() } });
  } catch (error) {
    console.error(`[AUTOMATIONS:SCHEDULER] ${id} —`, error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to run scheduler' }, meta: { requestId: id } }, { status: 500 });
  }
}
