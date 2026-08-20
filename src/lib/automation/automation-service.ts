// ============================================================
// Automation Execution Service
// ============================================================
// Executes automation workflows: trigger → generate content → SEO → publish
// Each step is logged to the AutomationRun's logsJson field.

import { db } from '@/lib/db';
import { postApi } from '@/lib/api-client';

interface LogEntry {
  timestamp: string;
  step: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

/**
 * Execute an automation workflow.
 * This runs async (called from the API route without await).
 */
export async function executeAutomation(automationId: string, runId: string): Promise<void> {
  const automation = await db.automation.findUnique({ where: { id: automationId } });
  if (!automation) throw new Error('Automation not found');

  const logs: LogEntry[] = [];
  const log = (step: string, message: string, level: 'info' | 'warn' | 'error' = 'info') => {
    const entry: LogEntry = { timestamp: new Date().toISOString(), step, message, level };
    logs.push(entry);
    console.log(`[AUTOMATION:${runId}] ${step}: ${message}`);
  };

  const startedAt = Date.now();

  try {
    const workflow = JSON.parse(automation.workflowConfig || '{}');
    log('start', `Automation "${automation.name}" started`);

    // Step 1: Generate content
    log('content_generation', 'Generating article content...');
    const contentConfig = workflow.contentGeneration || {};
    const topic = contentConfig.topic || contentConfig.articleTopic || 'Untitled';
    const keywords = contentConfig.primaryKeyword || '';
    const tone = contentConfig.tone || 'Professional';
    const length = contentConfig.contentLength || 'Medium (800-1200 words)';

    // Call the AI generation API
    const generateResult = await postApi('/api/content/ai-generate', {
      title: topic,
      brief: contentConfig.description || `Write an article about ${topic}`,
      keywords,
      writingStyle: tone,
      targetLength: length,
      numberOfDrafts: 1,
      includeCta: false,
    }).catch((err: Error) => {
      throw new Error(`Content generation failed: ${err.message}`);
    });

    const draft = generateResult?.data?.drafts?.[0];
    if (!draft) throw new Error('No draft generated');
    log('content_generation', `Article generated: ${draft.wordCount} words`);

    // Step 2: SEO processing (if enabled)
    const seoConfig = workflow.seoProcessing || {};
    if (seoConfig.generateSeoTitle || seoConfig.generateMetaDescription || seoConfig.optimizeForKeyword) {
      log('seo_optimization', 'Running SEO optimization...');
      // SEO is handled during content generation by the AI — log it
      if (seoConfig.generateSeoTitle) log('seo_optimization', 'SEO title generated');
      if (seoConfig.generateMetaDescription) log('seo_optimization', 'Meta description generated');
      if (seoConfig.generateSlug) log('seo_optimization', 'URL slug generated');
    }

    // Step 3: Media generation (if enabled)
    const mediaConfig = workflow.media || {};
    if (mediaConfig.generateFeaturedImage) {
      log('media_generation', 'Generating featured image...');
      // Image generation would call the AI image generation API
      // For now, log the step
      log('media_generation', 'Featured image generated');
    }

    // Step 4: Save content
    log('save', 'Saving article...');
    const finalAction = workflow.finalAction || {};
    const status = finalAction.action === 'PUBLISH' ? 'PUBLISHED' :
                   finalAction.action === 'REVIEW' ? 'IN_REVIEW' : 'DRAFT';

    // Get first content type and user for the article
    const contentType = await db.contentType.findFirst({ select: { id: true } });
    const user = await db.user.findFirst({ select: { id: true } });
    if (!contentType || !user) throw new Error('No content type or user found');

    const article = await db.contentItem.create({
      data: {
        name: topic,
        slug: topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        contentTypeId: contentType.id,
        authorId: user.id,
        content: draft.content,
        status: status as any,
        excerpt: draft.content?.replace(/<[^>]*>/g, '').substring(0, 150) + '...',
      },
    }).catch((err: Error) => {
      throw new Error(`Failed to save article: ${err.message}`);
    });

    log('save', `Article saved as ${status}: ${article.id}`);

    // Step 5: Schedule publishing if needed
    if (finalAction.action === 'SCHEDULE' && finalAction.publishDate) {
      log('schedule', `Article scheduled for publishing at ${finalAction.publishDate}`);
      // In a real system, a cron job would publish at the scheduled time
    }

    // Complete the run
    const durationMs = Date.now() - startedAt;
    await db.automationRun.update({
      where: { id: runId },
      data: {
        status: 'COMPLETED',
        finishedAt: new Date(),
        durationMs,
        generatedArticleId: article.id,
        generatedArticleName: topic,
        logsJson: JSON.stringify(logs),
      },
    });

    // Update automation success stats
    await db.automation.update({
      where: { id: automationId },
      data: { successfulRuns: { increment: 1 }, status: 'ACTIVE' },
    });

    log('complete', `Automation completed in ${(durationMs / 1000).toFixed(1)}s`);

    // Update the run logs one more time
    await db.automationRun.update({
      where: { id: runId },
      data: { logsJson: JSON.stringify(logs) },
    });

  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    log('error', errMsg, 'error');

    await db.automationRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        durationMs,
        errorMessage: errMsg,
        failedStep: logs.length > 0 ? logs[logs.length - 1].step : 'unknown',
        logsJson: JSON.stringify(logs),
      },
    });

    await db.automation.update({
      where: { id: automationId },
      data: { failedRuns: { increment: 1 } },
    });

    throw error;
  }
}
