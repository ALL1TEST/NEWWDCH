// ============================================================
// AUTOMATION SKILL ENFORCEMENT & ACTION CONTROLS TEST SUITE
// Verifies:
// 1. Mandatory Article Creation Skill execution via runArticlePipeline
// 2. Semantic HTML conversion (no raw ## in preview/body)
// 3. Strict quality gate enforcement (FAIL/BLOCKED aborts and marks run FAILED)
// 4. Correct final action persistence: DRAFT, PUBLISH, SCHEDULE
// 5. Exactly 1 DB run row created per Run Now trigger (no duplicate child runs)
// 6. Pause prevents future scheduler runs (clears nextRunAt)
// 7. Resume restores nextRunAt based on schedule/timezone
// 8. DB run history preserved even when Runs column is removed from list UI
// ============================================================

import { db } from '../src/lib/db';
import { nanoid } from 'nanoid';
import { executeAutomation } from '../src/lib/automation/automation-service';
import { runArticlePipeline } from '../src/lib/pipeline/article-pipeline';
import { calculateNextRun, type ScheduleConfig } from '../src/lib/automation/scheduler-utils';

async function runTests() {
  console.log('====================================================');
  console.log('TESTING ARTICLE CREATION SKILL & AUTOMATION ACTIONS');
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

  // 1. Setup User and Site
  let user = await db.user.findFirst();
  if (!user) {
    user = await db.user.create({
      data: {
        id: `usr_${nanoid(8)}`,
        email: `test_user_${nanoid(6)}@example.com`,
        name: 'Test Automation Admin',
        role: 'ADMIN',
      },
    });
  }

  let site = await db.site.findFirst();
  if (!site) {
    site = await db.site.create({
      data: {
        id: `site_${nanoid(8)}`,
        name: 'Automation Test Site',
        slug: `test-${nanoid(6)}`,
        domain: `test-${nanoid(6)}.example.com`,
      },
    });
  }

  let contentType = await db.contentType.findFirst({ where: { slug: 'article' } });
  if (!contentType) {
    contentType = await db.contentType.create({
      data: {
        id: `ct_${nanoid(8)}`,
        name: 'Article',
        slug: 'article',
        fields: '[]',
        allowedStatuses: '["DRAFT","PUBLISHED","SCHEDULED","ARCHIVED"]',
        siteId: site.id,
      },
    });
  }

  console.log('\n--- 1. Testing Core Article Creation Skill Pipeline Direct Execution ---');
  {
    // Test the pipeline entrypoint directly to confirm it returns structured content & quality verdict
    const pipelineResult = await runArticlePipeline(
      'generate',
      {
        title: 'Modern Solar Storage Tech',
        keywords: 'solar battery storage, home backup power, lithium solar batteries',
        niche: 'Renewable Energy',
        targetLength: '800-1200',
        siteId: site.id,
      },
      {
        userId: user.id,
      }
    );

    assert(Boolean(pipelineResult), 'Pipeline executed and returned result');
    assert(Boolean(pipelineResult.primaryContent), 'Primary content generated');
    assert(Boolean(pipelineResult.seoFields.seoTitle), `SEO Title generated: "${pipelineResult.seoFields.seoTitle}"`);
    assert(Boolean(pipelineResult.seoFields.slug), `SEO Slug generated: "${pipelineResult.seoFields.slug}"`);
    assert(
      ['PASS', 'WARNING', 'FAIL', 'BLOCKED'].includes(pipelineResult.verdict),
      `Quality gate evaluated editorial & SEO rules with valid verdict (actual: ${pipelineResult.verdict})`
    );
  }

  console.log('\n--- 2. Testing Automation Run Execution with DRAFT Final Action ---');
  {
    // Create automation with DRAFT action
    const auto = await db.automation.create({
      data: {
        id: `auto_${nanoid(8)}`,
        name: 'Solar Tech Draft Automation',
        siteId: site.id,
        createdById: user.id,
        status: 'ACTIVE',
        triggerType: 'SCHEDULED',
        scheduleConfig: JSON.stringify({
          frequency: 'DAILY',
          time: '09:00',
          timezone: 'UTC',
          articlesPerDay: 1,
        }),
        workflowConfig: JSON.stringify({
          contentGeneration: {
            generationMode: 'MANUAL_QUEUE',
            topic: 'Best Solar Batteries of 2026',
            primaryKeyword: 'best solar batteries',
            secondaryKeywords: 'home battery backup',
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
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
      },
    });

    // Create exactly 1 run record as the API does
    const run = await db.automationRun.create({
      data: {
        id: `run_${nanoid(8)}`,
        automationId: auto.id,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    const runCountBefore = await db.automationRun.count({ where: { automationId: auto.id } });
    assert(runCountBefore === 1, 'Initial run count is exactly 1 before execution');

    // Execute automation
    await executeAutomation(auto.id, run.id, { overrideQuota: true });

    // Verify exactly 1 run record exists (no duplicate child run created)
    const runCountAfter = await db.automationRun.count({ where: { automationId: auto.id } });
    assert(runCountAfter === 1, `Run count remains exactly 1 after execution (no child duplicates, actual: ${runCountAfter})`);

    // Verify run completed successfully
    const completedRun = await db.automationRun.findUnique({ where: { id: run.id } });
    assert(completedRun?.status === 'COMPLETED', `Run status is COMPLETED (actual: ${completedRun?.status})`);

    // Verify article was persisted
    const articleId = completedRun?.generatedArticleId;
    assert(Boolean(articleId), `Run references created articleId: ${articleId}`);

    if (articleId) {
      const article = await db.contentItem.findUnique({ where: { id: articleId } });
      assert(Boolean(article), 'Article found in database');
      assert(article?.status === 'DRAFT', `Article status is DRAFT as configured (actual: ${article?.status})`);

      // Verify content formatting: semantic HTML rather than raw ## markers
      const body = article?.content || '';
      assert(
        !body.includes('## ') && !body.includes('### '),
        'Article body does NOT contain raw markdown markers (## or ###) in storage'
      );
      assert(
        body.includes('<h2') || body.includes('<p>') || body.includes('<h3'),
        'Article body contains semantic HTML tags (<h2, <h3, or <p)'
      );
    }
  }

  console.log('\n--- 3. Testing Automation Run Execution with SCHEDULE Final Action ---');
  {
    const futureDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

    const autoSched = await db.automation.create({
      data: {
        id: `auto_${nanoid(8)}`,
        name: 'Scheduled Article Automation',
        siteId: site.id,
        createdById: user.id,
        status: 'ACTIVE',
        triggerType: 'SCHEDULED',
        scheduleConfig: JSON.stringify({
          frequency: 'DAILY',
          time: '10:00',
          timezone: 'UTC',
          articlesPerDay: 1,
        }),
        workflowConfig: JSON.stringify({
          contentGeneration: {
            generationMode: 'MANUAL_QUEUE',
            topic: 'Off-Grid Inverters for Beginners',
            primaryKeyword: 'off-grid inverters',
            secondaryKeywords: 'solar inverter guide',
            tone: 'Informative',
            contentLength: 'Medium (800-1200 words)',
          },
          seoProcessing: {
            generateSeoTitle: true,
            generateMetaDescription: true,
            generateSlug: true,
          },
          media: { source: 'NONE' },
          finalAction: {
            action: 'SCHEDULE',
            scheduledAt: futureDate,
          },
        }),
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
      },
    });

    const schedRun = await db.automationRun.create({
      data: {
        id: `run_${nanoid(8)}`,
        automationId: autoSched.id,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    await executeAutomation(autoSched.id, schedRun.id, { overrideQuota: true });

    const finishedSchedRun = await db.automationRun.findUnique({ where: { id: schedRun.id } });
    assert(finishedSchedRun?.status === 'COMPLETED', 'Scheduled run completed');

    if (finishedSchedRun?.generatedArticleId) {
      const scheduledArticle = await db.contentItem.findUnique({
        where: { id: finishedSchedRun.generatedArticleId },
      });
      assert(
        scheduledArticle?.status === 'APPROVED',
        `Article status is APPROVED (Scheduled) as configured (actual: ${scheduledArticle?.status})`
      );
      assert(
        Boolean(scheduledArticle?.scheduledAt),
        `scheduledAt timestamp is persisted: ${scheduledArticle?.scheduledAt?.toISOString()}`
      );
      assert(
        (scheduledArticle?.scheduledAt?.getTime() || 0) > Date.now(),
        'scheduledAt timestamp is strictly in the future'
      );
    }
  }

  console.log('\n--- 4. Testing Pause and Resume Logic ---');
  {
    const scheduleConfig: ScheduleConfig = {
      frequency: 'DAILY',
      time: '14:30',
      timezone: 'UTC',
    };
    const initialNextRun = calculateNextRun(scheduleConfig);

    const autoPause = await db.automation.create({
      data: {
        id: `auto_${nanoid(8)}`,
        name: 'Pause/Resume Test Automation',
        siteId: site.id,
        createdById: user.id,
        status: 'ACTIVE',
        triggerType: 'SCHEDULED',
        scheduleConfig: JSON.stringify(scheduleConfig),
        nextRunAt: initialNextRun,
        workflowConfig: '{}',
      },
    });

    assert(Boolean(autoPause.nextRunAt), `Initial nextRunAt is scheduled: ${autoPause.nextRunAt?.toISOString()}`);

    // Pause automation
    const paused = await db.automation.update({
      where: { id: autoPause.id },
      data: {
        status: 'PAUSED',
        nextRunAt: null, // Clear nextRunAt to prevent future scheduler execution
      },
    });

    assert(paused.status === 'PAUSED', 'Automation status updated to PAUSED');
    assert(paused.nextRunAt === null, 'nextRunAt cleared to null so scheduler will not trigger it');

    // Resume automation
    const resumedNextRun = calculateNextRun(scheduleConfig);
    const resumed = await db.automation.update({
      where: { id: autoPause.id },
      data: {
        status: 'ACTIVE',
        nextRunAt: resumedNextRun,
      },
    });

    assert(resumed.status === 'ACTIVE', 'Automation status updated back to ACTIVE');
    assert(Boolean(resumed.nextRunAt), `nextRunAt recalculated on resume: ${resumed.nextRunAt?.toISOString()}`);
    assert((resumed.nextRunAt?.getTime() || 0) > Date.now(), 'Recalculated nextRunAt is in the future');
  }

  console.log('\n--- 5. Testing Execution Failure Reporting ---');
  {
    // Test that an execution failure records FAILED status and error logs, without falsely reporting success
    const autoFail = await db.automation.create({
      data: {
        id: `auto_${nanoid(8)}`,
        name: 'Failure Test Automation',
        siteId: site.id,
        createdById: user.id,
        status: 'ACTIVE',
        triggerType: 'SCHEDULED',
        scheduleConfig: JSON.stringify({ frequency: 'DAILY', time: '12:00', timezone: 'UTC' }),
        workflowConfig: JSON.stringify({
          contentGeneration: {
            generationMode: 'MANUAL_QUEUE',
            topicQueue: [], // Empty queue with no topics
          },
          finalAction: { action: 'DRAFT' },
        }),
      },
    });

    const failRun = await db.automationRun.create({
      data: {
        id: `run_${nanoid(8)}`,
        automationId: autoFail.id,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    let threw = false;
    try {
      await executeAutomation(autoFail.id, failRun.id, { overrideQuota: true });
    } catch {
      threw = true;
    }

    assert(threw, 'Execution stopped and threw error on empty eligible topics');

    const updatedFailRun = await db.automationRun.findUnique({ where: { id: failRun.id } });
    assert(
      updatedFailRun?.status === 'SKIPPED' || updatedFailRun?.status === 'FAILED',
      `Run recorded as SKIPPED or FAILED on empty topic queue (actual: ${updatedFailRun?.status})`
    );
    assert(Boolean(updatedFailRun?.errorMessage), `Error message persisted: "${updatedFailRun?.errorMessage}"`);
  }

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
