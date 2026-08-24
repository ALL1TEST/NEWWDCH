'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi, postApi, patchApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';
import type { PromptCategoryNew, PaginatedResponse } from '@/shared/types';

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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Plus, Search, MoreHorizontal, Pencil, Trash2, Star, Copy, LayoutGrid, List, History, ChevronLeft, ChevronRight, Loader2, MessageSquare, Heart,
} from 'lucide-react';

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
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  isFavorite: boolean;
  usageCount: number;
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

interface PromptVersion {
  id: string;
  version: number;
  systemPrompt: string;
  userPrompt: string;
  createdAt: string;
}

// -------------------- Constants --------------------

const PROMPT_CATEGORIES: PromptCategoryNew[] = [
  'CONTENT_GENERATION', 'IMAGE_GENERATION', 'SEO', 'TRANSLATION',
  'SUMMARIZATION', 'MARKETING', 'SOCIAL_MEDIA', 'EMAIL', 'CODING', 'ANALYSIS', 'CUSTOM',
];

const CATEGORY_LABELS: Record<PromptCategoryNew, string> = {
  CONTENT_GENERATION: 'Content Generation',
  IMAGE_GENERATION: 'Image Generation',
  SEO: 'SEO',
  TRANSLATION: 'Translation',
  SUMMARIZATION: 'Summarization',
  MARKETING: 'Marketing',
  SOCIAL_MEDIA: 'Social Media',
  EMAIL: 'Email',
  CODING: 'Coding',
  ANALYSIS: 'Analysis',
  CUSTOM: 'Custom',
};

const CATEGORY_COLORS: Record<PromptCategoryNew, string> = {
  CONTENT_GENERATION: 'bg-emerald-100 text-emerald-700',
  IMAGE_GENERATION: 'bg-violet-100 text-violet-700',
  SEO: 'bg-orange-100 text-orange-700',
  TRANSLATION: 'bg-sky-100 text-sky-700',
  SUMMARIZATION: 'bg-cyan-100 text-cyan-700',
  MARKETING: 'bg-rose-100 text-rose-700',
  SOCIAL_MEDIA: 'bg-pink-100 text-pink-700',
  EMAIL: 'bg-amber-100 text-amber-700',
  CODING: 'bg-teal-100 text-teal-700',
  ANALYSIS: 'bg-zinc-100 text-zinc-700',
  CUSTOM: 'bg-stone-100 text-stone-700',
};

const emptyForm: PromptFormData = {
  name: '',
  category: 'CUSTOM',
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

type ViewMode = 'grid' | 'table';
type FavFilter = 'all' | 'favorites';

// -------------------- Component --------------------

export function PromptsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [favFilter, setFavFilter] = useState<FavFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AiPrompt | null>(null);
  const [formData, setFormData] = useState<PromptFormData>(emptyForm);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPrompt, setDeletingPrompt] = useState<AiPrompt | null>(null);
  const [versionsDialogOpen, setVersionsDialogOpen] = useState(false);
  const [versionsPrompt, setVersionsPrompt] = useState<AiPrompt | null>(null);

  // Fetch prompts
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.aiPrompts.list({ page, pageSize, search, category: categoryFilter, isFavorite: favFilter }),
    queryFn: () => getApi<PaginatedResponse<AiPrompt>>('/api/ai/prompts', {
      page, pageSize,
      search: search || undefined,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      isFavorite: favFilter === 'favorites' ? true : undefined,
    }),
  });

  const prompts = data?.data ?? [];
  const pagination = data?.pagination;

  // Fetch active providers for the form
  const { data: providersData } = useQuery({
    queryKey: queryKeys.aiProviders.list({ isActive: true }),
    queryFn: () => getApi<PaginatedResponse<AiProvider>>('/api/ai/providers', { isActive: true, pageSize: 100 }),
  });
  const activeProviders = providersData?.data ?? [];

  // Fetch models filtered by selected provider
  const { data: modelsData } = useQuery({
    queryKey: queryKeys.aiModels.list({ providerId: formData.providerId || undefined }),
    queryFn: () => getApi<PaginatedResponse<AiModel>>('/api/ai/models', {
      providerId: formData.providerId || undefined,
      pageSize: 100,
    }),
    enabled: !!formData.providerId,
  });
  const models = modelsData?.data ?? [];

  // Fetch versions
  const { data: versionsData } = useQuery({
    queryKey: queryKeys.aiPrompts.nested('versions').list(versionsPrompt?.id ?? ''),
    queryFn: () => getApi<PromptVersion[]>(`/api/ai/prompts/${versionsPrompt!.id}/versions`),
    enabled: !!versionsPrompt,
  });
  const versions = versionsData ?? [];

  // Create / Update mutation
  const saveMutation = useMutation({
    mutationFn: (body: PromptFormData) => {
      const payload = {
        ...body,
        tags: body.tags.split(',').map((t) => t.trim()).filter(Boolean),
        variables: (() => { try { return JSON.parse(body.variables); } catch { return {}; } })(),
        providerId: body.providerId || null,
        modelId: body.modelId || null,
      };
      if (editingPrompt) {
        return patchApi<AiPrompt>(`/api/ai/prompts/${editingPrompt.id}`, payload);
      }
      return postApi<AiPrompt>('/api/ai/prompts', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiPrompts.all });
      toast.success(editingPrompt ? 'Prompt updated' : 'Prompt created');
      handleCloseDialog();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save prompt'),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/ai/prompts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiPrompts.all });
      toast.success('Prompt deleted');
      setDeleteDialogOpen(false);
      setDeletingPrompt(null);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete prompt'),
  });

  // Favorite toggle
  const favMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/ai/prompts/${id}/favorite`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiPrompts.all });
    },
  });

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: (id: string) => postApi(`/api/ai/prompts/${id}/duplicate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiPrompts.all });
      toast.success('Prompt duplicated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to duplicate'),
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
      tags: prompt.tags?.join(', ') ?? '',
      variables: JSON.stringify(prompt.variables ?? {}, null, 2),
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      providerId: prompt.providerId ?? '',
      modelId: prompt.modelId ?? '',
      temperature: prompt.temperature,
      maxTokens: prompt.maxTokens,
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
      toast.error('Name is required');
      return;
    }
    saveMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      {/* Filters & Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Prompt Library</h2>
            <div className="flex items-center gap-2">
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                  size="sm" className="rounded-r-none"
                  onClick={() => setViewMode('table')}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm" className="rounded-l-none"
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={handleOpenCreate} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Prompt
              </Button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search prompts..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {PROMPT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={favFilter} onValueChange={(v) => { setFavFilter(v as FavFilter); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="favorites">Favorites</SelectItem>
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
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="hidden md:table-cell">Tags</TableHead>
                    <TableHead className="hidden lg:table-cell">Vars</TableHead>
                    <TableHead className="hidden lg:table-cell">Usage</TableHead>
                    <TableHead>Fav</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>
                      ))}</TableRow>
                    ))
                  ) : isError ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-zinc-500">Failed to load prompts</TableCell></TableRow>
                  ) : prompts.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-zinc-500">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
                      No prompts found. Create your first prompt to get started.
                    </TableCell></TableRow>
                  ) : prompts.map((prompt) => (
                    <TableRow key={prompt.id}>
                      <TableCell className="font-medium">{prompt.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={CATEGORY_COLORS[prompt.category]}>
                          {CATEGORY_LABELS[prompt.category]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {prompt.tags?.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                          ))}
                          {(prompt.tags?.length ?? 0) > 3 && (
                            <Badge variant="outline" className="text-xs">+{prompt.tags!.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {prompt.variables ? Object.keys(prompt.variables).length : 0}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{prompt.usageCount}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => favMutation.mutate(prompt.id)}>
                          <Heart className={`h-4 w-4 ${prompt.isFavorite ? 'fill-red-500 text-red-500' : 'text-zinc-400'}`} />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Badge variant={prompt.isActive ? 'default' : 'secondary'} className={prompt.isActive ? 'bg-green-100 text-green-700' : ''}>
                          {prompt.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEdit(prompt)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicateMutation.mutate(prompt.id)}><Copy className="h-4 w-4 mr-2" />Duplicate</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setVersionsPrompt(prompt); setVersionsDialogOpen(true); }}><History className="h-4 w-4 mr-2" />Version History</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={() => { setDeletingPrompt(prompt); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
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

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4 space-y-3"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))
          ) : prompts.length === 0 ? (
            <div className="col-span-full text-center py-12 text-zinc-500">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 text-zinc-300" />
              No prompts found. Create your first prompt.
            </div>
          ) : prompts.map((prompt) => (
            <Card key={prompt.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{prompt.name}</h3>
                    <Badge variant="secondary" className={`${CATEGORY_COLORS[prompt.category]} mt-1`}>
                      {CATEGORY_LABELS[prompt.category]}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => favMutation.mutate(prompt.id)}>
                    <Heart className={`h-4 w-4 ${prompt.isFavorite ? 'fill-red-500 text-red-500' : 'text-zinc-400'}`} />
                  </Button>
                </div>
                {prompt.description && <p className="text-sm text-zinc-500 line-clamp-2">{prompt.description}</p>}
                <div className="flex flex-wrap gap-1">
                  {prompt.tags?.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{prompt.usageCount} uses</span>
                  <Badge variant={prompt.isActive ? 'default' : 'secondary'} className={prompt.isActive ? 'bg-green-100 text-green-700' : ''}>
                    {prompt.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleOpenEdit(prompt)}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                  <Button variant="outline" size="sm" onClick={() => duplicateMutation.mutate(prompt.id)}><Copy className="h-3.5 w-3.5" /></Button>
                  <Button variant="outline" size="sm" className="text-red-600" onClick={() => { setDeletingPrompt(prompt); setDeleteDialogOpen(true); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Grid pagination */}
      {viewMode === 'grid' && pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm">Page {pagination.page} of {pagination.totalPages}</span>
          <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPrompt ? 'Edit Prompt' : 'Create Prompt'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="prompt-name">Name</Label>
              <Input id="prompt-name" placeholder="e.g. Blog Post Writer" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData((p) => ({ ...p, category: v as PromptCategoryNew }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROMPT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prompt-tags">Tags (comma-separated)</Label>
                <Input id="prompt-tags" placeholder="blog, seo, content" value={formData.tags} onChange={(e) => setFormData((p) => ({ ...p, tags: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prompt-desc">Description</Label>
              <Input id="prompt-desc" placeholder="Brief description..." value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prompt-vars">Variables (JSON)</Label>
              <Textarea id="prompt-vars" rows={3} placeholder='{"topic": "", "tone": "", "length": 500}' value={formData.variables} onChange={(e) => setFormData((p) => ({ ...p, variables: e.target.value }))} />
              <p className="text-xs text-zinc-400">Define variables as JSON. Use {"{{variable_name}}"} in prompts.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prompt-system">System Prompt</Label>
              <Textarea id="prompt-system" rows={4} placeholder="You are a helpful assistant..." value={formData.systemPrompt} onChange={(e) => setFormData((p) => ({ ...p, systemPrompt: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prompt-user">User Prompt</Label>
              <Textarea id="prompt-user" rows={4} placeholder="Write a {{topic}} article in a {{tone}} tone..." value={formData.userPrompt} onChange={(e) => setFormData((p) => ({ ...p, userPrompt: e.target.value }))} />
              <p className="text-xs text-zinc-400">Use {"{{variable_name}}"} syntax for dynamic content.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Provider</Label>
                <Select value={formData.providerId} onValueChange={(v) => setFormData((p) => ({ ...p, providerId: v, modelId: '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                  <SelectContent>
                    {activeProviders.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Model</Label>
                <Select
                  value={formData.modelId}
                  onValueChange={(v) => setFormData((p) => ({ ...p, modelId: v }))}
                  disabled={!formData.providerId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.providerId ? 'Select model' : 'Select provider first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.providerId && models.length === 0 && (
                  <p className="text-xs text-muted-foreground">No active models for this provider. Add models in the Models tab.</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Temperature: {formData.temperature}</Label>
                <Slider min={0} max={2} step={0.1} value={[formData.temperature]} onValueChange={([v]) => setFormData((p) => ({ ...p, temperature: v }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prompt-tokens">Max Tokens</Label>
                <Input id="prompt-tokens" type="number" min={1} max={128000} value={formData.maxTokens} onChange={(e) => setFormData((p) => ({ ...p, maxTokens: parseInt(e.target.value) || 2048 }))} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="prompt-active">Active</Label>
              <Switch id="prompt-active" checked={formData.isActive} onCheckedChange={(checked) => setFormData((p) => ({ ...p, isActive: checked }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingPrompt ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={versionsDialogOpen} onOpenChange={setVersionsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[70vh]">
          <DialogHeader>
            <DialogTitle>Version History — {versionsPrompt?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[500px]">
            {versions.length === 0 ? (
              <p className="text-center py-8 text-zinc-500">No versions found.</p>
            ) : (
              <div className="space-y-4 p-1">
                {versions.map((v) => (
                  <Card key={v.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">v{v.version}</Badge>
                        <span className="text-xs text-zinc-500">{new Date(v.createdAt).toLocaleString()}</span>
                      </div>
                      {v.systemPrompt && (
                        <div>
                          <p className="text-xs font-medium text-zinc-500">System:</p>
                          <p className="text-sm text-zinc-700 line-clamp-2">{v.systemPrompt}</p>
                        </div>
                      )}
                      {v.userPrompt && (
                        <div>
                          <p className="text-xs font-medium text-zinc-500">User:</p>
                          <p className="text-sm text-zinc-700 line-clamp-2">{v.userPrompt}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete &quot;{deletingPrompt?.name}&quot;?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deletingPrompt && deleteMutation.mutate(deletingPrompt.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
