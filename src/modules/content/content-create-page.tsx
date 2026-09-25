'use client';

import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import {
  ArrowLeft,
  Save,
  CalendarClock,
  Sparkles,
  Image as ImageIcon,
  Calendar,
  Clock,
  Search,
  X,
  Upload,
  FileText,
  Type,
  Send,
  Eye,
  FolderOpen,
  Loader2,
  BookOpen,
  CalendarDays,
  Square,
  Trash2,
  Check,
  Plus,
  PenLine,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { TiptapEditor, type TiptapEditorRef } from '@/components/editor/tiptap-editor';
import { getApi, postApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { CategoriesTagsDialog } from './categories-tags-dialog';
import { KeywordsDialog } from './keywords-dialog';
import { isImageGenerationIntent, buildImagePrompt } from '@/lib/ai/ai-intent-detector';
import { useSiteStore } from '@/lib/stores/site-store';
import { markdownToEditorHtml } from '@/lib/pipeline/markdown-to-html';

import { useAiWorkspace } from '@/hooks/use-ai-workspace';
import { PublishDatePicker, PublishTimePicker } from './publishing-datetime-pickers';
import { useT } from '@/lib/i18n';
import { slugify, cn } from '@/lib/utils';
import { sanitizeContentForStorage } from '@/lib/pipeline/content-item-pipeline';
import { toast } from 'sonner';

// -------------------- Types ----------------

interface ContentTypeOption { id: string; name: string; slug?: string; }
interface CategoryOption { id: string; name: string; }
interface TagOption { id: string; name: string; }
interface MediaItem { id: string; filename: string; url: string; thumbnailUrl?: string; alt?: string; }
interface CreatedContent { id: string; title: string; }

// -------------------- Draft Persistence ----------------
const DRAFT_STORAGE_KEY = 'cms_article_new_draft';

interface ArticleCreateDraft {
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  contentTypeId?: string;
  categoryId?: string;
  tagIds?: string[];
  customTags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  aiInput?: string;
  featuredImage?: MediaItem | null;
  targetScheduleDate?: string;
  updatedAt: number;
}

// -------------------- Form Schema ----------------

const contentFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  excerpt: z.string().max(300, 'Excerpt must be 300 characters or less').optional().or(z.literal('')),
  content: z.string().optional().or(z.literal('')),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED']),
  contentTypeId: z.string().optional().or(z.literal('')),
  categoryId: z.string().optional().or(z.literal('')),
  tagIds: z.array(z.string()),
  seoTitle: z.string().max(60, 'Meta title must be 60 characters or less').optional().or(z.literal('')),
  seoDescription: z.string().max(160, 'Meta description must be 160 characters or less').optional().or(z.literal('')),
});

type ContentFormValues = z.infer<typeof contentFormSchema>;

const AI_NORMAL_ACTIONS = [
  { id: 'Make it shorter', key: 'articles.aiAction.makeShorter' },
  { id: 'Fix grammar', key: 'articles.aiAction.fixGrammar' },
  { id: 'More professional', key: 'articles.aiAction.moreProfessional' },
  { id: 'Add a conclusion', key: 'articles.aiAction.addConclusion' },
];
const AI_SELECTED_ACTIONS = [
  { id: 'Make it shorter', key: 'articles.aiAction.makeShorter' },
  { id: 'Fix grammar', key: 'articles.aiAction.fixGrammar' },
  { id: 'More professional', key: 'articles.aiAction.moreProfessional' },
  { id: 'Rewrite this', key: 'articles.aiAction.rewriteThis' },
];

// -------------------- Preview Component ----------------

function PreviewPanel({
  title,
  excerpt,
  content,
  featuredImageUrl,
  seoTitle,
  seoDescription,
  tags,
  onClose,
}: {
  title: string;
  excerpt: string;
  content: string;
  featuredImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  tags: string[];
  onClose: () => void;
}) {
  const { t } = useT();
  const wordCount = content ? content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));
  const publishDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      {/* Preview Mode Indicator Bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-amber-400 px-4 py-2 text-zinc-900">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4" />
          <span className="text-sm font-semibold">{t('articles.previewMode')}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs bg-white/90 border-zinc-900/20 hover:bg-white"
          onClick={onClose}
        >
          <ArrowLeft className="h-3 w-3 mr-1" />
          {t('articles.backToEditor')}
        </Button>
      </div>

      {/* Article Preview */}
      <div className="mx-auto max-w-3xl px-6 py-12">
        {/* Featured Image */}
        {featuredImageUrl && (
          <div className="mb-8 overflow-hidden rounded-xl">
            <img src={featuredImageUrl} alt={title} className="w-full h-auto object-cover" />
          </div>
        )}

        {/* Title */}
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title || t('articles.untitledArticle')}</h1>

        {/* Metadata */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>{publishDate}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            <span>{readingTime} {t('articles.minRead')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            <span>{wordCount} {t('articles.words')}</span>
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs font-normal">{tag}</Badge>
            ))}
          </div>
        )}

        <Separator className="my-8" />

        {/* Excerpt */}
        {excerpt && (
          <p className="text-lg text-muted-foreground leading-relaxed italic mb-8">{excerpt}</p>
        )}

        {/* Content */}
        <div
          className="prose prose-gray dark:prose-invert max-w-none prose-headings:font-bold prose-h2:text-2xl prose-h3:text-xl prose-p:leading-relaxed prose-a:text-primary"
          dangerouslySetInnerHTML={{ __html: content || `<p class="text-muted-foreground">${t('articles.noContentYet')}</p>` }}
        />

        {/* SEO Preview */}
        {(seoTitle || seoDescription) && (
          <>
            <Separator className="my-8" />
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t('articles.seoPreview')}</p>
              <div className="space-y-1">
                <p className="text-blue-700 dark:text-blue-400 text-sm font-medium truncate">
                  {seoTitle || title || t('articles.pageTitle')} — My Website
                </p>
                <p className="text-green-700 dark:text-green-400 text-xs truncate">
                  mywebsite.com/articles/slug
                </p>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {seoDescription || excerpt || t('articles.pageDescriptionPlaceholder')}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// -------------------- Media Library Dialog ----------------

function MediaLibraryDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (media: MediaItem) => void;
}) {
  const { t } = useT();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['media-library', search],
    queryFn: () => getApi<MediaItem[] | { data: MediaItem[] }>(`/api/media?pageSize=50${search ? `&search=${encodeURIComponent(search)}` : ''}`),
    enabled: open,
    staleTime: 30_000,
  });

  const mediaItems: MediaItem[] = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.data)
      ? (data as any).data
      : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            {t('articles.mediaLibraryTitle')}
          </DialogTitle>
          <DialogDescription>{t('articles.mediaLibraryDescription')}</DialogDescription>
        </DialogHeader>

        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('articles.searchMediaPlaceholder')}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="grid grid-cols-3 gap-2 p-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : mediaItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ImageIcon className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{t('articles.noMediaFiles')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 p-1">
              {mediaItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { onSelect(item); onOpenChange(false); }}
                  className="group relative aspect-square rounded-lg overflow-hidden border hover:ring-2 hover:ring-primary transition-all"
                >
                  <img
                    src={item.thumbnailUrl || item.url}
                    alt={item.alt || item.filename}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end">
                    <span className="p-1.5 text-[10px] text-white font-medium truncate w-full opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.filename}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Schedule Dialog ----------------

function ScheduleDialog({
  open,
  onOpenChange,
  onSchedule,
  isPending,
  initialDate,
  initialTime,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSchedule: (date: string, time: string) => void;
  isPending: boolean;
  initialDate?: string;
  initialTime?: string;
}) {
  const { t } = useT();
  const [date, setDate] = useState(initialDate || '');
  const [time, setTime] = useState(initialTime || '');

  useEffect(() => {
    if (open) {
      setDate(initialDate || '');
      setTime(initialTime || '');
    }
  }, [open, initialDate, initialTime]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-muted-foreground" />
            {t('articles.scheduleArticleTitle')}
          </DialogTitle>
          <DialogDescription>{t('articles.scheduleArticleDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('articles.date')}</Label>
            <PublishDatePicker value={date} onChange={setDate} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('articles.time')}</Label>
            <PublishTimePicker value={time} onChange={setTime} className="h-10" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button
            className="bg-yellow-500 hover:bg-yellow-400 text-black"
            onClick={() => { onSchedule(date, time); onOpenChange(false); }}
            disabled={isPending || !date}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
            {t('articles.schedule')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- AI Assist Dialog ----------------

function AIAssistDialog({
  open,
  onOpenChange,
  onGenerate,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (prompt: string) => void;
  isPending: boolean;
}) {
  const { t } = useT();
  const [prompt, setPrompt] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            {t('articles.aiAssistantTitle')}
          </DialogTitle>
          <DialogDescription>{t('articles.aiAssistantDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('articles.aiAssistantPromptPlaceholder')}
            rows={4}
            className="text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            {AI_NORMAL_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => setPrompt(action.id)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-border/50 bg-background hover:bg-muted hover:border-border transition-colors text-muted-foreground"
              >
                {t(action.key)}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button
            className="gap-1.5 bg-amber-400 text-zinc-900 hover:bg-amber-400/90"
            onClick={() => { onGenerate(prompt); onOpenChange(false); }}
            disabled={isPending || !prompt.trim()}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {t('articles.generate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Main Component ----------------

export function ContentCreatePage({ fixedContentType }: { fixedContentType?: 'post' | 'page' } = {}) {
  const navigate = useNavigationStore((s) => s.navigate);
  const currentModule = useNavigationStore((s) => s.currentModule);
  const queryClient = useQueryClient();
  const { t } = useT();
  const isAllSites = useSiteStore((s) => s.isAllSites());
  const activeSiteDbId = useSiteStore((s) => s.activeSiteDbId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<TiptapEditorRef>(null);

  // Platform AI entitlement (client-side hiding only — the AI
  // endpoints enforce the plan feature server-side). While the
  // workspace state is loading the tools remain visible (fail-open
  // for cosmetics; a user without Platform AI gets 403 + a clear
  // message from the API).
  const { data: aiWorkspace } = useAiWorkspace();
  const aiToolsEnabled = aiWorkspace?.entitlements.aiPlatform ?? true;

  const [tagSearch, setTagSearch] = useState('');
  const [slugValue, setSlugValue] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [generatedSeoReport, setGeneratedSeoReport] = useState<any>(null);
  const [generatedEditorialReport, setGeneratedEditorialReport] = useState<any>(null);
  const [featuredImage, setFeaturedImage] = useState<MediaItem | null>(null);
  const [customTags, setCustomTags] = useState<string[]>([]); // For newly created tags
  const [selectedText, setSelectedText] = useState(''); // Tracks the currently selected text in the editor (transient)
  const [savedSelectedText, setSavedSelectedText] = useState(''); // Persistent saved selection context for AI bar
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const aiBoxRef = useRef<HTMLDivElement>(null);

  // Fix #2: onSelectionChange handler — update transient and saved selection
  const handleEditorSelectionChange = useCallback((text: string) => {
    setSelectedText(text);
    setSavedSelectedText(text);
  }, []);

  const clearSavedSelection = useCallback(() => {
    setSavedSelectedText('');
    setSelectedText('');
  }, []);

  // Clear selection when clicking anywhere on empty space outside the AI input container
  useEffect(() => {
    const handleDocumentMouseDown = (e: MouseEvent) => {
      // If clicking inside the AI box, don't clear (user might be focusing input)
      if (aiBoxRef.current && aiBoxRef.current.contains(e.target as Node)) {
        return;
      }
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          setSavedSelectedText('');
          setSelectedText('');
        }
      }, 50);
    };
    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown);
  }, []);

  const [targetScheduleDate, setTargetScheduleDate] = useState<string>('');
  const [targetScheduleTime, setTargetScheduleTime] = useState<string>('');

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return 'Select date';
    try {
      const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatDisplayTime = (timeStr: string) => {
    if (!timeStr) return '--:-- --';
    try {
      const [h, m] = timeStr.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return timeStr;
      const period = h >= 12 ? 'PM' : 'AM';
      const hours = h % 12 || 12;
      return `${hours}:${m.toString().padStart(2, '0')} ${period}`;
    } catch {
      return timeStr;
    }
  };

  const {
    register, handleSubmit, control, watch, setValue, getValues, formState: { errors },
  } = useForm<ContentFormValues>({
    resolver: zodResolver(contentFormSchema),
    defaultValues: { title: '', excerpt: '', content: '', status: 'DRAFT', contentTypeId: '', categoryId: '', tagIds: [], seoTitle: '', seoDescription: '' },
  });

  const selectedTagIds = watch('tagIds');
  const watchedTitle = watch('title');
  const watchedExcerpt = watch('excerpt');
  const watchedSeoTitle = watch('seoTitle');
  const watchedSeoDescription = watch('seoDescription');
  const watchedContentTypeId = watch('contentTypeId');
  const watchedCategoryId = watch('categoryId');

  // Draft persistence: Restore draft from localStorage on initial mount
  const hasRestoredDraftRef = useRef(false);
  useEffect(() => {
    if (hasRestoredDraftRef.current) return;
    hasRestoredDraftRef.current = true;

    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(DRAFT_STORAGE_KEY) : null;
      if (!raw) return;
      const draft: ArticleCreateDraft = JSON.parse(raw);
      if (!draft || typeof draft !== 'object') return;

      if (draft.title && !getValues('title')) {
        setValue('title', draft.title, { shouldValidate: true });
      }
      if (draft.slug) {
        setSlugValue(draft.slug);
      } else if (draft.title) {
        setSlugValue(slugify(draft.title));
      }
      if (draft.excerpt && !getValues('excerpt')) {
        setValue('excerpt', draft.excerpt);
      }
      if (draft.content) {
        setEditorContent(draft.content);
        setValue('content', draft.content);
      }
      if (draft.contentTypeId && !getValues('contentTypeId')) {
        setValue('contentTypeId', draft.contentTypeId);
      }
      if (draft.categoryId && !getValues('categoryId')) {
        setValue('categoryId', draft.categoryId);
      }
      if (Array.isArray(draft.tagIds) && draft.tagIds.length > 0 && getValues('tagIds').length === 0) {
        setValue('tagIds', draft.tagIds);
      }
      if (Array.isArray(draft.customTags) && draft.customTags.length > 0) {
        setCustomTags(draft.customTags);
      }
      if (draft.seoTitle && !getValues('seoTitle')) {
        setValue('seoTitle', draft.seoTitle);
      }
      if (draft.seoDescription && !getValues('seoDescription')) {
        setValue('seoDescription', draft.seoDescription);
      }
      if (draft.aiInput) {
        setAiInput(draft.aiInput);
      }
      if (draft.featuredImage) {
        setFeaturedImage(draft.featuredImage);
      }
      if (draft.targetScheduleDate) {
        setTargetScheduleDate(draft.targetScheduleDate);
      }
    } catch (e) {
      console.warn('[Draft] Failed to restore draft:', e);
    }
  }, [setValue, getValues]);

  // Draft persistence: Auto-save draft to localStorage whenever form or editor state changes
  useEffect(() => {
    if (!hasRestoredDraftRef.current) return;

    const currentValues = getValues();
    const hasData = Boolean(
      currentValues.title?.trim() ||
      currentValues.excerpt?.trim() ||
      editorContent?.trim() ||
      aiInput?.trim() ||
      currentValues.seoTitle?.trim() ||
      currentValues.seoDescription?.trim() ||
      currentValues.categoryId ||
      (currentValues.tagIds && currentValues.tagIds.length > 0) ||
      featuredImage
    );

    if (!hasData) {
      try {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {}
      return;
    }

    const timer = setTimeout(() => {
      try {
        const draft: ArticleCreateDraft = {
          title: currentValues.title || '',
          slug: slugValue || '',
          excerpt: currentValues.excerpt || '',
          content: editorContent || '',
          contentTypeId: currentValues.contentTypeId || '',
          categoryId: currentValues.categoryId || '',
          tagIds: currentValues.tagIds || [],
          customTags,
          seoTitle: currentValues.seoTitle || '',
          seoDescription: currentValues.seoDescription || '',
          aiInput: aiInput || '',
          featuredImage,
          targetScheduleDate,
          updatedAt: Date.now(),
        };
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } catch (e) {
        console.warn('[Draft] Failed to save draft:', e);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [
    watchedTitle,
    watchedExcerpt,
    editorContent,
    aiInput,
    watchedSeoTitle,
    watchedSeoDescription,
    watchedContentTypeId,
    watchedCategoryId,
    selectedTagIds,
    customTags,
    slugValue,
    featuredImage,
    targetScheduleDate,
    getValues,
  ]);

  // Clear draft helper
  const clearDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {}
    setValue('title', '');
    setValue('excerpt', '');
    setValue('content', '');
    setValue('seoTitle', '');
    setValue('seoDescription', '');
    setValue('categoryId', '');
    setValue('tagIds', []);
    setSlugValue('');
    setEditorContent('');
    setAiInput('');
    setFeaturedImage(null);
    setCustomTags([]);
    setSavedSelectedText('');
    setSelectedText('');
    setTargetScheduleDate('');
    toast.info(t('articles.draftCleared') || 'Draft cleared');
  }, [setValue, t]);

  const hasDraftContent = useMemo(() => {
    return Boolean(
      watchedTitle?.trim() ||
      watchedExcerpt?.trim() ||
      editorContent?.trim() ||
      aiInput?.trim() ||
      watchedSeoTitle?.trim() ||
      watchedSeoDescription?.trim() ||
      (selectedTagIds && selectedTagIds.length > 0) ||
      featuredImage
    );
  }, [
    watchedTitle,
    watchedExcerpt,
    editorContent,
    aiInput,
    watchedSeoTitle,
    watchedSeoDescription,
    selectedTagIds,
    featuredImage,
  ]);

  // Preload AI prompt and title if navigated from AI Ideas
  useEffect(() => {
    const navStore = useNavigationStore.getState();
    const promptFromStore = navStore.initialAiPrompt;
    const promptFromStorage =
      typeof window !== 'undefined' ? window.sessionStorage.getItem('pending_ai_prompt') : null;
    const prompt = promptFromStore || promptFromStorage;

    const titleFromStore = navStore.initialArticleTitle;
    const titleFromStorage =
      typeof window !== 'undefined' ? window.sessionStorage.getItem('pending_ai_title') : null;
    const title = titleFromStore || titleFromStorage;

    const targetDateFromStorage =
      typeof window !== 'undefined' ? window.sessionStorage.getItem('pending_ai_target_date') : null;
    if (targetDateFromStorage) {
      const datePart = targetDateFromStorage.split('T')[0];
      setTargetScheduleDate(datePart);
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('pending_ai_target_date');
      }
    }

    if (prompt) {
      setAiInput(prompt);
      navStore.setInitialAiPrompt(null, null);
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('pending_ai_prompt');
        window.sessionStorage.removeItem('pending_ai_title');
      }
    }

    if (title && !getValues('title')) {
      setValue('title', title, { shouldValidate: true });
      setSlugValue(slugify(title));
    }
  }, [setValue, getValues]);

  // Dialog states
  const [previewOpen, setPreviewOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [aiAssistOpen, setAiAssistOpen] = useState(false);
  const [aiImageDialogOpen, setAiImageDialogOpen] = useState(false);
  const [aiImagePrompt, setAiImagePrompt] = useState('');
  const [featuredAspectRatio, setFeaturedAspectRatio] = useState<string>('1:1');
  const [catTagsOpen, setCatTagsOpen] = useState(false);
  const [catTagsInitialTab, setCatTagsInitialTab] = useState<'categories' | 'tags'>('categories');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isSeoGenerating, setIsSeoGenerating] = useState(false);

  // Fetch dropdown data
  const { data: contentTypes } = useQuery({
    queryKey: queryKeys.contentTypes.all,
    queryFn: () => getApi<ContentTypeOption[]>('/api/content-types?pageSize=100'),
    staleTime: 60_000,
  });

  const isPage = fixedContentType === 'page' ||
    currentModule === 'pages' ||
    contentTypes?.find((ct: any) => ct.id === watchedContentTypeId)?.slug?.toLowerCase() === 'page' ||
    contentTypes?.find((ct: any) => ct.id === watchedContentTypeId)?.name?.toLowerCase() === 'page';

  // Automatically default content type to POST for articles or PAGE for pages
  useEffect(() => {
    if (contentTypes && contentTypes.length > 0) {
      const targetSlug = fixedContentType || 'post';
      const targetType = contentTypes.find(
        (ct: any) => ct.slug?.toLowerCase() === targetSlug || ct.name?.toLowerCase() === targetSlug,
      ) || contentTypes[0];
      if (targetType) {
        setValue('contentTypeId', targetType.id);
      }
    }
  }, [contentTypes, fixedContentType, setValue]);
  const { data: categories, refetch: refetchCategories } = useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => getApi<CategoryOption[]>('/api/categories?pageSize=200'),
    staleTime: 60_000,
  });
  const { data: allTags, refetch: refetchTags } = useQuery({
    queryKey: queryKeys.tags.all,
    queryFn: () => getApi<TagOption[]>('/api/tags?pageSize=200'),
    staleTime: 60_000,
  });

  const [keywordsDialogOpen, setKeywordsDialogOpen] = useState(false);
  const [isTagsGenerating, setIsTagsGenerating] = useState(false);

  const handleGenerateTags = useCallback(async () => {
    const currentTitle = watchedTitle?.trim() || getValues('title')?.trim();
    const currentSeoTitle = watchedSeoTitle?.trim() || getValues('seoTitle')?.trim();
    const currentSeoDescription = watchedSeoDescription?.trim() || getValues('seoDescription')?.trim();
    const currentContent = editorContent || watchedExcerpt || aiInput || '';
    if (!currentTitle && !currentContent && !currentSeoTitle) {
      toast.error(t('articles.titleRequired') || 'Please enter an article title or SEO information first.');
      return;
    }

    setIsTagsGenerating(true);
    try {
      const existingNames = allTags?.map((t) => t.name) || [];
      const res = await postApi<any>('/api/content/generate-taxonomy', {
        type: 'tags',
        title: currentTitle || undefined,
        seoTitle: currentSeoTitle || undefined,
        seoDescription: currentSeoDescription || undefined,
        content: currentContent || undefined,
        existing: existingNames,
        count: 8,
      });

      let items: string[] =
        res?.items ||
        res?.data?.items ||
        (Array.isArray(res) ? res : []) ||
        [];

      // Local fallback from aiInput keywords if any
      if (items.length === 0 && (aiInput || currentContent)) {
        const text = `${aiInput} ${currentContent}`;
        const kwMatch = text.match(/Keywords:\s*([^\n\r]+)/i);
        if (kwMatch && kwMatch[1]) {
          items = kwMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
        }
      }

      if (items.length === 0 && currentTitle) {
        items = currentTitle
          .replace(/[:\-–—\(\)\?!]/g, ' ')
          .split(/\s+/)
          .map((w) => w.trim())
          .filter((w) => w.length > 3)
          .slice(0, 6);
      }

      if (items.length === 0) {
        toast.info('No tags suggested by AI.');
        return;
      }

      const generatedTagIds: string[] = [];
      for (const item of items) {
        try {
          const createRes = await postApi<{ id: string; name: string }>('/api/tags', { name: item });
          if (createRes?.id) {
            generatedTagIds.push(createRes.id);
          }
        } catch {
          // If exists
        }
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      const refreshed = await refetchTags();
      const updatedTags = refreshed.data ?? allTags ?? [];

      for (const item of items) {
        const found = updatedTags.find((t) => t.name.toLowerCase() === item.toLowerCase());
        if (found && !generatedTagIds.includes(found.id)) {
          generatedTagIds.push(found.id);
        }
      }

      const currentTagIds = getValues('tagIds') || selectedTagIds || [];
      const mergedIds = Array.from(new Set([...currentTagIds, ...generatedTagIds]));
      setValue('tagIds', mergedIds, { shouldDirty: true, shouldValidate: true });
      toast.success(`Generated ${generatedTagIds.length} SEO keywords and tags with AI!`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate tags');
    } finally {
      setIsTagsGenerating(false);
    }
  }, [watchedTitle, watchedSeoTitle, watchedSeoDescription, getValues, editorContent, watchedExcerpt, aiInput, allTags, queryClient, refetchTags, selectedTagIds, setValue, t]);

  const handleGenerateSeo = useCallback(async () => {
    const currentTitle = watchedTitle?.trim() || getValues('title')?.trim();
    if (!currentTitle) {
      toast.error(t('articles.titleRequired') || 'Please enter an article title first.');
      return;
    }
    setIsSeoGenerating(true);
    try {
      const editorText =
        (typeof editorRef.current?.getMarkdown === 'function' ? editorRef.current.getMarkdown() : '') ||
        editorContent ||
        getValues('content') ||
        '';
      const currentExcerpt = getValues('excerpt') || '';
      const res = await postApi<{ data?: { seoTitle?: string; seoDescription?: string }; seoTitle?: string; seoDescription?: string }>('/api/content/generate-seo', {
        title: currentTitle,
        content: editorText,
        excerpt: currentExcerpt,
      });
      const data = (res as any)?.data || res;
      if (data?.seoTitle) {
        setValue('seoTitle', data.seoTitle, { shouldDirty: true, shouldValidate: true });
      }
      if (data?.seoDescription) {
        setValue('seoDescription', data.seoDescription, { shouldDirty: true, shouldValidate: true });
      }
      toast.success(t('articles.seoGenerated') || 'SEO metadata generated successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate SEO metadata');
    } finally {
      setIsSeoGenerating(false);
    }
  }, [watchedTitle, getValues, editorContent, setValue, t]);

  const filteredTags = useMemo(() => {
    if (!allTags) return [];
    if (!tagSearch) return allTags;
    return allTags.filter((t) => t.name.toLowerCase().includes(tagSearch.toLowerCase()));
  }, [allTags, tagSearch]);

  // Auto-slug
  React.useEffect(() => {
    setSlugValue(slugify(watchedTitle));
  }, [watchedTitle]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: ContentFormValues & { scheduledAt?: string }) => {
      const slug = slugValue || slugify(data.title);
      return postApi<CreatedContent>('/api/content', {
        title: data.title,
        slug,
        siteId: !isAllSites && activeSiteDbId ? activeSiteDbId : undefined,
        excerpt: isPage ? '' : (data.excerpt !== undefined ? data.excerpt : ''),
        content: editorContent !== undefined ? sanitizeContentForStorage(editorContent) : (data.content || ''),
        status: data.status,
        contentTypeId: data.contentTypeId || undefined,
        type: isPage ? 'page' : (fixedContentType || 'post'),
        categoryId: isPage ? null : (data.categoryId ? data.categoryId : null),
        tagIds: isPage ? [] : data.tagIds,
        seoTitle: data.seoTitle ? data.seoTitle : null,
        seoDescription: data.seoDescription ? data.seoDescription : null,
        seoReport: generatedSeoReport ? JSON.stringify(generatedSeoReport) : undefined,
        editorialReport: generatedEditorialReport ? JSON.stringify(generatedEditorialReport) : undefined,
        featuredImageId: isPage ? null : (featuredImage ? featuredImage.id : null),
        scheduledAt: data.scheduledAt ? data.scheduledAt : null,
      } as Record<string, unknown>);
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.content.all });
      toast.success(t('articles.createdToast'));
      try {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {}
      navigate(fixedContentType === 'page' || isPage || currentModule === 'pages' ? 'pages' : 'content', created.id);
    },
    onError: (err: Error) => toast.error(err.message || t('articles.createFailedToast')),
  });

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: (name: string) => postApi<TagOption>('/api/tags', { name }),
    onSuccess: (newTag) => {
      refetchTags();
      if (!selectedTagIds.includes(newTag.id)) {
        setValue('tagIds', [...selectedTagIds, newTag.id], { shouldValidate: true });
      }
      setCustomTags((prev) => [...prev, newTag.name]);
      toast.success(`${t('articles.tagCreatedToast')} ${newTag.name}`);
    },
    onError: (err: Error) => toast.error(err.message || t('articles.tagCreateFailedToast')),
  });

  // Upload featured image mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'Upload failed');
      }
      const json = await res.json();
      return json.data as MediaItem;
    },
    onSuccess: (media) => {
      setFeaturedImage(media);
      toast.success(t('articles.imageUploadedToast'));
    },
    onError: (err: Error) => toast.error(err.message || t('articles.uploadFailedToast')),
  });

  // Generate featured image with AI mutation
  const aiImageGenerateMutation = useMutation({
    mutationFn: async ({ promptText, aspectRatio = '1:1' }: { promptText: string; aspectRatio?: string }) => {
      const res = await postApi<any>('/api/media/generate', {
        prompt: promptText,
        aspectRatio,
        count: 1,
      });
      const items = Array.isArray(res) ? res : (res as any)?.data;
      return items?.[0];
    },
    onSuccess: (item) => {
      if (item && item.url) {
        setFeaturedImage({
          id: item.id,
          filename: item.filename || 'ai-featured-image.png',
          url: item.url,
          alt: item.alt || aiImagePrompt || 'Featured image',
        });
        setAiImageDialogOpen(false);
        toast.success(t('media.imagesGenerated') || 'Featured image generated successfully');
      } else {
        toast.error(t('media.generateFailed') || 'Image generation failed');
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || t('media.generateFailed') || 'Image generation failed');
    },
  });

  // AbortController ref for interrupting ongoing AI generation
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStopAi = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGeneratingImage(false);
    setIsAiStreaming(false);
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const [isAiStreaming, setIsAiStreaming] = useState(false);

  // AI content generation via SSE streaming (full article — used when no text is selected)
  const generateAiArticleStream = useCallback(async (prompt: string) => {
    abortControllerRef.current = new AbortController();
    setIsAiStreaming(true);

    try {
      const response = await fetch('/api/content/ai-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          title: watchedTitle || t('articles.untitled'),
          brief: prompt,
          writingStyle: 'Professional',
          targetLength: 'Medium (800-1200 words)',
          numberOfDrafts: 1,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || errJson?.message || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Response stream not readable');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const lines = part.split('\n');
          let eventType = 'message';
          let dataStr = '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('event:')) {
              eventType = trimmed.slice(6).trim();
            } else if (trimmed.startsWith('data:')) {
              dataStr = trimmed.slice(5).trim();
            }
          }

          if (!dataStr) continue;

          try {
            const parsed = JSON.parse(dataStr);
            if (eventType === 'chunk') {
              const accumulated = parsed.accumulated || '';
              if (accumulated) {
                const html = markdownToEditorHtml(accumulated);
                setEditorContent(html);
              }
            } else if (eventType === 'done') {
              const draft = parsed.drafts?.[0];
              const seo = parsed.seo;
              const seoReport = parsed.seoReport;
              const editorialReport = parsed.editorialReport;

              if (draft?.content) {
                setEditorContent(draft.content);
              }
              if (seoReport || seo) {
                setGeneratedSeoReport(seoReport || seo);
              }
              if (editorialReport) {
                setGeneratedEditorialReport(editorialReport);
              }
              if (seo) {
                if (seo.seoTitle && !getValues('seoTitle')) {
                  setValue('seoTitle', seo.seoTitle, { shouldDirty: true });
                }
                if (seo.metaDescription && !getValues('seoDescription')) {
                  setValue('seoDescription', seo.metaDescription, { shouldDirty: true });
                }
                if (seo.slug && !slugValue) {
                  setSlugValue(seo.slug);
                }
              }
              clearSavedSelection();
              toast.success(t('articles.aiGeneratedToast'));
            } else if (eventType === 'error') {
              throw new Error(parsed.message || 'Generation failed');
            }
          } catch (jsonErr: any) {
            if (eventType === 'error' || (jsonErr.message && !jsonErr.message.includes('JSON'))) {
              throw jsonErr;
            }
          }
        }
      }
    } catch (err: any) {
      if (
        err.name === 'AbortError' ||
        err.message?.toLowerCase().includes('cancel') ||
        err.message?.toLowerCase().includes('abort')
      ) {
        toast.info(t('articles.generationStopped') || 'Generation stopped');
        return;
      }
      toast.error(err.message || t('articles.aiGenerationFailedToast'));
    } finally {
      setIsAiStreaming(false);
      abortControllerRef.current = null;
      clearSavedSelection();
    }
  }, [watchedTitle, t, slugValue, getValues, setValue, clearSavedSelection]);

  // AI edit selected text mutation (used when text is selected)
  const aiEditSelectionMutation = useMutation({
    mutationFn: ({ text, action, context }: { text: string; action: string; context?: string }) => {
      abortControllerRef.current = new AbortController();
      return postApi<{ editedText: string }>(
        '/api/content/ai-edit-selection',
        { text, action, context },
        { signal: abortControllerRef.current.signal },
      );
    },
    onSuccess: (result) => {
      abortControllerRef.current = null;
      clearSavedSelection();
      // postApi unwraps the ApiResponse envelope → result IS the data object.
      const editedText = result?.editedText;
      if (editedText) {
        editorRef.current?.replaceSelection(editedText);
        toast.success(t('articles.textUpdatedToast'));
      }
    },
    onError: (err: Error) => {
      abortControllerRef.current = null;
      clearSavedSelection();
      if (
        err.name === 'AbortError' ||
        err.message?.toLowerCase().includes('cancel') ||
        err.message?.toLowerCase().includes('abort')
      ) {
        toast.info(t('articles.generationStopped') || 'Generation stopped');
        return;
      }
      toast.error(err.message || t('articles.aiEditFailedToast'));
    },
  });

  const isAiGenerating = isAiStreaming || aiEditSelectionMutation.isPending || isGeneratingImage;

  // Generate Image directly into the editor
  const handleAiImageGenerate = useCallback(
    async (promptText: string, contextText?: string) => {
      const effectivePrompt = buildImagePrompt(promptText, contextText, watchedTitle);
      setIsGeneratingImage(true);
      abortControllerRef.current = new AbortController();

      try {
        const genMsg = t('articles.generatingImage');
        toast.info(genMsg && genMsg !== 'articles.generatingImage' ? genMsg : 'Generating image with AI...');
        const res = await postApi<any>(
          '/api/media/generate',
          {
            prompt: effectivePrompt,
            aspectRatio: '16:9',
            count: 1,
          },
          { signal: abortControllerRef.current.signal },
        );

        const items = Array.isArray(res) ? res : (res as any)?.data;
        const media = items?.[0];

        if (media && media.url) {
          editorRef.current?.insertImage(media.url, effectivePrompt);

          setFeaturedImage((prev) => {
            if (!prev) {
              return {
                id: media.id,
                filename: media.filename || 'ai-generated-image.png',
                url: media.url,
                alt: media.alt || effectivePrompt,
              };
            }
            return prev;
          });

          const succMsg = t('articles.imageGeneratedToast');
          toast.success(succMsg && succMsg !== 'articles.imageGeneratedToast' ? succMsg : 'Image generated and inserted successfully');
        } else {
          toast.error(t('media.generateFailed') || 'Failed to generate image');
        }
      } catch (err: any) {
        if (
          err?.name === 'AbortError' ||
          err?.message?.toLowerCase().includes('cancel') ||
          err?.message?.toLowerCase().includes('abort')
        ) {
          toast.info(t('articles.generationStopped') || 'Generation stopped');
          return;
        }
        toast.error(err?.message || t('media.generateFailed') || 'Failed to generate image');
      } finally {
        setIsGeneratingImage(false);
        abortControllerRef.current = null;
        clearSavedSelection();
      }
    },
    [clearSavedSelection, watchedTitle, t],
  );

  // Selection-aware action handler
  // Captures the selection in onMouseDown (before editor loses focus),
  // then executes the action in onClick using the already-saved range.
  const captureAndHandleQuickAction = useCallback((action: string) => {
    // Selection is already captured in onMouseDown via captureSelection().
    // At this point savedSelectionRef inside the editor already holds the range.
    // We just retrieve the saved text to check if anything is selected.
    const savedText = editorRef.current?.saveSelectionForReplace() || savedSelectedText || '';
    clearSavedSelection();

    if (action === 'Duplicate') {
      if (savedText) {
        editorRef.current?.insertAfterSelection(savedText);
        toast.success(t('articles.textDuplicatedToast'));
      } else {
        toast.error(t('articles.selectTextToDuplicateToast'));
      }
      return;
    }

    if (savedText) {
      aiEditSelectionMutation.mutate({ text: savedText, action });
    } else {
      generateAiArticleStream(action);
    }
  }, [aiEditSelectionMutation, generateAiArticleStream, savedSelectedText, clearSavedSelection, t]);

  // Called on mousedown of AI action buttons — captures selection BEFORE editor can lose it
  const captureSelectionOnMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); // prevent editor from losing focus/selection
    // saveSelectionForReplace reads editor.state.selection (still valid here)
    // and stores the {from, to} range for use after the subsequent onClick.
    editorRef.current?.saveSelectionForReplace();
  }, []);

  const handleQuickAction = useCallback((action: string) => {
    captureAndHandleQuickAction(action);
  }, [captureAndHandleQuickAction]);

  const handleAiSubmit = useCallback((prompt: string) => {
    const selectedText = editorRef.current?.saveSelectionForReplace() || savedSelectedText || '';
    const shouldGenerateImage = isImageGenerationIntent(prompt);

    // Clear saved selection so pill disappears immediately on submit
    clearSavedSelection();

    if (shouldGenerateImage) {
      handleAiImageGenerate(prompt, selectedText);
      return;
    }

    if (selectedText) {
      aiEditSelectionMutation.mutate({ text: selectedText, action: prompt });
    } else {
      generateAiArticleStream(prompt);
    }
  }, [savedSelectedText, clearSavedSelection, handleAiImageGenerate, aiEditSelectionMutation, generateAiArticleStream]);

  const goBack = useCallback(() => navigate(fixedContentType === 'page' || isPage || currentModule === 'pages' ? 'pages' : 'content'), [navigate, fixedContentType, isPage, currentModule]);

  const addTag = useCallback((tagId: string) => {
    if (!selectedTagIds.includes(tagId)) {
      setValue('tagIds', [...selectedTagIds, tagId], { shouldValidate: true });
    }
    setTagSearch('');
  }, [selectedTagIds, setValue]);

  const removeTag = useCallback((tagId: string) => {
    setValue('tagIds', selectedTagIds.filter((id) => id !== tagId), { shouldValidate: true });
  }, [selectedTagIds, setValue]);

  // Handle tag input: Enter or comma creates new tag(s), splitting on commas
  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const raw = tagSearch.trim();
        if (!raw) return;

        const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
        for (const part of parts) {
          // Check if tag already exists in the list
          const existingTag = allTags?.find(
            (t) => t.name.toLowerCase() === part.toLowerCase(),
          );
          if (existingTag) {
            addTag(existingTag.id);
            continue;
          }

          // Check if already selected (by custom name)
          const allSelectedNames = [
            ...selectedTagIds.map((id) => allTags?.find((t) => t.id === id)?.name).filter(Boolean),
            ...customTags,
          ];
          if (allSelectedNames.some((n) => n?.toLowerCase() === part.toLowerCase())) {
            continue;
          }

          // Create new tag
          createTagMutation.mutate(part);
        }
        setTagSearch('');
      }
    },
    [tagSearch, allTags, selectedTagIds, customTags, addTag, createTagMutation, t],
  );

  const submitWithStatus = useCallback(
    (status: string, scheduledAt?: string) => {
      const values = getValues();
      // Auto-select content type (defaults to POST for articles or PAGE for pages)
      let contentTypeId = values.contentTypeId;
      if (!contentTypeId && contentTypes && contentTypes.length > 0) {
        const targetSlug = fixedContentType || 'post';
        const targetType = contentTypes.find(
          (ct: any) => ct.slug?.toLowerCase() === targetSlug || ct.name?.toLowerCase() === targetSlug,
        ) || contentTypes[0];
        contentTypeId = targetType?.id;
        if (contentTypeId) setValue('contentTypeId', contentTypeId);
      }
      // Ensure title for publish
      const title = values.title?.trim() || t('articles.untitled');
      if (!values.title?.trim()) setValue('title', title);

      if (status === 'DRAFT') {
        createMutation.mutate({
          ...values,
          title,
          contentTypeId: contentTypeId || values.contentTypeId,
          status: 'DRAFT' as ContentFormValues['status'],
          scheduledAt,
          content: editorContent || values.content,
        });
        return;
      }
      // For Publish / Scheduled: validate first, show errors if invalid
      handleSubmit(
        (data) =>
          createMutation.mutate({ ...data, status: status as ContentFormValues['status'], scheduledAt }),
        (errs) => {
          const firstError = Object.values(errs)[0]?.message;
          if (firstError) toast.error(firstError);
        },
      )();
    },
    [handleSubmit, createMutation, getValues, editorContent, contentTypes, setValue, t],
  );

  const handleSchedule = useCallback(
    (date: string, time: string) => {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
      submitWithStatus('APPROVED', scheduledAt);
    },
    [submitWithStatus],
  );

  const handleFileUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadMutation.mutate(file);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [uploadMutation],
  );

  const handleMediaSelect = useCallback((media: MediaItem) => {
    setFeaturedImage(media);
  }, []);

  const isSubmitting = createMutation.isPending;

  // Gather all tag names for display
  const allTagNames = useMemo(() => {
 const names: string[] = [];
    for (const tagId of selectedTagIds) {
      const found = allTags?.find((t) => t.id === tagId);
      if (found) names.push(found.name);
    }
    return names;
  }, [selectedTagIds, allTags]);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header Row */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:bg-white/5" onClick={goBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-semibold">{fixedContentType === 'page' ? 'New Page' : t('articles.newArticle')}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => submitWithStatus('DRAFT')}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {t('articles.saveDraft')}
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5 bg-yellow-500 hover:bg-yellow-400 text-black"
                onClick={() => setScheduleOpen(true)}
                disabled={isSubmitting}
              >
                <CalendarClock className="h-3.5 w-3.5" />
                {t('articles.schedule')}
              </Button>
              {/* Preview Button (additional toolbar button beside Publish) */}
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="h-3.5 w-3.5" />
                {t('articles.preview')}
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => submitWithStatus('PUBLISHED')}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {t('articles.publish')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Mode Overlay */}
      {previewOpen && (
        <PreviewPanel
          title={watchedTitle}
          excerpt={watchedExcerpt || ''}
          content={editorContent}
          featuredImageUrl={featuredImage?.url}
          seoTitle={watchedSeoTitle || undefined}
          seoDescription={watchedSeoDescription || undefined}
          tags={allTagNames}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {/* Main Grid: Editor (9 cols) + Sidebar (3 cols) — fills remaining vertical space down to pb-6 */}
      <div className={cn('grid grid-cols-1 lg:grid-cols-12 gap-4 transition-all flex-1 min-h-0 items-stretch', previewOpen ? 'hidden' : '')}>
        {/* LEFT: Editor Area — Fixed height matching right sidebar with internal vertical scroll */}
        <div className="lg:col-span-9 xl:col-span-9 2xl:col-span-9 h-full min-h-0 flex flex-col">
          <div className="flex flex-col h-full min-h-0 border border-border/50 rounded-xl overflow-hidden bg-background shadow-2xs">
            {/* Tiptap Rich Text Editor — internal vertical scroll */}
            <div className="flex-1 min-h-0 flex flex-col h-full">
              <TiptapEditor
                ref={editorRef}
                content={editorContent}
                onChange={setEditorContent}
                onSelectionChange={handleEditorSelectionChange}
                className="border-0 rounded-none h-full flex-1 min-h-0"
                footer={
                  <div className="w-full">
                    <div className="w-full max-w-3xl mx-auto">
                      {/* AI Box: matching Image 4 */}
                      <div ref={aiBoxRef} className="border border-border/80 rounded-2xl overflow-hidden bg-background shadow-2xs transition-all">
                        {savedSelectedText && (
                          <div className="bg-[#fef9ee] dark:bg-amber-950/30 border-b border-amber-200/70 dark:border-amber-900/40 px-3.5 py-2 flex items-center justify-between gap-2 animate-in fade-in duration-150">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <PenLine className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300 shrink-0" />
                              <span className="text-xs text-zinc-800 dark:text-zinc-200 font-normal truncate select-none">
                                {savedSelectedText}
                              </span>
                            </div>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={clearSavedSelection}
                              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-0.5 shrink-0 transition-colors cursor-pointer"
                              title="Clear selection"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}

                        <div className="p-2.5">
                          <div className="flex items-center gap-2 px-1">
                            <div
                              className={cn(
                                'flex size-7 items-center justify-center rounded-full text-white shrink-0 transition-colors shadow-xs',
                                isGeneratingImage
                                  ? 'bg-purple-600'
                                  : 'bg-amber-500'
                              )}
                            >
                              {isGeneratingImage ? (
                                <ImageIcon className="size-3.5" />
                              ) : (
                                <Sparkles className="size-3.5" />
                              )}
                            </div>

                        <div className="relative flex-1 min-w-0">
                          <textarea
                            value={aiInput}
                            onChange={(e) => setAiInput(e.target.value)}
                            onMouseDown={() => {
                              editorRef.current?.saveSelectionForReplace();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (isAiGenerating) return;
                                if (aiInput.trim()) {
                                  handleAiSubmit(aiInput.trim());
                                  setAiInput('');
                                }
                              }
                            }}
                            placeholder={
                              isAiGenerating
                                ? (isGeneratingImage
                                    ? (t('articles.generatingImage') === 'articles.generatingImage' ? 'Generating image with AI...' : t('articles.generatingImage'))
                                    : t('articles.generatingPlaceholder'))
                                : savedSelectedText
                                ? t('articles.editSelectedTextPlaceholder')
                                : t('articles.askAiPlaceholder')
                            }
                            disabled={isAiGenerating}
                            rows={aiInput.includes('\n') ? 3 : 1}
                            className="flex-1 resize-none bg-transparent text-sm leading-normal placeholder:text-muted-foreground/60 focus:outline-none w-full py-0.5 max-h-32 overflow-y-auto disabled:opacity-60"
                          />
                        </div>

                        <button
                          type="button"
                          onMouseDown={isAiGenerating ? undefined : captureSelectionOnMouseDown}
                          onClick={() => {
                            if (isAiGenerating) {
                              handleStopAi();
                            } else if (aiInput.trim()) {
                              handleAiSubmit(aiInput.trim());
                              setAiInput('');
                            }
                          }}
                          className={
                            isAiGenerating
                              ? 'size-7 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90 flex items-center justify-center shrink-0 transition-all active:scale-95 shadow-xs'
                              : 'size-7 rounded-full flex items-center justify-center shrink-0 transition-all text-muted-foreground hover:text-foreground'
                          }
                          title={isAiGenerating ? t('articles.stopGeneration') : t('articles.sendToAi')}
                          aria-label={isAiGenerating ? t('articles.stopGeneration') : t('articles.sendToAi')}
                        >
                          {isAiGenerating ? (
                            <Square className="size-3 fill-current" />
                          ) : (
                            <Send className="size-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            }
              />
            </div>
          </div>
        </div>

        {/* RIGHT: Sidebar — height matching the editor with internal scroll */}
        <div className="col-span-1 lg:col-span-3 xl:col-span-3 2xl:col-span-3 h-full min-h-0">
          <div className="h-full overflow-y-auto rounded-lg border bg-card">
              <Accordion
                type="multiple"
                defaultValue={isPage ? ['title-slug', 'seo'] : ['featured-image', 'publishing', 'categories', 'title-slug', 'excerpt']}
                className="px-4"
              >
                {/* 1. Featured Image */}
                {!isPage && (
                  <AccordionItem value="featured-image">
                    <AccordionTrigger className="py-3 text-sm">
                      <span className="flex items-center gap-2">
                        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        {t('articles.section.featuredImage')}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pb-4 space-y-2.5">
                        {featuredImage ? (
                          <div
                            className="relative aspect-video rounded-md overflow-hidden border group cursor-pointer bg-slate-950"
                            onClick={() => setLightboxOpen(true)}
                            title="Click to preview full size"
                          >
                            <img
                              src={featuredImage.url}
                              alt={featuredImage.alt || t('articles.section.featuredImage')}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <span className="text-white text-xs bg-black/70 px-2.5 py-1 rounded-full backdrop-blur-sm flex items-center gap-1 font-medium shadow-sm">
                                <Eye className="h-3 w-3" /> Preview
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFeaturedImage(null);
                              }}
                              className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors z-10"
                              title="Remove image"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="relative aspect-video rounded-md overflow-hidden bg-slate-800 border flex items-center justify-center">
                            <span className="text-slate-400 text-sm">{t('articles.noImage')}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-1.5 w-full">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1 px-1 font-medium min-w-0"
                            onClick={handleFileUpload}
                            disabled={uploadMutation.isPending}
                          >
                            {uploadMutation.isPending ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Upload className="h-3.5 w-3.5 shrink-0" />}
                            <span className="truncate">{t('media.upload')}</span>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1 px-1 font-medium min-w-0"
                            onClick={() => setMediaLibraryOpen(true)}
                          >
                            <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{t('articles.library')}</span>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1 px-1 font-medium min-w-0 border-amber-400/40 text-amber-600 hover:bg-amber-400/10 dark:text-amber-400 dark:border-amber-400/40 dark:hover:bg-amber-400/10"
                            onClick={() => {
                              if (!aiImagePrompt && watchedTitle) {
                                setAiImagePrompt(watchedTitle);
                              }
                              setAiImageDialogOpen(true);
                            }}
                            disabled={aiImageGenerateMutation.isPending}
                          >
                            {aiImageGenerateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 shrink-0" />}
                            <span>AI</span>
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* 2. Title & Slug */}
                <AccordionItem value="title-slug">
                  <AccordionTrigger className="py-3 text-sm">
                    <span className="flex items-center gap-2">
                      <Type className="h-3.5 w-3.5 text-muted-foreground" />
                      {t('articles.section.titleAndSlug')}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pb-4 space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t('articles.titleLabel')}</Label>
                        <Input
                          {...register('title')}
                          placeholder={t('articles.titlePlaceholder')}
                          className="h-9 font-medium"
                        />
                        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t('articles.slugLabel')}</Label>
                        <Input
                          value={slugValue}
                          onChange={(e) => setSlugValue(e.target.value)}
                          placeholder={t('articles.slugPlaceholder')}
                          className="h-8 text-sm font-mono"
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 4. Excerpt */}
                {!isPage && (
                  <AccordionItem value="excerpt">
                    <AccordionTrigger className="py-3 text-sm">
                      <span className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        {t('articles.section.excerpt')}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pb-4">
                        <Textarea
                          {...register('excerpt')}
                          placeholder={t('articles.excerptPlaceholder')}
                          rows={2}
                          className="text-sm resize-none"
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* 5. Categories */}
                {!isPage && (
                  <AccordionItem value="categories">
                    <AccordionTrigger className="py-3 text-sm">
                      <span className="flex items-center gap-2">
                        <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                        {t('articles.section.categories')}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pb-4 space-y-2">
                        <Controller control={control} name="categoryId" render={({ field }) => (
                          <Select value={field.value ?? ''} onValueChange={field.onChange}>
                            <SelectTrigger className="h-9"><SelectValue placeholder={t('articles.selectCategoryPlaceholder')} /></SelectTrigger>
                            <SelectContent>
                              {(categories ?? []).map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )} />
                        {(!categories || categories.length === 0) && (
                          <p className="text-xs text-muted-foreground">
                            {t('articles.noCategories') || 'No categories yet.'}
                          </p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* 6. Tags */}
                {!isPage && (
                  <AccordionItem value="tags">
                    <div className="flex items-center justify-between pr-4">
                      <AccordionTrigger className="py-3 text-sm flex-1">
                        <span className="flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                          {t('articles.section.tags')}
                        </span>
                      </AccordionTrigger>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateTags();
                        }}
                        disabled={isTagsGenerating}
                        className="h-6 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 gap-1 px-1.5"
                      >
                        {isTagsGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        Generate Tags
                      </Button>
                    </div>
                    <AccordionContent>
                      <div className="pb-4 space-y-3">
                        {/* Selected tags pills */}
                        {selectedTagIds.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {selectedTagIds.map((tagId) => {
                              const tag = allTags?.find((t) => t.id === tagId);
                              return (
                                <span
                                  key={tagId}
                                  className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                                >
                                  {tag?.name ?? tagId}
                                  <button type="button" onClick={() => removeTag(tagId)} className="hover:text-destructive">
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Search / Create Input */}
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            value={tagSearch}
                            onChange={(e) => setTagSearch(e.target.value)}
                            onKeyDown={handleTagKeyDown}
                            placeholder={t('articles.searchOrCreateTagPlaceholder') || 'Search or type tag + Enter...'}
                            className="pl-8 h-8 text-sm"
                          />
                        </div>

                        {/* Filtered suggestions while typing */}
                        {tagSearch && filteredTags.length > 0 && (
                          <div className="max-h-32 overflow-y-auto rounded-md border bg-popover p-1 space-y-0.5 shadow-sm">
                            {filteredTags.map((tag) => {
                              const isSelected = selectedTagIds.includes(tag.id);
                              return (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() => isSelected ? removeTag(tag.id) : addTag(tag.id)}
                                  className={cn(
                                    "w-full text-left px-2 py-1.5 text-xs rounded flex items-center justify-between transition-colors",
                                    isSelected ? "bg-amber-50 text-amber-900 font-medium dark:bg-amber-950/40 dark:text-amber-300" : "hover:bg-accent text-foreground"
                                  )}
                                >
                                  <span>{tag.name}</span>
                                  {isSelected && <Check className="h-3 w-3 text-amber-600 dark:text-amber-400" />}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Button to open Keywords Dialog (alert modal for selecting keywords) */}
                        <div className="pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setKeywordsDialogOpen(true)}
                            className="w-full text-xs gap-2 h-8 border-dashed hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 text-muted-foreground hover:text-foreground justify-center"
                          >
                            <Upload className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            <span>Select / Upload Keywords</span>
                            {allTags && allTags.length > 0 && (
                              <span className="ml-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-mono">
                                {allTags.length}
                              </span>
                            )}
                          </Button>
                        </div>

                        {/* Small Alert Dialog for Keywords selection */}
                        <KeywordsDialog
                          open={keywordsDialogOpen}
                          onOpenChange={setKeywordsDialogOpen}
                          allTags={allTags || []}
                          selectedTagIds={selectedTagIds}
                          onToggleTag={(id) => selectedTagIds.includes(id) ? removeTag(id) : addTag(id)}
                          onTagCreated={() => refetchTags()}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* 7. SEO */}
                <AccordionItem value="seo">
                  <div className="flex items-center justify-between pr-4">
                    <AccordionTrigger className="py-3 text-sm flex-1">
                      {t('articles.section.seo')}
                    </AccordionTrigger>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateSeo();
                      }}
                      disabled={isSeoGenerating}
                      className="h-6 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 gap-1 px-1.5"
                    >
                      {isSeoGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      Generate SEO
                    </Button>
                  </div>
                  <AccordionContent>
                    <div className="pb-4 space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{t('articles.metaTitle')}</Label>
                        <Input {...register('seoTitle')} placeholder={t('articles.metaTitlePlaceholder')} className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{t('articles.metaDescription')}</Label>
                        <Textarea {...register('seoDescription')} placeholder={t('articles.metaDescriptionPlaceholder')} rows={2} className="text-sm" />
                      </div>

                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
          </div>
        </div>
      </div>

      {/* Schedule Dialog */}
      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onSchedule={handleSchedule}
        isPending={isSubmitting}
        initialDate={targetScheduleDate}
        initialTime={targetScheduleTime}
      />

      {/* Media Library Dialog */}
      <MediaLibraryDialog
        open={mediaLibraryOpen}
        onOpenChange={setMediaLibraryOpen}
        onSelect={handleMediaSelect}
      />

      {/* AI Assist Dialog */}
      <AIAssistDialog
        open={aiAssistOpen}
        onOpenChange={setAiAssistOpen}
        onGenerate={handleAiSubmit}
        isPending={isAiGenerating}
      />

      {/* AI Featured Image Dialog */}
      <Dialog open={aiImageDialogOpen} onOpenChange={setAiImageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              {t('media.generateWithAi') || 'Generate Featured Image with AI'}
            </DialogTitle>
            <DialogDescription>
              {t('media.generateDescription') || 'Describe the image you want to generate for this article.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Textarea
              value={aiImagePrompt}
              onChange={(e) => setAiImagePrompt(e.target.value)}
              placeholder={watchedTitle ? `e.g. A high quality editorial photograph for "${watchedTitle}"` : 'Describe the image you want to generate...'}
              rows={3}
              className="text-sm"
            />
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground block">
                Aspect Ratio
              </Label>
              <div className="flex flex-wrap gap-2">
                {(['1:1', '16:9', '9:16', '4:3', '3:4'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setFeaturedAspectRatio(ratio)}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-semibold transition-all border cursor-pointer select-none',
                      featuredAspectRatio === ratio
                        ? 'bg-amber-400 text-zinc-950 border-amber-400 shadow-sm'
                        : 'bg-background hover:bg-muted text-muted-foreground border-border/80'
                    )}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAiImageDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              className="gap-1.5 bg-amber-400 text-zinc-900 hover:bg-amber-500 font-semibold"
              onClick={() =>
                aiImageGenerateMutation.mutate({
                  promptText: aiImagePrompt.trim() || watchedTitle || 'Featured article image',
                  aspectRatio: featuredAspectRatio,
                })
              }
              disabled={aiImageGenerateMutation.isPending || (!aiImagePrompt.trim() && !watchedTitle?.trim())}
            >
              {aiImageGenerateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Categories & Tags Management Dialog */}
      <CategoriesTagsDialog
        open={catTagsOpen}
        onOpenChange={setCatTagsOpen}
        initialTab={catTagsInitialTab}
        title={watchedTitle || ''}
        content={editorContent || watchedExcerpt || aiInput || ''}
        onSuccess={() => {
          refetchCategories();
          refetchTags();
        }}
        onCategoryCreated={() => refetchCategories()}
        onTagCreated={() => refetchTags()}
      />

      {/* Featured Image Full-size Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] p-2 bg-black/95 border-zinc-800 text-white flex flex-col items-center justify-center overflow-hidden">
          <div className="relative w-full h-[75vh] flex items-center justify-center">
            {featuredImage && (
              <img
                src={featuredImage.url}
                alt={featuredImage.alt || 'Featured image preview'}
                className="max-h-full max-w-full object-contain rounded-md"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
