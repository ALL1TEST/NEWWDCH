'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi, postApi, patchApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';
import type { PaginatedResponse } from '@/shared/types';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search, Star, RefreshCw, Boxes, ChevronLeft, ChevronRight, Loader2, Eye, Check,
} from 'lucide-react';

// -------------------- Types --------------------

interface AiModel {
  id: string;
  name: string;
  providerId: string;
  provider?: { id: string; name: string; kind: string };
  contextLength: number | null;
  inputCostPerMToken: number | null;
  outputCostPerMToken: number | null;
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
  supportsJsonMode: boolean;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsImages: boolean;
  isDefault: boolean;
  isActive: boolean;
}

interface AiProvider {
  id: string;
  name: string;
  kind: string;
  isActive: boolean;
}

// -------------------- Component --------------------

export function ModelsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  // Fetch providers
  const { data: providersData } = useQuery({
    queryKey: queryKeys.aiProviders.list(),
    queryFn: () => getApi<PaginatedResponse<AiProvider>>('/api/ai/providers', { pageSize: 100 }),
  });
  const providers = providersData?.data ?? [];

  // Fetch models
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.aiModels.list({ page, pageSize, search, providerId: providerFilter }),
    queryFn: () => getApi<PaginatedResponse<AiModel>>('/api/ai/models', {
      page, pageSize,
      search: search || undefined,
      providerId: providerFilter !== 'all' ? providerFilter : undefined,
    }),
  });

  const models = data?.data ?? [];
  const pagination = data?.pagination;

  // Set default mutation
  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/ai/models/${id}/set-default`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiModels.all });
      toast.success('Default model updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to set default'),
  });

  // Sync all providers mutation
  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const active = providers.filter((p) => p.isActive);
      let totalSynced = 0;
      for (const provider of active) {
        try {
          const res = await postApi<{ count?: number }>(`/api/ai/providers/${provider.id}/sync-models`);
          totalSynced += res?.count ?? 0;
        } catch {
          // continue
        }
      }
      return totalSynced;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiModels.all });
      toast.success(`Synced ${count} models across all providers`);
    },
    onError: (err: Error) => toast.error(err.message || 'Sync failed'),
  });

  // Toggle active
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      patchApi(`/api/ai/models/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiModels.all });
    },
  });

  const CAPABILITY_BADGES: { key: keyof AiModel; label: string; color: string }[] = [
    { key: 'supportsVision', label: 'Vision', color: 'bg-violet-100 text-violet-700' },
    { key: 'supportsFunctionCalling', label: 'Function Calling', color: 'bg-orange-100 text-orange-700' },
    { key: 'supportsJsonMode', label: 'JSON Mode', color: 'bg-emerald-100 text-emerald-700' },
    { key: 'supportsStreaming', label: 'Streaming', color: 'bg-sky-100 text-sky-700' },
    { key: 'supportsTools', label: 'Tools', color: 'bg-rose-100 text-rose-700' },
    { key: 'supportsImages', label: 'Images', color: 'bg-amber-100 text-amber-700' },
  ];

  return (
    <div className="space-y-6">
      {/* Filters & Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">AI Models</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}>
                {viewMode === 'table' ? <Boxes className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {viewMode === 'table' ? 'Cards' : 'Table'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => syncAllMutation.mutate()} disabled={syncAllMutation.isPending}>
                {syncAllMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Sync All
              </Button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search models..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={providerFilter} onValueChange={(v) => { setProviderFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table View */}
      {viewMode === 'table' && (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="hidden md:table-cell">Context</TableHead>
                    <TableHead className="hidden lg:table-cell">Input $/M</TableHead>
                    <TableHead className="hidden lg:table-cell">Output $/M</TableHead>
                    <TableHead className="hidden xl:table-cell">Capabilities</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 9 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>
                      ))}</TableRow>
                    ))
                  ) : isError ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-zinc-500">Failed to load models</TableCell></TableRow>
                  ) : models.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-zinc-500">
                      <Boxes className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
                      No models found. Sync models from your providers.
                    </TableCell></TableRow>
                  ) : models.map((model) => (
                    <React.Fragment key={model.id}>
                      <TableRow>
                        <TableCell className="font-medium">{model.name}</TableCell>
                        <TableCell>{model.provider?.name ?? model.providerId}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {model.contextLength ? `${(model.contextLength / 1000).toFixed(0)}K` : '—'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {model.inputCostPerMToken != null ? `$${model.inputCostPerMToken.toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {model.outputCostPerMToken != null ? `$${model.outputCostPerMToken.toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {CAPABILITY_BADGES.filter((c) => model[c.key]).map((c) => (
                              <Badge key={c.key} variant="secondary" className={`${c.color} text-[10px] px-1.5 py-0`}>{c.label}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {model.isDefault ? (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700">Default</Badge>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setDefaultMutation.mutate(model.id)}>
                              <Star className="h-3.5 w-3.5 text-zinc-400" />
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch checked={model.isActive} onCheckedChange={(checked) => toggleMutation.mutate({ id: model.id, isActive: checked })} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setExpandedModel(expandedModel === model.id ? null : model.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedModel === model.id && (
                        <TableRow>
                          <TableCell colSpan={9} className="bg-zinc-50 p-4">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <div><p className="text-xs text-zinc-500">Context Length</p><p className="font-medium">{model.contextLength?.toLocaleString() ?? '—'}</p></div>
                              <div><p className="text-xs text-zinc-500">Input Cost</p><p className="font-medium">{model.inputCostPerMToken != null ? `$${model.inputCostPerMToken.toFixed(2)}/M tokens` : '—'}</p></div>
                              <div><p className="text-xs text-zinc-500">Output Cost</p><p className="font-medium">{model.outputCostPerMToken != null ? `$${model.outputCostPerMToken.toFixed(2)}/M tokens` : '—'}</p></div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {CAPABILITY_BADGES.map((c) => (
                                <div key={c.key} className="flex items-center gap-1.5">
                                  {model[c.key] ? (
                                    <Check className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <span className="h-4 w-4 rounded-full border border-zinc-300" />
                                  )}
                                  <span className="text-sm">{c.label}</span>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
              <ScrollBar />
            </ScrollArea>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-zinc-500">
                  {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-sm">{pagination.page} / {pagination.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cards View */}
      {viewMode === 'cards' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}><CardContent className="p-4 space-y-3"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-12 w-full" /></CardContent></Card>
              ))
            ) : models.length === 0 ? (
              <div className="col-span-full text-center py-12 text-zinc-500">
                <Boxes className="h-10 w-10 mx-auto mb-3 text-zinc-300" />
                No models found.
              </div>
            ) : models.map((model) => (
              <Card key={model.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{model.name}</h3>
                      <p className="text-sm text-zinc-500">{model.provider?.name ?? model.providerId}</p>
                    </div>
                    {model.isDefault ? (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 shrink-0">Default</Badge>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => setDefaultMutation.mutate(model.id)}>
                        <Star className="h-4 w-4 text-zinc-400" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-xs text-zinc-500">Context</p><p className="text-sm font-medium">{model.contextLength ? `${(model.contextLength / 1000).toFixed(0)}K` : '—'}</p></div>
                    <div><p className="text-xs text-zinc-500">In $/M</p><p className="text-sm font-medium">{model.inputCostPerMToken != null ? `$${model.inputCostPerMToken.toFixed(2)}` : '—'}</p></div>
                    <div><p className="text-xs text-zinc-500">Out $/M</p><p className="text-sm font-medium">{model.outputCostPerMToken != null ? `$${model.outputCostPerMToken.toFixed(2)}` : '—'}</p></div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {CAPABILITY_BADGES.filter((c) => model[c.key]).map((c) => (
                      <Badge key={c.key} variant="secondary" className={`${c.color} text-[10px] px-1.5 py-0`}>{c.label}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <Switch checked={model.isActive} onCheckedChange={(checked) => toggleMutation.mutate({ id: model.id, isActive: checked })} />
                      <span className="text-xs text-zinc-500">Active</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm">Page {pagination.page} of {pagination.totalPages}</span>
              <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
