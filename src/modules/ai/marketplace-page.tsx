'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi, postApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Search, Download, Store, Loader2, Package, MessageSquare, CheckCircle2,
} from 'lucide-react';
import { useT } from '@/lib/i18n';

// -------------------- Types --------------------

interface MarketplacePromptPack {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  installCount: number;
  promptCount: number;
  prompts: MarketplacePrompt[];
  isInstalled: boolean;
}

interface MarketplacePrompt {
  name: string;
  category: string;
  description: string;
}

// -------------------- Component --------------------

export function MarketplacePage() {
  const { t } = useT();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [detailPack, setDetailPack] = useState<MarketplacePromptPack | null>(null);
  const [installConfirmPack, setInstallConfirmPack] = useState<MarketplacePromptPack | null>(null);

  // Fetch marketplace
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.aiMarketplace.list({ search, category: categoryFilter }),
    queryFn: () => getApi<MarketplacePromptPack[]>('/api/ai/marketplace', {
      search: search || undefined,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
    }),
  });

  const packs = data ?? [];

  // Extract unique categories
  const categories = [...new Set(packs.map((p) => p.category).filter(Boolean))];

  // Install mutation
  const installMutation = useMutation({
    mutationFn: (slug: string) => postApi('/api/ai/marketplace', { slug }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiMarketplace.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.aiPrompts.all });
      toast.success(t('ai.packInstalled'));
      setInstallConfirmPack(null);
      setDetailPack(null);
    },
    onError: (err: Error) => toast.error(err.message || t('ai.installationFailed')),
  });

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Store className="h-5 w-5" /> {t('ai.marketplaceTitle')}
            </h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder={t('ai.searchPacks')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t('ai.category')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('ai.allCategories')}</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Grid of Packs */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6 space-y-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent></Card>
          ))}
        </div>
      ) : isError ? (
        <Card><CardContent className="p-8 text-center text-zinc-500">{t('ai.failedToLoadMarketplace')}</CardContent></Card>
      ) : packs.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-zinc-500">
          <Package className="h-12 w-12 mx-auto mb-3 text-zinc-300" />
          <p className="text-lg font-medium">{t('ai.noPacks')}</p>
          <p className="text-sm mt-1">{t('ai.noPacksHint')}</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {packs.map((pack) => (
            <Card key={pack.id} className="hover:shadow-md transition-shadow flex flex-col">
              <CardContent className="p-6 flex-1 flex flex-col">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-lg shrink-0">
                    {pack.icon || '📦'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">{pack.name}</h3>
                    {pack.category && (
                      <Badge variant="secondary" className="mt-1 text-xs">{pack.category}</Badge>
                    )}
                  </div>
                </div>

                <p className="text-sm text-zinc-500 line-clamp-2 mb-3">{pack.description}</p>

                <div className="flex items-center gap-3 text-xs text-zinc-400 mb-4">
                  <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {pack.promptCount} {t('ai.promptsSuffix')}</span>
                  <span className="flex items-center gap-1"><Download className="h-3.5 w-3.5" /> {pack.installCount} {t('ai.installsSuffix')}</span>
                </div>

                <div className="mt-auto flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setDetailPack(pack)}>
                    {t('ai.viewDetails')}
                  </Button>
                  {pack.isInstalled ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 h-9 px-3 flex items-center">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {t('ai.installed')}
                    </Badge>
                  ) : (
                    <Button size="sm" className="flex-1" onClick={() => setInstallConfirmPack(pack)}>
                      <Download className="h-3.5 w-3.5 mr-1" /> {t('ai.install')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailPack} onOpenChange={(open) => { if (!open) setDetailPack(null); }}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailPack?.icon || '📦'} {detailPack?.name}
            </DialogTitle>
          </DialogHeader>
          {detailPack && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{detailPack.description}</p>
              <div className="flex items-center gap-3 text-sm text-zinc-500">
                <span>{detailPack.promptCount} {t('ai.promptsSuffix')}</span>
                <span>·</span>
                <span>{detailPack.installCount} {t('ai.installsSuffix')}</span>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">{t('ai.includedPrompts')}</h4>
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-2">
                    {detailPack.prompts?.map((p, i) => (
                      <div key={i} className="p-3 bg-zinc-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{p.name}</p>
                          {p.category && <Badge variant="outline" className="text-xs">{p.category}</Badge>}
                        </div>
                        {p.description && <p className="text-xs text-zinc-500 mt-1">{p.description}</p>}
                      </div>
                    ))}
                  </div>
                  <ScrollBar />
                </ScrollArea>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setDetailPack(null)}>{t('common.close')}</Button>
                {!detailPack.isInstalled && (
                  <Button className="flex-1" onClick={() => { setDetailPack(null); setInstallConfirmPack(detailPack); }}>
                    <Download className="h-4 w-4 mr-2" /> {t('ai.installPack')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Install Confirmation */}
      <AlertDialog open={!!installConfirmPack} onOpenChange={setInstallConfirmPack}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('ai.installPackTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('ai.installConfirmPrefix')}{installConfirmPack?.promptCount ?? 0}{t('ai.installConfirmMid')}{installConfirmPack?.name}{t('ai.installConfirmSuffix')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => installConfirmPack && installMutation.mutate(installConfirmPack.slug)}
              disabled={installMutation.isPending}
            >
              {installMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {t('ai.install')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
