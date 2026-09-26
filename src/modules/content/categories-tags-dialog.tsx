'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderOpen, Tag, Plus, Trash2, Loader2, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/lib/i18n';
import { getApi, postApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';

export interface CategoriesTagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: 'categories' | 'tags';
  title?: string;
  content?: string;
  onSuccess?: () => void;
  onCategoryCreated?: () => void;
  onTagCreated?: () => void;
}

export function CategoriesTagsDialog({
  open,
  onOpenChange,
  initialTab = 'categories',
  title,
  content,
  onSuccess,
  onCategoryCreated,
  onTagCreated,
}: CategoriesTagsDialogProps) {
  const { t } = useT();
  const queryClient = useQueryClient();
  const [newCategory, setNewCategory] = useState('');
  const [newTag, setNewTag] = useState('');
  const [activeTab, setActiveTab] = useState<'categories' | 'tags'>(initialTab);
  const [isAiGeneratingCategory, setIsAiGeneratingCategory] = useState(false);
  const [isAiGeneratingTag, setIsAiGeneratingTag] = useState(false);

  useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  const { data: categoriesData, isLoading: catLoading } = useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () =>
      getApi<{ data: { id: string; name: string; slug?: string }[] } | { id: string; name: string; slug?: string }[]>(
        '/api/categories?pageSize=200',
      ),
    enabled: open,
    staleTime: 30_000,
  });

  const { data: tagsData, isLoading: tagsLoading } = useQuery({
    queryKey: queryKeys.tags.all,
    queryFn: () =>
      getApi<{ data: { id: string; name: string; slug?: string; color?: string }[] } | { id: string; name: string; slug?: string; color?: string }[]>(
        '/api/tags?pageSize=200',
      ),
    enabled: open,
    staleTime: 30_000,
  });

  const categories = useMemo(() => {
    const d = categoriesData as unknown;
    if (Array.isArray(d)) return d as { id: string; name: string; slug?: string }[];
    if (d && typeof d === 'object' && 'data' in (d as Record<string, unknown>)) {
      return (d as { data: { id: string; name: string; slug?: string }[] }).data;
    }
    return [];
  }, [categoriesData]);

  const tags = useMemo(() => {
    const d = tagsData as unknown;
    if (Array.isArray(d)) return d as { id: string; name: string; slug?: string; color?: string }[];
    if (d && typeof d === 'object' && 'data' in (d as Record<string, unknown>)) {
      return (d as { data: { id: string; name: string; slug?: string; color?: string }[] }).data;
    }
    return [];
  }, [tagsData]);

  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => postApi('/api/categories', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      toast.success(t('articles.categoryCreated') || 'Category created');
      onSuccess?.();
      onCategoryCreated?.();
    },
    onError: (err: Error) => toast.error(err.message || t('articles.categoryCreateFailed') || 'Failed to create category'),
  });

  const createTagMutation = useMutation({
    mutationFn: (name: string) => postApi('/api/tags', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      toast.success(t('articles.tagCreated') || 'Tag created');
      onSuccess?.();
      onTagCreated?.();
    },
    onError: (err: Error) => toast.error(err.message || t('articles.tagCreateFailed') || 'Failed to create tag'),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      toast.success(t('articles.categoryDeleted') || 'Category deleted');
      onSuccess?.();
      onCategoryCreated?.();
    },
    onError: (err: Error) => toast.error(err.message || t('articles.categoryDeleteFailed') || 'Failed to delete category'),
  });

  const deleteTagMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      toast.success(t('articles.tagDeleted') || 'Tag deleted');
      onSuccess?.();
      onTagCreated?.();
    },
    onError: (err: Error) => toast.error(err.message || t('articles.tagDeleteFailed') || 'Failed to delete tag'),
  });

  const handleAddCategory = useCallback(() => {
    const v = newCategory.trim();
    if (!v) return;
    // Split on comma so categories are separated, not combined
    const parts = v.split(',').map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      createCategoryMutation.mutate(part);
    }
    setNewCategory('');
  }, [newCategory, createCategoryMutation]);

  const handleAddTag = useCallback(() => {
    const v = newTag.trim();
    if (!v) return;
    // Split on comma so tags are separated, not combined
    const parts = v.split(',').map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      createTagMutation.mutate(part);
    }
    setNewTag('');
  }, [newTag, createTagMutation]);

  const handleAiGenerateCategories = useCallback(async () => {
    setIsAiGeneratingCategory(true);
    try {
      const res = await postApi<any>('/api/content/generate-taxonomy', {
        type: 'categories',
        title: title || undefined,
        content: content || undefined,
        existing: categories.map((c) => c.name),
        count: 5,
      });
      const items: string[] = res?.items || res?.data?.items || (Array.isArray(res) ? res : []) || [];
      if (items.length === 0) {
        toast.info('No categories suggested.');
        return;
      }
      for (const item of items) {
        await postApi('/api/categories', { name: item }).catch(() => null);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      onSuccess?.();
      onCategoryCreated?.();
      toast.success(`Generated ${items.length} categories with AI!`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate categories with AI');
    } finally {
      setIsAiGeneratingCategory(false);
    }
  }, [categories, title, content, queryClient, onSuccess, onCategoryCreated]);

  const handleAiGenerateTags = useCallback(async () => {
    setIsAiGeneratingTag(true);
    try {
      const res = await postApi<any>('/api/content/generate-taxonomy', {
        type: 'tags',
        title: title || undefined,
        content: content || undefined,
        existing: tags.map((t) => t.name),
        count: 6,
      });
      const items: string[] = res?.items || res?.data?.items || (Array.isArray(res) ? res : []) || [];
      if (items.length === 0) {
        toast.info('No tags suggested.');
        return;
      }
      for (const item of items) {
        await postApi('/api/tags', { name: item }).catch(() => null);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      onSuccess?.();
      onTagCreated?.();
      toast.success(`Generated ${items.length} tags with AI!`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate tags with AI');
    } finally {
      setIsAiGeneratingTag(false);
    }
  }, [tags, title, content, queryClient, onSuccess, onTagCreated]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-amber-500" />
            {t('articles.categoriesTags') || 'Categories & Tags'}
          </DialogTitle>
          <DialogDescription>
            {t('articles.categoriesTagsDescription') || 'Organize your articles with categories and tags. These are managed here instead of having separate pages.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'categories' | 'tags')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="categories">
              <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
              {`${t('articles.categoriesLabel') || 'Categories'} (${categories.length})`}
            </TabsTrigger>
            <TabsTrigger value="tags">
              <Tag className="h-3.5 w-3.5 mr-1.5" />
              {`${t('articles.tags') || 'Tags'} (${tags.length})`}
            </TabsTrigger>
          </TabsList>

          {/* Categories Tab */}
          <TabsContent value="categories" className="mt-4 space-y-3">
            <div className="flex gap-2">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
                placeholder={t('articles.newCategoryPlaceholder') || 'New category name (separate with commas)...'}
                className="h-9 text-sm flex-1"
              />
              <Button
                size="sm"
                className="h-9 gap-1.5 bg-amber-400 text-zinc-900 hover:bg-amber-500 font-medium"
                onClick={handleAddCategory}
                disabled={createCategoryMutation.isPending || !newCategory.trim()}
              >
                {createCategoryMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {t('articles.add') || 'Add'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 border-amber-400/40 text-amber-600 hover:bg-amber-400/10 dark:text-amber-400 shrink-0 font-medium"
                onClick={handleAiGenerateCategories}
                disabled={isAiGeneratingCategory}
                title="Generate categories using AI"
              >
                {isAiGeneratingCategory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-amber-500" />}
                AI Generate
              </Button>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border">
              {catLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : categories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FolderOpen className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">{t('articles.noCategories') || 'No categories yet'}</p>
                </div>
              ) : (
                <ul className="divide-y">
                  {categories.map((cat) => (
                    <li key={cat.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors">
                      <div className="min-w-0 flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-amber-500/70 shrink-0" />
                        <span className="text-sm font-medium truncate">{cat.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                        onClick={() => deleteCategoryMutation.mutate(cat.id)}
                        disabled={deleteCategoryMutation.isPending && deleteCategoryMutation.variables === cat.id}
                        title={t('common.delete')}
                      >
                        {deleteCategoryMutation.isPending && deleteCategoryMutation.variables === cat.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          {/* Tags Tab */}
          <TabsContent value="tags" className="mt-4 space-y-3">
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder={t('articles.newTagPlaceholder') || 'New tag name (separate with commas)...'}
                className="h-9 text-sm flex-1"
              />
              <Button
                size="sm"
                className="h-9 gap-1.5 bg-amber-400 text-zinc-900 hover:bg-amber-500 font-medium"
                onClick={handleAddTag}
                disabled={createTagMutation.isPending || !newTag.trim()}
              >
                {createTagMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {t('articles.add') || 'Add'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 border-amber-400/40 text-amber-600 hover:bg-amber-400/10 dark:text-amber-400 shrink-0 font-medium"
                onClick={handleAiGenerateTags}
                disabled={isAiGeneratingTag}
                title="Generate tags using AI"
              >
                {isAiGeneratingTag ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-amber-500" />}
                AI Generate
              </Button>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border">
              {tagsLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : tags.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Tag className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">{t('articles.noTags') || 'No tags yet'}</p>
                </div>
              ) : (
                <ul className="divide-y">
                  {tags.map((tag) => (
                    <li key={tag.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors">
                      <div className="min-w-0 flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                        <span className="text-sm font-medium truncate">{tag.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                        onClick={() => deleteTagMutation.mutate(tag.id)}
                        disabled={deleteTagMutation.isPending && deleteTagMutation.variables === tag.id}
                        title={t('common.delete')}
                      >
                        {deleteTagMutation.isPending && deleteTagMutation.variables === tag.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('articles.done') || 'Done'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
