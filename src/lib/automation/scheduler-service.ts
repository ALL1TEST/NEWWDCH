import { db } from '@/lib/db';
import { executeAutomation } from './automation-service';
import { calculateNextRun, recoverStaleRuns, getAutomationDailyStats } from './scheduler-utils';

export interface SchedulerExecutionResult {
  automationId: string;
  name: string;
  success: boolean;
  message: string;
  runId?: string;
  generatedArticleId?: string | null;
  nextRunAt?: Date | null;
}

export interface SchedulerCheckSummary {
  checkedAt: string;
  dueCount: number;
  processedCount: number;
  results: SchedulerExecutionResult[];
}

/**
 * Core server-side scheduler worker.
 * Discovers due automations, atomically claims them, advances nextRunAt,
 * and executes article generation through the real pipeline.
 */
export async function runSchedulerCheck(options: {
  waitForCompletion?: boolean;
  forceAutomationId?: string;
} = {}): Promise<SchedulerCheckSummary> {
  const now = new Date();

  // Auto-recover stale runs exceeding 20 minutes
  await recoverStaleRuns(20).catch((err) => {
    console.error('[SCHEDULER] Error recovering stale runs:', err);
  });

  // Query due automations
  const whereClause: any = {
    status: 'ACTIVE',
    triggerType: 'SCHEDULED',
  };

  if (options.forceAutomationId) {
    whereClause.id = options.forceAutomationId;
  } else {
    whereClause.nextRunAt = { lte: now };
  }

  const dueAutomations = await db.automation.findMany({
    where: whereClause,
    orderBy: { nextRunAt: 'asc' },
  });

  const results: SchedulerExecutionResult[] = [];

  for (const automation of dueAutomations) {
    try {
      // 1. Prevent duplicate execution if already running in the last 15 minutes
      const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
      const activeRun = await db.automationRun.findFirst({
        where: {
          automationId: automation.id,
          status: 'RUNNING',
          startedAt: { gte: fifteenMinutesAgo },
        },
      });

      if (activeRun) {
        results.push({
          automationId: automation.id,
          name: automation.name,
          success: false,
          message: `Skipped: Execution already in progress (${activeRun.id})`,
        });
        continue;
      }

      // 2. Calculate the next occurrence for recurring schedule
      const nextRunAt = calculateNextRun(automation.scheduleConfig, now, { advancePastNow: true });

      // 3. Atomically claim the automation using exact nextRunAt matching
      const claimResult = await db.automation.updateMany({
        where: {
          id: automation.id,
          nextRunAt: automation.nextRunAt,
          status: 'ACTIVE',
        },
        data: {
          nextRunAt,
          totalRuns: { increment: 1 },
          lastRunAt: now,
        },
      });

      if (claimResult.count === 0 && !options.forceAutomationId) {
        results.push({
          automationId: automation.id,
          name: automation.name,
          success: false,
          message: 'Skipped: Already claimed by a concurrent scheduler worker',
        });
        continue;
      }

      // 4. Create persistent run record — every scheduled trigger MUST be recorded
      const run = await db.automationRun.create({
        data: {
          automationId: automation.id,
          status: 'RUNNING',
          startedAt: now,
          logsJson: JSON.stringify([
            {
              timestamp: now.toISOString(),
              step: 'TRIGGERED',
              message: `Scheduled execution triggered by background scheduler at ${now.toISOString()}`,
              level: 'info',
            },
          ]),
        },
      });

      console.log(`[SCHEDULER] Claimed automation "${automation.name}" (${automation.id}). Created Run: ${run.id}. Next run: ${nextRunAt.toISOString()}`);

      // 5. Verify daily quota
      const dailyStats = await getAutomationDailyStats(automation.id, automation.scheduleConfig, now);
      if (dailyStats.remainingToday <= 0) {
        const quotaMsg = `Daily quota of ${dailyStats.dailyTarget} articles has already been satisfied for today (${dailyStats.completedToday}/${dailyStats.dailyTarget} completed in ${dailyStats.timezone}). Run skipped. Next run: ${nextRunAt.toISOString()}`;
        await db.automationRun.update({
          where: { id: run.id },
          data: {
            status: 'SKIPPED',
            finishedAt: new Date(),
            durationMs: Date.now() - now.getTime(),
            errorMessage: quotaMsg,
            failedStep: 'quota_check',
            logsJson: JSON.stringify([
              {
                timestamp: now.toISOString(),
                step: 'TRIGGERED',
                message: `Scheduled execution triggered by background scheduler`,
                level: 'info',
              },
              {
                timestamp: new Date().toISOString(),
                step: 'QUOTA',
                message: quotaMsg,
                level: 'warn',
              },
            ]),
          },
        });
        results.push({
          automationId: automation.id,
          name: automation.name,
          success: false,
          message: quotaMsg,
          runId: run.id,
          nextRunAt,
        });
        continue;
      }

      // 6. Execute automation pipeline
      if (options.waitForCompletion) {
        try {
          await executeAutomation(automation.id, run.id);
          const finishedRun = await db.automationRun.findUnique({ where: { id: run.id } });
          results.push({
            automationId: automation.id,
            name: automation.name,
            success: finishedRun?.status === 'COMPLETED',
            message: `Execution ${finishedRun?.status}: ${finishedRun?.errorMessage || 'Success'}`,
            runId: run.id,
            generatedArticleId: finishedRun?.generatedArticleId,
            nextRunAt,
          });
        } catch (err: any) {
          results.push({
            automationId: automation.id,
            name: automation.name,
            success: false,
            message: `Execution failed: ${err?.message || err}`,
            runId: run.id,
            nextRunAt,
          });
        }
      } else {
        // Asynchronous background execution
        executeAutomation(automation.id, run.id).catch((err) => {
          console.error(`[SCHEDULER] Async execution error for automation ${automation.id}:`, err);
        });

        results.push({
          automationId: automation.id,
          name: automation.name,
          success: true,
          message: `Run started: ${run.id}. Next run scheduled for: ${nextRunAt.toISOString()}`,
          runId: run.id,
          nextRunAt,
        });
      }
    } catch (err: any) {
      console.error(`[SCHEDULER] Error processing automation ${automation.id}:`, err);
      results.push({
        automationId: automation.id,
        name: automation.name,
        success: false,
        message: err instanceof Error ? err.message : 'Unknown execution error',
      });
    }
  }

  return {
    checkedAt: now.toISOString(),
    dueCount: dueAutomations.length,
    processedCount: results.length,
    results,
  };
}
