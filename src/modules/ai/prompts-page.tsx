'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi, postApi, patchApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';
import type { PromptCategoryNew, PaginatedResponse } from '@/shared/types';
import { UNIVERSAL_OPERATIONS, type UniversalOperationKey } from '@/lib/ai/universal-prompt-definitions';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Plus, Search, Pencil, Trash2, Copy, LayoutGrid, List, ChevronLeft, ChevronRight, Loader2, MessageSquare, Shield, Eye, Sparkles, Info,
} from 'lucide-react';
import { useT } from '@/lib/i18n';
import { useSiteStore } from '@/lib/stores/site-store';
import { formatRelativeTime } from '@/lib/utils';

// -------------------- Types --------------------

interface AiPrompt {
  id: string;
  name: string;
  category: PromptCategoryNew;
  description: string | null;
  tags: string[];
  variables: Record<string, unknown> | null;
  systemPrompt: string;
  userPrompt: string;
  providerId: string | null;
  modelId: string | null;
  temperature: number | null;
  maxTokens: number | null;
  isActive: boolean;
  isFavorite: boolean;
  usageCount: number;
  sourceType: 'PLATFORM' | 'CLIENT';
  canEdit?: boolean;
  isPlatformManaged?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AiProvider {
  id: string;
  name: string;
  kind: string;
  isActive: boolean;
}

interface AiModel {
  id: string;
  name: string;
  providerId: string;
  type?: string;
}

interface PromptFormData {
  name: string;
  category: PromptCategoryNew;
  description: string;
  tags: string;
  variables: string;
  systemPrompt: string;
  userPrompt: string;
  providerId: string;
  modelId: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
}

// -------------------- Constants --------------------

const PROMPT_CATEGORIES: PromptCategoryNew[] = [
  'CONTENT_GENERATION', 'IMAGE_GENERATION', 'SEO', 'TRANSLATION',
  'SUMMARIZATION', 'MARKETING', 'SOCIAL_MEDIA', 'EMAIL', 'CODING', 'ANALYSIS',
];

const CATEGORY_COLORS: Record<PromptCategoryNew, string> = {
  CONTENT_GENERATION: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  IMAGE_GENERATION: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  SEO: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  TRANSLATION: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  SUMMARIZATION: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  MARKETING: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  SOCIAL_MEDIA: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  EMAIL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  CODING: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  ANALYSIS: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

const SUGGESTED_VARIABLES = [
  'topic',
  'language',
  'tone',
  'target_audience',
  'primary_keyword',
  'secondary_keywords',
  'word_count',
  'brief',
];

const emptyForm: PromptFormData = {
  name: '',
  category: 'CONTENT_GENERATION',
  description: '',
  tags: '',
  variables: '{}',
  systemPrompt: '',
  userPrompt: '',
  providerId: '',
  modelId: '',
  temperature: 0.7,
  maxTokens: 2048,
  isActive: true,
};

type ViewMode = 'table' | 'grid';
type SourceFilter = 'all' | 'platform' | 'client';

// -------------------- Component --------------------

export function PromptsPage() {
  const { t } = useT();

  const CATEGORY_LABELS: Record<PromptCategoryNew, string> = {
    CONTENT_GENERATION: t('ai.categoryContentGeneration') || 'Content Generation',
    IMAGE_GENERATION: t('ai.categoryImageGeneration') || 'Image Generation',
    SEO: t('ai.categorySEO') || 'SEO',
    TRANSLATION: t('ai.categoryTranslation') || 'Translation',
    SUMMARIZATION: t('ai.categorySummarization') || 'Summarization',
    MARKETING: t('ai.categoryMarketing') || 'Marketing',
    SOCIAL_MEDIA: t('ai.categorySocialMedia') || 'Social Media',
    EMAIL: t('ai.categoryEmail') || 'Email',
    CODING: t('ai.categoryCoding') || 'Coding',
    ANALYSIS: t('ai.categoryAnalysis') || 'Analysis',
  };

  const isAllSites = useSiteStore((s) => s.isAllSites());
  const activeSiteDbId = useSiteStore((s) => s.activeSiteDbId);
  const siteIdParam = !isAllSites && activeSiteDbId ? activeSiteDbId : undefined;

  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(!isAllSites && activeSiteDbId ? 'client' : 'all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AiPrompt | null>(null);
  const [formData, setFormData] = useState<PromptFormData>(emptyForm);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPrompt, setDeletingPrompt] = useState<AiPrompt | null>(null);

  // Sync source filter when active site changes
  React.useEffect(() => {
    if (!isAllSites && activeSiteDbId) {
      setSourceFilter('client');
    }
    setPage(1);
  }, [isAllSites, activeSiteDbId]);

  // Fetch prompts
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.aiPrompts.list({
      page,
      pageSize,
      search,
      category: categoryFilter,
      source: sourceFilter,
      siteId: siteIdParam,
    }),
    queryFn: () =>
      getApi<PaginatedResponse<AiPrompt> & { entitlements?: { hasPlatformAi: boolean; hasClientAi: boolean; isStaff: boolean; canCreateCustom: boolean } }>(
        '/api/ai/prompts',
        {
          page,
          pageSize,
          search: search || undefined,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
          source: sourceFilter !== 'all' ? sourceFilter : undefined,
          siteId: siteIdParam,
        },
      ),
  });

  const prompts = data?.data ?? [];
  const pagination = data?.pagination;
  const entitlements = (data as any)?.entitlements;
  const canCreateCustom = entitlements?.canCreateCustom ?? true;

  // Fetch active providers for the form
  const { data: providersData } = useQuery({
    queryKey: queryKeys.aiProviders.list({ isActive: true }),
    queryFn: () => getApi<PaginatedResponse<AiProvider>>('/api/ai/providers', { isActive: true, pageSize: 100 }),
  });
  const activeProviders = providersData?.data ?? [];

  // Fetch models filtered by selected provider
  const { data: modelsData } = useQuery({
    queryKey: queryKeys.aiModels.list({ providerId: formData.providerId || undefined, isActive: true }),
    queryFn: () =>
      getApi<PaginatedResponse<AiModel>>('/api/ai/models', {
        providerId: formData.providerId || undefined,
        pageSize: 100,
        isActive: true,
      }),
    enabled: !!formData.providerId,
  });
  const models = (modelsData?.data ?? []).filter((m) => m.type?.toUpperCase() !== 'IMAGE');

  // Create / Update mutation
  const saveMutation = useMutation({
    mutationFn: (body: PromptFormData) => {
      let parsedVariables: Record<string, unknown> = {};
      const trimmed = body.variables?.trim();
      if (trimmed) {
        try {
          parsedVariables = JSON.parse(trimmed);
        } catch {
          throw new Error(t('ai.variablesValidJson') || 'Variables must be valid JSON');
        }
      }
      const payload = {
        name: body.name.trim(),
        category: body.category,
        description: body.description?.trim() || null,
        tags: body.tags ? body.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        variables: parsedVariables,
        systemPrompt: body.systemPrompt?.trim() || null,
        userPrompt: body.userPrompt?.trim() || null,
        providerId: body.providerId?.trim() ? body.providerId.trim() : null,
        modelId: body.modelId?.trim() ? body.modelId.trim() : null,
        temperature: typeof body.temperature === 'number' ? body.temperature : 0.7,
        maxTokens: Number(body.maxTokens) || 2048,
        isActive: body.isActive ?? true,
        siteId: siteIdParam || null,
      };
      if (editingPrompt) {
        return patchApi<AiPrompt>(`/api/ai/prompts/${editingPrompt.id}`, payload);
      }
      return postApi<AiPrompt>('/api/ai/prompts', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiPrompts.all });
      toast.success(editingPrompt ? (t('ai.promptUpdated') || 'Prompt updated') : (t('ai.promptCreated') || 'Prompt created'));
      handleCloseDialog();
    },
    onError: (err: Error) => toast.error(err.message || t('ai.failedToSavePrompt') || 'Failed to save prompt'),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/ai/prompts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiPrompts.all });
      toast.success(t('ai.promptDeleted') || 'Prompt deleted');
      setDeleteDialogOpen(false);
      setDeletingPrompt(null);
    },
    onError: (err: Error) => toast.error(err.message || t('ai.failedToDeletePrompt') || 'Failed to delete prompt'),
  });

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: (id: string) =>
      postApi(`/api/ai/prompts/${id}/duplicate${siteIdParam ? `?siteId=${siteIdParam}` : ''}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiPrompts.all });
      toast.success(t('ai.promptDuplicated') || 'Prompt duplicated to My Prompts');
    },
    onError: (err: Error) => toast.error(err.message || t('ai.failedToDuplicate') || 'Failed to duplicate'),
  });

  // Active-status toggle — reuses the existing PATCH endpoint with a
  // partial body ({ isActive }): the API accepts field-level updates, so
  // no duplicate status system is created.
  const toggleActiveMutation = useMutation({
    mutationFn: (prompt: AiPrompt) =>
      patchApi<AiPrompt>(`/api/ai/prompts/${prompt.id}`, { isActive: !prompt.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiPrompts.all });
    },
    onError: (err: Error) => toast.error(err.message || t('ai.failedToSavePrompt') || 'Failed to update prompt'),
  });

  const handleOpenCreate = () => {
    setEditingPrompt(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (prompt: AiPrompt) => {
    setEditingPrompt(prompt);
    setFormData({
      name: prompt.name,
      category: prompt.category,
      description: prompt.description ?? '',
      tags: Array.isArray(prompt.tags) ? prompt.tags.join(', ') : '',
      variables: JSON.stringify(prompt.variables ?? {}, null, 2),
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      providerId: prompt.providerId ?? '',
      modelId: prompt.modelId ?? '',
      // Null guards: temperature / maxTokens are nullable in the schema —
      // API-created or seeded prompts may omit them. Fall back to the same
      // defaults the create form and the API use (0.7 / 2048) so the edit
      // dialog never crashes on .toFixed / parseInt with null.
      temperature: prompt.temperature ?? 0.7,
      maxTokens: prompt.maxTokens ?? 2048,
      isActive: prompt.isActive,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPrompt(null);
    setFormData(emptyForm);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error(t('ai.nameRequired') || 'Name is required');
      return;
    }
    if (formData.variables.trim() && formData.variables.trim() !== '{}') {
      try {
        const parsed = JSON.parse(formData.variables);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          toast.error(t('ai.variablesJsonObject') || 'Variables must be a valid JSON object');
          return;
        }
      } catch {
        toast.error(t('ai.variablesValidJson') || 'Variables must be valid JSON');
        return;
      }
    }
    saveMutation.mutate(formData);
  };

  const handleLoadTemplate = (opKey: UniversalOperationKey) => {
    const op = UNIVERSAL_OPERATIONS[opKey];
    if (!op) return;
    const varsObj: Record<string, unknown> = {};
    for (const v of op.variables) {
      varsObj[v.name] = v.default !== undefined ? v.default : '';
    }
    setFormData((prev) => ({
      ...prev,
      name: prev.name ? prev.name : op.name,
      category: op.category,
      description: prev.description ? prev.description : op.description,
      tags: op.tags.join(', '),
      variables: JSON.stringify(varsObj, null, 2),
      systemPrompt: op.defaultSystemPrompt,
      userPrompt: op.defaultUserPrompt,
      temperature: op.defaultTemperature,
      maxTokens: op.defaultMaxTokens,
    }));
    toast.success(`Loaded template: ${op.name}`);
  };

  const handleInsertVariable = (varName: string) => {
    const token = `{{${varName}}}`;
    setFormData((prev) => ({
      ...prev,
      userPrompt: prev.userPrompt ? `${prev.userPrompt} ${token}` : token,
    }));
  };

  const isReadOnly = editingPrompt ? !editingPrompt.canEdit : false;

  return (
    <div className="space-y-6">
      {/* Filters & Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                {t('ai.promptLibrary') || 'Prompt Library'}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Universal, domain-agnostic prompts powered by Site Context and Universal System Skills.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-r-none"
                  onClick={() => setViewMode('table')}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-l-none"
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
              {canCreateCustom && (
                <Button onClick={handleOpenCreate} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('ai.addPrompt') || 'Add Prompt'}
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder={t('ai.searchPrompts') || 'Search prompts...'}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={categoryFilter}
              onValueChange={(v) => {
                setCategoryFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t('ai.category') || 'Category'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('ai.allCategories') || 'All Categories'}</SelectItem>
                {PROMPT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sourceFilter}
              onValueChange={(v) => {
                setSourceFilter(v as SourceFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">{!isAllSites ? 'Site Prompts' : 'My Prompts'}</SelectItem>
                <SelectItem value="platform">Platform Templates</SelectItem>
                <SelectItem value="all">All Sources</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table View */}
      {viewMode === 'table' && (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <Table className="[&_th]:px-3 [&_td]:px-3 [&_td]:py-3">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[240px]">{t('common.name') || 'Name'}</TableHead>
                    <TableHead>{t('ai.category') || 'Category'}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('users.updatedColumn') || 'Updated'}</TableHead>
                    <TableHead className="text-center">{t('common.status') || 'Status'}</TableHead>
                    <TableHead className="w-[100px] text-center">{t('common.actions') || 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto rounded-full" /></TableCell>
                        <TableCell className="text-center"><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : isError ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-zinc-500">
                        {t('ai.failedToLoadPrompts') || 'Failed to load prompts'}
                      </TableCell>
                    </TableRow>
                  ) : prompts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-zinc-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <MessageSquare className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                          <p className="font-medium text-sm text-zinc-700 dark:text-zinc-300">
                            {t('ai.noPromptsHint') || 'No prompts found for this site.'}
                          </p>
                          <p className="text-xs text-zinc-400 max-w-sm">
                            You haven&apos;t added any prompts for this site yet. Create custom prompts or view platform templates.
                          </p>
                          {canCreateCustom && (
                            <Button size="sm" className="mt-2 text-xs" onClick={handleOpenCreate}>
                              <Plus className="h-3.5 w-3.5 mr-1.5" />
                              {t('ai.addPrompt') || 'Add Prompt'}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    prompts.map((prompt) => (
                      <TableRow key={prompt.id}>
                        <TableCell className="max-w-[480px]">
                          <span className="font-medium block truncate" title={prompt.name}>
                            {prompt.name}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={CATEGORY_COLORS[prompt.category] ?? ''}>
                            {CATEGORY_LABELS[prompt.category] ?? prompt.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          <span title={new Date(prompt.updatedAt).toLocaleString()}>
                            {formatRelativeTime(prompt.updatedAt)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={prompt.isActive}
                            disabled={!prompt.canEdit || (toggleActiveMutation.isPending && toggleActiveMutation.variables?.id === prompt.id)}
                            onCheckedChange={() => toggleActiveMutation.mutate(prompt)}
                            aria-label={prompt.name}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleOpenEdit(prompt)}
                              aria-label={prompt.canEdit ? (t('common.edit') || 'Edit prompt') : 'View prompt'}
                              title={prompt.canEdit ? (t('common.edit') || 'Edit') : 'View'}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {prompt.canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                onClick={() => {
                                  setDeletingPrompt(prompt);
                                  setDeleteDialogOpen(true);
                                }}
                                aria-label={t('common.delete') || 'Delete prompt'}
                                title={t('common.delete') || 'Delete'}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <ScrollBar />
            </ScrollArea>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-3 py-3 border-t">
                <p className="text-sm text-zinc-500">
                  {(pagination.page - 1) * pagination.pageSize + 1}–
                  {Math.min(pagination.page * pagination.pageSize, pagination.total)} {t('common.of') || 'of'} {pagination.total}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">{pagination.page} / {pagination.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4 space-y-3"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))
          ) : prompts.length === 0 ? (
            <div className="col-span-full text-center py-12 text-zinc-500">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
              <p className="font-medium text-sm text-zinc-700 dark:text-zinc-300">
                {t('ai.noPromptsGrid') || 'No prompts found for this site.'}
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                You haven&apos;t added any prompts for this site yet.
              </p>
              {canCreateCustom && (
                <Button size="sm" className="mt-3 text-xs" onClick={handleOpenCreate}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  {t('ai.addPrompt') || 'Add Prompt'}
                </Button>
              )}
            </div>
          ) : (
            prompts.map((prompt) => (
              <Card key={prompt.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex flex-col gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <h3 className="font-semibold leading-snug break-words" title={prompt.name}>
                      {prompt.name}
                    </h3>
                    <Badge variant="secondary" className={`${CATEGORY_COLORS[prompt.category] ?? ''} text-xs`}>
                      {CATEGORY_LABELS[prompt.category] ?? prompt.category}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t mt-auto">
                    <Switch
                      checked={prompt.isActive}
                      disabled={!prompt.canEdit || (toggleActiveMutation.isPending && toggleActiveMutation.variables?.id === prompt.id)}
                      onCheckedChange={() => toggleActiveMutation.mutate(prompt)}
                      aria-label={prompt.name}
                    />
                    <div className="flex items-center gap-1">
                      {prompt.canEdit ? (
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleOpenEdit(prompt)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />{t('common.edit') || 'Edit'}
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleOpenEdit(prompt)}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                      )}
                      {prompt.canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          aria-label={t('common.delete') || 'Delete'}
                          onClick={() => {
                            setDeletingPrompt(prompt);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); }}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingPrompt ? (
                isReadOnly ? (
                  <>
                    <Shield className="h-5 w-5 text-purple-600" />
                    View Platform Prompt (Read-Only)
                  </>
                ) : (
                  <>
                    <Pencil className="h-5 w-5 text-indigo-600" />
                    {t('ai.editPrompt') || 'Edit Prompt'}
                  </>
                )
              ) : (
                <>
                  <Plus className="h-5 w-5 text-indigo-600" />
                  {t('ai.createPrompt') || 'Create Reusable Prompt'}
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Universal prompts define operation behavior. Site context (niche, audience, tone) and platform system skills are automatically merged at runtime.
            </DialogDescription>
          </DialogHeader>

          {isReadOnly && (
            <div className="flex items-start gap-2 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg p-3 text-xs text-purple-800 dark:text-purple-300">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Platform-Managed Prompt</p>
                <p className="mt-0.5 text-purple-700/90 dark:text-purple-400">
                  This prompt is maintained centrally by the platform and cannot be directly modified. To customize it for your account, duplicate it to &quot;My Prompts&quot;.
                </p>
              </div>
            </div>
          )}

          {!editingPrompt && (
            <div className="bg-zinc-50 dark:bg-zinc-900 border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Load Universal Operation Template
                </Label>
                <span className="text-[11px] text-muted-foreground">Pre-fill standard parameters</span>
              </div>
              <Select onValueChange={(v) => handleLoadTemplate(v as UniversalOperationKey)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select an operation to load defaults..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {Object.entries(UNIVERSAL_OPERATIONS).map(([key, op]) => (
                    <SelectItem key={key} value={key} className="text-xs">
                      [{CATEGORY_LABELS[op.category] || op.category}] {op.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="prompt-name">{t('common.name') || 'Prompt Name'}</Label>
              <Input
                id="prompt-name"
                disabled={isReadOnly}
                placeholder={t('ai.promptNamePlaceholder') || 'e.g., Blog Article Writer'}
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t('ai.category') || 'Category'}</Label>
                <Select
                  disabled={isReadOnly}
                  value={formData.category}
                  onValueChange={(v) => setFormData((p) => ({ ...p, category: v as PromptCategoryNew }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROMPT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prompt-tags">{t('ai.tagsLabel') || 'Tags (comma separated)'}</Label>
                <Input
                  id="prompt-tags"
                  disabled={isReadOnly}
                  placeholder="universal, article, blog"
                  value={formData.tags}
                  onChange={(e) => setFormData((p) => ({ ...p, tags: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="prompt-desc">{t('ai.description') || 'Description'}</Label>
              <Input
                id="prompt-desc"
                disabled={isReadOnly}
                placeholder="Clear summary of what this operation accomplishes"
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="prompt-vars">{t('ai.variablesLabel') || 'Variables Schema (JSON)'}</Label>
                <span className="text-[11px] text-zinc-400">Values supplied at execution</span>
              </div>
              <Textarea
                id="prompt-vars"
                rows={3}
                disabled={isReadOnly}
                placeholder='{"topic": "", "word_count": 1000, "tone": "Professional"}'
                value={formData.variables}
                onChange={(e) => setFormData((p) => ({ ...p, variables: e.target.value }))}
                className="font-mono text-xs"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="prompt-system">{t('ai.systemPrompt') || 'Operation System Prompt'}</Label>
              <Textarea
                id="prompt-system"
                rows={4}
                disabled={isReadOnly}
                placeholder="System instructions for how this operation is performed..."
                value={formData.systemPrompt}
                onChange={(e) => setFormData((p) => ({ ...p, systemPrompt: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="prompt-user">{t('ai.userPrompt') || 'User Prompt Template'}</Label>
                <span className="text-[11px] text-zinc-400">Uses {`{{variable}}`} syntax</span>
              </div>
              <Textarea
                id="prompt-user"
                rows={4}
                disabled={isReadOnly}
                placeholder="Write an article about {{topic}} for {{target_audience}}..."
                value={formData.userPrompt}
                onChange={(e) => setFormData((p) => ({ ...p, userPrompt: e.target.value }))}
              />
              {!isReadOnly && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-muted-foreground mr-1">Insert variable:</span>
                  {SUGGESTED_VARIABLES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleInsertVariable(v)}
                      className="px-1.5 py-0.5 text-[11px] bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded border font-mono transition-colors"
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t('ai.provider') || 'AI Provider (Optional)'}</Label>
                <Select
                  disabled={isReadOnly}
                  value={formData.providerId || '__system_default__'}
                  onValueChange={(v) =>
                    setFormData((p) => ({
                      ...p,
                      providerId: v === '__system_default__' ? '' : v,
                      modelId: '',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="System Default (AI Settings)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__system_default__">System AI Settings (Default)</SelectItem>
                    {activeProviders.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>{t('ai.model') || 'AI Model (Optional)'}</Label>
                <Select
                  disabled={isReadOnly || !formData.providerId}
                  value={formData.modelId || '__provider_default__'}
                  onValueChange={(v) =>
                    setFormData((p) => ({
                      ...p,
                      modelId: v === '__provider_default__' ? '' : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        formData.providerId ? 'Provider Default Model' : 'Uses System Default Model'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__provider_default__">Provider Default Model</SelectItem>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t('ai.temperature') || 'Temperature'}: {formData.temperature.toFixed(1)}</Label>
                <Slider
                  disabled={isReadOnly}
                  min={0}
                  max={2}
                  step={0.1}
                  value={[formData.temperature]}
                  onValueChange={([v]) => setFormData((p) => ({ ...p, temperature: v }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prompt-tokens">{t('ai.maxTokens') || 'Operation Max Tokens'}</Label>
                <Input
                  id="prompt-tokens"
                  type="number"
                  disabled={isReadOnly}
                  min={1}
                  max={128000}
                  value={formData.maxTokens}
                  onChange={(e) => setFormData((p) => ({ ...p, maxTokens: parseInt(e.target.value) || 2048 }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <Label htmlFor="prompt-active">{t('common.active') || 'Active for AI Workflows'}</Label>
                <p className="text-xs text-muted-foreground">
                  When inactive, workflows automatically fall back to the built-in universal operation prompt.
                </p>
              </div>
              <Switch
                id="prompt-active"
                disabled={isReadOnly}
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData((p) => ({ ...p, isActive: checked }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCloseDialog}>{t('common.cancel') || 'Cancel'}</Button>
            {editingPrompt && !editingPrompt.canEdit && canCreateCustom && (
              <Button
                variant="secondary"
                onClick={() => {
                  handleCloseDialog();
                  duplicateMutation.mutate(editingPrompt.id);
                }}
              >
                <Copy className="h-4 w-4 mr-2" /> Duplicate to My Prompts
              </Button>
            )}
            {!isReadOnly && (
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingPrompt ? (t('ai.update') || 'Update Prompt') : (t('common.create') || 'Create Prompt')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete') || 'Confirm Delete'}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('ai.deletePromptConfirm') || 'Are you sure you want to delete this prompt? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel') || 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deletingPrompt && deleteMutation.mutate(deletingPrompt.id)}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('common.delete') || 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
