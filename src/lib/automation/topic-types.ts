// ============================================================
// TOPIC TYPES & UTILITIES — Client-safe interfaces & parser
// Safe for both Browser Client Components and Server code
// ============================================================

import { nanoid } from 'nanoid';

export interface TopicQueueItem {
  id: string;
  topic: string;
  primaryKeyword?: string;
  secondaryKeywords?: string;
  status: 'AVAILABLE' | 'RESERVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  reservedAt?: string | null;
  completedAt?: string | null;
  lastArticleId?: string | null;
  errorMessage?: string | null;
  addedAt: string;
}

export interface TopicDiscoveryConfig {
  niche?: string;
  subNiches?: string;
  targetAudience?: string;
  language?: string;
  country?: string;
  preferredCategories?: string;
  selectionStrategy?: 'HIGH_SEARCH_INTENT' | 'QUESTION_BASED' | 'TOPICAL_AUTHORITY_PILLARS' | 'COMPETITOR_GAPS';
  excludedTopics?: string;
  previouslyCoveredTopics?: string[];
}

export interface ResolvedTopicResult {
  id?: string;
  topic: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  sourceMode: 'AI_TOPIC_DISCOVERY' | 'MANUAL_QUEUE' | 'LEGACY_MANUAL';
  queueItemId?: string;
  status?: string;
  isAiSuggestion?: boolean;
  evidenceSource?: string;
  evidenceNote?: string;
  sourceNote: string;
}

/**
 * Parse a multiline string or CSV of topics into TopicQueueItem objects.
 * Formats supported:
 * - Simple topic per line: "My Topic"
 * - Delimited: "My Topic | Primary Keyword | Secondary Keywords"
 */
export function parseMultilineTopics(rawText: string): TopicQueueItem[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  const now = new Date().toISOString();
  return lines.map((line) => {
    const parts = line.split('|').map((p) => p.trim());
    const topic = parts[0];
    const primaryKeyword = parts[1] || topic;
    const secondaryKeywords = parts[2] || '';

    return {
      id: `tq_${nanoid(8)}`,
      topic,
      primaryKeyword,
      secondaryKeywords,
      status: 'AVAILABLE',
      addedAt: now,
    };
  });
}
