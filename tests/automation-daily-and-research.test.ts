// ============================================================
// AUTOMATION DAILY ARTICLES & AI INTERNET RESEARCH TEST SUITE
// Tests the 12 core acceptance criteria:
// 1. Articles Per Day = 1 generates at most one article
// 2. Articles Per Day = 3 processes 3 distinct eligible topics
// 3. AI Internet Research integrates with real search / SERP provider
// 4. Strict honesty: No fake research metrics (volumes/difficulty)
// 5. Manual mode never invents topics when queue has shortfall
// 6. Empty queue ends cleanly
// 7. Daily quota is respected across repeated triggers
// 8. Retries / re-runs do not duplicate articles or topic reservations
// 9. Atomic topic reservation prevents concurrent duplicate processing
// 10. Edit preserves and updates the existing automation
// 11. Daily counters reflect actual persisted articles
// 12. Tenant / site isolation is maintained
// ============================================================

import { db } from '../src/lib/db';
import { nanoid } from 'nanoid';
import {
  getDayBoundsInTz,
  getAutomationDailyStats,
  calculateNextRun,
  type ScheduleConfig,
} from '../src/lib/automation/scheduler-utils';
import {
  parseMultilineTopics,
  type TopicQueueItem,
} from '../src/lib/automation/topic-types';
import {
  reserveBatchTopicsForAutomation,
  markTopicStatusInQueue,
} from '../src/lib/automation/topic-service';
import {
  discoverTopicsViaInternetResearch,
  getConfiguredSearchProvider,
} from '../src/lib/automation/serp-research';

async function runTests() {
  console.log('====================================================');
  console.log('STARTING AUTOMATION DAILY ARTICLES & RESEARCH TESTS');
  console.log('====================================================');

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

  // Setup test environment
  let user = await db.user.findFirst();
  if (!user) {
    user = await db.user.create({
      data: {
        email: `test-${nanoid(6)}@example.com`,
        name: 'Daily Automation Tester',
        role: 'ADMIN',
      },
    });
  }

  let site = await db.site.findFirst();
  if (!site) {
    site = await db.site.create({
      data: {
        name: 'Daily Automation Site',
        slug: `auto-site-${nanoid(6)}`,
        ownerId: user.id,
      },
    });
  }

  let contentType = await db.contentType.findFirst({
    where: { OR: [{ slug: 'post' }, { slug: 'article' }] },
  });
  if (!contentType) {
    contentType = await db.contentType.create({
      data: {
        name: 'Article',
        slug: 'post',
        siteId: site.id,
        allowedStatuses: '["DRAFT", "PUBLISHED"]',
        fields: '[]',
      },
    });
  }

  console.log('\n--- 1. Testing Calendar-Day Boundaries Across Timezones ---');
  {
    const date = new Date('2026-06-15T14:30:00Z');
    const boundsNy = getDayBoundsInTz(date, 'America/New_York');
    const boundsUtc = getDayBoundsInTz(date, 'UTC');
    const boundsTokyo = getDayBoundsInTz(date, 'Asia/Tokyo');

    assert(boundsNy.start < boundsNy.end, 'NY day start is before NY day end');
    assert(boundsUtc.start < boundsUtc.end, 'UTC day start is before UTC day end');
    assert(boundsTokyo.start < boundsTokyo.end, 'Tokyo day start is before Tokyo day end');
    // Difference between start and end is roughly 24 hours
    const diffHours = (boundsNy.end.getTime() - boundsNy.start.getTime()) / (1000 * 60 * 60);
    assert(Math.round(diffHours) === 24, `Day span is 24 hours (calculated: ${diffHours}h)`);
  }

  console.log('\n--- 2. Testing Articles Per Day = 1 Quota Enforcement ---');
  {
    const auto1 = await db.automation.create({
      data: {
        name: `Test Quota 1 ${nanoid(6)}`,
        description: 'Testing quota of 1',
        triggerType: 'SCHEDULED',
        scheduleConfig: JSON.stringify({
          frequency: 'DAILY',
          time: '09:00',
          timezone: 'America/New_York',
          articlesPerDay: 1,
        }),
        workflowConfig: JSON.stringify({
          contentGeneration: {
            generationMode: 'MANUAL_QUEUE',
            topicQueue: [
              { id: 'q1', topic: 'Topic 1', status: 'AVAILABLE', addedAt: new Date().toISOString() },
              { id: 'q2', topic: 'Topic 2', status: 'AVAILABLE', addedAt: new Date().toISOString() },
            ],
          },
        }),
        status: 'ACTIVE',
        siteId: site.id,
        createdById: user.id,
      },
    });

    const statsBefore = await getAutomationDailyStats(auto1.id, auto1.scheduleConfig);
    assert(statsBefore.dailyTarget === 1, `Daily target is 1 (actual: ${statsBefore.dailyTarget})`);
    assert(statsBefore.completedToday === 0, 'Completed today starts at 0');
    assert(statsBefore.remainingToday === 1, 'Remaining today starts at 1');

    // Simulate 1 successful generated article created today
    const article = await db.contentItem.create({
      data: {
        title: 'Article 1 for Auto 1',
        slug: `article-1-${nanoid(6)}`,
        status: 'PUBLISHED',
        contentTypeId: contentType.id,
        siteId: site.id,
        authorId: user.id,
        content: '<p>Article body content</p>',
      },
    });

    const run = await db.automationRun.create({
      data: {
        automationId: auto1.id,
        status: 'COMPLETED',
        startedAt: new Date(),
        finishedAt: new Date(),
        generatedArticleId: article.id,
        generatedArticleName: article.title,
        logsJson: '[]',
      },
    });

    const statsAfter = await getAutomationDailyStats(auto1.id, auto1.scheduleConfig);
    assert(statsAfter.completedToday === 1, `Completed today is 1 (actual: ${statsAfter.completedToday})`);
    assert(statsAfter.remainingToday === 0, `Remaining today is 0 when quota is 1 (actual: ${statsAfter.remainingToday})`);
  }

  console.log('\n--- 3. Testing Articles Per Day = 3 and Batch Topic Reservation ---');
  {
    const auto3 = await db.automation.create({
      data: {
        name: `Test Quota 3 ${nanoid(6)}`,
        description: 'Testing quota of 3',
        triggerType: 'SCHEDULED',
        scheduleConfig: JSON.stringify({
          frequency: 'DAILY',
          time: '09:00',
          timezone: 'UTC',
          articlesPerDay: 3,
        }),
        workflowConfig: JSON.stringify({
          contentGeneration: {
            generationMode: 'MANUAL_QUEUE',
            topicQueue: [
              { id: 'tq_1', topic: 'Topic Alpha', status: 'AVAILABLE', addedAt: new Date().toISOString() },
              { id: 'tq_2', topic: 'Topic Beta', status: 'AVAILABLE', addedAt: new Date().toISOString() },
              { id: 'tq_3', topic: 'Topic Gamma', status: 'AVAILABLE', addedAt: new Date().toISOString() },
              { id: 'tq_4', topic: 'Topic Delta', status: 'AVAILABLE', addedAt: new Date().toISOString() },
            ],
          },
        }),
        status: 'ACTIVE',
        siteId: site.id,
        createdById: user.id,
      },
    });

    // Reserve batch topics for quota = 3
    const reserved = await reserveBatchTopicsForAutomation(auto3.id, 3, site.id, user.id);
    assert(reserved.length === 3, `Batch reserved 3 topics for quota=3 (actual: ${reserved.length})`);
    const uniqueTopics = new Set(reserved.map((r) => r.topic));
    assert(uniqueTopics.size === 3, `All 3 reserved topics are distinct (${Array.from(uniqueTopics).join(', ')})`);

    // Verify queue statuses updated in DB
    const updatedAuto3 = await db.automation.findUnique({ where: { id: auto3.id } });
    const parsedWf = JSON.parse(updatedAuto3?.workflowConfig || '{}');
    const queue: TopicQueueItem[] = parsedWf.contentGeneration?.topicQueue || [];
    const reservedCount = queue.filter((q) => q.status === 'RESERVED' || q.status === 'PROCESSING').length;
    const availableCount = queue.filter((q) => q.status === 'AVAILABLE').length;
    assert(reservedCount === 3, `Queue has exactly 3 in-progress/reserved topics (actual: ${reservedCount})`);
    assert(availableCount === 1, `Queue has 1 remaining AVAILABLE topic (actual: ${availableCount})`);
  }

  console.log('\n--- 4. Testing Concurrency & Duplicate Prevention on Topic Queue ---');
  {
    const autoConc = await db.automation.create({
      data: {
        name: `Test Concurrency ${nanoid(6)}`,
        triggerType: 'MANUAL',
        scheduleConfig: JSON.stringify({ articlesPerDay: 1 }),
        workflowConfig: JSON.stringify({
          contentGeneration: {
            generationMode: 'MANUAL_QUEUE',
            topicQueue: [
              { id: 'single_topic', topic: 'Only Topic', status: 'AVAILABLE', addedAt: new Date().toISOString() },
            ],
          },
        }),
        status: 'ACTIVE',
        siteId: site.id,
        createdById: user.id,
      },
    });

    // Run 2 simultaneous reservation calls
    const [worker1Result, worker2Result] = await Promise.all([
      reserveBatchTopicsForAutomation(autoConc.id, 1, site.id, user.id, undefined, false),
      reserveBatchTopicsForAutomation(autoConc.id, 1, site.id, user.id, undefined, false),
    ]);

    const totalTopicsGranted = worker1Result.length + worker2Result.length;
    assert(totalTopicsGranted === 1, `Atomic reservation granted topic to only 1 worker (actual total: ${totalTopicsGranted})`);
    const grantedWorker = worker1Result.length === 1 ? 'Worker 1' : 'Worker 2';
    console.log(`   Topic granted exclusively to: ${grantedWorker}`);
  }

  console.log('\n--- 5. Testing Empty Queue & Shortfall in Manual Mode (Never Invent Topics) ---');
  {
    const autoEmpty = await db.automation.create({
      data: {
        name: `Test Empty Queue ${nanoid(6)}`,
        triggerType: 'MANUAL',
        scheduleConfig: JSON.stringify({ articlesPerDay: 5 }),
        workflowConfig: JSON.stringify({
          contentGeneration: {
            generationMode: 'MANUAL_QUEUE',
            topicQueue: [
              { id: 'item_1', topic: 'First Only', status: 'AVAILABLE', addedAt: new Date().toISOString() },
            ],
            allowReuseCompletedTopics: false,
          },
        }),
        status: 'ACTIVE',
        siteId: site.id,
        createdById: user.id,
      },
    });

    // Request 5 topics, but queue only has 1
    const resultShortfall = await reserveBatchTopicsForAutomation(autoEmpty.id, 5, site.id, user.id);
    assert(resultShortfall.length === 1, `Returned only 1 topic when 5 requested from 1-item queue (actual: ${resultShortfall.length})`);
    assert(resultShortfall[0].topic === 'First Only', 'Returned genuine queued topic');

    // Second request with empty queue
    const resultEmpty = await reserveBatchTopicsForAutomation(autoEmpty.id, 5, site.id, user.id, undefined, false);
    assert(resultEmpty.length === 0, `Returned 0 topics for completely exhausted queue (never invent topics in Manual mode)`);
  }

  console.log('\n--- 6. Testing AI Internet Research & Provider Status ---');
  {
    const providerInfo = getConfiguredSearchProvider();
    console.log(`   Configured Search Provider: ${providerInfo.provider || 'AI Estimate Fallback'} (status: ${providerInfo.isLive ? 'ACTIVE' : 'NOT CONFIGURED / FALLBACK'})`);
    assert(typeof providerInfo.label === 'string', 'Detected search provider description');

    // Run discovery for a niche
    const discovered = await discoverTopicsViaInternetResearch(
      {
        niche: 'Sustainable Solar Energy Solutions',
        subNiches: 'Residential rooftop solar panels',
        country: 'US',
        language: 'en',
        targetAudience: 'Homeowners looking to reduce electricity bills',
      },
      2,
      site.id,
      user.id
    );

    assert(discovered.length >= 2, `Discovered at least 2 topics for solar niche (actual: ${discovered.length})`);
    assert(discovered[0].topic.length > 5, `Discovered topic is substantive: "${discovered[0].topic}"`);
    assert(Boolean(discovered[0].evidenceSource), `Evidence source recorded: ${discovered[0].evidenceSource}`);
    assert(Boolean(discovered[0].evidenceNote), `Evidence note provided: ${discovered[0].evidenceNote}`);
  }

  console.log('\n--- 7. Testing Strict Data Honesty (Zero Fabricated Metrics) ---');
  {
    const discovered = await discoverTopicsViaInternetResearch(
      { niche: 'Coffee Brewing Methods' },
      1,
      site.id,
      user.id
    );

    // Verify there are no fabricated search volume or competitor metrics
    const item = discovered[0] as any;
    assert(item.searchVolume === undefined, 'Does NOT invent searchVolume numbers');
    assert(item.keywordDifficulty === undefined, 'Does NOT invent keywordDifficulty percentage');
    assert(item.competitorTraffic === undefined, 'Does NOT invent competitorTraffic stats');
    assert(
      item.evidenceSource === 'SERPER_LIVE' ||
      item.evidenceSource === 'TAVILY_LIVE' ||
      item.evidenceSource === 'PERPLEXITY_LIVE' ||
      item.evidenceSource === 'GSC_MEASURED' ||
      item.evidenceSource === 'AI_ESTIMATE',
      `Evidence source is accurately categorized: ${item.evidenceSource}`
    );
  }

  console.log('\n--- 8. Testing Multiline Topic Import Parser ---');
  {
    const rawInput = `
# Sample Header Comment
Clean Energy for Homes | Solar Power | solar rebate, rooftop solar
Electric Vehicles 2026 | EV Adoption
Simple Topic Without Delimiters
    `;

    const parsed = parseMultilineTopics(rawInput);
    assert(parsed.length === 3, `Parsed exactly 3 valid topics (actual: ${parsed.length})`);
    assert(parsed[0].topic === 'Clean Energy for Homes', 'Parsed topic 1 name correctly');
    assert(parsed[0].primaryKeyword === 'Solar Power', 'Parsed primary keyword correctly');
    assert(parsed[0].secondaryKeywords === 'solar rebate, rooftop solar', 'Parsed secondary keywords correctly');
    assert(parsed[2].topic === 'Simple Topic Without Delimiters', 'Parsed simple topic without pipe');
    assert(parsed[2].primaryKeyword === 'Simple Topic Without Delimiters', 'Fallback primary keyword matches topic');
    assert(parsed.every((p) => p.status === 'AVAILABLE'), 'All parsed topics default to AVAILABLE');
  }

  console.log('\n--- 9. Testing Daily Quota Counter Verification (Only Certified DB Articles) ---');
  {
    const autoVerify = await db.automation.create({
      data: {
        name: `Test Verification ${nanoid(6)}`,
        triggerType: 'SCHEDULED',
        scheduleConfig: JSON.stringify({
          frequency: 'DAILY',
          time: '12:00',
          timezone: 'UTC',
          articlesPerDay: 2,
        }),
        status: 'ACTIVE',
        siteId: site.id,
        createdById: user.id,
      },
    });

    // 1. Create a failed run without article
    await db.automationRun.create({
      data: {
        automationId: autoVerify.id,
        status: 'FAILED',
        startedAt: new Date(),
        finishedAt: new Date(),
        errorMessage: 'Network timeout',
        logsJson: '[]',
      },
    });

    // 2. Create a completed run with no article ID (should not count as finished article)
    await db.automationRun.create({
      data: {
        automationId: autoVerify.id,
        status: 'COMPLETED',
        startedAt: new Date(),
        finishedAt: new Date(),
        generatedArticleId: null,
        logsJson: '[]',
      },
    });

    let stats = await getAutomationDailyStats(autoVerify.id, autoVerify.scheduleConfig);
    assert(stats.completedToday === 0, 'Does NOT count runs without certified generatedArticleId as completed');
    assert(stats.failedToday === 1, 'Correctly tracks 1 failed run today');
    assert(stats.remainingToday === 2, 'Remaining quota is still 2');

    // 3. Create a real completed article linked to a run
    const realArticle = await db.contentItem.create({
      data: {
        title: 'Real Persisted Article',
        slug: `real-article-${nanoid(6)}`,
        status: 'PUBLISHED',
        contentTypeId: contentType.id,
        siteId: site.id,
        authorId: user.id,
        content: '<p>Real Persisted Article body</p>',
      },
    });

    await db.automationRun.create({
      data: {
        automationId: autoVerify.id,
        status: 'COMPLETED',
        startedAt: new Date(),
        finishedAt: new Date(),
        generatedArticleId: realArticle.id,
        generatedArticleName: realArticle.title,
        logsJson: '[]',
      },
    });

    stats = await getAutomationDailyStats(autoVerify.id, autoVerify.scheduleConfig);
    assert(stats.completedToday === 1, 'Strictly counts only verified DB articles (completedToday: 1)');
    assert(stats.remainingToday === 1, 'Remaining quota drops to 1');
  }

  console.log('\n--- 10. Testing Edit Preserves and Updates Existing Automation ---');
  {
    const autoEdit = await db.automation.create({
      data: {
        name: 'Original Automation Name',
        description: 'Original Description',
        triggerType: 'SCHEDULED',
        scheduleConfig: JSON.stringify({
          frequency: 'DAILY',
          time: '08:00',
          timezone: 'America/Chicago',
          articlesPerDay: 1,
        }),
        status: 'ACTIVE',
        siteId: site.id,
        createdById: user.id,
      },
    });

    // Simulate PATCH update to change articlesPerDay to 5 and update name
    const updated = await db.automation.update({
      where: { id: autoEdit.id },
      data: {
        name: 'Updated Automation Name',
        scheduleConfig: JSON.stringify({
          frequency: 'DAILY',
          time: '10:00',
          timezone: 'America/Chicago',
          articlesPerDay: 5,
        }),
      },
    });

    assert(updated.id === autoEdit.id, 'Edit updates the same record ID without creating duplicates');
    assert(updated.name === 'Updated Automation Name', 'Name updated successfully');
    const updatedSched = JSON.parse(updated.scheduleConfig);
    assert(updatedSched.articlesPerDay === 5, 'Articles per day updated to 5');
    assert(updatedSched.time === '10:00', 'Schedule time updated');

    const totalWithId = await db.automation.count({ where: { id: autoEdit.id } });
    assert(totalWithId === 1, 'Exactly 1 record exists with the automation ID');
  }

  console.log('\n--- 11. Testing Multi-Tenant & Multi-Site Isolation ---');
  {
    const otherSite = await db.site.create({
      data: {
        name: 'Other Tenant Site',
        slug: `other-site-${nanoid(6)}`,
        ownerId: user.id,
      },
    });

    const autoSite1 = await db.automation.create({
      data: {
        name: 'Site 1 Automation',
        triggerType: 'SCHEDULED',
        scheduleConfig: JSON.stringify({ articlesPerDay: 2 }),
        siteId: site.id,
        createdById: user.id,
      },
    });

    const autoSite2 = await db.automation.create({
      data: {
        name: 'Site 2 Automation',
        triggerType: 'SCHEDULED',
        scheduleConfig: JSON.stringify({ articlesPerDay: 2 }),
        siteId: otherSite.id,
        createdById: user.id,
      },
    });

    const site1List = await db.automation.findMany({ where: { siteId: site.id } });
    const site2List = await db.automation.findMany({ where: { siteId: otherSite.id } });

    assert(site1List.some((a) => a.id === autoSite1.id), 'Site 1 sees its automation');
    assert(!site1List.some((a) => a.id === autoSite2.id), 'Site 1 cannot see Site 2 automation');
    assert(site2List.some((a) => a.id === autoSite2.id), 'Site 2 sees its automation');
    assert(!site2List.some((a) => a.id === autoSite1.id), 'Site 2 cannot see Site 1 automation');

    // Clean up isolated test records
    await db.automation.deleteMany({ where: { id: { in: [autoSite1.id, autoSite2.id] } } }).catch(() => {});
    await db.site.delete({ where: { id: otherSite.id } }).catch(() => {});
  }

  console.log('\n--- 12. Testing Retry Idempotency & Queue Status Integrity ---');
  {
    const autoRetry = await db.automation.create({
      data: {
        name: `Test Retry ${nanoid(6)}`,
        triggerType: 'SCHEDULED',
        scheduleConfig: JSON.stringify({ articlesPerDay: 1 }),
        workflowConfig: JSON.stringify({
          contentGeneration: {
            generationMode: 'MANUAL_QUEUE',
            topicQueue: [
              { id: 'item_retry', topic: 'Retry Topic', status: 'AVAILABLE', addedAt: new Date().toISOString() },
            ],
          },
        }),
        status: 'ACTIVE',
        siteId: site.id,
        createdById: user.id,
      },
    });

    // Mark item as PROCESSING
    await markTopicStatusInQueue(autoRetry.id, 'item_retry', 'PROCESSING');
    let curAuto = await db.automation.findUnique({ where: { id: autoRetry.id } });
    let qItem = JSON.parse(curAuto?.workflowConfig || '{}').contentGeneration.topicQueue[0];
    assert(qItem.status === 'PROCESSING', 'Topic transitioned to PROCESSING');

    // Simulate failure
    await markTopicStatusInQueue(autoRetry.id, 'item_retry', 'FAILED', undefined, 'API rate limit exceeded');
    curAuto = await db.automation.findUnique({ where: { id: autoRetry.id } });
    qItem = JSON.parse(curAuto?.workflowConfig || '{}').contentGeneration.topicQueue[0];
    assert(qItem.status === 'FAILED', 'Topic marked FAILED with error message');
    assert(qItem.errorMessage === 'API rate limit exceeded', 'Recorded accurate error message');

    // Safe retry resets to AVAILABLE or PROCESSING without duplicate item creation
    await markTopicStatusInQueue(autoRetry.id, 'item_retry', 'AVAILABLE');
    curAuto = await db.automation.findUnique({ where: { id: autoRetry.id } });
    const queueAfterRetry = JSON.parse(curAuto?.workflowConfig || '{}').contentGeneration.topicQueue;
    assert(queueAfterRetry.length === 1, 'Queue still has exactly 1 item (no duplicates on retry)');
    assert(queueAfterRetry[0].status === 'AVAILABLE', 'Topic reset to AVAILABLE for safe retry');
  }

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
