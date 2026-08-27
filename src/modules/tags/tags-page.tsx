'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  TrendingUp,
  Sparkles,
  RefreshCw,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Merge,
  FileText,
  Clock,
  BarChart3,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ConfirmDialog } from '@/components/patterns';
import { getApi, postApi, patchApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, slugify } from '@/lib/utils';
import type { PaginatedResponse } from '@/shared/types';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';

// -------------------- Types --------------------

interface TagItem {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  description: string | null;
  contentCount: number;
  createdAt: string;
  updatedAt: string;
}

interface TagFormData {
  name: string;
  slug: string;
  color: string;
  description: string;
}

type ViewMode = 'grid' | 'list';
type SortOption =
  | 'name_asc'
  | 'name_desc'
  | 'contentCount_desc'
  | 'contentCount_asc'
  | 'createdAt_desc'
  | 'createdAt_asc';

// -------------------- AI Suggested Tags (Mock) --------------------

const AI_SUGGESTED_TAGS = [
  { name: 'Machine Learning', confidence: 95 },
  { name: 'Cloud Computing', confidence: 89 },
  { name: 'Web Development', confidence: 85 },
  { name: 'Data Science', confidence: 82 },
  { name: 'DevOps', confidence: 78 },
] as const;

// -------------------- Tag Form --------------------

interface TagFormProps {
  data: TagFormData;
  onChange: (data: TagFormData) => void;
  autoFocus?: boolean;
}

function TagForm({ data, onChange, autoFocus }: TagFormProps) {
  const handleNameChange = useCallback(
    (name: string) => {
      onChange({ ...data, name, slug: slugify(name) });
    },
    [data, onChange],
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tag-name">Name</Label>
        <Input
          id="tag-name"
          value={data.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Tag name"
          autoFocus={autoFocus}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tag-slug">Slug</Label>
        <Input
          id="tag-slug"
          value={data.slug}
          onChange={(e) => onChange({ ...data, slug: e.target.value })}
          placeholder="tag-slug"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tag-color">Color</Label>
        <div className="flex items-center gap-3">
          {data.color && (
            <div
              className="h-8 w-8 rounded-md border shrink-0"
              style={{ backgroundColor: data.color }}
            />
          )}
          <Input
            id="tag-color"
            value={data.color}
            onChange={(e) => onChange({ ...data, color: e.target.value })}
            placeholder="#e11d48"
            className="flex-1 font-mono text-sm"
            maxLength={7}
          />
          <div className="flex gap-1">
            {['#e11d48', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'].map(
              (preset) => (
                <button
                  key={preset}
                  type="button"
                  className="h-6 w-6 rounded-full border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: preset }}
                  onClick={() => onChange({ ...data, color: preset })}
                  aria-label={`Set color to ${preset}`}
                />
              ),
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Enter a hex color code or click a preset
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="tag-description">Description</Label>
        <Textarea
          id="tag-description"
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          placeholder="Optional description"
          rows={3}
        />
      </div>
    </div>
  );
}

// -------------------- Main Tags Page --------------------

const emptyForm: TagFormData = {
  name: '',
  slug: '',
  color: '',
  description: '',
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'name_desc', label: 'Name Z-A' },
  { value: 'contentCount_desc', label: 'Most Used' },
  { value: 'contentCount_asc', label: 'Least Used' },
  { value: 'createdAt_desc', label: 'Newest' },
  { value: 'createdAt_asc', label: 'Oldest' },
];

export function TagsPage() {
  const queryClient = useQueryClient();

  // State
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TagItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TagItem | null>(null);
  const [createForm, setCreateForm] = useState<TagFormData>(emptyForm);
  const [editForm, setEditForm] = useState<TagFormData>(emptyForm);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortOption, setSortOption] = useState<SortOption>('name_asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [aiRefreshing, setAiRefreshing] = useState(false);

  // Parse sort option into field + order
  const { sortField, sortOrder } = useMemo(() => {
    const [field, order] = sortOption.split('_');
    return { sortField: field, sortOrder: order as 'asc' | 'desc' };
  }, [sortOption]);

  // -------------------- Queries --------------------

  const { data: allTags = [], isLoading: isLoadingAll } = useQuery({
    queryKey: queryKeys.tags.list({ all: true }),
    queryFn: () => getApi<TagItem[]>('/api/tags', { pageSize: 1000 }),
    staleTime: 30_000,
  });

  const queryParams = useMemo(
    () => ({
      page: currentPage,
      pageSize,
      sort: sortField,
      order: sortOrder,
      search: search || undefined,
    }),
    [currentPage, pageSize, sortField, sortOrder, search],
  );

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.tags.list(queryParams),
    queryFn: () =>
      getApi<PaginatedResponse<TagItem>>('/api/tags', queryParams),
    staleTime: 10_000,
  });

  const tags = data?.data ?? [];
  const pagination = data?.pagination;
  const totalItems = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  // -------------------- Analytics from allTags --------------------

  const analytics = useMemo(() => {
    const total = allTags.length;
    const sorted = [...allTags].sort((a, b) => b.contentCount - a.contentCount);
    const mostUsed = sorted[0];
    const totalArticles = allTags.reduce((sum, t) => sum + t.contentCount, 0);
    const avgArticles = total > 0 ? (totalArticles / total).toFixed(1) : '0';
    const noContent = allTags.filter((t) => t.contentCount === 0).length;
    const recentlyUsed = sorted.slice(0, 5).map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      count: t.contentCount,
    }));
    return { total, mostUsed, avgArticles, noContent, recentlyUsed };
  }, [allTags]);

  // Popular tags for the card (top 8 by contentCount)
  const popularTags = useMemo(
    () =>
      [...allTags]
        .sort((a, b) => b.contentCount - a.contentCount)
        .slice(0, 8),
    [allTags],
  );

  // -------------------- Mutations --------------------

  const createMutation = useMutation({
    mutationFn: (formData: TagFormData) =>
      postApi<TagItem>('/api/tags', formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      setIsCreateOpen(false);
      setCreateForm(emptyForm);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: TagFormData }) =>
      patchApi<TagItem>(`/api/tags/${id}`, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      setEditTarget(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      setDeleteTarget(null);
      setSelectedId(null);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => deleteApi(`/api/tags/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      setSelectedTagIds(new Set());
    },
  });

  // -------------------- Handlers --------------------

  const handleOpenCreate = useCallback(() => {
    setCreateForm(emptyForm);
    setIsCreateOpen(true);
  }, []);

  const handleOpenEdit = useCallback((tag: TagItem) => {
    setEditTarget(tag);
    setEditForm({
      name: tag.name,
      slug: tag.slug,
      color: tag.color ?? '',
      description: tag.description ?? '',
    });
  }, []);

  const handleSortChange = useCallback((value: string) => {
    setSortOption(value as SortOption);
    setCurrentPage(1);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setCurrentPage(1);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedTagIds((prev) => {
      if (prev.size === tags.length) return new Set();
      return new Set(tags.map((t) => t.id));
    });
  }, [tags]);

  const handleAiRefresh = useCallback(() => {
    setAiRefreshing(true);
    setTimeout(() => setAiRefreshing(false), 1500);
  }, []);

  const handleBulkDelete = useCallback(() => {
    bulkDeleteMutation.mutate(Array.from(selectedTagIds));
  }, [bulkDeleteMutation, selectedTagIds]);

  const handleAddAiTag = useCallback(
    (name: string) => {
      const form: TagFormData = {
        name,
        slug: slugify(name),
        color: '#f59e0b',
        description: '',
      };
      createMutation.mutate(form);
    },
    [createMutation],
  );

  // Pagination helpers
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // -------------------- Render --------------------

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tags</h1>
          <p className="text-muted-foreground text-sm">
            Manage tags for content organization and discovery
          </p>
        </div>
        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Tag
        </Button>
      </div>

      {/* Two top cards side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Popular Tags Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Popular Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingAll ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-20 rounded-full" />
                ))}
              </div>
            ) : popularTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags yet</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {popularTags.map((tag) => {
                  const maxCount = Math.max(
                    ...popularTags.map((t) => t.contentCount),
                    1,
                  );
                  const ratio = tag.contentCount / maxCount;
                  const sizeClass =
                    ratio >= 0.75
                      ? 'text-sm px-3.5 py-1.5'
                      : ratio >= 0.4
                        ? 'text-xs px-3 py-1'
                        : 'text-xs px-2.5 py-1';

                  return (
                    <span
                      key={tag.id}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors',
                        sizeClass,
                      )}
                      style={
                        tag.color
                          ? {
                              backgroundColor: `${tag.color}15`,
                              borderColor: `${tag.color}40`,
                              color: tag.color,
                            }
                          : undefined
                      }
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            tag.color ?? 'var(--muted-foreground)',
                        }}
                      />
                      {tag.name}
                      <span className="tabular-nums opacity-60">
                        {tag.contentCount}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Suggested Tags Card */}
        <Card className="border-l-4 border-l-amber-400">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-amber-500" />
              AI Suggested Tags
            </CardTitle>
            <CardAction>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleAiRefresh}
                disabled={aiRefreshing}
              >
                <RefreshCw
                  className={cn(
                    'h-4 w-4',
                    aiRefreshing && 'animate-spin',
                  )}
                />
                <span className="sr-only">Refresh suggestions</span>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {AI_SUGGESTED_TAGS.map((suggestion) => (
                <span
                  key={suggestion.name}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400 px-3 py-1 text-xs font-medium"
                >
                  <span>{suggestion.name}</span>
                  <span className="text-amber-500 dark:text-amber-500 tabular-nums">
                    {suggestion.confidence}%
                  </span>
                  <button
                    type="button"
                    className="ml-0.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-200/60 hover:bg-amber-300 dark:bg-amber-800/60 dark:hover:bg-amber-700 transition-colors"
                    onClick={() => handleAddAiTag(suggestion.name)}
                    aria-label={`Add tag ${suggestion.name}`}
                    disabled={createMutation.isPending}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tags..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortOption} onValueChange={handleSortChange}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9 rounded-r-none"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9 rounded-l-none"
              onClick={() => setViewMode('list')}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main content area with sidebar */}
      <div className="flex gap-6">
        {/* Tags list / grid area */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div
              className={cn(
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                  : 'space-y-1',
              )}
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className={viewMode === 'grid' ? 'h-36 rounded-xl' : 'h-12 rounded-lg'}
                />
              ))}
            </div>
          ) : tags.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Tag className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {search ? 'No tags match your search' : 'No tags found'}
              </p>
              {!search && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={handleOpenCreate}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create your first tag
                </Button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {tags.map((tag) => {
                const isSelected = selectedTagIds.has(tag.id);
                return (
                  <div
                    key={tag.id}
                    className={cn(
                      'group relative rounded-xl border bg-card p-4 transition-all hover:shadow-md overflow-hidden',
                      isSelected && 'ring-2 ring-primary',
                    )}
                  >
                    {/* Left color strip */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{
                        backgroundColor:
                          tag.color ?? 'var(--muted-foreground)',
                      }}
                    />
                    {/* Checkbox */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(tag.id)}
                        aria-label={`Select ${tag.name}`}
                      />
                    </div>
                    {/* Actions */}
                    <div className="absolute top-3 right-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleOpenEdit(tag)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(tag)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                    {/* Content */}
                    <div className="pl-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              tag.color ?? 'var(--muted-foreground)',
                          }}
                        />
                        <span className="font-semibold text-sm truncate">
                          {tag.name}
                        </span>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">
                        {tag.slug}
                      </p>
                      {tag.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {tag.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <Badge variant="secondary" className="text-xs tabular-nums">
                          <FileText className="h-3 w-3 mr-1" />
                          {tag.contentCount}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(tag.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div className="border rounded-lg overflow-hidden">
              {/* List header */}
              <div className="grid grid-cols-[40px_1fr_1fr_100px_100px] gap-4 px-4 py-2.5 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                <div>
                  <Checkbox
                    checked={
                      tags.length > 0 &&
                      selectedTagIds.size === tags.length
                    }
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </div>
                <span>Name</span>
                <span>Slug</span>
                <span className="text-right">Articles</span>
                <span className="text-right">Actions</span>
              </div>
              {/* List rows */}
              {tags.map((tag) => {
                const isSelected = selectedTagIds.has(tag.id);
                return (
                  <div
                    key={tag.id}
                    className={cn(
                      'grid grid-cols-[40px_1fr_1fr_100px_100px] gap-4 px-4 py-3 items-center border-b last:border-b-0 transition-colors hover:bg-muted/30',
                      isSelected && 'bg-primary/5',
                    )}
                  >
                    <div>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(tag.id)}
                        aria-label={`Select ${tag.name}`}
                      />
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            tag.color ?? 'var(--muted-foreground)',
                        }}
                      />
                      <span className="text-sm font-medium truncate">
                        {tag.name}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground truncate">
                      {tag.slug}
                    </span>
                    <div className="text-right">
                      <Badge variant="secondary" className="text-xs tabular-nums">
                        {tag.contentCount}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleOpenEdit(tag)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(tag)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalItems > 0 && (
            <div className="flex items-center justify-between mt-4 px-1">
              <p className="text-sm text-muted-foreground">
                Showing{' '}
                <span className="font-medium text-foreground">{startItem}</span>{' '}
                to{' '}
                <span className="font-medium text-foreground">{endItem}</span>{' '}
                of{' '}
                <span className="font-medium text-foreground">{totalItems}</span>{' '}
                tags
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Previous page</span>
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (page) =>
                      page === 1 ||
                      page === totalPages ||
                      Math.abs(page - currentPage) <= 1,
                  )
                  .reduce<(number | string)[]>((acc, page, idx, arr) => {
                    if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                      acc.push('...');
                    }
                    acc.push(page);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    typeof item === 'string' ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-2 text-sm text-muted-foreground"
                      >
                        ...
                      </span>
                    ) : (
                      <Button
                        key={item}
                        variant={currentPage === item ? 'default' : 'outline'}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(item)}
                      >
                        {item}
                      </Button>
                    ),
                  )}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                  <span className="sr-only">Next page</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Tag Analytics Sidebar (lg+) */}
        <aside className="hidden lg:block w-[280px] shrink-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Tag Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-2xl font-bold tabular-nums">
                    {isLoadingAll ? (
                      <Skeleton className="h-7 w-12" />
                    ) : (
                      analytics.total
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">Total tags</p>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold tabular-nums">
                    {isLoadingAll ? (
                      <Skeleton className="h-7 w-12" />
                    ) : (
                      analytics.avgArticles
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg articles/tag</p>
                </div>
              </div>

              <Separator />

              {/* Most Used */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  Most Used
                </p>
                {isLoadingAll ? (
                  <Skeleton className="h-5 w-full" />
                ) : analytics.mostUsed ? (
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          analytics.mostUsed.color ??
                          'var(--muted-foreground)',
                      }}
                    />
                    <span className="text-sm font-medium truncate">
                      {analytics.mostUsed.name}
                    </span>
                    <Badge variant="secondary" className="text-xs tabular-nums ml-auto">
                      {analytics.mostUsed.contentCount}
                    </Badge>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">--</p>
                )}
              </div>

              {/* No Content */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  Tags with no content
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {isLoadingAll ? (
                      <Skeleton className="h-5 w-8 inline-block" />
                    ) : (
                      analytics.noContent
                    )}
                  </span>
                </div>
              </div>

              <Separator />

              {/* Recently Used */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Recently Used
                </p>
                <div className="space-y-2">
                  {isLoadingAll
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-5 w-full" />
                      ))
                    : analytics.recentlyUsed.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2"
                        >
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                item.color ??
                                'var(--muted-foreground)',
                            }}
                          />
                          <span className="text-sm truncate flex-1">
                            {item.name}
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {item.count}
                          </span>
                        </div>
                      ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tag Relationships placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-muted-foreground">
                Tag Relationships
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-2">
                  <Merge className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Coming soon</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  Visualize and manage related tags
                </p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Bulk Actions Floating Bar */}
      {selectedTagIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border bg-background/95 backdrop-blur-sm shadow-lg px-4 py-3">
          <span className="text-sm font-medium">
            <span className="tabular-nums">{selectedTagIds.size}</span> selected
          </span>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSelectAll}
          >
            Clear
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={handleBulkDelete}
            disabled={bulkDeleteMutation.isPending}
          >
            {bulkDeleteMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            )}
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete Selected
          </Button>
        </div>
      )}

      {/* Create Tag Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Tag</DialogTitle>
            <DialogDescription>
              Add a new tag to your content tagging system
            </DialogDescription>
          </DialogHeader>
          <TagForm
            data={createForm}
            onChange={setCreateForm}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(createForm)}
              disabled={createMutation.isPending || !createForm.name.trim()}
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tag Dialog */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>
              Update tag details for &ldquo;{editTarget?.name}&rdquo;
            </DialogDescription>
          </DialogHeader>
          <TagForm
            data={editForm}
            onChange={setEditForm}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditTarget(null)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editTarget)
                  updateMutation.mutate({
                    id: editTarget.id,
                    formData: editForm,
                  });
              }}
              disabled={updateMutation.isPending || !editForm.name.trim()}
            >
              {updateMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Tag"
        description={
          deleteTarget
            ? `Are you sure you want to delete the tag "${deleteTarget.name}"? This will remove the tag from all associated content items.`
            : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
