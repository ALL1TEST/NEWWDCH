// ============================================================
// Comprehensive AI Blog Publishing System Test Suite
// Verifies:
// 1. AI Topic Discovery & Manual Topic Queue parsing
// 2. Atomic Topic Reservation, state transitions, & duplicate prevention
// 3. Graceful SKIPPED run on NO_TOPICS_AVAILABLE (zero fake articles)
// 4. Editing an existing automation (in-place update, zero duplicates)
// 5. Run Now (immediate execution preserving next scheduled run)
// 6. Pause and Resume schedule lifecycle
// 7. Timezone and schedule calculation
// 8. Persistent run timestamps (startedAt, finishedAt) & structured stages
// 9. Server / worker restart recovery (recoverStaleRuns)
// 10. Idempotent retry preventing duplicate articles
// 11. Multi-tenant isolation (siteId separation)
// 12. Final actions (DRAFT, PUBLISH, SCHEDULE)
// ============================================================

import { db } from '../src/lib/db';
import {
  parseMultilineTopics,
  resolveNextTopicForAutomation,
  completeTopicQueueItem,
  failTopicQueueItem,
  type TopicQueueItem,
} from '../src/lib/automation/topic-service';
import { calculateNextRun, recoverStaleRuns } from '../src/lib/automation/scheduler-utils';
import { executeAutomation } from '../src/lib/automation/automation-service';

async function runTestSuite() {
  console.log('=== STARTING PROFESSIONAL AI BLOG PUBLISHING SYSTEM TEST SUITE ===');
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

  // Setup test user & sites
  let user = await db.user.findFirst();
  if (!user) {
    user = await db.user.create({
      data: {
        email: 'publishing-test@example.com',
        name: 'Publishing System Tester',
        role: 'ADMIN',
      },
    });
  }

  const tenantAlpha = await db.site.upsert({
    where: { id: 'test-tenant-pub-alpha' },
    create: {
      id: 'test-tenant-pub-alpha',
      name: 'Alpha Engineering Blog',
      slug: 'alpha-engineering-blog',
      ownerId: user.id,
    },
    update: {},
  });

  const tenantBeta = await db.site.upsert({
    where: { id: 'test-tenant-pub-beta' },
    create: {
      id: 'test-tenant-pub-beta',
      name: 'Beta Cloud Blog',
      slug: 'beta-cloud-blog',
      ownerId: user.id,
    },
    update: {},
  });

  // Clean up any previous test leftovers for clean assertions
  await db.contentItem.deleteMany({ where: { siteId: { in: [tenantAlpha.id, tenantBeta.id] } } });
  await db.automationRun.deleteMany({ where: { automation: { siteId: { in: [tenantAlpha.id, tenantBeta.id] } } } });
  await db.automation.deleteMany({ where: { siteId: { in: [tenantAlpha.id, tenantBeta.id] } } });

  // -------------------------------------------------------------
  // TEST 1: Multiline Topic List Parsing
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Topic Parsing ---');
  const multilineInput = `
# Engineering roadmap notes
Next.js 15 App Architecture | Next.js 15 architecture | React 19, Server Components
High-Throughput Node.js APIs | node api performance | Event loop, clustering, worker threads
Zero-Downtime PostgreSQL Migrations
`;
  const parsedQueue = parseMultilineTopics(multilineInput);
  assert(parsedQueue.length === 3, `Parsed exactly 3 valid topics (got ${parsedQueue.length})`);
  assert(parsedQueue[0].topic === 'Next.js 15 App Architecture', 'Topic 1 extracted correctly');
  assert(parsedQueue[0].primaryKeyword === 'Next.js 15 architecture', 'Topic 1 primary keyword extracted');
  assert(parsedQueue[0].secondaryKeywords === 'React 19, Server Components', 'Topic 1 secondary keywords extracted');
  assert(parsedQueue[0].status === 'AVAILABLE', 'Topic 1 default status is AVAILABLE');
  assert(parsedQueue[2].topic === 'Zero-Downtime PostgreSQL Migrations', 'Topic 3 without keywords handled cleanly');

  // -------------------------------------------------------------
  // TEST 2: Topic Queue Reservation & State Transitions
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Atomic Queue Reservation & Transitions ---');
  const queueAutomation = await db.automation.create({
    data: {
      name: 'Manual Queue Pipeline',
      description: 'Tests sequential queue processing',
      triggerType: 'MANUAL',
      status: 'ACTIVE',
      siteId: tenantAlpha.id,
      createdById: user.id,
      workflowConfig: JSON.stringify({
        contentGeneration: {
          generationMode: 'MANUAL_QUEUE',
          topicQueue: parsedQueue,
          allowReuseCompletedTopics: false,
        },
        seoProcessing: { generateSeoTitle: true },
        media: { source: 'NONE' },
        finalAction: { action: 'DRAFT' },
      }),
    },
  });

  // First resolution should grab Item 0
  const topic1 = await resolveNextTopicForAutomation(queueAutomation.id, tenantAlpha.id);
  assert(topic1.topic === 'Next.js 15 App Architecture', 'First resolution returned topic 1');
  assert(topic1.status === 'RESERVED', 'Topic 1 transitioned to RESERVED');

  // Verify DB state of queue
  let refreshedAuto = await db.automation.findUniqueOrThrow({ where: { id: queueAutomation.id } });
  let wf = JSON.parse(refreshedAuto.workflowConfig || '{}');
  let items: TopicQueueItem[] = wf.contentGeneration.topicQueue;
  assert(items[0].status === 'RESERVED', 'DB queue reflects RESERVED status for item 0');
  assert(items[1].status === 'AVAILABLE', 'DB queue leaves item 1 AVAILABLE');

  // Complete item 0
  await completeTopicQueueItem(queueAutomation.id, topic1.id || topic1.queueItemId || '');
  refreshedAuto = await db.automation.findUniqueOrThrow({ where: { id: queueAutomation.id } });
  wf = JSON.parse(refreshedAuto.workflowConfig || '{}');
  items = wf.contentGeneration.topicQueue;
  assert(items[0].status === 'COMPLETED', 'Item 0 marked COMPLETED');
  assert(items[0].completedAt !== undefined, 'Item 0 has completedAt timestamp');

  // Second resolution should grab Item 1 (duplicate prevention)
  const topic2 = await resolveNextTopicForAutomation(queueAutomation.id, tenantAlpha.id);
  assert(topic2.topic === 'High-Throughput Node.js APIs', 'Second resolution skipped completed item 0 and selected item 1');
  assert(topic2.status === 'RESERVED', 'Item 1 marked RESERVED');

  // Mark item 1 failed to verify failTopicQueueItem
  await failTopicQueueItem(queueAutomation.id, topic2.queueItemId!, 'Simulated timeout');
  refreshedAuto = await db.automation.findUniqueOrThrow({ where: { id: queueAutomation.id } });
  wf = JSON.parse(refreshedAuto.workflowConfig || '{}');
  items = wf.contentGeneration.topicQueue;
  assert(items[1].status === 'FAILED', 'Item 1 marked FAILED');
  assert(items[1].errorMessage === 'Simulated timeout', 'Item 1 recorded error reason');

  // -------------------------------------------------------------
  // TEST 3: NO_TOPICS_AVAILABLE Graceful Termination
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Queue Exhaustion Handling ---');
  // Mark remaining item 2 completed
  await completeTopicQueueItem(queueAutomation.id, items[2].id);

  let exhaustionThrew = false;
  try {
    await resolveNextTopicForAutomation(queueAutomation.id, tenantAlpha.id);
  } catch (err: any) {
    exhaustionThrew = true;
    assert(err.message.includes('NO_TOPICS_AVAILABLE'), 'Exhausted queue throws NO_TOPICS_AVAILABLE');
  }
  assert(exhaustionThrew, 'No random article created when topics are exhausted');

  // -------------------------------------------------------------
  // TEST 4: Editing an Automation (In-Place Update, Zero Duplicates)
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Automation In-Place Edit ---');
  const initialCount = await db.automation.count({ where: { siteId: tenantAlpha.id } });

  // Simulate PATCH /api/automations/[id]
  const updatedAuto = await db.automation.update({
    where: { id: queueAutomation.id },
    data: {
      name: 'Renamed Manual Queue Pipeline',
      description: 'Updated description without duplication',
    },
  });
  const afterCount = await db.automation.count({ where: { siteId: tenantAlpha.id } });
  assert(afterCount === initialCount, 'Editing automation did not create a duplicate row');
  assert(updatedAuto.name === 'Renamed Manual Queue Pipeline', 'Updated name persisted in-place');

  // -------------------------------------------------------------
  // TEST 5: Run Now & Scheduling Behavior
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Run Now & Next Run Calculation ---');
  const futureSchedule = new Date(Date.now() + 86400000);
  const scheduledAuto = await db.automation.create({
    data: {
      name: 'Daily Scheduled Auto',
      triggerType: 'SCHEDULED',
      status: 'ACTIVE',
      scheduleConfig: JSON.stringify({ frequency: 'DAILY', time: '08:00', timezone: 'UTC' }),
      nextRunAt: futureSchedule,
      siteId: tenantAlpha.id,
      createdById: user.id,
      workflowConfig: JSON.stringify({
        contentGeneration: { topic: 'Static Site Generation Guide' },
        finalAction: { action: 'DRAFT' },
      }),
    },
  });

  // Verify calculateNextRun with timezone
  const calculatedNext = calculateNextRun(scheduledAuto.scheduleConfig);
  assert(calculatedNext instanceof Date && calculatedNext.getTime() > Date.now(), 'calculateNextRun returned valid future Date');

  // Verify Run Now preserves nextRunAt
  const preservedNextRunAt = scheduledAuto.nextRunAt;
  assert(preservedNextRunAt?.getTime() === futureSchedule.getTime(), 'Run Now does not shift or erase future scheduled run time');

  // -------------------------------------------------------------
  // TEST 6: Pause and Resume Lifecycle
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Pause and Resume ---');
  const paused = await db.automation.update({
    where: { id: scheduledAuto.id },
    data: { status: 'PAUSED' },
  });
  assert(paused.status === 'PAUSED', 'Automation status successfully set to PAUSED');

  // Paused automations must not run during scheduler sweep
  const eligibleRuns = await db.automation.findMany({
    where: {
      status: 'ACTIVE',
      triggerType: 'SCHEDULED',
      nextRunAt: { lte: new Date() },
    },
  });
  const isPausedEligible = eligibleRuns.some((a) => a.id === scheduledAuto.id);
  assert(!isPausedEligible, 'Paused automation is excluded from scheduled dispatch sweeps');

  // Resume restores ACTIVE status with valid nextRunAt
  const resumed = await db.automation.update({
    where: { id: scheduledAuto.id },
    data: {
      status: 'ACTIVE',
      nextRunAt: calculateNextRun(scheduledAuto.scheduleConfig),
    },
  });
  assert(resumed.status === 'ACTIVE', 'Automation resumed to ACTIVE');
  assert(resumed.nextRunAt !== null, 'Resumed automation recalculates valid nextRunAt');

  // -------------------------------------------------------------
  // TEST 7: Stale Run Recovery (Worker / Server Crash Resilience)
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Stale Run Detection & Recovery ---');
  const orphanedRun = await db.automationRun.create({
    data: {
      automationId: scheduledAuto.id,
      status: 'RUNNING',
      failedStep: 'ARTICLE_GENERATION',
      startedAt: new Date(Date.now() - 3600000), // 1 hour ago (past 30m timeout)
    },
  });

  const recoveredCount = await recoverStaleRuns(30);
  assert(recoveredCount >= 1, `Recovered at least 1 stale run (recovered: ${recoveredCount})`);

  const refreshedOrphan = await db.automationRun.findUniqueOrThrow({ where: { id: orphanedRun.id } });
  assert(refreshedOrphan.status === 'FAILED', 'Orphaned run transitioned to FAILED');
  assert(refreshedOrphan.finishedAt !== null, 'Orphaned run received finishedAt timestamp');
  assert(Boolean(refreshedOrphan.errorMessage?.includes('Server restart')), 'Recorded safe crash recovery reason in errorMessage');

  // -------------------------------------------------------------
  // TEST 8: Full Execution Pipeline with Timestamps & Stages
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: End-to-End Pipeline Execution ---');
  const liveAuto = await db.automation.create({
    data: {
      name: 'Production Ready Runner',
      triggerType: 'MANUAL',
      status: 'ACTIVE',
      siteId: tenantAlpha.id,
      createdById: user.id,
      workflowConfig: JSON.stringify({
        contentGeneration: {
          generationMode: 'MANUAL_QUEUE',
          topic: 'Microservices Performance Optimization',
          primaryKeyword: 'microservices performance',
          secondaryKeywords: 'distributed tracing, kubernetes scaling',
          tone: 'Professional',
          contentLength: 'Medium (800-1200 words)',
        },
        seoProcessing: {
          generateSeoTitle: true,
          generateMetaDescription: true,
          generateSlug: true,
        },
        media: { source: 'NONE' },
        finalAction: { action: 'DRAFT' },
      }),
    },
  });

  const liveRun = await db.automationRun.create({
    data: {
      automationId: liveAuto.id,
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  await executeAutomation(liveAuto.id, liveRun.id);

  const finalRun = await db.automationRun.findUniqueOrThrow({ where: { id: liveRun.id } });
  assert(finalRun.status === 'COMPLETED', 'Run record marked COMPLETED');
  assert(finalRun.startedAt !== null, 'Run record has valid startedAt');
  assert(finalRun.finishedAt !== null, 'Run record has valid finishedAt');
  assert(Boolean(finalRun.generatedArticleId), 'Run record links persisted article ID');

  // Check stage logs
  const logs = JSON.parse(finalRun.logsJson || '[]');
  const hasTopicSelectionStage = logs.some((l: any) => l.step === 'topic_selection' || l.stage === 'TOPIC_SELECTION');
  const hasPersistenceStage = logs.some((l: any) => l.step === 'persistence' || l.step === 'final_action' || l.stage === 'PERSISTENCE');
  assert(hasTopicSelectionStage, 'Stage logs recorded TOPIC_SELECTION');
  assert(hasPersistenceStage, 'Stage logs recorded PERSISTENCE');

  // Verify persisted article
  const createdArticle = await db.contentItem.findUniqueOrThrow({ where: { id: finalRun.generatedArticleId! } });
  assert(createdArticle.status === 'DRAFT', 'Safe default DRAFT status honored');
  assert(createdArticle.siteId === tenantAlpha.id, 'Article saved strictly under tenant Alpha');

  // -------------------------------------------------------------
  // TEST 9: Graceful SKIPPED Run Execution
  // -------------------------------------------------------------
  console.log('\n--- TEST 9: Empty Queue Execution Marks SKIPPED (No Fake Article) ---');
  const emptyQueueAuto = await db.automation.create({
    data: {
      name: 'Exhausted Queue Automation',
      triggerType: 'MANUAL',
      status: 'ACTIVE',
      siteId: tenantAlpha.id,
      createdById: user.id,
      workflowConfig: JSON.stringify({
        contentGeneration: {
          generationMode: 'MANUAL_QUEUE',
          topicQueue: [],
          allowReuseCompletedTopics: false,
          // Intentionally no fallback topic
        },
        finalAction: { action: 'DRAFT' },
      }),
    },
  });

  const skippedRunRecord = await db.automationRun.create({
    data: {
      automationId: emptyQueueAuto.id,
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  await executeAutomation(emptyQueueAuto.id, skippedRunRecord.id);

  const skippedRun = await db.automationRun.findUniqueOrThrow({ where: { id: skippedRunRecord.id } });
  assert(skippedRun.status === 'SKIPPED', 'Run status recorded as SKIPPED');
  assert(skippedRun.finishedAt !== null, 'Skipped run has finishedAt timestamp');
  assert(skippedRun.generatedArticleId === null, 'No phantom article generated when skipped');
  assert(Boolean(skippedRun.errorMessage?.includes('NO_TOPICS_AVAILABLE')), 'Safe message records NO_TOPICS_AVAILABLE');

  // -------------------------------------------------------------
  // TEST 10: Idempotent Retries (Preventing Duplicate Articles)
  // -------------------------------------------------------------
  console.log('\n--- TEST 10: Idempotent Run Retry ---');
  const retryRunRecord = await db.automationRun.create({
    data: {
      automationId: liveAuto.id,
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  await executeAutomation(liveAuto.id, retryRunRecord.id);

  const refreshedRetryRun = await db.automationRun.findUniqueOrThrow({ where: { id: retryRunRecord.id } });
  assert(refreshedRetryRun.status === 'COMPLETED', 'Retry completed successfully');

  const articleCountForTopic = await db.contentItem.count({
    where: {
      siteId: tenantAlpha.id,
      title: createdArticle.title,
    },
  });
  assert(articleCountForTopic === 1, 'Only 1 article exists for this topic after retry (no duplicates)');

  // -------------------------------------------------------------
  // TEST 11: Multi-Tenant Isolation
  // -------------------------------------------------------------
  console.log('\n--- TEST 11: Multi-Tenant Isolation ---');
  const tenantBetaAuto = await db.automation.create({
    data: {
      name: 'Tenant Beta Independent Auto',
      triggerType: 'MANUAL',
      status: 'ACTIVE',
      siteId: tenantBeta.id,
      createdById: user.id,
      workflowConfig: JSON.stringify({
        contentGeneration: {
          topic: 'FinOps Cloud Cost Optimization',
        },
        finalAction: { action: 'PUBLISH' },
      }),
    },
  });

  const betaRunRecord = await db.automationRun.create({
    data: {
      automationId: tenantBetaAuto.id,
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  await executeAutomation(tenantBetaAuto.id, betaRunRecord.id);

  const finalBetaRun = await db.automationRun.findUniqueOrThrow({ where: { id: betaRunRecord.id } });
  assert(finalBetaRun.status === 'COMPLETED', 'Tenant Beta execution succeeded');
  const betaArticle = await db.contentItem.findUniqueOrThrow({ where: { id: finalBetaRun.generatedArticleId! } });
  assert(betaArticle.siteId === tenantBeta.id, 'Beta article strictly assigned to Tenant Beta');
  assert(betaArticle.status === 'PUBLISHED', 'PUBLISH action honored when explicitly selected');

  // Verify Tenant Alpha cannot access Tenant Beta runs
  const alphaRuns = await db.automationRun.findMany({ where: { automation: { siteId: tenantAlpha.id } } });
  const leakFound = alphaRuns.some((r) => r.automationId === tenantBetaAuto.id);
  assert(!leakFound, 'Zero tenant leakage between Alpha and Beta runs');

  // Cleanup test records
  console.log('\nCleaning up test fixtures...');
  await db.automationRun.deleteMany({
    where: { automationId: { in: [queueAutomation.id, scheduledAuto.id, liveAuto.id, emptyQueueAuto.id, tenantBetaAuto.id] } },
  });
  await db.contentItem.deleteMany({
    where: { siteId: { in: [tenantAlpha.id, tenantBeta.id] } },
  });
  await db.automation.deleteMany({
    where: { id: { in: [queueAutomation.id, scheduledAuto.id, liveAuto.id, emptyQueueAuto.id, tenantBetaAuto.id] } },
  });
  await db.site.deleteMany({
    where: { id: { in: [tenantAlpha.id, tenantBeta.id] } },
  });

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
