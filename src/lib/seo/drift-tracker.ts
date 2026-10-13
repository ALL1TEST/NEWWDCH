// ============================================================
// CMS-Native SEO System: SEO Drift & Snapshot Tracking
// Records audit history and computes regressions/improvements over time
// ============================================================

import { db } from '@/lib/db';
import { SeoAuditSnapshot } from './types';

const SNAPSHOTS_SETTING_KEY = 'seo_audit_snapshots';

export async function saveAuditSnapshot(snapshot: Omit<SeoAuditSnapshot, 'id' | 'createdAt'>): Promise<SeoAuditSnapshot> {
  const effectiveSiteId = typeof snapshot.siteId === 'string' ? snapshot.siteId : null;

  const existing = await db.setting.findFirst({
    where: {
      key: SNAPSHOTS_SETTING_KEY,
      siteId: effectiveSiteId,
    },
  });

  let history: SeoAuditSnapshot[] = [];
  if (existing?.value) {
    try {
      history = JSON.parse(existing.value);
    } catch {
      history = [];
    }
  }

  const newRecord: SeoAuditSnapshot = {
    id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ...snapshot,
    siteId: effectiveSiteId || undefined,
    createdAt: new Date().toISOString(),
  };

  // Keep last 30 snapshots
  const updatedHistory = [newRecord, ...history].slice(0, 30);

  if (existing) {
    await db.setting.update({
      where: { id: existing.id },
      data: { value: JSON.stringify(updatedHistory) },
    });
  } else {
    await db.setting.create({
      data: {
        key: SNAPSHOTS_SETTING_KEY,
        value: JSON.stringify(updatedHistory),
        siteId: effectiveSiteId,
        type: 'JSON',
        scope: effectiveSiteId ? 'SITE' : 'GLOBAL',
        category: 'SEO',
        description: 'SEO Audit Snapshots',
        isPublic: false,
      },
    });
  }

  return newRecord;
}

export async function getAuditSnapshots(siteId?: string): Promise<{
  history: SeoAuditSnapshot[];
  latestComparison?: {
    scoreDiff: number;
    issuesDiff: number;
    improvedCategories: string[];
    regressedCategories: string[];
  };
}> {
  const effectiveSiteId = typeof siteId === 'string' ? siteId : null;
  const existing = await db.setting.findFirst({
    where: { key: SNAPSHOTS_SETTING_KEY, siteId: effectiveSiteId },
  });

  if (!existing?.value) {
    return { history: [] };
  }

  try {
    const history: SeoAuditSnapshot[] = JSON.parse(existing.value);
    if (history.length < 2) {
      return { history };
    }

    const current = history[0];
    const previous = history[1];

    const scoreDiff = current.overallScore - previous.overallScore;
    const issuesDiff = current.totalIssues - previous.totalIssues;

    const improvedCategories: string[] = [];
    const regressedCategories: string[] = [];

    const cats = new Set([
      ...Object.keys(current.categoryScores || {}),
      ...Object.keys(previous.categoryScores || {}),
    ]);

    for (const cat of cats) {
      const currCat = current.categoryScores[cat] ?? 0;
      const prevCat = previous.categoryScores[cat] ?? 0;
      if (currCat > prevCat) improvedCategories.push(`${cat} (+${currCat - prevCat}%)`);
      else if (currCat < prevCat) regressedCategories.push(`${cat} (${currCat - prevCat}%)`);
    }

    return {
      history,
      latestComparison: {
        scoreDiff,
        issuesDiff,
        improvedCategories,
        regressedCategories,
      },
    };
  } catch {
    return { history: [] };
  }
}
