import { db } from '../src/lib/db';

async function main() {
  const automations = await db.automation.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 5,
  });
  console.log('=== AUTOMATIONS ===');
  for (const a of automations) {
    console.log(JSON.stringify({
      id: a.id,
      name: a.name,
      status: a.status,
      triggerType: a.triggerType,
      scheduleConfig: a.scheduleConfig,
      lastRunAt: a.lastRunAt,
      nextRunAt: a.nextRunAt,
      totalRuns: a.totalRuns,
      successfulRuns: a.successfulRuns,
      failedRuns: a.failedRuns,
    }, null, 2));
  }

  const runs = await db.automationRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.log('\n=== RECENT RUNS ===');
  for (const r of runs) {
    console.log(JSON.stringify({
      id: r.id,
      automationId: r.automationId,
      status: r.status,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      failedStep: r.failedStep,
      errorMessage: r.errorMessage,
      generatedArticleId: r.generatedArticleId,
      logsJson: r.logsJson ? JSON.parse(r.logsJson) : null,
    }, null, 2));
  }
}

main().catch(console.error).finally(() => process.exit(0));
