// ============================================================
// Automation Execution Service — Blog Automation Engine
// ============================================================
// Executes end-to-end automation workflows:
// 1. VALIDATION: Validate configuration, ownership, and multi-tenant scoping
// 2. DAILY QUOTA: Calculate remaining daily quota in configured timezone
// 3. TOPIC SELECTION: Atomically reserve required number of eligible topics (Mode A / Mode B)
// 4. CHILD TASK TRACKING: Track each article generation as an individual child execution
// 5. PIPELINE EXECUTION: For each topic, run Research, Outline, Generation, SEO, Media, Linking, Validation, Persistence
// 6. METRICS & COUNTERS: Update daily counters and verify persistence
// ============================================================

import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { calculateNextRun, getAutomationDailyStats } from './scheduler-utils';
import { resolveKeywords, performCompetitorResearch } from './research-service';
import { generateArticleOutline, formatOutlineToPrompt } from './outline-service';
import { discoverEligibleInternalLinks, injectInternalLinks } from './internal-linking';
import { runPreFlightValidation } from './validation-service';
import {
  reserveBatchTopicsForAutomation,
  completeTopicQueueItem,
  failTopicQueueItem,
  ResolvedTopicResult,
} from './topic-service';

export interface LogEntry {
  timestamp: string;
  step: string;
  message: string;
  level: 'info' | 'warn' | 'error';
  parentRunId?: string;
  childRunId?: string;
}

const ASPECT_MAP: Record<string, string> = {
  '1:1': '1024x1024',
  '16:9': '1344x768',
  '9:16': '768x1344',
  '4:3': '1152x864',
  '3:4': '864x1152',
};

const LENGTH_MAP: Record<string, string> = {
  'Short (300-600 words)': '300-600',
  'Medium (800-1200 words)': '800-1200',
  'Long (1500-2500 words)': '1500-2500',
  'Comprehensive (3000+ words)': '3000+',
};

export function sanitizeErrorMessage(err: unknown): string {
  if (!err) return 'Unknown execution error';
  let message = err instanceof Error ? err.message : String(err);
  // Redact potential API keys or authorization tokens
  message = message.replace(/(?:Bearer\s+|key=|[a-z0-9_-]{0,10}api[-_]?key[:=\s]+)[a-zA-Z0-9_\-\.]{8,}/gi, '[REDACTED_KEY]');
  // Redact internal file system paths
  message = message.replace(/[a-zA-Z]:\\[^:\n\r\t]+|\/(?:home|Users|var|tmp)\/[^\s:]+/g, '[INTERNAL_PATH]');
  // Strip node stack traces
  if (message.includes('\n    at ')) {
    message = message.split('\n    at ')[0].trim();
  }
  return message.slice(0, 500).trim();
}

/**
 * Execute an individual article generation workflow for a specific topic.
 * Persists child execution logs and updates individual article record.
 */
async function executeSingleArticle(params: {
  automationId: string;
  childRunId: string;
  parentRunId: string;
  index: number;
  total: number;
  resolvedTopic: ResolvedTopicResult;
  articleSiteId: string;
  userId: string;
  workflow: any;
  automationName: string;
  approvedOutline?: any;
}): Promise<{
  success: boolean;
  articleId?: string;
  articleTitle?: string;
  error?: string;
  pausedForApproval?: boolean;
  outline?: any;
}> {
  const {
    automationId,
    childRunId,
    parentRunId,
    index,
    total,
    resolvedTopic,
    articleSiteId,
    userId,
    workflow,
    automationName,
    approvedOutline,
  } = params;

  const startedAt = Date.now();
  const logs: LogEntry[] = [];
  let currentStep = 'start';
  const topic = resolvedTopic.topic;
  const queueItemId = resolvedTopic.queueItemId;

  const log = async (step: string, message: string, level: 'info' | 'warn' | 'error' = 'info') => {
    currentStep = step;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      step,
      message,
      level,
      parentRunId,
      childRunId,
    };
    logs.push(entry);
    console.log(`[AUTOMATION:${childRunId}] [${step}] [Task ${index}/${total}] ${message}`);
    await db.automationRun
      .update({
        where: { id: childRunId },
        data: { logsJson: JSON.stringify(logs) },
      })
      .catch(() => {});
  };

  try {
    await log('init', `Starting article generation ${index} of ${total}: "${topic}"`);

    const contentConfig = workflow.contentGeneration || {};
    const topicDiscovery = contentConfig.topicDiscovery || {};
    const targetCountry = topicDiscovery.country || contentConfig.country || undefined;
    const targetLanguage = topicDiscovery.language || contentConfig.language || 'English (US)';

    // ----------------------------------------------------
    // STAGE 1: KEYWORD & COMPETITOR RESEARCH
    // ----------------------------------------------------
    await log('research', 'Resolving keyword strategy and competitor insights...');

    const keywordRes = await resolveKeywords(
      topic,
      {
        ...contentConfig,
        primaryKeyword: resolvedTopic.primaryKeyword || contentConfig.primaryKeyword,
        secondaryKeywords:
          resolvedTopic.secondaryKeywords.length > 0
            ? resolvedTopic.secondaryKeywords.join(', ')
            : contentConfig.secondaryKeywords,
      },
      articleSiteId,
      userId
    );

    await log(
      'research',
      `Keyword strategy resolved (${keywordRes.source}): Primary: "${keywordRes.primaryKeyword}" | Secondary: ${keywordRes.secondaryKeywords.length > 0 ? keywordRes.secondaryKeywords.join(', ') : 'None'}`
    );

    const competitorResearchEnabled = contentConfig.competitorResearchEnabled === true;
    const competitorRes = await performCompetitorResearch(
      keywordRes.primaryKeyword,
      topic,
      competitorResearchEnabled,
      {
        country: targetCountry,
        language: targetLanguage,
      }
    );

    if (competitorRes.available) {
      await log(
        'research',
        `Live SERP competitor research completed via ${competitorRes.provider}: Found ${competitorRes.pages.length} ranking pages.`
      );
    } else {
      await log(
        'research',
        `Competitor research note: ${competitorRes.skippedReason || 'Skipped. Proceeding with intent-based outline.'}`,
        'info'
      );
    }

    // ----------------------------------------------------
    // STAGE 2: OUTLINE GENERATION OR APPROVAL RESUMPTION
    // ----------------------------------------------------
    let generatedOutline = approvedOutline;

    if (!generatedOutline) {
      await log('outline', 'Generating structured, original article outline...');

      const rawTone = contentConfig.tone || 'Professional';
      const rawLength = contentConfig.contentLength || 'Medium (800-1200 words)';
      const wordCount = LENGTH_MAP[rawLength] || rawLength;
      const struct = contentConfig.articleStructure || {};

      generatedOutline = await generateArticleOutline({
        topic,
        primaryKeyword: keywordRes.primaryKeyword,
        secondaryKeywords: keywordRes.secondaryKeywords,
        tone: rawTone,
        targetLength: wordCount,
        language: targetLanguage,
        structure: {
          introduction: struct.introduction !== false,
          tableOfContents: struct.tableOfContents === true,
          h2Sections: struct.h2Sections !== false,
          h3Subsections: struct.h3Subsections !== false,
          faqSection: struct.faqSection === true,
          conclusion: struct.conclusion !== false,
        },
        competitorResearch: competitorRes.available ? competitorRes : null,
        userId,
      });

      // If user requires outline approval before writing, pause run here!
      if (contentConfig.outlineStrategy === 'REVIEW') {
        await log(
          'outline_approval',
          `Outline generated: "${generatedOutline.title || topic}" (${generatedOutline.sections.length} sections). Execution paused awaiting user approval.`
        );

        await db.automationRun.update({
          where: { id: childRunId },
          data: {
            status: 'AWAITING_APPROVAL',
            errorMessage: 'Outline approval required before generating article content.',
            failedStep: null,
            logsJson: JSON.stringify([
              ...logs,
              {
                timestamp: new Date().toISOString(),
                step: 'outline_payload',
                message: JSON.stringify({
                  outline: generatedOutline,
                  topic,
                  primaryKeyword: keywordRes.primaryKeyword,
                  secondaryKeywords: keywordRes.secondaryKeywords,
                }),
                level: 'info',
              },
            ]),
          },
        });

        return {
          success: false,
          pausedForApproval: true,
          outline: generatedOutline,
          articleTitle: generatedOutline.title || topic,
        };
      }
    } else {
      await log('outline', `Resuming article generation using approved outline: "${generatedOutline.title || topic}"`);
    }

    const outlinePromptBlock = formatOutlineToPrompt(generatedOutline);
    await log(
      'outline',
      `Outline resolved: ${generatedOutline.sections.length} sections (${generatedOutline.sections.map((s: any) => s.heading).slice(0, 3).join(' / ')}...)`
    );

    // ----------------------------------------------------
    // STAGE 3: ARTICLE GENERATION VIA CENTRALIZED PIPELINE
    // ----------------------------------------------------
    await log('article_generation', 'Generating complete article content via pipeline...');

    const rawTone = contentConfig.tone || 'Professional';
    const rawLength = contentConfig.contentLength || 'Medium (800-1200 words)';
    const wordCount = LENGTH_MAP[rawLength] || rawLength;

    const briefCombined = [
      contentConfig.description || `Comprehensive, original editorial guide on ${topic}.`,
      outlinePromptBlock,
    ]
      .filter(Boolean)
      .join('\n\n');

    const { runArticlePipeline } = await import('@/lib/pipeline/article-pipeline');
    const { markdownToEditorHtml } = await import('@/lib/pipeline/markdown-to-html');

    const detectedNiche = contentConfig.niche || contentConfig.topicDiscovery?.niche || undefined;
    const pipelineResult = await runArticlePipeline(
      'generate',
      {
        title: generatedOutline.title || topic,
        brief: briefCombined,
        keywords: keywordRes.resolvedKeywordsString,
        writingStyle: rawTone,
        targetLength: wordCount,
        siteId: articleSiteId,
        niche: detectedNiche,
        language: targetLanguage,
      },
      {
        userId,
        interactive: false,
      }
    );

    if (!pipelineResult.success || pipelineResult.verdict === 'FAIL' || pipelineResult.verdict === 'BLOCKED') {
      const issueSummary = [
        ...pipelineResult.editorialReport.issues.filter((i) => i.result === 'FAIL').map((i) => `${i.id}: ${i.problem}`),
        ...pipelineResult.seoReport.issues.filter((i) => i.severity === 'CRITICAL').map((i) => `${i.check}: ${i.problem}`),
      ].join('; ');
      throw new Error(`Article Creation Skill quality gate failed (${pipelineResult.verdict}): ${issueSummary || pipelineResult.warnings.join('; ') || 'Editorial standards not met'}`);
    }

    let cleanContent = pipelineResult.htmlContent || (pipelineResult.drafts[0]?.content ? markdownToEditorHtml(pipelineResult.drafts[0].content) : markdownToEditorHtml(pipelineResult.primaryContent));
    const calculatedWordCount = cleanContent.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
    await log(
      'article_generation',
      `Article content generated successfully via Article Creation Skill (~${calculatedWordCount} words, verdict: ${pipelineResult.verdict})`
    );

    // ----------------------------------------------------
    // STAGE 4: SEO METADATA OPTIMIZATION
    // ----------------------------------------------------
    await log('seo_optimization', 'Processing SEO metadata and structured data...');

    const seoConfig = workflow.seoProcessing || {};
    const seoTitle =
      seoConfig.generateSeoTitle !== false
        ? pipelineResult.seoFields.seoTitle || generatedOutline.title || topic
        : topic;

    const seoDescription =
      seoConfig.generateMetaDescription !== false
        ? pipelineResult.seoFields.seoDescription || null
        : null;

    const baseSlug =
      seoConfig.generateSlug !== false && pipelineResult.seoFields.slug
        ? pipelineResult.seoFields.slug
        : topic
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'article';

    const focusKeyword =
      seoConfig.optimizePrimaryKeyword !== false
        ? keywordRes.primaryKeyword || pipelineResult.seoFields.focusKeyword || null
        : null;

    const hasActualFaq =
      cleanContent.toLowerCase().includes('faq') ||
      cleanContent.toLowerCase().includes('frequently asked questions') ||
      (generatedOutline.faqQuestions && generatedOutline.faqQuestions.length > 0);

    const includeSchema =
      seoConfig.generateArticleSchema !== false || (seoConfig.generateFaqSchema === true && hasActualFaq);

    // ----------------------------------------------------
    // STAGE 5: MEDIA ASSET RESOLUTION OR GENERATION
    // ----------------------------------------------------
    const mediaConfig = workflow.media || {};
    let featuredImageId: string | null = null;
    let featuredImageUrl: string | null = null;
    const generatedSectionImages: { id: string; url: string; alt: string; heading?: string }[] = [];

    if (mediaConfig.source === 'AI_GENERATE') {
      await log('media_generation', 'Generating media assets using AI image service...');

      const { resolveAiProviderForUser } = await import('@/lib/ai/platform-ai');
      const imageProvider = await resolveAiProviderForUser(userId, 'IMAGE');
      if (imageProvider) {
        const { executeImageGeneration } = await import('@/lib/ai/ai-service');
        const imgStyle = mediaConfig.imageStyle || 'Professional';
        const imgTone = mediaConfig.imageTone || 'Modern';
        const imgInstructions = mediaConfig.imagePromptInstructions || '';
        const size = ASPECT_MAP[mediaConfig.aspectRatio || '16:9'] || '1344x768';

        if (mediaConfig.generateFeaturedImage !== false) {
          try {
            const featuredPrompt = `${topic}, ${keywordRes.primaryKeyword}, ${imgInstructions}, style: ${imgStyle}, tone: ${imgTone}, photorealistic, editorial`;
            const imgRes = await executeImageGeneration({
              providerId: imageProvider.id,
              prompt: featuredPrompt,
              size: size as any,
              n: 1,
              responseFormat: 'b64_json',
              siteId: articleSiteId,
              userId,
            });

            if (imgRes.images && imgRes.images.length > 0) {
              const img = imgRes.images[0];
              const base64Url = img.b64_json
                ? img.b64_json.startsWith('data:')
                  ? img.b64_json
                  : `data:image/png;base64,${img.b64_json}`
                : img.url || '';

              const descriptiveAlt = `${topic} — ${keywordRes.primaryKeyword}`;

              const mediaRecord = await db.media.create({
                data: {
                  filename: `ai_${nanoid(8)}_${Date.now()}.png`,
                  originalName: `AI Featured: ${topic.slice(0, 50)}`,
                  mimeType: 'image/png',
                  size: Math.round((base64Url.length * 3) / 4),
                  url: base64Url,
                  alt: descriptiveAlt,
                  folderId: mediaConfig.folderId || null,
                  siteId: articleSiteId,
                  uploadedById: userId,
                  processingStatus: 'READY',
                },
              });

              featuredImageId = mediaRecord.id;
              featuredImageUrl = mediaRecord.url;
              await log('media_generation', `Featured image created (ID: ${mediaRecord.id})`);
            }
          } catch (imgErr) {
            const errDetail = imgErr instanceof Error ? imgErr.message : 'Image error';
            await log('media_generation', `Featured image generation skipped: ${errDetail}`, 'warn');
          }
        }

        if (mediaConfig.generateSectionImages === true) {
          try {
            await log('media_generation', 'Generating section images using AI image service...');
            const requestedCount = Math.max(1, Number(mediaConfig.imageCount) || 1);

            let candidateHeadings: string[] = [];
            if (generatedOutline?.sections && Array.isArray(generatedOutline.sections)) {
              candidateHeadings = generatedOutline.sections
                .map((s: any) => s.heading?.trim())
                .filter((h: string) => {
                  if (!h) return false;
                  const lower = h.toLowerCase();
                  return (
                    !lower.includes('conclusion') &&
                    !lower.includes('summary') &&
                    !lower.includes('faq') &&
                    !lower.includes('frequently asked questions')
                  );
                });
              if (candidateHeadings.length === 0) {
                candidateHeadings = generatedOutline.sections
                  .map((s: any) => s.heading?.trim())
                  .filter(Boolean);
              }
            }

            if (candidateHeadings.length === 0) {
              const matches = Array.from(cleanContent.matchAll(/(?:^|\n)##\s+([^\n]+)|<h2>([^<]+)<\/h2>/g));
              candidateHeadings = matches
                .map((m) => (m[1] || m[2])?.trim())
                .filter(Boolean);
            }

            const targetHeadings = candidateHeadings.slice(0, requestedCount);
            if (targetHeadings.length === 0) {
              await log('media_generation', 'No suitable article sections found for section images; skipped.', 'info');
            } else {
              for (let i = 0; i < targetHeadings.length; i++) {
                const sectionHeading = targetHeadings[i];
                try {
                  const sectionPrompt = `${sectionHeading}, ${topic}, ${imgInstructions ? imgInstructions + ', ' : ''}style: ${imgStyle}, tone: ${imgTone}, photorealistic, editorial, contextual scene`;
                  const secRes = await executeImageGeneration({
                    providerId: imageProvider.id,
                    prompt: sectionPrompt,
                    size: size as any,
                    n: 1,
                    responseFormat: 'b64_json',
                    siteId: articleSiteId,
                    userId,
                  });

                  if (secRes.images && secRes.images.length > 0) {
                    const secImg = secRes.images[0];
                    const base64Url = secImg.b64_json
                      ? secImg.b64_json.startsWith('data:')
                        ? secImg.b64_json
                        : `data:image/png;base64,${secImg.b64_json}`
                      : secImg.url || '';

                    const descriptiveAlt = `${sectionHeading} — ${topic}`;

                    const secRecord = await db.media.create({
                      data: {
                        filename: `ai_sec_${nanoid(8)}_${Date.now()}.png`,
                        originalName: `AI Section: ${sectionHeading.slice(0, 50)}`,
                        mimeType: 'image/png',
                        size: Math.round((base64Url.length * 3) / 4),
                        url: base64Url,
                        alt: descriptiveAlt,
                        folderId: mediaConfig.folderId || null,
                        siteId: articleSiteId,
                        uploadedById: userId,
                        processingStatus: 'READY',
                      },
                    });

                    generatedSectionImages.push({
                      id: secRecord.id,
                      url: secRecord.url,
                      alt: descriptiveAlt,
                      heading: sectionHeading,
                    });
                    await log('media_generation', `Section image created for "${sectionHeading}" (ID: ${secRecord.id})`);
                  } else {
                    await log('media_generation', `No image returned for section "${sectionHeading}"`, 'warn');
                  }
                } catch (secErr: any) {
                  const errDetail = secErr instanceof Error ? secErr.message : 'Image error';
                  await log('media_generation', `Section image generation failed for "${sectionHeading}": ${errDetail}`, 'warn');
                }
              }
            }
          } catch (secTotalErr: any) {
            const errDetail = secTotalErr instanceof Error ? secTotalErr.message : 'Section images error';
            await log('media_generation', `Section image generation pipeline failed: ${errDetail}`, 'warn');
          }
        }
      } else {
        await log('media_generation', 'AI image provider not configured; skipped image generation.', 'info');
      }
    } else if (mediaConfig.source === 'MEDIA_LIBRARY' || mediaConfig.source === 'LOCAL_UPLOAD') {
      await log(
        'media_selection',
        `Resolving media assets from ${mediaConfig.source === 'LOCAL_UPLOAD' ? 'computer uploads' : 'media library'}...`
      );

      try {
        let candidateImages: { id: string; url: string; alt: string | null }[] = [];

        // 1. If explicit image IDs are specified
        if (Array.isArray(mediaConfig.selectedMediaIds) && mediaConfig.selectedMediaIds.length > 0) {
          candidateImages = await db.media.findMany({
            where: {
              id: { in: mediaConfig.selectedMediaIds },
              deletedAt: null,
              mimeType: { startsWith: 'image/' },
              OR: [
                { siteId: articleSiteId || undefined },
                { uploadedById: userId },
              ],
            },
            select: { id: true, url: true, alt: true },
          });
        }

        // 2. If no explicit IDs, load from the selected folder
        if (candidateImages.length === 0 && mediaConfig.folderId) {
          candidateImages = await db.media.findMany({
            where: {
              folderId: mediaConfig.folderId === '__root__' ? null : mediaConfig.folderId,
              deletedAt: null,
              mimeType: { startsWith: 'image/' },
              OR: [
                { siteId: articleSiteId || undefined },
                { uploadedById: userId },
              ],
            },
            take: 20,
            select: { id: true, url: true, alt: true },
          });
        }

        // 3. Fallback: load site library images
        if (candidateImages.length === 0) {
          candidateImages = await db.media.findMany({
            where: {
              deletedAt: null,
              mimeType: { startsWith: 'image/' },
              OR: [
                { siteId: articleSiteId || undefined },
                { uploadedById: userId },
              ],
            },
            take: 10,
            select: { id: true, url: true, alt: true },
          });
        }

        if (candidateImages.length > 0) {
          const chosen = mediaConfig.imageSelectionMode === 'RANDOM'
            ? candidateImages[Math.floor(Math.random() * candidateImages.length)]
            : candidateImages[(index - 1) % candidateImages.length];

          featuredImageId = chosen.id;
          featuredImageUrl = chosen.url;
          await log('media_selection', `Attached media asset to article (ID: ${chosen.id})`);
        } else {
          await log('media_selection', 'No eligible media assets found in library/uploads; proceeding without media.', 'info');
        }
      } catch (mediaErr: any) {
        await log('media_selection', `Media lookup skipped: ${mediaErr?.message || 'Error querying media'}`, 'warn');
      }
    }

    // Embed image into article content
    if (featuredImageUrl) {
      const figureHtml = `<figure class="featured-media my-4"><img src="${featuredImageUrl}" alt="${topic} — ${keywordRes.primaryKeyword}" class="w-full max-h-96 object-cover rounded-lg shadow-sm" /></figure>\n\n`;
      if (!cleanContent.includes(featuredImageUrl)) {
        cleanContent = `${figureHtml}${cleanContent}`;
      }
    }

    if (generatedSectionImages.length > 0) {
      for (const secImg of generatedSectionImages) {
        if (cleanContent.includes(secImg.url)) continue;
        const figureHtml = `\n\n<figure class="section-media my-6"><img src="${secImg.url}" alt="${secImg.alt}" class="w-full max-h-96 object-cover rounded-lg shadow-sm" /></figure>\n\n`;

        let inserted = false;
        if (secImg.heading) {
          const escapedH = secImg.heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const mdRegex = new RegExp(`(^|\\n)(#{1,4}\\s+${escapedH}[^\\n]*)(\\n+)`, 'i');
          const htmlRegex = new RegExp(`(<h[1-4][^>]*>[^<]*${escapedH}[^<]*<\\/h[1-4]>)`, 'i');

          if (mdRegex.test(cleanContent)) {
            cleanContent = cleanContent.replace(mdRegex, `$1$2\n\n${figureHtml.trim()}\n\n`);
            inserted = true;
          } else if (htmlRegex.test(cleanContent)) {
            cleanContent = cleanContent.replace(htmlRegex, `$1\n\n${figureHtml.trim()}\n\n`);
            inserted = true;
          }
        }

        if (!inserted) {
          const anyH2Match = cleanContent.match(/(?:^|\n)(#{2,3}\s+[^\n]+)/);
          if (anyH2Match && anyH2Match.index !== undefined) {
            const insertIdx = anyH2Match.index + anyH2Match[0].length;
            cleanContent = cleanContent.slice(0, insertIdx) + figureHtml + cleanContent.slice(insertIdx);
            inserted = true;
          } else {
            cleanContent = `${cleanContent}${figureHtml}`;
          }
        }
      }
    }

    // ----------------------------------------------------
    // STAGE 6: INTERNAL LINKING
    // ----------------------------------------------------
    await log('linking', 'Scanning published articles for contextual internal links...');
    const internalLinkingEnabled = contentConfig.internalLinkingEnabled !== false;

    if (internalLinkingEnabled && articleSiteId) {
      const candidates = await discoverEligibleInternalLinks(
        articleSiteId,
        undefined,
        topic,
        [keywordRes.primaryKeyword, ...keywordRes.secondaryKeywords]
      );

      if (candidates.length > 0) {
        const linkRes = injectInternalLinks(cleanContent, candidates, 3);
        cleanContent = linkRes.content;
        if (linkRes.linksInjected.length > 0) {
          await log('linking', `Injected ${linkRes.linksInjected.length} internal link(s) to published site content`);
        }
      }
    }

    // ----------------------------------------------------
    // STAGE 7: PRE-FLIGHT VALIDATION
    // ----------------------------------------------------
    await log('validation', 'Performing pre-flight validation...');

    let contentType = null;
    if (articleSiteId) {
      contentType = await db.contentType.findFirst({
        where: {
          siteId: articleSiteId,
          OR: [{ slug: 'article' }, { slug: 'post' }],
        },
        select: { id: true },
      });
    }
    if (!contentType) {
      contentType = await db.contentType.findFirst({
        where: { OR: [{ slug: 'post' }, { slug: 'article' }] },
        select: { id: true },
      });
    }
    if (!contentType) {
      contentType = await db.contentType.findFirst({ select: { id: true } });
    }
    if (!contentType) {
      throw new Error('No ContentType available in database. Please initialize Content Types first.');
    }

    const preFlight = await runPreFlightValidation({
      content: cleanContent,
      topic,
      seoTitle,
      seoDescription,
      slug: baseSlug,
      siteId: articleSiteId,
      contentTypeId: contentType.id,
      featuredImageId,
      schemaJsonLd: includeSchema ? pipelineResult.seoFields.schemaJsonLd : null,
    });

    if (!preFlight.isValid) {
      throw new Error(`Pre-flight validation failed: ${preFlight.criticalErrors.join('; ')}`);
    }

    // ----------------------------------------------------
    // STAGE 8: DATABASE PERSISTENCE & FINAL ACTION
    // ----------------------------------------------------
    await log('persistence', 'Persisting generated article to database...');

    const finalAction = workflow.finalAction || {};
    const requestedAction = (finalAction.action || 'DRAFT').toUpperCase();

    let articleStatus: 'DRAFT' | 'APPROVED' | 'PUBLISHED' = 'DRAFT';
    let publishedAt: Date | null = null;
    let scheduledAt: Date | null = null;

    if (requestedAction === 'PUBLISH') {
      articleStatus = 'PUBLISHED';
      publishedAt = new Date();
    } else if (requestedAction === 'SCHEDULE') {
      articleStatus = 'APPROVED';
      if (finalAction.publishDate) {
        const timePart = finalAction.publishTime || '09:00';
        let candidate = new Date(`${finalAction.publishDate}T${timePart}:00`);
        if (isNaN(candidate.getTime()) || candidate.getTime() <= Date.now()) {
          candidate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        }
        scheduledAt = candidate;
      } else {
        scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
    } else {
      articleStatus = 'DRAFT';
    }

    await log(
      'final_action',
      `Configured final action resolved: ${requestedAction} -> Article status set to ${articleStatus}${scheduledAt ? ` (Scheduled for ${scheduledAt.toISOString()})` : ''}`
    );

    // Ensure unique slug
    let finalSlug = baseSlug;
    const existingWithSlug = await db.contentItem.findFirst({
      where: { slug: finalSlug, contentTypeId: contentType.id, deletedAt: null },
      select: { id: true },
    });
    if (existingWithSlug) {
      finalSlug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
    }

    const finalHtml = markdownToEditorHtml(cleanContent);
    const excerpt = cleanContent.replace(/<[^>]*>/g, '').substring(0, 160).trim() + '...';

    // Idempotency: check if run already has an article
    const existingRun = await db.automationRun.findUnique({
      where: { id: childRunId },
      select: { generatedArticleId: true },
    });

    let article;
    if (existingRun?.generatedArticleId) {
      article = await db.contentItem.update({
        where: { id: existingRun.generatedArticleId },
        data: {
          title: topic,
          slug: finalSlug,
          content: finalHtml,
          status: articleStatus as any,
          excerpt,
          seoTitle,
          seoDescription,
          focusKeyword,
          featuredImageId: featuredImageId || null,
          publishedAt,
          scheduledAt,
          seoReport: JSON.stringify(pipelineResult.seoReport),
          editorialReport: JSON.stringify(pipelineResult.editorialReport),
        },
      });
    } else {
      article = await db.contentItem.create({
        data: {
          title: topic,
          slug: finalSlug,
          contentTypeId: contentType.id,
          authorId: userId,
          content: finalHtml,
          status: articleStatus as any,
          excerpt,
          seoTitle,
          seoDescription,
          focusKeyword,
          featuredImageId: featuredImageId || null,
          siteId: articleSiteId,
          publishedAt,
          scheduledAt,
          seoReport: JSON.stringify(pipelineResult.seoReport),
          editorialReport: JSON.stringify(pipelineResult.editorialReport),
        },
      });
    }

    // Structured Schema
    if (includeSchema && pipelineResult.seoFields.schemaJsonLd) {
      await db.seoConfig
        .upsert({
          where: {
            resourceType_resourceId_siteId: {
              resourceType: 'content',
              resourceId: article.id,
              siteId: articleSiteId || '',
            },
          },
          create: {
            resourceType: 'content',
            resourceId: article.id,
            metaTitle: seoTitle,
            metaDescription: seoDescription,
            canonicalUrl: null,
            structuredData: pipelineResult.seoFields.schemaJsonLd,
            siteId: articleSiteId,
          },
          update: {
            metaTitle: seoTitle,
            metaDescription: seoDescription,
            structuredData: pipelineResult.seoFields.schemaJsonLd,
          },
        })
        .catch(() => {});
    }

    // Final verification: verify article exists in DB
    const verified = await db.contentItem.findUnique({
      where: { id: article.id },
      select: { id: true, status: true, title: true },
    });

    if (!verified) {
      throw new Error('Failed to verify article persistence in database.');
    }

    const durationMs = Date.now() - startedAt;

    // Update child run record
    await db.automationRun.update({
      where: { id: childRunId },
      data: {
        status: 'COMPLETED',
        finishedAt: new Date(),
        durationMs,
        generatedArticleId: article.id,
        generatedArticleName: article.title,
        errorMessage: null,
        failedStep: null,
        logsJson: JSON.stringify(logs),
      },
    });

    // Mark topic queue item completed if applicable
    if (queueItemId) {
      await completeTopicQueueItem(automationId, queueItemId, article.id).catch(() => {});
    }

    await log('complete', `Article ${index}/${total} successfully generated and saved (${(durationMs / 1000).toFixed(1)}s): "${article.title}"`);

    return {
      success: true,
      articleId: article.id,
      articleTitle: article.title,
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const rawErrMsg = err instanceof Error ? err.message : 'Unknown generation error';
    const errMsg = sanitizeErrorMessage(rawErrMsg);

    if (queueItemId) {
      await failTopicQueueItem(automationId, queueItemId, errMsg).catch(() => {});
    }

    await log('error', `Article generation failed at step [${currentStep}]: ${errMsg}`, 'error');

    await db.automationRun
      .update({
        where: { id: childRunId },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          durationMs,
          errorMessage: errMsg,
          failedStep: currentStep,
          logsJson: JSON.stringify(logs),
        },
      })
      .catch(() => {});

    return {
      success: false,
      error: errMsg,
    };
  }
}

/**
 * Execute an automation run end-to-end.
 * Connects daily target (articlesPerDay), remaining daily quota,
 * atomic topic reservation, and child task executions.
 */
export async function executeAutomation(
  automationId: string,
  runId: string,
  options: { overrideQuota?: boolean } = {}
): Promise<void> {
  const startedAt = Date.now();
  const parentLogs: LogEntry[] = [];

  const logParent = async (step: string, message: string, level: 'info' | 'warn' | 'error' = 'info') => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      step,
      message,
      level,
      parentRunId: runId,
    };
    parentLogs.push(entry);
    console.log(`[AUTOMATION:PARENT:${runId}] [${step}] ${message}`);
    await db.automationRun
      .update({
        where: { id: runId },
        data: { logsJson: JSON.stringify(parentLogs) },
      })
      .catch(() => {});
  };

  let currentParentStep = 'validation';
  try {
    await logParent('validation', 'Validating automation configuration and daily quota...');

    const automation = await db.automation.findUnique({ where: { id: automationId } });
    if (!automation) {
      throw new Error(`Automation not found with ID: ${automationId}`);
    }

    const userId = automation.createdById;
    if (!userId) {
      throw new Error('Automation has no owner user ID');
    }

    let workflow: Record<string, any> = {};
    try {
      workflow = JSON.parse(automation.workflowConfig || '{}');
    } catch {
      throw new Error('Invalid workflow configuration: JSON parse failed');
    }

    // Early validation on content configuration
    const contentGen = workflow.contentGeneration || {};
    const mode = contentGen.generationMode || 'MANUAL_QUEUE';
    const hasTopic = Boolean((contentGen.topic || '').trim());
    const hasNiche = Boolean((contentGen.niche || contentGen.topicDiscovery?.niche || '').trim());
    const hasQueueConfigured = Array.isArray(contentGen.topicQueue);

    if (mode === 'AI_TOPIC_DISCOVERY' && !hasNiche && !hasTopic) {
      currentParentStep = 'validation';
      throw new Error('Validation failed: Website Niche is required for AI Topic Discovery mode');
    }
    if (mode !== 'AI_TOPIC_DISCOVERY' && !hasTopic && !hasQueueConfigured) {
      currentParentStep = 'validation';
      throw new Error('Validation failed: A topic or topic queue is required');
    }

    currentParentStep = 'orchestration';

    // Resolve site ID
    let articleSiteId = automation.siteId;
    if (!articleSiteId) {
      const userSite = await db.site.findFirst({
        where: { ownerId: userId, status: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      });
      articleSiteId = userSite?.id || null;
      if (articleSiteId) {
        await db.automation
          .update({
            where: { id: automationId },
            data: { siteId: articleSiteId },
          })
          .catch(() => {});
      }
    }

    // Verify AI text provider
    const { resolveAiProviderForUser } = await import('@/lib/ai/platform-ai');
    const textProvider = await resolveAiProviderForUser(userId, 'TEXT');
    if (!textProvider) {
      throw new Error('No active AI text provider found. Please configure an AI provider in Settings.');
    }

    // ----------------------------------------------------
    // DAILY QUOTA CALCULATION
    // ----------------------------------------------------
    const dailyStats = await getAutomationDailyStats(automationId, automation.scheduleConfig);
    const dailyTarget = dailyStats.dailyTarget;
    let countToGenerate = dailyStats.remainingToday;

    if (options.overrideQuota) {
      countToGenerate = Math.max(1, dailyTarget);
      await logParent('quota', `Manual run with quota override requested. Generating up to ${countToGenerate} articles.`);
    } else {
      await logParent(
        'quota',
        `Daily Quota: Target = ${dailyTarget}, Completed Today = ${dailyStats.completedToday}, Failed Today = ${dailyStats.failedToday}, Remaining = ${countToGenerate} (Timezone: ${dailyStats.timezone})`
      );
    }

    if (countToGenerate <= 0) {
      await logParent(
        'quota',
        `Daily target of ${dailyTarget} articles has already been satisfied for today (${dailyStats.timezone}). No more articles will be generated today.`,
        'info'
      );

      const nextRunAt = calculateNextRun(automation.scheduleConfig, undefined, { advancePastNow: true });
      await db.automation.update({
        where: { id: automationId },
        data: { nextRunAt, lastRunAt: new Date() },
      });

      await db.automationRun.update({
        where: { id: runId },
        data: {
          status: 'SKIPPED',
          finishedAt: new Date(),
          durationMs: Date.now() - startedAt,
          errorMessage: `Daily target of ${dailyTarget} articles has already been satisfied for today (${dailyStats.timezone}).`,
          failedStep: 'quota',
          logsJson: JSON.stringify(parentLogs),
        },
      });

      return;
    }

    // ----------------------------------------------------
    // TOPIC RESERVATION (Mode A or Mode B)
    // ----------------------------------------------------
    await logParent('topic_selection', `Reserving up to ${countToGenerate} eligible topics for daily execution...`);

    let selectedTopics: ResolvedTopicResult[] = [];
    try {
      selectedTopics = await reserveBatchTopicsForAutomation(
        automationId,
        countToGenerate,
        articleSiteId || '',
        userId,
        workflow
      );
    } catch (topicErr: any) {
      if (topicErr.message?.startsWith('NO_TOPICS_AVAILABLE')) {
        await logParent('topic_selection', topicErr.message, 'warn');
        const nextRunAt = calculateNextRun(automation.scheduleConfig, undefined, { advancePastNow: true });

        await db.automationRun.update({
          where: { id: runId },
          data: {
            status: 'SKIPPED',
            finishedAt: new Date(),
            durationMs: Date.now() - startedAt,
            errorMessage: topicErr.message,
            failedStep: 'topic_selection',
            logsJson: JSON.stringify(parentLogs),
          },
        });

        await db.automation.update({
          where: { id: automationId },
          data: { nextRunAt, lastRunAt: new Date() },
        });

        return;
      }
      throw topicErr;
    }

    if (selectedTopics.length === 0) {
      await logParent('topic_selection', 'No topics could be reserved. Ending run.', 'warn');
      return;
    }

    await logParent(
      'topic_selection',
      `Reserved ${selectedTopics.length} distinct topic(s): ${selectedTopics.map((t, idx) => `[#${idx + 1}: "${t.topic}"]`).join(', ')}`
    );

    // ----------------------------------------------------
    // EXECUTE ARTICLE TASKS
    // ----------------------------------------------------
    const successfulArticles: { id: string; title: string }[] = [];
    const pausedArticles: { topic: string; runId: string }[] = [];
    const failedArticles: { topic: string; error: string }[] = [];

    for (let i = 0; i < selectedTopics.length; i++) {
      const currentTopic = selectedTopics[i];
      const childIndex = i + 1;
      const totalInBatch = selectedTopics.length;

      // For the first/primary topic in the run, use runId directly (1 click = 1 run record)
      let targetRunId = runId;
      if (i > 0) {
        const additionalRun = await db.automationRun.create({
          data: {
            automationId,
            status: 'RUNNING',
            startedAt: new Date(),
            logsJson: JSON.stringify([
              {
                timestamp: new Date().toISOString(),
                step: 'QUEUED',
                message: `Batch task ${childIndex} of ${totalInBatch} started for batch ${runId}`,
                level: 'info',
                parentRunId: runId,
              },
            ]),
          },
        });
        targetRunId = additionalRun.id;
        await db.automation.update({
          where: { id: automationId },
          data: { totalRuns: { increment: 1 } },
        });
      }

      await logParent(
        'execution',
        `Starting execution ${childIndex}/${totalInBatch} (Run ID: ${targetRunId}): "${currentTopic.topic}"`
      );

      const result = await executeSingleArticle({
        automationId,
        childRunId: targetRunId,
        parentRunId: runId,
        index: childIndex,
        total: totalInBatch,
        resolvedTopic: currentTopic,
        articleSiteId: articleSiteId || '',
        userId,
        workflow,
        automationName: automation.name,
      });

      if (result.pausedForApproval) {
        pausedArticles.push({ topic: currentTopic.topic, runId: targetRunId });
        await logParent(
          'execution',
          `Task ${childIndex}/${totalInBatch} paused for outline approval: "${currentTopic.topic}". Outline generated and waiting for review.`
        );
      } else if (result.success && result.articleId) {
        successfulArticles.push({ id: result.articleId, title: result.articleTitle || currentTopic.topic });
        await logParent('persistence', `Persisted generated article "${result.articleTitle}" (ID: ${result.articleId})`);
        await logParent('execution', `Task ${childIndex}/${totalInBatch} succeeded: "${result.articleTitle}" (Article ID: ${result.articleId})`);

        await db.automation.update({
          where: { id: automationId },
          data: { successfulRuns: { increment: 1 } },
        });
      } else {
        failedArticles.push({ topic: currentTopic.topic, error: result.error || 'Unknown error' });
        await logParent('execution', `Task ${childIndex}/${totalInBatch} failed: ${result.error}`, 'error');

        await db.automation.update({
          where: { id: automationId },
          data: { failedRuns: { increment: 1 } },
        });
      }
    }

    // ----------------------------------------------------
    // FINALIZE EXECUTION
    // ----------------------------------------------------
    const durationMs = Date.now() - startedAt;
    const allSucceeded = successfulArticles.length === selectedTopics.length;
    const partialSuccess = successfulArticles.length > 0;
    const hasPaused = pausedArticles.length > 0;
    const parentStatus = hasPaused
      ? 'AWAITING_APPROVAL'
      : partialSuccess
      ? 'COMPLETED'
      : failedArticles.length > 0
      ? 'FAILED'
      : 'COMPLETED';

    let nextRunAt: Date | null = null;
    if (automation.triggerType === 'SCHEDULED' && automation.status === 'ACTIVE') {
      try {
        nextRunAt = calculateNextRun(automation.scheduleConfig, undefined, { advancePastNow: true });
      } catch {
        nextRunAt = null;
      }
    }

    await db.automation.update({
      where: { id: automationId },
      data: {
        lastRunAt: new Date(),
        nextRunAt,
      },
    });

    if (selectedTopics.length > 1) {
      const summaryMsg = hasPaused
        ? `Batch paused for outline approval. ${pausedArticles.length} outline(s) awaiting approval.`
        : `Batch execution completed in ${(durationMs / 1000).toFixed(1)}s. Success: ${successfulArticles.length}/${selectedTopics.length}, Failed: ${failedArticles.length}/${selectedTopics.length}.`;
      await logParent('complete', summaryMsg, allSucceeded ? 'info' : hasPaused ? 'warn' : partialSuccess ? 'warn' : 'error');

      await db.automationRun.update({
        where: { id: runId },
        data: {
          status: parentStatus,
          finishedAt: hasPaused ? null : new Date(),
          durationMs,
          generatedArticleId: successfulArticles[0]?.id || null,
          generatedArticleName: successfulArticles.map((a) => a.title).join('; ') || null,
          errorMessage: hasPaused
            ? 'Outline approval required before generating article content.'
            : allSucceeded
            ? null
            : failedArticles.map((f) => `${f.topic}: ${f.error}`).join(' | '),
          failedStep: allSucceeded || hasPaused ? null : 'batch_execution',
          logsJson: JSON.stringify(parentLogs),
        },
      });
    }
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const rawErrMsg = error instanceof Error ? error.message : 'Unknown execution error';
    const errMsg = sanitizeErrorMessage(rawErrMsg);

    await logParent('error', errMsg, 'error');

    await db.automationRun
      .update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          durationMs,
          errorMessage: errMsg,
          failedStep: currentParentStep,
          logsJson: JSON.stringify(parentLogs),
        },
      })
      .catch(() => {});

    await db.automation
      .update({
        where: { id: automationId },
        data: {
          failedRuns: { increment: 1 },
          lastRunAt: new Date(),
        },
      })
      .catch(() => {});

    throw error;
  }
}

/**
 * Resume article generation after user approves or edits the outline.
 */
export async function approveOutlineAndResume(params: {
  automationId: string;
  runId: string;
  userId: string;
  outline?: any;
}): Promise<{ success: boolean; articleId?: string; error?: string }> {
  const { automationId, runId, userId, outline } = params;

  const run = await db.automationRun.findUnique({
    where: { id: runId },
    include: { automation: true },
  });

  if (!run) {
    return { success: false, error: 'Automation run not found.' };
  }

  if (run.automationId !== automationId) {
    return { success: false, error: 'Run does not belong to specified automation.' };
  }

  let workflow: any = {};
  try {
    workflow = JSON.parse(run.automation.workflowConfig || '{}');
  } catch {}

  let effectiveOutline = outline;
  let topic = 'Article Topic';
  let primaryKeyword = '';
  let secondaryKeywords: string[] = [];

  try {
    const logs = JSON.parse(run.logsJson || '[]');
    const payloadLog = logs.find((l: any) => l.step === 'outline_payload');
    if (payloadLog?.message) {
      const parsedPayload = JSON.parse(payloadLog.message);
      if (!effectiveOutline && parsedPayload.outline) {
        effectiveOutline = parsedPayload.outline;
      }
      if (parsedPayload.topic) topic = parsedPayload.topic;
      if (parsedPayload.primaryKeyword) primaryKeyword = parsedPayload.primaryKeyword;
      if (parsedPayload.secondaryKeywords) secondaryKeywords = parsedPayload.secondaryKeywords;
    }
  } catch {}

  if (!effectiveOutline) {
    return { success: false, error: 'No outline found to approve.' };
  }

  // Update run back to RUNNING
  await db.automationRun.update({
    where: { id: runId },
    data: {
      status: 'RUNNING',
      errorMessage: null,
    },
  });

  const result = await executeSingleArticle({
    automationId,
    childRunId: runId,
    parentRunId: runId,
    index: 1,
    total: 1,
    resolvedTopic: {
      topic,
      sourceMode: 'LEGACY_MANUAL',
      sourceNote: 'Approved outline resume',
      primaryKeyword: primaryKeyword || topic,
      secondaryKeywords: Array.isArray(secondaryKeywords)
        ? secondaryKeywords
        : typeof secondaryKeywords === 'string'
        ? (secondaryKeywords as string).split(',').map((s: string) => s.trim()).filter(Boolean)
        : [],
    },
    articleSiteId: run.automation.siteId || '',
    userId,
    workflow,
    automationName: run.automation.name,
    approvedOutline: effectiveOutline,
  });

  if (result.success && result.articleId) {
    await db.automation.update({
      where: { id: automationId },
      data: { successfulRuns: { increment: 1 } },
    });
    return { success: true, articleId: result.articleId };
  } else {
    return { success: false, error: result.error || 'Failed to generate article from approved outline.' };
  }
}

