import { db } from '../src/lib/db';

async function main() {
  const automations = await db.automation.findMany({
    where: {
      scheduleConfig: { contains: 'Africa/Casablanca' }
    },
    include: {
      runs: {
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    }
  });

  console.log(`Found ${automations.length} Casablanca automations`);
  for (const a of automations) {
    console.log('----------------------------------------------------');
    console.log('Automation:', {
      id: a.id,
      name: a.name,
      status: a.status,
      scheduleConfig: a.scheduleConfig,
      lastRunAt: a.lastRunAt,
      nextRunAt: a.nextRunAt,
      totalRuns: a.totalRuns,
      successfulRuns: a.successfulRuns,
      failedRuns: a.failedRuns,
    });
    console.log('Workflow Config:', a.workflowConfig);
    console.log('Runs count:', a.runs.length);
    for (const r of a.runs) {
      console.log('Run:', {
        id: r.id,
        status: r.status,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        failedStep: r.failedStep,
        errorMessage: r.errorMessage,
        generatedArticleId: r.generatedArticleId,
        logs: r.logsJson ? JSON.parse(r.logsJson) : null
      });
    }
  }
}

main().catch(console.error).finally(() => process.exit(0));
