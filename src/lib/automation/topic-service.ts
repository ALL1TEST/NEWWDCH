// ============================================================
// TOPIC SERVICE — Topic Discovery & Manual Topic Queue Engine
// Handles:
// 1. Mode A: AI Internet Research & Topic Discovery (SERP intelligence, Niche, Deduplication)
// 2. Mode B: Manual Topic Queue (Atomic reservation, AVAILABLE/PROCESSING/COMPLETED/FAILED)
// ============================================================

import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { discoverTopicsViaInternetResearch, DiscoveredTopicResult } from './serp-research';
export * from './topic-types';
import type { TopicQueueItem, TopicDiscoveryConfig, ResolvedTopicResult } from './topic-types';

/**
 * Atomically reserve a batch of eligible topics (up to countNeeded) for an automation run.
 * Supports:
 * - Mode B (MANUAL_QUEUE): Atomically selects distinct AVAILABLE items.
 *   If fewer items are available than countNeeded, returns only what is available.
 *   Does NOT invent topics in Manual mode.
 * - Mode A (AI_TOPIC_DISCOVERY): Discovers countNeeded distinct, non-duplicative topics
 *   leveraging real search/SERP intelligence or domain analysis.
 */
export async function reserveBatchTopicsForAutomation(
  automationId: string,
  countNeeded: number = 1,
  siteId?: string,
  userId?: string,
  workflow?: any,
  throwOnEmpty: boolean = true
): Promise<ResolvedTopicResult[]> {
  let loadedAutomation: any = null;
  if (!workflow || !siteId || !userId) {
    loadedAutomation = await db.automation.findUnique({
      where: { id: automationId },
    });
    if (loadedAutomation) {
      if (!workflow) {
        try {
          workflow = JSON.parse(loadedAutomation.workflowConfig || '{}');
        } catch {
          workflow = {};
        }
      }
      if (!siteId) siteId = loadedAutomation.siteId || '';
      if (!userId) userId = loadedAutomation.createdById || '';
    }
  }

  if (!workflow) workflow = {};
  const contentConfig = workflow.contentGeneration || {};
  const mode = contentConfig.generationMode || (contentConfig.topicQueue?.length ? 'MANUAL_QUEUE' : 'LEGACY_MANUAL');

  // ------------------------------------------------------------------
  // MODE B: MANUAL TOPIC QUEUE
  // ------------------------------------------------------------------
  if (mode === 'MANUAL_QUEUE' || Array.isArray(contentConfig.topicQueue)) {
    // Perform atomic transaction to avoid race conditions with concurrent runs
    return await db.$transaction(async (tx) => {
      const currentAuto = await tx.automation.findUnique({
        where: { id: automationId },
        select: { workflowConfig: true },
      });
      if (!currentAuto) {
        throw new Error(`Automation not found: ${automationId}`);
      }

      let currentWf: any = {};
      try {
        currentWf = JSON.parse(currentAuto.workflowConfig || '{}');
      } catch {
        currentWf = {};
      }
      const curContent = currentWf.contentGeneration || {};
      const topicQueue: TopicQueueItem[] = Array.isArray(curContent.topicQueue)
        ? [...curContent.topicQueue]
        : [];
      const allowReuse = Boolean(curContent.allowReuseCompletedTopics);

      // Find available items
      const selectedIndices: number[] = [];

      for (let i = 0; i < topicQueue.length; i++) {
        if (selectedIndices.length >= countNeeded) break;
        if (topicQueue[i].status === 'AVAILABLE') {
          selectedIndices.push(i);
        }
      }

      // If available items are fewer than countNeeded and reuse is permitted:
      if (selectedIndices.length < countNeeded && allowReuse) {
        for (let i = 0; i < topicQueue.length; i++) {
          if (selectedIndices.length >= countNeeded) break;
          if (topicQueue[i].status === 'COMPLETED' && !selectedIndices.includes(i)) {
            selectedIndices.push(i);
          }
        }
      }

      // If queue is completely exhausted and nothing could be selected:
      if (selectedIndices.length === 0) {
        // Check single topic fallback only if queue was empty
        const fallbackTopic = (curContent.topic || curContent.articleTopic || '').trim();
        if (fallbackTopic && topicQueue.length === 0) {
          const primaryKw = curContent.primaryKeyword || fallbackTopic;
          const secondaries = typeof curContent.secondaryKeywords === 'string'
            ? curContent.secondaryKeywords.split(',').map((s: string) => s.trim()).filter(Boolean)
            : [];
          return [
            {
              topic: fallbackTopic,
              primaryKeyword: primaryKw,
              secondaryKeywords: secondaries,
              sourceMode: 'MANUAL_QUEUE',
              sourceNote: 'Processed via single topic fallback configuration.',
            },
          ];
        }

        if (!throwOnEmpty) {
          return [];
        }

        throw new Error(
          `NO_TOPICS_AVAILABLE: No eligible topics remain in manual queue. (Total: ${topicQueue.length}, Completed: ${topicQueue.filter((t) => t.status === 'COMPLETED').length})`
        );
      }

      const nowIso = new Date().toISOString();
      const results: ResolvedTopicResult[] = [];

      // Atomically mark selected items as PROCESSING
      for (const idx of selectedIndices) {
        const item = topicQueue[idx];
        topicQueue[idx] = {
          ...item,
          status: 'RESERVED',
          reservedAt: nowIso,
          errorMessage: null,
        };

        const secondaries = item.secondaryKeywords
          ? item.secondaryKeywords.split(',').map((s) => s.trim()).filter(Boolean)
          : [];

        results.push({
          id: item.id,
          topic: item.topic,
          status: 'RESERVED',
          primaryKeyword: item.primaryKeyword || item.topic,
          secondaryKeywords: secondaries,
          sourceMode: 'MANUAL_QUEUE',
          queueItemId: item.id,
          sourceNote: `Reserved topic from manual queue (Item ID: ${item.id}). Status: PROCESSING.`,
        });
      }

      // Persist atomically
      const updatedWf = {
        ...currentWf,
        contentGeneration: {
          ...curContent,
          topicQueue,
        },
      };

      await tx.automation.update({
        where: { id: automationId },
        data: { workflowConfig: JSON.stringify(updatedWf) },
      });

      return results;
    });
  }

  // ------------------------------------------------------------------
  // MODE A: AI TOPIC DISCOVERY / INTERNET RESEARCH
  // ------------------------------------------------------------------
  if (mode === 'AI_TOPIC_DISCOVERY') {
    const discoveryConfig: TopicDiscoveryConfig = contentConfig.topicDiscovery || {};
    const niche = discoveryConfig.niche || contentConfig.topic || 'Technology';

    const discoveredTopics = await discoverTopicsViaInternetResearch({
      niche,
      subNiches: discoveryConfig.subNiches,
      targetAudience: discoveryConfig.targetAudience,
      language: discoveryConfig.language,
      country: discoveryConfig.country,
      excludedTopics: discoveryConfig.excludedTopics,
      preferredCategories: discoveryConfig.preferredCategories,
      selectionStrategy: discoveryConfig.selectionStrategy,
      countNeeded,
      siteId,
      userId: userId || '',
      automationId,
      workflow,
    });

    return discoveredTopics.map((d: DiscoveredTopicResult) => ({
      topic: d.topic,
      primaryKeyword: d.primaryKeyword,
      secondaryKeywords: d.secondaryKeywords,
      sourceMode: 'AI_TOPIC_DISCOVERY',
      isAiSuggestion: true,
      evidenceSource: d.evidenceSource,
      evidenceNote: d.evidenceNote,
      sourceNote: `${d.evidenceSource}: ${d.evidenceNote}. (${d.reasoning})`,
    }));
  }

  // ------------------------------------------------------------------
  // LEGACY MANUAL: Single topic field
  // ------------------------------------------------------------------
  const manualTopic = contentConfig.topic || 'Untitled Article';
  const primaryKw = contentConfig.primaryKeyword || manualTopic;
  const secondaries = typeof contentConfig.secondaryKeywords === 'string'
    ? contentConfig.secondaryKeywords.split(',').map((s: string) => s.trim()).filter(Boolean)
    : [];

  return [
    {
      topic: manualTopic,
      primaryKeyword: primaryKw,
      secondaryKeywords: secondaries,
      sourceMode: 'LEGACY_MANUAL',
      sourceNote: 'Using saved single topic configuration.',
    },
  ];
}

/**
 * Atomically select and reserve a single eligible topic (backwards-compatible wrapper).
 */
export async function resolveNextTopicForAutomation(
  automationId: string,
  siteId?: string,
  userId?: string,
  workflow?: any
): Promise<ResolvedTopicResult> {
  const list = await reserveBatchTopicsForAutomation(automationId, 1, siteId, userId, workflow);
  if (!list || list.length === 0) {
    throw new Error('NO_TOPICS_AVAILABLE: No eligible topics remain.');
  }
  return list[0];
}

/**
 * Mark a manual queue item as COMPLETED after successful article generation.
 */
export async function completeTopicQueueItem(
  automationId: string,
  queueItemId: string,
  articleId?: string
): Promise<void> {
  try {
    await db.$transaction(async (tx) => {
      const automation = await tx.automation.findUnique({
        where: { id: automationId },
        select: { workflowConfig: true },
      });
      if (!automation) return;

      const workflow = JSON.parse(automation.workflowConfig || '{}');
      const topicQueue: TopicQueueItem[] = workflow.contentGeneration?.topicQueue;
      if (!Array.isArray(topicQueue)) return;

      const item = topicQueue.find((t) => t.id === queueItemId);
      if (item) {
        item.status = 'COMPLETED';
        item.completedAt = new Date().toISOString();
        item.lastArticleId = articleId;
        item.errorMessage = null;

        await tx.automation.update({
          where: { id: automationId },
          data: { workflowConfig: JSON.stringify(workflow) },
        });
      }
    });
  } catch (err) {
    console.error('[TOPIC_QUEUE:COMPLETE] Failed to update queue item status:', err);
  }
}

/**
 * Mark a manual queue item as FAILED if generation errors out.
 */
export async function failTopicQueueItem(
  automationId: string,
  queueItemId: string,
  errorMessage: string
): Promise<void> {
  try {
    await db.$transaction(async (tx) => {
      const automation = await tx.automation.findUnique({
        where: { id: automationId },
        select: { workflowConfig: true },
      });
      if (!automation) return;

      const workflow = JSON.parse(automation.workflowConfig || '{}');
      const topicQueue: TopicQueueItem[] = workflow.contentGeneration?.topicQueue;
      if (!Array.isArray(topicQueue)) return;

      const item = topicQueue.find((t) => t.id === queueItemId);
      if (item) {
        item.status = 'FAILED';
        item.errorMessage = errorMessage.slice(0, 300);

        await tx.automation.update({
          where: { id: automationId },
          data: { workflowConfig: JSON.stringify(workflow) },
        });
      }
    });
  } catch (err) {
    console.error('[TOPIC_QUEUE:FAIL] Failed to update queue item status:', err);
  }
}

/**
 * Update a topic queue item's status (AVAILABLE, RESERVED, PROCESSING, COMPLETED, FAILED).
 */
export async function markTopicStatusInQueue(
  automationId: string,
  queueItemId: string,
  status: TopicQueueItem['status'],
  articleId?: string,
  errorMessage?: string
): Promise<void> {
  await db.$transaction(async (tx) => {
    const automation = await tx.automation.findUnique({
      where: { id: automationId },
      select: { workflowConfig: true },
    });
    if (!automation) return;

    const workflow = JSON.parse(automation.workflowConfig || '{}');
    const topicQueue: TopicQueueItem[] = workflow.contentGeneration?.topicQueue;
    if (!Array.isArray(topicQueue)) return;

    const item = topicQueue.find((t) => t.id === queueItemId);
    if (item) {
      item.status = status;
      if (status === 'COMPLETED') {
        item.completedAt = new Date().toISOString();
        if (articleId) item.lastArticleId = articleId;
      }
      if (status === 'PROCESSING') {
        item.reservedAt = new Date().toISOString();
      }
      if (status === 'AVAILABLE') {
        item.reservedAt = null;
        item.errorMessage = null;
      }
      if (errorMessage) {
        item.errorMessage = errorMessage.slice(0, 300);
      }

      await tx.automation.update({
        where: { id: automationId },
        data: { workflowConfig: JSON.stringify(workflow) },
      });
    }
  });
}
