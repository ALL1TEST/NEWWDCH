// GET / POST /api/automations/scheduler — Check for due automations and trigger them
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { runSchedulerCheck } from '@/lib/automation/scheduler-service';
import { startSchedulerDaemon, isSchedulerDaemonRunning } from '@/lib/automation/scheduler-daemon';
import { requireFeature } from '@/lib/platform/platform-auth';

function reqId() { return 'req_' + nanoid(8); }

async function handleScheduler(request: NextRequest) {
  // Ensure background daemon is active in runtime
  if (!isSchedulerDaemonRunning()) {
    startSchedulerDaemon();
  }

  // Authorize via CRON_SECRET, internal header, or authenticated user session
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || 'cms_automation_cron_secret';
  const querySecret = request.nextUrl.searchParams.get('secret');
  const isCronAuth =
    authHeader === `Bearer ${cronSecret}` ||
    querySecret === cronSecret ||
    request.headers.get('x-internal-scheduler') === 'true';

  if (!isCronAuth) {
    const auth = await requireFeature(request, 'automation');
    if ('response' in auth) return auth.response;
  }

  const id = reqId();
  try {
    const waitForCompletion = request.nextUrl.searchParams.get('wait') === 'true';
    const forceAutomationId = request.nextUrl.searchParams.get('automationId') || undefined;

    const summary = await runSchedulerCheck({ waitForCompletion, forceAutomationId });

    return NextResponse.json({
      data: {
        processed: summary.processedCount,
        dueCount: summary.dueCount,
        results: summary.results,
        daemonActive: isSchedulerDaemonRunning(),
      },
      meta: { requestId: id, timestamp: summary.checkedAt },
    });
  } catch (error) {
    console.error(`[AUTOMATIONS:SCHEDULER] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to run scheduler check' }, meta: { requestId: id } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return handleScheduler(request);
}

export async function GET(request: NextRequest) {
  return handleScheduler(request);
}
