// ============================================================
// CMS-Native SEO System: Internal Link & Topic Cluster Engine
// Pillar-cluster architecture, orphan detection, anchor text analysis
// ============================================================

import { SeoFinding } from './types';

export interface ContentLinkItem {
  id: string;
  slug: string;
  title: string;
  category?: string | null;
  focusKeyword?: string | null;
  content: string; // HTML or Markdown
}

export interface LinkAnalysisResult {
  totalInternalLinks: number;
  totalExternalLinks: number;
  orphanPages: { id: string; slug: string; title: string }[];
  genericAnchorIssues: { sourceSlug: string; anchorText: string }[];
  clusters: {
    topic: string;
    pillarPage?: { id: string; slug: string; title: string };
    clusterPages: { id: string; slug: string; title: string }[];
  }[];
  findings: SeoFinding[];
}

const GENERIC_ANCHORS = new Set([
  'click here',
  'read more',
  'here',
  'link',
  'learn more',
  'this article',
  'website',
  'page',
  'more',
]);

export function analyzeLinkGraphAndClusters(items: ContentLinkItem[]): LinkAnalysisResult {
  const slugToItem = new Map<string, ContentLinkItem>();
  for (const item of items) {
    slugToItem.set(item.slug.toLowerCase(), item);
  }

  const incomingCounts = new Map<string, number>();
  for (const item of items) {
    incomingCounts.set(item.id, 0);
  }

  let totalInternalLinks = 0;
  let totalExternalLinks = 0;
  const genericAnchorIssues: { sourceSlug: string; anchorText: string }[] = [];

  const linkRegex = /<a\s+([^>]*?)>(.*?)<\/a>/gi;

  for (const item of items) {
    const content = item.content || '';
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(content)) !== null) {
      const attrs = match[1];
      const anchorRaw = match[2].replace(/<[^>]*>/g, '').trim().toLowerCase();

      const hrefMatch = attrs.match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/i);
      const href = (hrefMatch ? hrefMatch[1] || hrefMatch[2] || hrefMatch[3] : '') || '';

      if (href.startsWith('http://') || href.startsWith('https://')) {
        totalExternalLinks++;
      } else if (href.startsWith('/') || !href.includes(':')) {
        totalInternalLinks++;
        const targetSlug = href.replace(/^\//, '').split('/')[0].split('?')[0].split('#')[0].toLowerCase();
        const targetItem = slugToItem.get(targetSlug);
        if (targetItem && targetItem.id !== item.id) {
          incomingCounts.set(targetItem.id, (incomingCounts.get(targetItem.id) || 0) + 1);
        }
      }

      if (GENERIC_ANCHORS.has(anchorRaw) && anchorRaw.length > 0) {
        genericAnchorIssues.push({
          sourceSlug: item.slug,
          anchorText: match[2].replace(/<[^>]*>/g, '').trim(),
        });
      }
    }
  }

  // Detect orphan pages
  const orphanPages: { id: string; slug: string; title: string }[] = [];
  const findings: SeoFinding[] = [];

  for (const item of items) {
    const inCount = incomingCounts.get(item.id) || 0;
    if (inCount === 0 && items.length > 3) {
      orphanPages.push({ id: item.id, slug: item.slug, title: item.title });

      findings.push({
        id: `orphan-${item.id}`,
        category: 'INTERNAL_LINKING',
        severity: 'MEDIUM',
        issue: `Orphan page: No internal links pointing to "${item.title}"`,
        explanation: 'Orphan pages have zero internal incoming links, making them difficult for search engine crawlers and users to discover.',
        recommendation: `Add contextual internal links pointing to /${item.slug} from relevant related articles or category pages.`,
        affected_url: `/${item.slug}`,
        detected_value: '0 incoming internal links',
        expected_value: 'At least 1-3 contextual internal links',
        verification_method: 'Inspect internal incoming link count in the SEO link manager',
        expected_impact: 'MEDIUM',
      });
    }
  }

  // Generic anchor findings
  if (genericAnchorIssues.length > 0) {
    const sample = genericAnchorIssues.slice(0, 3).map((g) => `"${g.anchorText}" in /${g.sourceSlug}`).join(', ');
    findings.push({
      id: `generic-anchors-${Math.random().toString(36).substring(2, 7)}`,
      category: 'INTERNAL_LINKING',
      severity: 'LOW',
      issue: `${genericAnchorIssues.length} generic anchor texts detected`,
      explanation: 'Search engines use anchor text to determine the topical relevance of linked pages. Phrases like "click here" or "read more" provide zero keyword context.',
      recommendation: 'Replace generic anchor text with descriptive keywords describing the target topic.',
      affected_url: `/${genericAnchorIssues[0].sourceSlug}`,
      detected_value: sample,
      expected_value: 'Descriptive, keyword-relevant anchor text',
      verification_method: 'Audit links and update anchor labels',
      expected_impact: 'LOW',
    });
  }

  // Semantic topic clusters based on Category or Focus Keyword
  const clusterMap = new Map<string, { id: string; slug: string; title: string }[]>();
  for (const item of items) {
    const topic = item.category || (item.focusKeyword ? item.focusKeyword.split(' ')[0] : 'General');
    const list = clusterMap.get(topic) || [];
    list.push({ id: item.id, slug: item.slug, title: item.title });
    clusterMap.set(topic, list);
  }

  const clusters = Array.from(clusterMap.entries()).map(([topic, pages]) => ({
    topic,
    pillarPage: pages[0],
    clusterPages: pages.slice(1),
  }));

  return {
    totalInternalLinks,
    totalExternalLinks,
    orphanPages,
    genericAnchorIssues,
    clusters,
    findings,
  };
}
