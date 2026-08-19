'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  ArrowUpDown,
  Eye,
  Pencil,
  Trash2,
  Sparkles,
  ChevronRight,
  Bookmark,
  BookmarkCheck,
  Save,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  BarChart3,
  Target,
  X,
  Lightbulb,
  FolderOpen,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/patterns';
import { AvatarWithFallback } from '@/components/shared';
import { getApi, postApi, deleteApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { cn, formatRelativeTime, truncate } from '@/lib/utils';
import type { PaginatedResponse, PostStatus } from '@/shared/types';
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import { toast } from 'sonner';

// -------------------- Types --------------------

interface ContentAuthor {
  id: string;
  name: string;
  avatar?: string;
}

interface ContentCategory {
  id: string;
  name: string;
}

interface ContentTypeItem {
  id: string;
  name: string;
}

interface ContentTag {
  id: string;
  name: string;
}

interface ContentItemRow {
  id: string;
  title: string;
  slug: string;
  status: PostStatus;
  excerpt?: string;
  author: ContentAuthor;
  contentType: ContentTypeItem;
  category?: ContentCategory | null;
  tags?: ContentTag[];
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface ArticleIdea {
  title: string;
  seoScore: number;
  difficulty: string;
  monthlyVolume: number;
  searchIntent: string;
  keywords: string[];
  description: string;
  tags: string[];
}

// -------------------- Status Config --------------------

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Published', value: 'PUBLISHED' },
  { label: 'Drafts', value: 'DRAFT' },
  { label: 'In Review', value: 'IN_REVIEW' },
  { label: 'Scheduled', value: 'APPROVED' },
];

const STATUS_BADGE_STYLES: Record<string, string> = {
  DRAFT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  IN_REVIEW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  APPROVED: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  PUBLISHED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  UNPUBLISHED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  ARCHIVED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In Review',
  APPROVED: 'Approved',
  PUBLISHED: 'Published',
  UNPUBLISHED: 'Unpublished',
  ARCHIVED: 'Archived',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20',
  Medium: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20',
  Hard: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20',
  'Very Hard': 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20',
};

const INTENT_COLORS: Record<string, string> = {
  Informational: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Commercial: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  Transactional: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Navigational: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

function getSeoScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-500';
}

function getSeoScoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

// -------------------- AI Idea Card --------------------

function IdeaCard({
  idea,
  index,
  expanded,
  onToggle,
  onSave,
  onBookmark,
  onCreateArticle,
  isBookmarked,
}: {
  idea: ArticleIdea;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onSave: () => void;
  onBookmark: () => void;
  onCreateArticle: () => void;
  isBookmarked: boolean;
}) {
  return (
    <div className="border rounded-xl overflow-hidden transition-all duration-200 hover:shadow-sm">
      {/* Collapsed Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        {/* SEO Score Ring */}
        <div className="relative shrink-0">
          <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
            <circle
              cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={`${(idea.seoScore / 100) * 97.4} 97.4`}
              className={cn('transition-all duration-700', getSeoScoreBg(idea.seoScore))}
            />
          </svg>
          <span className={cn('absolute inset-0 flex items-center justify-center text-[10px] font-bold', getSeoScoreColor(idea.seoScore))}>
            {idea.seoScore}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight line-clamp-2">{idea.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', DIFFICULTY_COLORS[idea.difficulty] || 'bg-gray-100 text-gray-600')}>
              {idea.difficulty}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {idea.monthlyVolume >= 1000 ? `${(idea.monthlyVolume / 1000).toFixed(1)}k` : idea.monthlyVolume} searches/mo
            </span>
          </div>
        </div>

        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t px-3 py-3 space-y-3 animate-in slide-in-from-top-1 duration-200">
          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed">{idea.description}</p>

          {/* Metrics Row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <Target className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Intent:</span>
              <span className={cn('font-medium px-1.5 py-0.5 rounded text-[10px]', INTENT_COLORS[idea.searchIntent] || 'bg-gray-100 text-gray-600')}>
                {idea.searchIntent}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <BarChart3 className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Volume:</span>
              <span className="font-medium">{idea.monthlyVolume.toLocaleString()}/mo</span>
            </div>
          </div>

          {/* Keywords */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Keywords</p>
            <div className="flex flex-wrap gap-1">
              {idea.keywords.map((kw) => (
                <span key={kw} className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30">
                  {kw}
                </span>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Related Tags</p>
            <div className="flex flex-wrap gap-1">
              {idea.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full bg-muted text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] gap-1 flex-1"
              onClick={(e) => { e.stopPropagation(); onSave(); }}
            >
              <Save className="h-3 w-3" />
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] gap-1"
              onClick={(e) => { e.stopPropagation(); onBookmark(); }}
            >
              {isBookmarked ? <BookmarkCheck className="h-3 w-3 text-amber-500" /> : <Bookmark className="h-3 w-3" />}
            </Button>
            <Button
              size="sm"
              className="h-7 text-[11px] gap-1 flex-1 bg-amber-400 text-zinc-900 hover:bg-amber-400/90"
              onClick={(e) => { e.stopPropagation(); onCreateArticle(); }}
            >
              <FileText className="h-3 w-3" />
              Create Article
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------- AI Generate Dialog --------------------

function AIGenerateDialog({
  open,
  onOpenChange,
  idea,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idea: ArticleIdea | null;
}) {
  const [brief, setBrief] = useState('');
  const [keywords, setKeywords] = useState('');
  const [writingStyle, setWritingStyle] = useState('Professional');
  const [targetLength, setTargetLength] = useState('Medium (800-1200 words)');
  const [numberOfDrafts, setNumberOfDrafts] = useState('1');
  const [includeCta, setIncludeCta] = useState(false);

  const navigate = useNavigationStore((s) => s.navigate);

  const generateMutation = useMutation({
    mutationFn: () =>
      postApi('/api/content/ai-generate', {
        title: idea?.title || '',
        brief: brief || idea?.description || '',
        keywords: keywords || idea?.keywords?.join(', ') || '',
        writingStyle,
        targetLength,
        numberOfDrafts: parseInt(numberOfDrafts),
        includeCta,
      }),
    onSuccess: (result) => {
      const draft = result.data?.drafts?.[0];
      if (draft) {
        toast.success('Article draft generated!');
        onOpenChange(false);
        navigate('content', null, 'create');
      }
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to generate'),
  });

  React.useEffect(() => {
    if (idea) {
      setBrief(idea.description);
      setKeywords(idea.keywords?.join(', ') || '');
    }
  }, [idea]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Generate Article with AI
          </DialogTitle>
          <DialogDescription>Configure and generate an article draft from this idea.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Article Title</Label>
            <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium">
              {idea?.title}
            </div>
          </div>

          {/* Brief */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Brief / Description</Label>
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Describe what the article should cover..."
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          {/* Keywords */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Keywords</Label>
            <Input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="comma, separated, keywords"
              className="h-9 text-sm"
            />
          </div>

          {/* Output Settings Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Number of Drafts</Label>
              <Select value={numberOfDrafts} onValueChange={setNumberOfDrafts}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Draft</SelectItem>
                  <SelectItem value="2">2 Drafts</SelectItem>
                  <SelectItem value="3">3 Drafts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Writing Style</Label>
              <Select value={writingStyle} onValueChange={setWritingStyle}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Professional">Professional</SelectItem>
                  <SelectItem value="Casual">Casual</SelectItem>
                  <SelectItem value="Academic">Academic</SelectItem>
                  <SelectItem value="Conversational">Conversational</SelectItem>
                  <SelectItem value="Persuasive">Persuasive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Target Length</Label>
            <Select value={targetLength} onValueChange={setTargetLength}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Short (300-600 words)">Short (300-600 words)</SelectItem>
                <SelectItem value="Medium (800-1200 words)">Medium (800-1200 words)</SelectItem>
                <SelectItem value="Long (1500-2500 words)">Long (1500-2500 words)</SelectItem>
                <SelectItem value="Comprehensive (3000+ words)">Comprehensive (3000+ words)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* CTA Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeCta}
              onChange={(e) => setIncludeCta(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm">Include call-to-action</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="gap-1.5 bg-amber-400 text-zinc-900 hover:bg-amber-400/90"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate Drafts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Categories & Tags Management Dialog --------------------

function CategoriesTagsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [newCategory, setNewCategory] = useState('');
  const [newTag, setNewTag] = useState('');
  const [activeTab, setActiveTab] = useState<'categories' | 'tags'>('categories');

  const { data: categoriesData, isLoading: catLoading } = useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => getApi<{ data: { id: string; name: string; slug?: string }[] } | { id: string; name: string; slug?: string }[]>('/api/categories?pageSize=200'),
    enabled: open,
    staleTime: 30_000,
  });
  const { data: tagsData, isLoading: tagsLoading } = useQuery({
    queryKey: queryKeys.tags.all,
    queryFn: () => getApi<{ data: { id: string; name: string; slug?: string; color?: string }[] } | { id: string; name: string; slug?: string; color?: string }[]>('/api/tags?pageSize=200'),
    enabled: open,
    staleTime: 30_000,
  });

  // Normalize responses — API may return either an array or { data: [...] }
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }); toast.success('Category created'); },
    onError: (err: Error) => toast.error(err.message || 'Failed to create category'),
  });
  const createTagMutation = useMutation({
    mutationFn: (name: string) => postApi('/api/tags', { name }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.tags.all }); toast.success('Tag created'); },
    onError: (err: Error) => toast.error(err.message || 'Failed to create tag'),
  });
  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/categories/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }); toast.success('Category deleted'); },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete category'),
  });
  const deleteTagMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/tags/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.tags.all }); toast.success('Tag deleted'); },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete tag'),
  });

  const handleAddCategory = useCallback(() => {
    const v = newCategory.trim();
    if (!v) return;
    createCategoryMutation.mutate(v);
    setNewCategory('');
  }, [newCategory, createCategoryMutation]);
  const handleAddTag = useCallback(() => {
    const v = newTag.trim();
    if (!v) return;
    createTagMutation.mutate(v);
    setNewTag('');
  }, [newTag, createTagMutation]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Categories &amp; Tags
          </DialogTitle>
          <DialogDescription>
            Organize your articles with categories and tags. These are managed here instead of having separate pages.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'categories' | 'tags')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="categories">
              <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
              Categories ({categories.length})
            </TabsTrigger>
            <TabsTrigger value="tags">
              <Tag className="h-3.5 w-3.5 mr-1.5" />
              Tags ({tags.length})
            </TabsTrigger>
          </TabsList>

          {/* Categories Tab */}
          <TabsContent value="categories" className="mt-4 space-y-3">
            <div className="flex gap-2">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
                placeholder="New category name..."
                className="h-9 text-sm"
              />
              <Button
                size="sm"
                className="h-9 gap-1.5"
                onClick={handleAddCategory}
                disabled={createCategoryMutation.isPending || !newCategory.trim()}
              >
                {createCategoryMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add
              </Button>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border">
              {catLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : categories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FolderOpen className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No categories yet</p>
                </div>
              ) : (
                <ul className="divide-y">
                  {categories.map((cat) => (
                    <li key={cat.id} className="flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{cat.name}</p>
                        {cat.slug && <p className="text-[10px] text-muted-foreground font-mono truncate">{cat.slug}</p>}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                        onClick={() => deleteCategoryMutation.mutate(cat.id)}
                        disabled={deleteCategoryMutation.isPending}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                placeholder="New tag name..."
                className="h-9 text-sm"
              />
              <Button
                size="sm"
                className="h-9 gap-1.5"
                onClick={handleAddTag}
                disabled={createTagMutation.isPending || !newTag.trim()}
              >
                {createTagMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add
              </Button>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border">
              {tagsLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : tags.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Tag className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No tags yet</p>
                </div>
              ) : (
                <ul className="divide-y">
                  {tags.map((tag) => (
                    <li key={tag.id} className="flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{tag.name}</p>
                        {tag.slug && <p className="text-[10px] text-muted-foreground font-mono truncate">{tag.slug}</p>}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                        onClick={() => deleteTagMutation.mutate(tag.id)}
                        disabled={deleteTagMutation.isPending}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Main Component --------------------

export function ContentListPage() {
  const navigate = useNavigationStore((s) => s.navigate);
  const queryClient = useQueryClient();

  const [deleteTarget, setDeleteTarget] = useState<ContentItemRow | null>(null);
  const [statusTab, setStatusTab] = useState('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // AI Ideas state
  const [aiIdeasOpen, setAiIdeasOpen] = useState(false);
  const [ideas, setIdeas] = useState<ArticleIdea[]>([]);
  const [expandedIdea, setExpandedIdea] = useState<number | null>(null);
  const [bookmarkedIdeas, setBookmarkedIdeas] = useState<Set<number>>(new Set());
  const [savedIdeas, setSavedIdeas] = useState<Set<number>>(new Set());
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<ArticleIdea | null>(null);
  const [ideaNiche, setIdeaNiche] = useState('');
  const [ideaKeywords, setIdeaKeywords] = useState('');
  const [catTagOpen, setCatTagOpen] = useState(false);

  // Build query params
  const queryParams = useMemo(
    () => ({
      page,
      pageSize,
      sort: sortField,
      order: sortOrder,
      search: search || undefined,
      ...(statusTab !== 'all' ? { status: statusTab } : {}),
    }),
    [page, pageSize, sortField, sortOrder, search, statusTab],
  );

  // Fetch content list
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.content.list(queryParams),
    queryFn: () => getApi<PaginatedResponse<ContentItemRow>>('/api/content', queryParams),
    staleTime: 10_000,
  });

  const contentItems = data?.data ?? [];
  const pagination = data?.pagination;
  const totalItems = pagination?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApi(`/api/content/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.content.all });
      setDeleteTarget(null);
    },
  });

  // Bulk status change
  const bulkStatusMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: PostStatus }) =>
      postApi('/api/content/bulk-status', { ids, status }),
    onSuccess: (result, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.content.all });
      const count = (result as { updatedCount?: number })?.updatedCount ?? vars.ids.length;
      toast.success(`${count} article(s) set to ${STATUS_LABELS[vars.status] ?? vars.status}`);
      setSelectedIds([]);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update statuses'),
  });

  // Bulk delete mutation — deletes all selected in parallel
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => deleteApi(`/api/content/${id}`)));
    },
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.content.all });
      toast.success(`${ids.length} article(s) deleted`);
      setSelectedIds([]);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete articles'),
  });

  // AI Ideas generation mutation
  const ideasMutation = useMutation({
    mutationFn: () =>
      postApi('/api/content/ai-ideas', {
        niche: ideaNiche || undefined,
        keywords: ideaKeywords || undefined,
        count: 5,
      }),
    onSuccess: (result) => {
      const generatedIdeas = result.data?.ideas;
      if (generatedIdeas && Array.isArray(generatedIdeas)) {
        setIdeas(generatedIdeas);
        setExpandedIdea(0);
        toast.success(`Generated ${generatedIdeas.length} article ideas!`);
      } else {
        toast.error('Unexpected response format from AI');
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to generate ideas');
    },
  });

  // Navigation
  const goToDetail = useCallback((id: string) => navigate('content', id), [navigate]);
  const goToEdit = useCallback((id: string) => navigate('content', id, 'edit'), [navigate]);
  const goToCreate = useCallback(() => navigate('content', null, 'create'), [navigate]);

  // Selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.length === contentItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(contentItems.map((i) => i.id));
    }
  }, [selectedIds.length, contentItems]);

  const handleStatusTab = useCallback((value: string) => {
    setStatusTab(value);
    setPage(1);
  }, []);

  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, []);

  const handleCreateFromIdea = useCallback((idea: ArticleIdea) => {
    setSelectedIdea(idea);
    setGenerateDialogOpen(true);
  }, []);

  // Pagination range
  const pageNumbers = useMemo(() => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    }
    if (page < totalPages - 2) pages.push('...');
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  }, [totalPages, page]);

  const fromItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const toItem = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col lg:flex-row lg:items-stretch gap-6">
      {/* Main Content — takes most of the width */}
      <main className="min-w-0 flex-1">
        {/* Page Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Articles</h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              Manage your blog articles for The Efficient You
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* AI Ideas — global page action (not a row action) */}
            <Button
              variant="outline"
              className="h-9 px-4 gap-2 border-amber-400/40 text-amber-700 hover:bg-amber-400/10 hover:text-amber-700"
              onClick={() => setAiIdeasOpen(true)}
              title="Generate AI article ideas"
            >
              <Sparkles className="h-4 w-4" />
              AI Ideas
            </Button>
            {/* Categories & Tags manager */}
            <Button
              variant="outline"
              className="h-9 px-4 gap-2"
              onClick={() => setCatTagOpen(true)}
              title="Manage categories and tags"
            >
              <FolderOpen className="h-4 w-4" />
              Categories &amp; Tags
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="h-9 px-4 gap-2">
                  <Plus className="h-4 w-4" />
                  Create New
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={goToCreate}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Article from scratch
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCreateFromIdea(null)}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate with AI
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
            {/* Status Tabs */}
            <div className="flex min-w-0 items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => handleStatusTab(tab.value)}
                  className={cn(
                    'relative shrink-0 px-3 py-2 text-sm font-medium transition-colors',
                    statusTab === tab.value
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab.label}
                  {statusTab === tab.value && (
                    <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-amber-400" />
                  )}
                </button>
              ))}
            </div>

            {/* Search + Sort */}
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search articles..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="h-9 w-full rounded-lg pl-9 pr-3"
                />
              </div>
              <Select
                value={`${sortField}-${sortOrder}`}
                onValueChange={(v) => {
                  const [f, o] = v.split('-');
                  setSortField(f);
                  setSortOrder(o as 'asc' | 'desc');
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-[150px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updatedAt-desc">Newest First</SelectItem>
                  <SelectItem value="updatedAt-asc">Oldest First</SelectItem>
                  <SelectItem value="createdAt-desc">Newest Created</SelectItem>
                  <SelectItem value="title-asc">Title A-Z</SelectItem>
                  <SelectItem value="title-desc">Title Z-A</SelectItem>
                </SelectContent>
              </Select>
            </div>

          {/* Content Area */}
          <div className="flex flex-1 items-center justify-center p-6">
            {isLoading ? (
              <div className="w-full space-y-4 p-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : contentItems.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col gap-3 rounded-xl border border-dashed p-12 text-center">
                <div className="flex flex-col items-center gap-2">
                  <FileText className="h-10 w-10 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold">No articles yet</h3>
                  <p className="text-sm text-muted-foreground">Create your first article to get started</p>
                </div>
              </div>
            ) : (
              /* Table with articles */
              <div className="w-full">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="w-10 px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.length === contentItems.length && contentItems.length > 0}
                            onChange={toggleSelectAll}
                            className="rounded border-gray-300"
                          />
                        </th>
                        <th className="text-left px-3 py-3">
                          <button
                            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Title <ArrowUpDown className="inline h-3 w-3 ml-1 opacity-40" />
                          </button>
                        </th>
                        <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Status
                        </th>
                        <th className="text-left px-3 py-3 hidden md:table-cell text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Author
                        </th>
                        <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Updated
                        </th>
                        <th className="w-28 px-3 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {contentItems.map((item) => {
                        const isSelected = selectedIds.includes(item.id);
                        return (
                          <tr
                            key={item.id}
                            onClick={() => goToDetail(item.id)}
                            className="border-b last:border-b-0 hover:bg-muted/50 transition-colors cursor-pointer"
                          >
                            <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(item.id)}
                                className="rounded border-gray-300"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <p className="text-sm font-medium leading-tight line-clamp-1">{item.title}</p>
                              {item.contentType && (
                                <p className="text-xs text-muted-foreground mt-0.5">{item.contentType.name}</p>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                                  STATUS_BADGE_STYLES[item.status] ?? 'bg-gray-100 text-gray-700',
                                )}
                              >
                                {STATUS_LABELS[item.status] ?? item.status}
                              </span>
                            </td>
                            <td className="px-3 py-3 hidden md:table-cell">
                              <div className="flex items-center gap-2">
                                <AvatarWithFallback
                                  src={item.author?.avatar}
                                  name={item.author?.name ?? ''}
                                  size="sm"
                                  className="h-7 w-7 text-[10px]"
                                />
                                <span className="text-sm truncate max-w-[100px]">{item.author?.name}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeTime(item.updatedAt)}
                              </span>
                            </td>
                            <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => goToEdit(item.id)}
                                  title="Edit"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => goToDetail(item.id)}
                                  title="View"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteTarget(item)}
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
                  <span className="text-sm text-muted-foreground">
                    Showing {fromItem} to {toItem} of {totalItems} articles
                  </span>
                  <div className="flex items-center gap-1">
                    {pageNumbers.map((p, i) =>
                      p === '...' ? (
                        <span key={`dot-${i}`} className="px-1 text-muted-foreground">...</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p as number)}
                          className={cn(
                            'h-8 w-8 rounded-md text-sm font-medium transition-colors',
                            page === p
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-muted',
                          )}
                        >
                          {p}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
      </main>

      {/* AI Ideas Sidebar - Animated Panel */}
      <aside
        className={cn(
          'shrink-0 transition-all duration-300 ease-in-out overflow-hidden',
          aiIdeasOpen
            ? 'w-full lg:w-80 xl:w-[340px] opacity-100'
            : 'w-0 lg:w-0 opacity-0',
        )}
      >
        <div className="flex h-full max-h-[75vh] lg:max-h-none w-80 xl:w-[340px] shrink-0 flex-col rounded-2xl border border-border/70 bg-card">
          {/* AI Ideas Header */}
          <div className="flex items-start gap-3 border-b border-border/60 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-700">
              <Sparkles className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-foreground">AI Ideas</h3>
              <p className="truncate text-xs text-muted-foreground">SEO-scored topics for your site</p>
            </div>
            <button
              type="button"
              aria-label="Collapse AI Ideas panel"
              onClick={() => setAiIdeasOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Content: CTA or Ideas List */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {ideas.length === 0 ? (
              /* CTA State */
              <div className="flex flex-col items-center justify-center gap-4 px-4 py-10 text-center">
                <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-700">
                  <Lightbulb className="h-[22px] w-[22px]" />
                </span>
                <p className="text-sm font-semibold text-foreground">Need Content Ideas?</p>
                <p className="mb-2 text-xs text-muted-foreground">Let AI Help!</p>
                <p className="mb-4 text-xs text-muted-foreground">
                  Get AI-generated article title suggestions based on your site&apos;s niche and audience.
                </p>

                {/* Niche Input */}
                <div className="w-full space-y-2 mb-2">
                  <Input
                    value={ideaNiche}
                    onChange={(e) => setIdeaNiche(e.target.value)}
                    placeholder="Your niche (e.g., productivity)"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={ideaKeywords}
                    onChange={(e) => setIdeaKeywords(e.target.value)}
                    placeholder="Target keywords (optional)"
                    className="h-8 text-xs"
                  />
                </div>

                <Button
                  className="rounded-full bg-amber-400 text-zinc-900 text-xs font-semibold hover:bg-amber-400/90 gap-1.5 w-full"
                  onClick={() => ideasMutation.mutate()}
                  disabled={ideasMutation.isPending}
                >
                  {ideasMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Generate Article Ideas
                </Button>
              </div>
            ) : (
              /* Ideas List */
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                  {ideas.map((idea, idx) => (
                    <IdeaCard
                      key={idx}
                      idea={idea}
                      index={idx}
                      expanded={expandedIdea === idx}
                      onToggle={() => setExpandedIdea(expandedIdea === idx ? null : idx)}
                      onSave={() => {
                        setSavedIdeas((prev) => new Set(prev).add(idx));
                        toast.success('Idea saved!');
                      }}
                      onBookmark={() => {
                        setBookmarkedIdeas((prev) => {
                          const next = new Set(prev);
                          if (next.has(idx)) next.delete(idx);
                          else next.add(idx);
                          return next;
                        });
                      }}
                      onCreateArticle={() => handleCreateFromIdea(idea)}
                      isBookmarked={bookmarkedIdeas.has(idx)}
                    />
                  ))}
                </div>

                {/* Bottom Actions */}
                <div className="border-t px-3 py-2 flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1 flex-1"
                    onClick={() => ideasMutation.mutate()}
                    disabled={ideasMutation.isPending}
                  >
                    {ideasMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Regenerate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] gap-1"
                    onClick={() => { setIdeas([]); setExpandedIdea(null); }}
                  >
                    <X className="h-3 w-3" />
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* AI Generate Dialog */}
      <AIGenerateDialog
        open={generateDialogOpen}
        onOpenChange={setGenerateDialogOpen}
        idea={selectedIdea}
      />

      {/* Categories & Tags management modal */}
      <CategoriesTagsDialog open={catTagOpen} onOpenChange={setCatTagOpen} />

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border bg-background px-4 py-3 shadow-lg">
          <span className="text-sm font-medium">{selectedIds.length} selected</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => bulkStatusMutation.mutate({ ids: selectedIds, status: 'DRAFT' })}
            disabled={bulkStatusMutation.isPending}
          >
            Set Draft
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => bulkStatusMutation.mutate({ ids: selectedIds, status: 'PUBLISHED' })}
            disabled={bulkStatusMutation.isPending}
          >
            Set Published
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => bulkDeleteMutation.mutate(selectedIds)}
            disabled={bulkDeleteMutation.isPending}
          >
            {bulkDeleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Delete Selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
            Clear
          </Button>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Content"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${truncate(deleteTarget.title, 50)}"? This action cannot be undone.`
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

