'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, ImageOff, Globe, RefreshCw, Search,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/patterns';
import { getApi, patchApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useSiteStore } from '@/lib/stores/site-store';
import { toast } from 'sonner';

interface ContentOption {
  id: string;
  title: string;
  slug: string;
}

interface SocialPreviewData {
  ogTitle: string;
  ogDescription: string;
  ogImage: string | null;
  ogUrl: string;
  ogType: string;
  ogSiteName: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string | null;
  pageUrl: string;
  domain: string;
}

export function SeoSocialPreviewPage() {
  const [selectedId, setSelectedId] = useState('');
  const [ogTitle, setOgTitle] = useState('');
  const [ogDescription, setOgDescription] = useState('');
  const [ogType, setOgType] = useState('article');
  const activeSite = useSiteStore((s) => s.getActiveSite());
  const domain = activeSite?.domain ?? 'example.com';

  // Fetch published content for selector
  const { data: contentData } = useQuery({
    queryKey: ['content-social-select'],
    queryFn: () => getApi<{ data: ContentOption[] }>('/api/content?status=PUBLISHED&pageSize=100'),
    staleTime: 60_000,
  });

  const contentItems = (contentData as any)?.data ?? [];

  // Fetch social preview
  const { data: previewData, isLoading: previewLoading, refetch } = useQuery({
    queryKey: queryKeys.seoSocialPreview.detail(selectedId),
    queryFn: () => getApi<SocialPreviewData>(`/api/seo/social-preview?resourceId=${selectedId}`),
    enabled: !!selectedId,
    staleTime: 10_000,
  });

  // Derive live preview values (no local state to avoid setState-in-effect)
  const displayTitle = ogTitle || previewData?.ogTitle || 'Page Title';
  const displayDesc = ogDescription || previewData?.ogDescription || 'Page description will appear here...';
  const displayImage = previewData?.ogImage ?? null;
  const displayUrl = previewData?.ogUrl ?? `https://${domain}/`;
  const localDomain = previewData?.domain ?? domain;
  const localSiteName = previewData?.ogSiteName ?? domain;

  // Remove unused imports
  // const localOgImage = previewData?.ogImage ?? null;
  // const localOgUrl = previewData?.ogUrl ?? '';
  // const localDomain = previewData?.domain ?? domain;
  // const localSiteName = previewData?.ogSiteName ?? domain;

  return (
    <div className="space-y-6">
      <PageHeader title="Social Preview" description="Preview how your pages appear when shared on social media" />

      {/* Content Selector */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div className="flex-1 w-full space-y-1.5">
            <Label className="text-sm">Select Content</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a published page..." />
              </SelectTrigger>
              <SelectContent>
                {contentItems.map((item: ContentOption) => (
                  <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={!selectedId || previewLoading}>
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', previewLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </Card>

      {!selectedId ? (
        <Card className="p-12 text-center">
          <Search className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Select a content item to see its social preview</p>
        </Card>
      ) : previewLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <>
          {/* Previews */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Facebook / Open Graph */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">f</div>
                  <CardTitle className="text-sm font-semibold">Facebook / Open Graph</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden bg-white dark:bg-zinc-900">
                  {displayImage ? (
                    <div className="relative aspect-[1.91/1] bg-muted">
                      <img src={displayImage} alt="OG Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center aspect-[1.91/1] bg-muted">
                      <ImageOff className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="p-3">
                    <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase truncate">{localDomain}</p>
                    <p className="font-semibold text-sm mt-0.5 line-clamp-2 text-gray-900 dark:text-foreground">{displayTitle}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 line-clamp-2">{displayDesc}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Twitter / X */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-black dark:bg-white flex items-center justify-center text-white dark:text-black text-[10px] font-bold">𝕏</div>
                  <CardTitle className="text-sm font-semibold">Twitter / X</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border overflow-hidden bg-white dark:bg-zinc-900">
                  <div className="flex flex-col sm:flex-row">
                    <div className="flex-1 p-3 min-w-0">
                      <p className="font-bold text-sm text-gray-900 dark:text-foreground line-clamp-2">{displayTitle}</p>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 line-clamp-2">{displayDesc}</p>
                      <div className="flex items-center gap-1 mt-2 text-xs text-gray-400 dark:text-zinc-500">
                        <Globe className="h-3 w-3" />
                        <span className="truncate">{displayUrl}</span>
                      </div>
                    </div>
                    {displayImage && (
                      <div className="w-full sm:w-36 h-36 sm:h-auto bg-muted shrink-0">
                        <img src={displayImage} alt="Twitter Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Edit Fields */}
          <Card className="p-6">
            <h3 className="font-semibold text-sm mb-4">Social Metadata</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="og-title">OG Title</Label>
                <Input id="og-title" value={ogTitle} onChange={(e) => setOgTitle(e.target.value)} placeholder="Open Graph title" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="og-type">OG Type</Label>
                <Select value={ogType} onValueChange={setOgType}>
                  <SelectTrigger id="og-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="article">Article</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="blog">Blog</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="og-desc">OG Description</Label>
                <textarea id="og-desc" className="flex w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px] resize-y" value={ogDescription} onChange={(e) => setOgDescription(e.target.value)} placeholder="Open Graph description" />
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
