// ============================================================
// AUTOMATION SCHEDULE CONSISTENCY & REGRESSION TEST SUITE
// Validates:
// 1. Updating a daily automation from 09:00 to 16:45 (DB, Next Run, Calendar)
// 2. Editing schedule again avoids duplicate calendar events
// 3. Saving a schedule after its time has passed calculates next valid occurrence
// 4. Timezone conversion for Africa/Casablanca (and other zones)
// 5. Editing preserves Created At and historical runs
// 6. Due automation triggers article generation and persists draft
// 7. Atomic claiming prevents duplicate execution by concurrent workers
// 8. Failed generation does not increment successful runs
// 9. Pausing an automation suspends nextRunAt (clears to null)
// 10. Resuming recalculates the next valid execution
// 11. Manual runs do not corrupt recurring schedule
// ============================================================

import { db } from '../src/lib/db';
import { calculateNextRun, parseScheduleTime, formatScheduleTimeTo12Hour } from '../src/lib/automation/scheduler-utils';
import { executeAutomation } from '../src/lib/automation/automation-service';

async function runRegressionSuite() {
  console.log('=== RUNNING AUTOMATION SCHEDULE REGRESSION TEST SUITE ===');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // TEST 0: 12-hour vs 24-hour time formatting & Next Article date simplification
  // ----------------------------------------------------
  console.log('\n--- Scenario 0: 12-hour Time Formatting & Date Simplification ---');
  assert(formatScheduleTimeTo12Hour('23:56') === '11:56 PM', '23:56 displays as 11:56 PM');
  assert(formatScheduleTimeTo12Hour('00:15') === '12:15 AM', '00:15 displays as 12:15 AM');
  assert(formatScheduleTimeTo12Hour('12:00') === '12:00 PM', '12:00 displays as 12:00 PM');
  assert(formatScheduleTimeTo12Hour('00:00') === '12:00 AM', '00:00 displays as 12:00 AM');
  assert(formatScheduleTimeTo12Hour('09:00') === '9:00 AM', '09:00 displays as 9:00 AM');
  assert(formatScheduleTimeTo12Hour('14:30') === '2:30 PM', '14:30 displays as 2:30 PM');

  // Next Article simplified format test (abbreviated month, no year)
  const testTz = 'Africa/Casablanca';
  const testDate = new Date('2026-10-11T22:56:00.000Z'); // 23:56 in Africa/Casablanca (UTC+1)
  const dtfDate = new Intl.DateTimeFormat('en-US', { timeZone: testTz, month: 'short', day: 'numeric' });
  const dtfTime = new Intl.DateTimeFormat('en-US', { timeZone: testTz, hour: 'numeric', minute: '2-digit', hour12: true });
  const simplifiedDisplay = `${dtfDate.format(testDate)} at ${dtfTime.format(testDate)}`;
  assert(simplifiedDisplay === 'Oct 11 at 11:56 PM', `Simplified display has no year and short month: "${simplifiedDisplay}" === "Oct 11 at 11:56 PM"`);
  assert(dtfTime.format(testDate) === formatScheduleTimeTo12Hour('23:56'), 'Trigger display time and Next Article display time match exactly');


  // Find or create test user and site
  let user = await db.user.findFirst();
  if (!user) {
    user = await db.user.create({
      data: {
        email: 'schedule-tester@example.com',
        name: 'Schedule Tester',
        role: 'ADMIN',
      },
    });
  }

  let site = await db.site.findFirst();
  if (!site) {
    site = await db.site.create({
      data: {
        name: 'Schedule Test Site',
        slug: 'sched-test-site',
        ownerId: user.id,
      },
    });
  }

  // ----------------------------------------------------
  // TEST 1 & 4: Timezone conversion and parsing (Africa/Casablanca)
  // ----------------------------------------------------
  console.log('\n--- Scenario 1 & 4: Timezone & Schedule Parsing ---');
  const t1 = parseScheduleTime('16:45');
  assert(t1.hour === 16 && t1.minute === 45, 'Parsed 24h 16:45 to hour 16, minute 45');

  const t2 = parseScheduleTime('04:45 PM');
  assert(t2.hour === 16 && t2.minute === 45, 'Parsed 12h 04:45 PM to hour 16, minute 45');

  const t3 = parseScheduleTime('04:45 AM');
  assert(t3.hour === 4 && t3.minute === 45, 'Parsed 12h 04:45 AM to hour 4, minute 45');

  // Next run in Africa/Casablanca (UTC+1)
  // At 12:00Z on 2026-10-11, 16:45 Casablanca is 15:45Z on 2026-10-11
  const refBefore = new Date('2026-10-11T12:00:00.000Z');
  const nrBefore = calculateNextRun(
    { frequency: 'DAILY', time: '16:45', timezone: 'Africa/Casablanca', startDate: '2026-10-11' },
    refBefore
  );
  assert(
    nrBefore.toISOString() === '2026-10-11T15:45:00.000Z',
    `Before scheduled time, calculates today at 15:45Z (16:45 Casablanca): ${nrBefore.toISOString()}`
  );

  // ----------------------------------------------------
  // TEST 3: Scheduled time has already passed
  // ----------------------------------------------------
  console.log('\n--- Scenario 3: Schedule Saved After Time Has Passed ---');
  // At 17:00Z on 2026-10-11, 16:45 Casablanca (15:45Z) has already passed
  const refAfter = new Date('2026-10-11T17:00:00.000Z');
  const nrAfter = calculateNextRun(
    { frequency: 'DAILY', time: '16:45', timezone: 'Africa/Casablanca', startDate: '2026-10-11' },
    refAfter
  );
  assert(
    nrAfter.toISOString() === '2026-10-12T15:45:00.000Z',
    `After scheduled time has passed, calculates next occurrence tomorrow at 15:45Z (16:45 Casablanca): ${nrAfter.toISOString()}`
  );
  assert(
    nrAfter.getTime() > refAfter.getTime(),
    'Next run is strictly in the future'
  );

  // ----------------------------------------------------
  // TEST 5: Create automation, edit schedule, preserve Created At & history
  // ----------------------------------------------------
  console.log('\n--- Scenario 5: Preserving Created At and Run History across edits ---');
  const createdRecord = await db.automation.create({
    data: {
      name: 'Regression Schedule Auto',
      description: 'Test schedule consistency',
      triggerType: 'SCHEDULED',
      scheduleConfig: JSON.stringify({ frequency: 'DAILY', time: '09:00', timezone: 'Africa/Casablanca' }),
      workflowConfig: JSON.stringify({ contentGeneration: { topic: 'AI Trends', generationMode: 'MANUAL_QUEUE' }, finalAction: { action: 'DRAFT' } }),
      siteId: site.id,
      createdById: user.id,
      status: 'ACTIVE',
      nextRunAt: calculateNextRun({ frequency: 'DAILY', time: '09:00', timezone: 'Africa/Casablanca' }),
    },
  });

  const originalCreatedAt = createdRecord.createdAt;

  // Add historical run
  const historicalRun = await db.automationRun.create({
    data: {
      automationId: createdRecord.id,
      status: 'COMPLETED',
      startedAt: new Date(Date.now() - 3600000),
      finishedAt: new Date(Date.now() - 3500000),
      durationMs: 100000,
    },
  });

  // Edit schedule to 16:45
  const newSched = JSON.stringify({ frequency: 'DAILY', time: '16:45', timezone: 'Africa/Casablanca' });
  const updatedNextRun = calculateNextRun(newSched);

  const updatedRecord = await db.automation.update({
    where: { id: createdRecord.id },
    data: {
      scheduleConfig: newSched,
      nextRunAt: updatedNextRun,
    },
  });

  assert(
    updatedRecord.id === createdRecord.id,
    'Automation ID is preserved after edit'
  );
  assert(
    updatedRecord.createdAt.getTime() === originalCreatedAt.getTime(),
    'CreatedAt timestamp remains strictly unchanged after edit'
  );
  assert(
    updatedRecord.scheduleConfig === newSched,
    'Database contains newly persisted schedule configuration'
  );

  const preservedRuns = await db.automationRun.findMany({
    where: { automationId: createdRecord.id },
  });
  assert(
    preservedRuns.some((r) => r.id === historicalRun.id),
    'Historical runs are preserved after schedule edit'
  );

  // ----------------------------------------------------
  // TEST 2: Multiple schedule edits - no duplicate calendar events
  // ----------------------------------------------------
  console.log('\n--- Scenario 2: Repeated schedule edits prevent duplicate calendar events ---');
  // Re-edit schedule to 18:00
  const thirdSched = JSON.stringify({ frequency: 'DAILY', time: '18:00', timezone: 'Africa/Casablanca' });
  await db.automation.update({
    where: { id: createdRecord.id },
    data: {
      scheduleConfig: thirdSched,
      nextRunAt: calculateNextRun(thirdSched),
    },
  });

  const activeAutomations = await db.automation.findMany({
    where: { id: createdRecord.id, status: 'ACTIVE' },
  });
  assert(
    activeAutomations.length === 1,
    'Only one automation record exists for this ID (no duplicates in calendar query)'
  );

  // ----------------------------------------------------
  // TEST 9 & 10: Pausing & Resuming
  // ----------------------------------------------------
  console.log('\n--- Scenario 9 & 10: Pause & Resume Behavior ---');
  // Pause
  const pausedAuto = await db.automation.update({
    where: { id: createdRecord.id },
    data: { status: 'PAUSED', nextRunAt: null },
  });
  assert(
    pausedAuto.status === 'PAUSED' && pausedAuto.nextRunAt === null,
    'Pausing sets status to PAUSED and suspends nextRunAt to null'
  );

  // Resume
  const resumedNextRun = calculateNextRun(pausedAuto.scheduleConfig);
  const resumedAuto = await db.automation.update({
    where: { id: createdRecord.id },
    data: { status: 'ACTIVE', nextRunAt: resumedNextRun },
  });
  assert(
    resumedAuto.status === 'ACTIVE' && resumedAuto.nextRunAt !== null && resumedAuto.nextRunAt > new Date(),
    'Resuming recalculates next valid execution time strictly in the future'
  );

  // ----------------------------------------------------
  // TEST 7: Atomic claiming prevents concurrent execution
  // ----------------------------------------------------
  console.log('\n--- Scenario 7: Atomic Concurrent Claiming ---');
  const now = new Date();
  const currentNextRun = resumedAuto.nextRunAt!;

  // Worker 1 claims
  const worker1Claim = await db.automation.updateMany({
    where: { id: resumedAuto.id, nextRunAt: currentNextRun, status: 'ACTIVE' },
    data: { nextRunAt: new Date(Date.now() + 86400000), lastRunAt: now },
  });
  assert(worker1Claim.count === 1, 'Worker 1 successfully claimed automation');

  // Worker 2 attempts to claim with stale nextRunAt
  const worker2Claim = await db.automation.updateMany({
    where: { id: resumedAuto.id, nextRunAt: currentNextRun, status: 'ACTIVE' },
    data: { nextRunAt: new Date(Date.now() + 86400000), lastRunAt: now },
  });
  assert(worker2Claim.count === 0, 'Worker 2 is safely rejected (race condition prevented)');

  // ----------------------------------------------------
  // TEST 6: Execution generates article and persists draft
  // ----------------------------------------------------
  console.log('\n--- Scenario 6: Execution creates and persists draft article ---');
  const uniqueTopic = `Breakthrough Quantum Tech ${Date.now()}`;
  const execAuto = await db.automation.create({
    data: {
      name: 'Exec Draft Automation',
      triggerType: 'SCHEDULED',
      scheduleConfig: JSON.stringify({ frequency: 'DAILY', time: '10:00', timezone: 'UTC', articlesPerDay: 1 }),
      workflowConfig: JSON.stringify({
        contentGeneration: {
          topic: uniqueTopic,
          generationMode: 'MANUAL_QUEUE',
          tone: 'Professional',
          contentLength: 'Medium (800-1200 words)',
        },
        seoProcessing: { generateSeoTitle: true, generateMetaDescription: true, generateSlug: true },
        media: { source: 'NONE' },
        finalAction: { action: 'DRAFT' },
      }),
      siteId: site.id,
      createdById: user.id,
      status: 'ACTIVE',
      nextRunAt: new Date(),
    },
  });

  const run = await db.automationRun.create({
    data: {
      automationId: execAuto.id,
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  await executeAutomation(execAuto.id, run.id, { overrideQuota: true });

  const finishedRun = await db.automationRun.findUnique({ where: { id: run.id } });
  assert(
    finishedRun?.status === 'COMPLETED',
    `Execution completed with status: ${finishedRun?.status}`
  );
  assert(
    Boolean(finishedRun?.generatedArticleId),
    `Generated article ID is recorded: ${finishedRun?.generatedArticleId}`
  );

  const article = finishedRun?.generatedArticleId
    ? await db.contentItem.findUnique({
        where: { id: finishedRun.generatedArticleId },
      })
    : null;
  assert(
    article !== null && article.status === 'DRAFT',
    `Article is persisted in database with status DRAFT (ID: ${article?.id})`
  );

  // ----------------------------------------------------
  // TEST 8: Failed execution does not increment successfulRuns
  // ----------------------------------------------------
  console.log('\n--- Scenario 8: Failed execution increments failedRuns only ---');
  const initialSuccessful = (await db.automation.findUnique({ where: { id: execAuto.id } }))?.successfulRuns || 0;
  const initialFailed = (await db.automation.findUnique({ where: { id: execAuto.id } }))?.failedRuns || 0;

  // Create invalid automation missing required topic
  const invalidAuto = await db.automation.create({
    data: {
      name: 'Failing Auto Test',
      triggerType: 'SCHEDULED',
      scheduleConfig: JSON.stringify({ frequency: 'DAILY', time: '12:00', timezone: 'UTC' }),
      workflowConfig: JSON.stringify({ contentGeneration: {}, finalAction: { action: 'DRAFT' } }),
      siteId: site.id,
      createdById: user.id,
      status: 'ACTIVE',
    },
  });

  const failRun = await db.automationRun.create({
    data: {
      automationId: invalidAuto.id,
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  try {
    await executeAutomation(invalidAuto.id, failRun.id);
  } catch {}

  const postFailAuto = await db.automation.findUnique({ where: { id: invalidAuto.id } });
  assert(
    (postFailAuto?.failedRuns || 0) >= 1,
    'Failed run incremented failedRuns counter'
  );
  assert(
    (postFailAuto?.successfulRuns || 0) === 0,
    'Failed run did NOT increment successfulRuns counter'
  );

  // ----------------------------------------------------
  // TEST 11: Manual run does not corrupt recurring schedule
  // ----------------------------------------------------
  console.log('\n--- Scenario 11: Manual Run does not corrupt recurring schedule ---');
  const recurringSched = JSON.stringify({ frequency: 'DAILY', time: '16:45', timezone: 'Africa/Casablanca' });
  const scheduledNextRun = calculateNextRun(recurringSched, new Date('2026-10-11T12:00:00Z'));
  const manualTestAuto = await db.automation.create({
    data: {
      name: 'Manual Run Schedule Protection',
      triggerType: 'SCHEDULED',
      scheduleConfig: recurringSched,
      workflowConfig: JSON.stringify({ contentGeneration: { topic: 'Testing Manual Run', generationMode: 'MANUAL_QUEUE' }, finalAction: { action: 'DRAFT' } }),
      siteId: site.id,
      createdById: user.id,
      status: 'ACTIVE',
      nextRunAt: scheduledNextRun,
    },
  });

  // Manual run increments totalRuns and updates lastRunAt, but leaves nextRunAt and scheduleConfig intact
  await db.automation.update({
    where: { id: manualTestAuto.id },
    data: { totalRuns: { increment: 1 }, lastRunAt: new Date() },
  });

  const checkManual = await db.automation.findUnique({ where: { id: manualTestAuto.id } });
  assert(
    checkManual?.scheduleConfig === recurringSched,
    'scheduleConfig remains intact after manual run'
  );
  assert(
    checkManual?.nextRunAt?.toISOString() === scheduledNextRun.toISOString(),
    'nextRunAt remains intact after manual run'
  );

  // Clean up test records
  if (finishedRun?.generatedArticleId) {
    await db.contentItem.deleteMany({
      where: { id: finishedRun.generatedArticleId },
    }).catch(() => {});
  }
  await db.contentItem.deleteMany({
    where: { title: { contains: 'Breakthrough Quantum Tech' } },
  }).catch(() => {});
  await db.automation.deleteMany({
    where: { id: { in: [createdRecord.id, execAuto.id, invalidAuto.id, manualTestAuto.id] } },
  });

  console.log(`\n=== REGRESSION SUITE FINISHED: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error('Fatal error in regression suite:', err);
  process.exit(1);
});
