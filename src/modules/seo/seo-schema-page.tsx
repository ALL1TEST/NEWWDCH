'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Code, ChevronDown, ChevronRight, Copy, Check, Search, Loader2, Globe, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PageHeader } from '@/components/patterns';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useSiteStore } from '@/lib/stores/site-store';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ContentOption { id: string; title: string; slug: string; }

interface SchemaItem {
  type: string;
  jsonLd: Record<string, unknown>;
}

const SCHEMA_COLORS: Record<string, string> = {
  Article: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  BlogPosting: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  BreadcrumbList: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  WebSite: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  Organization: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

function JsonBlock({ data }: { data: Record<string, unknown> }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={handleCopy}>
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
      <pre className="rounded-lg border bg-muted/50 p-4 text-xs font-mono overflow-x-auto max-h-[400px] overflow-y-auto">
        <code>{json}</code>
      </pre>
    </div>
  );
}

export function SeoSchemaPage() {
  const { t } = useT();
  const [selectedId, setSelectedId] = useState('');
  const activeSite = useSiteStore((s) => s.getActiveSite());
  const domain = activeSite?.domain ?? 'example.com';

  const { data: contentData } = useQuery({
    queryKey: ['content-schema-select'],
    queryFn: () => getApi<{ data: ContentOption[] }>('/api/content?status=PUBLISHED&pageSize=100'),
    staleTime: 60_000,
  });
  const contentItems = (contentData as any)?.data ?? [];

  const { data: siteSchemas, isLoading: siteLoading } = useQuery({
    queryKey: queryKeys.seoSchema.all,
    queryFn: () => getApi<{ schemas: SchemaItem[] }>('/api/seo/schema?type=site'),
    staleTime: 30_000,
  });

  const { data: contentSchemas, isLoading: contentLoading } = useQuery({
    queryKey: queryKeys.seoSchema.detail(selectedId),
    queryFn: () => getApi<{ schemas: SchemaItem[] }>(`/api/seo/schema?resourceId=${selectedId}`),
    enabled: !!selectedId,
    staleTime: 10_000,
  });

  const siteSchemaItems = (siteSchemas as any)?.schemas ?? [];
  const contentSchemaItems = (contentSchemas as any)?.schemas ?? [];
  const allSchemas = [...siteSchemaItems, ...contentSchemaItems];

  return (
    <div className="space-y-6">
      <PageHeader title={t('seo.schemaTitle')} description={t('seo.schemaDescription')} breadcrumbs={false} />

      <Card className="p-4">
        <div className="flex items-end gap-3">
          <div className="flex-1 w-full space-y-1.5">
            <label className="text-sm font-medium">{t('seo.selectContent')}</label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t('seo.chooseContentSchemas')} /></SelectTrigger>
              <SelectContent>
                {contentItems.map((item: ContentOption) => (
                  <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {(siteLoading || (selectedId && contentLoading)) ? (
        <div className="space-y-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>
      ) : allSchemas.length === 0 ? (
        <Card className="p-12 text-center">
          <Code className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{selectedId ? t('seo.noSchemasForContent') : t('seo.selectToViewSchemas')}</p>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={allSchemas.map((s: SchemaItem) => s.type)} className="space-y-3">
          {allSchemas.map((schema: SchemaItem) => (
            <AccordionItem key={schema.type} value={schema.type} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn('font-medium', SCHEMA_COLORS[schema.type] ?? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300')}>{schema.type}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <JsonBlock data={schema.jsonLd} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {!selectedId && siteSchemaItems.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">{t('seo.siteLevelSchemasHint')}</p>
      )}
    </div>
  );
}
