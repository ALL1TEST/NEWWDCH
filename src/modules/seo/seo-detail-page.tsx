'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { getApi } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ChevronLeft, AlertCircle, FileText, Search, Link2, Unlink, Copy,
  CheckCircle2, XCircle, ArrowUpDown,
} from 'lucide-react';
import { PageHeader } from '@/components/patterns';
import { useT } from '@/lib/i18n';

// -------------------- Types --------------------

interface ContentItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

interface SeoConfig {
  resourceId: string;
  canonicalUrl: string | null;
  structuredData: string | null;
}

interface IndexingRecord {
  id: string;
  title: string;
  pageUrl: string;
  status: string;
  lastCrawl: string | null;
  lastIndexed: string | null;
  coverageError: string | null;
}

interface BrokenLink {
  id: string;
  brokenUrl: string;
  sourcePage: string;
  statusCode: number | null;
  linkType: string;
  status: string;
  anchorText: string | null;
}

type DetailType =
  | 'indexed'
  | 'not-indexed'
  | 'missing-meta-title'
  | 'missing-meta-description'
  | 'missing-h1'
  | 'duplicate-titles'
  | 'duplicate-descriptions'
  | 'broken-links'
  | 'missing-canonicals'
  | 'canonical-issues';

interface DetailMeta {
  titleKey: string;
  descriptionKey: string;
  icon: React.ElementType;
}

// titleKey/descriptionKey are resolved via t() at render time (display-only
// fields; routing stays driven by `type`).
const DETAIL_META: Record<DetailType, DetailMeta> = {
  'indexed': { titleKey: 'seo.indexedPages', descriptionKey: 'seo.detailIndexedDesc', icon: CheckCircle2 },
  'not-indexed': { titleKey: 'seo.notIndexed', descriptionKey: 'seo.detailNotIndexedDesc', icon: XCircle },
  'missing-meta-title': { titleKey: 'seo.missingMetaTitles', descriptionKey: 'seo.detailMissingMetaTitleDesc', icon: FileText },
  'missing-meta-description': { titleKey: 'seo.missingMetaDescriptionsFull', descriptionKey: 'seo.detailMissingMetaDescDesc', icon: FileText },
  'missing-h1': { titleKey: 'seo.missingH1Headings', descriptionKey: 'seo.detailMissingH1Desc', icon: AlertCircle },
  'duplicate-titles': { titleKey: 'seo.duplicateTitles', descriptionKey: 'seo.detailDuplicateTitlesDesc', icon: Copy },
  'duplicate-descriptions': { titleKey: 'seo.duplicateDescriptionsFull', descriptionKey: 'seo.detailDuplicateDescDesc', icon: Copy },
  'broken-links': { titleKey: 'seo.brokenLinks', descriptionKey: 'seo.detailBrokenLinksDesc', icon: Unlink },
  'missing-canonicals': { titleKey: 'seo.missingCanonicals', descriptionKey: 'seo.detailMissingCanonicalsDesc', icon: Link2 },
  'canonical-issues': { titleKey: 'seo.canonicalIssues', descriptionKey: 'seo.detailCanonicalIssuesDesc', icon: Link2 },
};

// -------------------- Component --------------------

export function SeoDetailPage({ type }: { type: DetailType }) {
  const { t } = useT();
  const navigate = useNavigationStore((s) => s.navigate);
  const meta = DETAIL_META[type];
  const Icon = meta.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('seo', null, null)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {t('seo.backToOverview')}
        </Button>
      </div>

      <PageHeader
        title={t(meta.titleKey)}
        description={t(meta.descriptionKey)}
        breadcrumbs={false}
      />

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[600px]">
            <DetailTable type={type} />
            <ScrollBar />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// -------------------- Detail Table --------------------

function DetailTable({ type }: { type: DetailType }) {
  // Broken links have their own data source
  if (type === 'broken-links') {
    return <BrokenLinksTable />;
  }

  // Indexed / Not-indexed use IndexingRecord
  if (type === 'indexed' || type === 'not-indexed') {
    return <IndexingTable type={type} />;
  }

  // All other types use content items + SEO configs
  return <ContentDetailTable type={type} />;
}

// -------------------- Content Detail Table (missing meta, duplicates, canonicals) --------------------

function ContentDetailTable({ type }: { type: DetailType }) {
  const { t } = useT();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['seo-detail', 'content', type],
    queryFn: () => getApi<{ items: ContentItem[]; configs: SeoConfig[] }>('/api/seo/overview/detail', { type }),
    staleTime: 30_000,
  });

  const items = data?.items ?? [];
  const configs = data?.configs ?? [];
  const configMap = useMemo(() => new Map(configs.map((c) => [c.resourceId, c])), [configs]);

  // Filter + transform based on type
  const rows = useMemo(() => {
    switch (type) {
      case 'missing-meta-title':
        return items
          .filter((i) => !i.seoTitle || i.seoTitle.trim() === '')
          .map((i) => ({ id: i.id, title: i.title, url: `/articles/${i.slug}`, detail: t('seo.detailNoMetaTitle'), recommendation: t('seo.detailAddMetaTitle') }));
      case 'missing-meta-description':
        return items
          .filter((i) => !i.seoDescription || i.seoDescription.trim() === '')
          .map((i) => ({ id: i.id, title: i.title, url: `/articles/${i.slug}`, detail: t('seo.detailNoMetaDesc'), recommendation: t('seo.detailAddMetaDesc') }));
      case 'missing-h1':
        return items
          .filter((i) => !i.content || !/<h1/i.test(i.content))
          .map((i) => ({ id: i.id, title: i.title, url: `/articles/${i.slug}`, detail: t('seo.detailNoH1'), recommendation: t('seo.detailAddH1') }));
      case 'duplicate-titles': {
        const groups = new Map<string, ContentItem[]>();
        for (const i of items) {
          const key = (i.seoTitle || i.title || '').trim();
          if (!key) continue;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(i);
        }
        const result: Array<{ id: string; title: string; url: string; detail: string; recommendation: string }> = [];
        for (const [title, group] of groups) {
          if (group.length > 1) {
            for (const i of group) {
              result.push({ id: i.id, title: i.title, url: `/articles/${i.slug}`, detail: `${t('seo.detailDuplicateTitlePrefix')}${title}${t('seo.detailPagesSuffix')} (${group.length}${t('seo.detailPagesClose')}`, recommendation: t('seo.detailUniqueTitles') });
            }
          }
        }
        return result;
      }
      case 'duplicate-descriptions': {
        const groups = new Map<string, ContentItem[]>();
        for (const i of items) {
          const key = (i.seoDescription || '').trim();
          if (!key) continue;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(i);
        }
        const result: Array<{ id: string; title: string; url: string; detail: string; recommendation: string }> = [];
        for (const [desc, group] of groups) {
          if (group.length > 1) {
            for (const i of group) {
              result.push({ id: i.id, title: i.title, url: `/articles/${i.slug}`, detail: `${t('seo.detailDuplicateDescPrefix')}${group.length}${t('seo.detailPagesClose')}`, recommendation: t('seo.detailUniqueDesc') });
            }
          }
        }
        return result;
      }
      case 'missing-canonicals':
        return items
          .filter((i) => {
            const config = configMap.get(i.id);
            return !config || !config.canonicalUrl || config.canonicalUrl.trim() === '';
          })
          .map((i) => ({ id: i.id, title: i.title, url: `/articles/${i.slug}`, detail: t('seo.detailNoCanonical'), recommendation: t('seo.detailAddCanonical') }));
      case 'canonical-issues':
        return items
          .filter((i) => {
            const config = configMap.get(i.id);
            if (!config?.canonicalUrl) return false;
            try {
              const u = new URL(config.canonicalUrl);
              return u.hostname !== 'cms.example.com';
            } catch {
              return true; // Invalid URL
            }
          })
          .map((i) => {
            const config = configMap.get(i.id);
            return { id: i.id, title: i.title, url: `/articles/${i.slug}`, detail: `${t('seo.detailCanonicalPrefix')} ${config?.canonicalUrl}`, recommendation: t('seo.detailCanonicalDomain') };
          });
      default:
        return [];
    }
  }, [items, configs, configMap, type, t]);

  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('seo.pageTitle')}</TableHead>
            <TableHead>{t('seo.url')}</TableHead>
            <TableHead>{t('seo.issue')}</TableHead>
            <TableHead className="hidden md:table-cell">{t('seo.recommendation')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 4 }).map((_, j) => (
                <TableCell key={j}><Skeleton className="h-5 w-32" /></TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-8 w-8 mb-2 text-red-400" />
        <p className="text-sm text-muted-foreground">{t('seo.detailLoadFailed')}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle2 className="h-8 w-8 mb-2 text-green-500" />
        <p className="text-sm font-medium">{t('seo.noIssuesFound')}</p>
        <p className="text-xs text-muted-foreground mt-1">{t('seo.allPagesPass')}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('seo.pageTitle')}</TableHead>
          <TableHead>{t('seo.url')}</TableHead>
          <TableHead>{t('seo.issue')}</TableHead>
          <TableHead className="hidden md:table-cell">{t('seo.recommendation')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.title}</TableCell>
            <TableCell>
              <span className="font-mono text-xs text-muted-foreground">{row.url}</span>
            </TableCell>
            <TableCell className="text-sm text-amber-600 dark:text-amber-400">{row.detail}</TableCell>
            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{row.recommendation}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// -------------------- Indexing Table (indexed / not-indexed) --------------------

function IndexingTable({ type }: { type: 'indexed' | 'not-indexed' }) {
  const { t } = useT();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['seo-detail', 'indexing', type],
    queryFn: () => getApi<{ data: IndexingRecord[]; pagination: { total: number } }>('/api/seo/indexing', {
      pageSize: 100,
      status: type === 'indexed' ? 'INDEXED' : undefined,
    }),
    staleTime: 30_000,
  });

  // For "not-indexed", filter to non-INDEXED statuses
  const records = useMemo(() => {
    const all = data?.data ?? [];
    if (type === 'indexed') return all;
    return all.filter((r) => r.status !== 'INDEXED');
  }, [data, type]);

  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('seo.page')}</TableHead>
            <TableHead>{t('seo.url')}</TableHead>
            <TableHead>{t('common.status')}</TableHead>
            <TableHead className="hidden md:table-cell">{t('seo.lastCrawled')}</TableHead>
            <TableHead className="hidden lg:table-cell">{t('seo.issue')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 5 }).map((_, j) => (
                <TableCell key={j}><Skeleton className="h-5 w-28" /></TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-8 w-8 mb-2 text-red-400" />
        <p className="text-sm text-muted-foreground">{t('seo.indexingLoadFailed')}</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle2 className="h-8 w-8 mb-2 text-green-500" />
        <p className="text-sm font-medium">{t('seo.noPagesInCategory')}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {type === 'indexed' ? t('seo.noIndexedPages') : t('seo.allIndexed')}
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('seo.page')}</TableHead>
          <TableHead>{t('seo.url')}</TableHead>
          <TableHead>{t('common.status')}</TableHead>
          <TableHead className="hidden md:table-cell">{t('seo.lastCrawled')}</TableHead>
          <TableHead className="hidden lg:table-cell">{t('seo.issue')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-medium">{r.title}</TableCell>
            <TableCell>
              <span className="font-mono text-xs text-muted-foreground">{r.pageUrl}</span>
            </TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={cn(
                  'border-transparent font-medium',
                  r.status === 'INDEXED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                )}
              >
                {r.status}
              </Badge>
            </TableCell>
            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
              {r.lastCrawl ? new Date(r.lastCrawl).toLocaleDateString() : '—'}
            </TableCell>
            <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
              {r.coverageError || '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// -------------------- Broken Links Table --------------------

function BrokenLinksTable() {
  const { t } = useT();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['seo-detail', 'broken-links'],
    queryFn: () => getApi<{ data: BrokenLink[]; pagination: { total: number } }>('/api/seo/broken-links', { pageSize: 100 }),
    staleTime: 30_000,
  });

  const links = data?.data ?? [];

  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('seo.sourcePage')}</TableHead>
            <TableHead>{t('seo.brokenUrl')}</TableHead>
            <TableHead>{t('seo.linkText')}</TableHead>
            <TableHead>{t('seo.statusCode')}</TableHead>
            <TableHead className="hidden md:table-cell">{t('seo.type')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 5 }).map((_, j) => (
                <TableCell key={j}><Skeleton className="h-5 w-28" /></TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-8 w-8 mb-2 text-red-400" />
        <p className="text-sm text-muted-foreground">{t('seo.brokenLinksLoadFailed')}</p>
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle2 className="h-8 w-8 mb-2 text-green-500" />
        <p className="text-sm font-medium">{t('seo.noBrokenLinks')}</p>
        <p className="text-xs text-muted-foreground mt-1">{t('seo.allLinksWorking')}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('seo.sourcePage')}</TableHead>
          <TableHead>{t('seo.brokenUrl')}</TableHead>
          <TableHead>{t('seo.linkText')}</TableHead>
          <TableHead>{t('seo.statusCode')}</TableHead>
          <TableHead className="hidden md:table-cell">{t('seo.type')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {links.map((link) => (
          <TableRow key={link.id}>
            <TableCell>
              <span className="font-mono text-xs text-muted-foreground">{link.sourcePage}</span>
            </TableCell>
            <TableCell>
              <span className="font-mono text-xs text-red-600 dark:text-red-400">{link.brokenUrl}</span>
            </TableCell>
            <TableCell className="text-sm">{link.anchorText || '—'}</TableCell>
            <TableCell>
              <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-transparent font-medium">
                {link.statusCode || 'ERR'}
              </Badge>
            </TableCell>
            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{link.linkType}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
