'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Save,
  Loader2,
  Zap,
  FileText,
  Sparkles,
  Send,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  SlidersHorizontal,
  Calendar,
  X,
  Search,
  FolderOpen,
  Upload,
  Check,
  Pencil,
  ListPlus,
  Trash2,
  Globe,
  Target,
  Layers,
  Plus,
  ListOrdered,
  Clock,
  FolderPlus,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { postApi, getApi, patchApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { parseMultilineTopics, type TopicQueueItem } from '@/lib/automation/topic-types';
import { nanoid } from 'nanoid';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { useSiteStore } from '@/lib/stores/site-store';
import { SUPPORTED_LANGUAGES, resolveLanguage, isValidCountryCode } from '@/lib/automation/language-config';
import { parseScheduleTime, calculateNextRun, formatScheduleTimeTo12Hour, validateScheduleNotPassed, getTodayDateStringInTz } from '@/lib/automation/scheduler-utils';
import { PublishTimePicker } from '@/modules/content/publishing-datetime-pickers';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const COMMON_TIMEZONES = [
  'UTC',
  'Africa/Casablanca',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

function formatNextExecution(frequency: string, timeStr: string, tz: string): string {
  try {
    const next = calculateNextRun({ frequency, time: timeStr, timezone: tz });
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(next);
  } catch {
    const formatted = formatScheduleTimeTo12Hour(timeStr);
    return `${frequency} at ${formatted || timeStr} (${tz})`;
  }
}

// -------------------- Types --------------------

type KeywordSource = 'MANUAL' | 'SAVED' | 'AI_GENERATE' | 'GSC_PERFORMANCE';
type MediaSource = 'NONE' | 'MEDIA_LIBRARY' | 'AI_GENERATE' | 'LOCAL_UPLOAD';
type ImagePlacement = 'AI_AUTOMATIC' | 'AFTER_INTRO' | 'BEFORE_FIRST_H2' | 'AFTER_EACH_H2' | 'MANUAL_MAPPING';

interface SavedKeyword { id: string; name: string; slug?: string; color?: string; }
interface MediaFolder { id: string; name: string; _count?: { media: number; children: number }; }
interface MediaItem { id: string; filename: string; url: string; thumbnailUrl?: string; }

// -------------------- Small Reusable UI Pieces --------------------

function SectionLabel({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold">{children}</h3>
    </div>
  );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}{hint && <span className="text-muted-foreground/50 ml-1">— {hint}</span>}</Label>
      {children}
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2.5 rounded-lg px-3 hover:bg-muted/40 transition-colors">
      <div className="min-w-0 pr-4">
        <p className="text-sm font-medium leading-tight">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="shrink-0" />
    </div>
  );
}

function ConditionalBlock({ children }: { children: React.ReactNode }) {
  return <div className="ml-1 pl-4 border-l-2 border-primary/15 space-y-4 pt-1 pb-1">{children}</div>;
}

function SearchableLanguageSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const currentLang = resolveLanguage(value);

  const filtered = useMemo(() => {
    if (!search.trim()) return SUPPORTED_LANGUAGES;
    const q = search.toLowerCase().trim();
    return SUPPORTED_LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.nativeName && l.nativeName.toLowerCase().includes(q)) ||
        l.code.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-10 w-full justify-between font-normal text-xs bg-background px-3 border-border hover:bg-muted/40"
        >
          <span className="truncate">
            <span className="font-semibold text-foreground">{currentLang.name}</span>{' '}
            {currentLang.nativeName && (
              <span className="text-muted-foreground text-[11px]">({currentLang.nativeName})</span>
            )}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-2" align="start">
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search 35+ languages..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
          {filtered.length === 0 ? (
            <p className="p-3 text-center text-xs text-muted-foreground">No matching languages</p>
          ) : (
            filtered.map((l) => {
              const isSelected = value === l.code || value === l.name;
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => {
                    onChange(l.code);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground font-medium"
                      : "hover:bg-muted/60 text-foreground"
                  )}
                >
                  <span className="truncate pr-2">
                    {l.name}{' '}
                    {l.nativeName && (
                      <span className={cn("text-[11px]", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                        ({l.nativeName})
                      </span>
                    )}
                  </span>
                  <span className={cn("font-mono text-[10px] shrink-0 uppercase px-1 py-0.5 rounded", isSelected ? "bg-white/20" : "bg-muted")}>
                    {l.code}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CreateFolderDialog({
  open,
  onOpenChange,
  onFolderCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFolderCreated: (folderId: string) => void;
}) {
  const [folderName, setFolderName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await postApi<any>('/api/media-folders', { name: folderName.trim() });
      const createdId = res?.data?.id || res?.id;
      toast.success('Folder created successfully');
      setFolderName('');
      onOpenChange(false);
      if (createdId) onFolderCreated(createdId);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create folder');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Media Folder</DialogTitle>
          <DialogDescription>
            Organize reusable media assets for this site and automation runs.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="folder-name-input" className="text-xs font-medium">Folder Name</Label>
            <Input
              id="folder-name-input"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g., Blog Featured Images"
              autoFocus
              className="h-9 text-xs"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!folderName.trim() || submitting}>
              {submitting ? 'Creating...' : 'Create Folder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Component --------------------

export function AutomationBuilderPage({
  mode,
  automationId: propAutomationId,
}: {
  mode?: 'generate';
  automationId?: string;
}) {
  const { t } = useT();
  const currentModule = useNavigationStore((s) => s.currentModule);
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const currentItemId = useNavigationStore((s) => s.currentItemId);
  const targetAutoMod = currentModule.startsWith('platform-') ? 'platform-automation' : 'automation';
  const targetContentMod = currentModule.startsWith('platform-') ? 'platform-content' : 'content';
  const navigate = useNavigationStore((s) => s.navigate);
  const queryClient = useQueryClient();
  const isGenerateMode = mode === 'generate';
  const automationId = propAutomationId || (currentSubPage === 'edit' ? currentItemId : undefined);
  const isEditMode = Boolean(automationId && !isGenerateMode);
  const activeSiteDbId = useSiteStore((s) => s.activeSiteDbId);
  const [step, setStep] = useState(isGenerateMode ? 2 : 1);
  const [generating, setGenerating] = useState(false);
  const keywordFileRef = useRef<HTMLInputElement>(null);
  const topicFileRef = useRef<HTMLInputElement>(null);

  // ── State ──
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<'MANUAL' | 'SCHEDULED'>(isGenerateMode ? 'MANUAL' : 'SCHEDULED');
  const [frequency, setFrequency] = useState('DAILY');
  const [time, setTime] = useState('09:00');
  const [timezone, setTimezone] = useState('Africa/Casablanca');
  const [startDate, setStartDate] = useState(() => getTodayDateStringInTz('Africa/Casablanca'));
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [articlesPerDay, setArticlesPerDay] = useState('1');
  const [customArticlesPerDay, setCustomArticlesPerDay] = useState('');
  const finalArticlesPerDay = useMemo(() => {
    return articlesPerDay === 'Custom'
      ? Math.max(1, parseInt(customArticlesPerDay) || 1)
      : Math.max(1, parseInt(articlesPerDay) || 1);
  }, [articlesPerDay, customArticlesPerDay]);

  // Mode A (AI Internet Research) vs Mode B (Manual Topics & Queue)
  const [generationMode, setGenerationMode] = useState<'AI_TOPIC_DISCOVERY' | 'MANUAL_QUEUE'>('MANUAL_QUEUE');
  // Mode A: Discovery State
  const [niche, setNiche] = useState('');
  const [subNiches, setSubNiches] = useState('');
  const [preferredCategories, setPreferredCategories] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [country, setCountry] = useState('');
  const [selectionStrategy, setSelectionStrategy] = useState<'HIGH_SEARCH_INTENT' | 'QUESTION_BASED' | 'TOPICAL_AUTHORITY_PILLARS' | 'COMPETITOR_GAPS'>('HIGH_SEARCH_INTENT');
  const [excludedTopics, setExcludedTopics] = useState('');
  const [advancedResearchOpen, setAdvancedResearchOpen] = useState(false);
  const [advancedContentOpen, setAdvancedContentOpen] = useState(false);

  // Mode B: Topic Queue State
  const [singleTopicText, setSingleTopicText] = useState('');
  const [singlePrimaryKw, setSinglePrimaryKw] = useState('');
  const [singleSecondaryKws, setSingleSecondaryKws] = useState('');
  const [topicQueue, setTopicQueue] = useState<TopicQueueItem[]>([]);
  const [rawTopicList, setRawTopicList] = useState('');
  const [allowReuseCompletedTopics, setAllowReuseCompletedTopics] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTopicText, setEditTopicText] = useState('');
  const [editPrimaryKw, setEditPrimaryKw] = useState('');
  const [editSecondaryKws, setEditSecondaryKws] = useState('');

  // Core topic / keywords (Manual mode / backwards compatibility)
  const [topic, setTopic] = useState('');
  const [keywordSource, setKeywordSource] = useState<KeywordSource>('MANUAL');
  const [primaryKeyword, setPrimaryKeyword] = useState('');
  const [secondaryKeywords, setSecondaryKeywords] = useState('');
  const [semanticKeywords, setSemanticKeywords] = useState('');
  const [competitorResearchEnabled, setCompetitorResearchEnabled] = useState(false);
  const [outlineStrategy, setOutlineStrategy] = useState<'AUTOMATIC' | 'REVIEW'>('AUTOMATIC');
  const [internalLinkingEnabled, setInternalLinkingEnabled] = useState(true);
  const [externalLinkingEnabled, setExternalLinkingEnabled] = useState(false);
  const [savedKeywordSearch, setSavedKeywordSearch] = useState('');
  const [selectedSavedKeywordIds, setSelectedSavedKeywordIds] = useState<string[]>([]);
  const [aiKeywordCount, setAiKeywordCount] = useState('5');
  const [aiKeywordCustomCount, setAiKeywordCustomCount] = useState('');
  const [aiKeywordTone, setAiKeywordTone] = useState('Informational');
  const [aiKeywordCustomTone, setAiKeywordCustomTone] = useState('');
  const [tone, setTone] = useState('Professional');
  const [customTone, setCustomTone] = useState('');
  const [contentLength, setContentLength] = useState('Medium (800-1200 words)');
  const [customWordCount, setCustomWordCount] = useState('');
  const [structIntro, setStructIntro] = useState(true);
  const [structToc, setStructToc] = useState(false);
  const [structH2, setStructH2] = useState(true);
  const [structH3, setStructH3] = useState(true);
  const [structFaq, setStructFaq] = useState(false);
  const [structConclusion, setStructConclusion] = useState(true);
  const [generateSeoTitle, setGenerateSeoTitle] = useState(true);
  const [generateMetaDescription, setGenerateMetaDescription] = useState(true);
  const [generateSlug, setGenerateSlug] = useState(true);
  const [optimizePrimaryKeyword, setOptimizePrimaryKeyword] = useState(true);
  const [includeSecondaryKeywords, setIncludeSecondaryKeywords] = useState(true);
  const [includeSemanticKeywords, setIncludeSemanticKeywords] = useState(true);
  const [generateFaq, setGenerateFaq] = useState(false);
  const [generateFaqSchema, setGenerateFaqSchema] = useState(false);
  const [generateArticleSchema, setGenerateArticleSchema] = useState(true);
  const [mediaSource, setMediaSource] = useState<MediaSource>('AI_GENERATE');
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [uploadedMediaItems, setUploadedMediaItems] = useState<MediaItem[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const localFileInputRef = useRef<HTMLInputElement>(null);
  const [imageSelectionMode, setImageSelectionMode] = useState<'ALL' | 'RANDOM' | 'AI_CHOOSE'>('AI_CHOOSE');
  const [generateFeaturedImage, setGenerateFeaturedImage] = useState(true);
  const [generateSectionImages, setGenerateSectionImages] = useState(false);
  const [imageCount, setImageCount] = useState('3');
  const [customImageCount, setCustomImageCount] = useState('');
  const [imageStyle, setImageStyle] = useState('Realistic');
  const [customImageStyle, setCustomImageStyle] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [customAspectRatio, setCustomAspectRatio] = useState('');
  const [imageTone, setImageTone] = useState('Modern');
  const [customImageTone, setCustomImageTone] = useState('');
  const [imagePromptInstructions, setImagePromptInstructions] = useState('');
  const [imagePlacement, setImagePlacement] = useState<ImagePlacement>('AI_AUTOMATIC');
  const [finalAction, setFinalAction] = useState('DRAFT');
  const [publishDate, setPublishDate] = useState('');
  const [publishTime, setPublishTime] = useState('');
  const [publicationScheduleError, setPublicationScheduleError] = useState<string | null>(null);

  const validatePublicationSchedule = (dStr: string, tStr: string, showToast: boolean = false): boolean => {
    if (finalAction !== 'SCHEDULE') {
      setPublicationScheduleError(null);
      return true;
    }
    if (!dStr || !tStr) {
      const err = 'Please select both publication date and time.';
      setPublicationScheduleError(err);
      if (showToast) toast.error(err, { id: 'pub-schedule-error' });
      return false;
    }

    const parsedTime = parseScheduleTime(tStr);
    const canonicalTime = `${String(parsedTime.hour).padStart(2, '0')}:${String(parsedTime.minute).padStart(2, '0')}`;
    const check = validateScheduleNotPassed({
      frequency: 'ONCE',
      time: canonicalTime,
      timezone,
      startDate: dStr,
    });

    if (!check.isValid) {
      const errMsg = check.error || 'This date and time has already passed. Please choose a future date and time.';
      setPublicationScheduleError(errMsg);
      if (showToast) {
        toast.error(errMsg, { id: 'pub-schedule-error' });
      }
      return false;
    }

    setPublicationScheduleError(null);
    return true;
  };

  // ── Pre-fill when editing existing automation ──
  const { data: existingData } = useQuery({
    queryKey: ['automation', automationId],
    queryFn: () => getApi<any>(`/api/automations/${automationId}`),
    enabled: isEditMode,
  });

  React.useEffect(() => {
    if (existingData) {
      const item = existingData.data || existingData;
      if (item.name) setName(item.name);
      if (item.description) setDescription(item.description);
      if (item.triggerType) setTriggerType(item.triggerType);

      try {
        const sched = JSON.parse(item.scheduleConfig || '{}');
        if (sched.frequency) setFrequency(sched.frequency);
        if (sched.time) setTime(sched.time);
        const tz = sched.timezone || 'Africa/Casablanca';
        const todayInTz = getTodayDateStringInTz(tz);
        if (sched.startDate) {
          // If stored start date is in the past in the configured timezone, advance to today in that timezone
          setStartDate(sched.startDate < todayInTz ? todayInTz : sched.startDate);
        } else if (item.nextRunAt) {
          const nr = new Date(item.nextRunAt);
          if (!isNaN(nr.getTime())) {
            const parts = new Intl.DateTimeFormat('en-US', {
              timeZone: tz,
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            }).formatToParts(nr);
            const y = parts.find((p) => p.type === 'year')?.value;
            const m = parts.find((p) => p.type === 'month')?.value;
            const d = parts.find((p) => p.type === 'day')?.value;
            const formatted = y && m && d ? `${y}-${m}-${d}` : todayInTz;
            setStartDate(formatted < todayInTz ? todayInTz : formatted);
          } else {
            setStartDate(todayInTz);
          }
        } else {
          setStartDate(todayInTz);
        }
        if (sched.timezone) setTimezone(sched.timezone);
        if (sched.articlesPerDay) {
          const num = Number(sched.articlesPerDay);
          if ([1, 2, 3, 5].includes(num)) {
            setArticlesPerDay(String(num));
          } else {
            setArticlesPerDay('Custom');
            setCustomArticlesPerDay(String(num));
          }
        }
      } catch {}

      try {
        const wf = JSON.parse(item.workflowConfig || '{}');
        const cg = wf.contentGeneration || {};
        if (cg.generationMode) setGenerationMode(cg.generationMode);
        if (cg.topic) setTopic(cg.topic);
        if (cg.keywordSource) setKeywordSource(cg.keywordSource);
        if (cg.primaryKeyword) setPrimaryKeyword(cg.primaryKeyword);
        if (cg.secondaryKeywords) setSecondaryKeywords(cg.secondaryKeywords);
        if (cg.semanticKeywords) setSemanticKeywords(cg.semanticKeywords);
        if (cg.competitorResearchEnabled !== undefined) setCompetitorResearchEnabled(cg.competitorResearchEnabled);
        if (cg.outlineStrategy) setOutlineStrategy(cg.outlineStrategy);
        if (cg.internalLinkingEnabled !== undefined) setInternalLinkingEnabled(cg.internalLinkingEnabled);
        if (cg.externalLinkingEnabled !== undefined) setExternalLinkingEnabled(cg.externalLinkingEnabled);
        if (cg.tone) setTone(cg.tone);
        if (cg.contentLength) setContentLength(cg.contentLength);

        if (cg.topicDiscovery) {
          if (cg.topicDiscovery.niche) setNiche(cg.topicDiscovery.niche);
          if (cg.topicDiscovery.subNiches) setSubNiches(cg.topicDiscovery.subNiches);
          if (cg.topicDiscovery.preferredCategories) setPreferredCategories(cg.topicDiscovery.preferredCategories);
          if (cg.topicDiscovery.targetAudience) setTargetAudience(cg.topicDiscovery.targetAudience);
          if (cg.topicDiscovery.language) setLanguage(cg.topicDiscovery.language);
          if (cg.topicDiscovery.country) setCountry(cg.topicDiscovery.country);
          if (cg.topicDiscovery.selectionStrategy) setSelectionStrategy(cg.topicDiscovery.selectionStrategy);
          if (cg.topicDiscovery.excludedTopics) setExcludedTopics(cg.topicDiscovery.excludedTopics);
        }

        if (Array.isArray(cg.topicQueue)) setTopicQueue(cg.topicQueue);
        if (cg.allowReuseCompletedTopics !== undefined) setAllowReuseCompletedTopics(cg.allowReuseCompletedTopics);

        const sp = wf.seoProcessing || {};
        if (sp.generateSeoTitle !== undefined) setGenerateSeoTitle(sp.generateSeoTitle);
        if (sp.generateMetaDescription !== undefined) setGenerateMetaDescription(sp.generateMetaDescription);
        if (sp.generateSlug !== undefined) setGenerateSlug(sp.generateSlug);
        if (sp.optimizePrimaryKeyword !== undefined) setOptimizePrimaryKeyword(sp.optimizePrimaryKeyword);
        if (sp.generateFaq !== undefined) setGenerateFaq(sp.generateFaq);
        if (sp.generateFaqSchema !== undefined) setGenerateFaqSchema(sp.generateFaqSchema);
        if (sp.generateArticleSchema !== undefined) setGenerateArticleSchema(sp.generateArticleSchema);

        const med = wf.media || {};
        if (med.source) setMediaSource(med.source);
        if (med.generateFeaturedImage !== undefined) setGenerateFeaturedImage(med.generateFeaturedImage);
        if (med.generateSectionImages !== undefined) setGenerateSectionImages(med.generateSectionImages);
        if (med.placement) setImagePlacement(med.placement);

        const fa = wf.finalAction || {};
        if (fa.action) setFinalAction(fa.action);
        if (fa.publishDate) setPublishDate(fa.publishDate);
        if (fa.publishTime) setPublishTime(fa.publishTime);
      } catch {}
    }
  }, [existingData]);

  // ── Queries ──
  const { data: gscData } = useQuery({
    queryKey: ['gsc-connection-builder', activeSiteDbId],
    queryFn: () => getApi<any>(`/api/seo/search-console`),
    enabled: keywordSource === 'GSC_PERFORMANCE' && step === 2,
    staleTime: 30_000,
  });
  // Fetch ALL saved keywords once (no server-side search) — filter client-side for real-time search
  const { data: savedKeywordsData } = useQuery({
    queryKey: ['saved-keywords-all'],
    queryFn: () => getApi(`/api/tags?pageSize=500`),
    enabled: keywordSource === 'SAVED' && step === 2, staleTime: 30_000,
  });
  const allSavedKeywords: SavedKeyword[] = useMemo(() => {
    const d = savedKeywordsData as any;
    if (Array.isArray(d)) return d as SavedKeyword[];
    if (d?.data && Array.isArray(d.data)) return d.data as SavedKeyword[];
    return [];
  }, [savedKeywordsData]);
  // Client-side real-time filtering
  const savedKeywords = useMemo(() => {
    if (!savedKeywordSearch.trim()) return allSavedKeywords;
    const q = savedKeywordSearch.toLowerCase();
    return allSavedKeywords.filter(k => k.name.toLowerCase().includes(q));
  }, [allSavedKeywords, savedKeywordSearch]);

  const { data: foldersData } = useQuery({
    queryKey: ['media-folders'],
    queryFn: () => getApi('/api/media-folders?pageSize=100'),
    enabled: (mediaSource === 'MEDIA_LIBRARY' || mediaSource === 'LOCAL_UPLOAD') && step === 3,
    staleTime: 60_000,
  });
  const mediaFolders: MediaFolder[] = useMemo(() => {
    const d = foldersData as any;
    return Array.isArray(d) ? d : d?.data ?? [];
  }, [foldersData]);

  const { data: mediaItemsData } = useQuery({
    queryKey: ['media-folder-items', selectedFolderId],
    queryFn: () =>
      getApi(
        selectedFolderId && selectedFolderId !== 'ALL_MEDIA'
          ? `/api/media?folderId=${selectedFolderId}&pageSize=50`
          : `/api/media?pageSize=50`
      ),
    enabled: mediaSource === 'MEDIA_LIBRARY' && step === 3,
    staleTime: 30_000,
  });
  const mediaItems: MediaItem[] = useMemo(() => {
    const d = mediaItemsData as any;
    return Array.isArray(d) ? d : d?.data ?? [];
  }, [mediaItemsData]);

  const { data: searchProviderData } = useQuery({
    queryKey: ['automation-search-provider'],
    queryFn: () => getApi<any>('/api/automations/search-provider'),
    staleTime: 60_000,
  });
  const searchProviderInfo = (searchProviderData as any)?.data || searchProviderData;

  const toggleSavedKeyword = (id: string) => setSelectedSavedKeywordIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleMediaSelection = (id: string) => setSelectedMediaIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleLocalFileUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArray.length === 0) {
      toast.error('Please select valid image files (JPG, PNG, WebP, etc.)');
      return;
    }
    setIsUploadingFiles(true);
    setUploadProgress(10);
    const newlyUploaded: MediaItem[] = [];
    try {
      for (let i = 0; i < fileArray.length; i++) {
        const f = fileArray[i];
        if (f.size > 10 * 1024 * 1024) {
          toast.error(`"${f.name}" exceeds 10MB limit`);
          continue;
        }
        const formData = new FormData();
        formData.append('file', f);
        if (selectedFolderId && selectedFolderId !== 'ALL_MEDIA') {
          formData.append('folderId', selectedFolderId);
        }
        const res = await postApi<any>('/api/media/upload', formData);
        const item = res?.data || res;
        if (item?.id) {
          newlyUploaded.push(item);
        }
        setUploadProgress(Math.round(((i + 1) / fileArray.length) * 100));
      }
      if (newlyUploaded.length > 0) {
        setUploadedMediaItems((prev) => [...prev, ...newlyUploaded]);
        setSelectedMediaIds((prev) => [...prev, ...newlyUploaded.map((m) => m.id)]);
        queryClient.invalidateQueries({ queryKey: ['media-folder-items'] });
        queryClient.invalidateQueries({ queryKey: ['media'] });
        toast.success(`Uploaded ${newlyUploaded.length} image${newlyUploaded.length === 1 ? '' : 's'} successfully`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload images');
    } finally {
      setIsUploadingFiles(false);
      setUploadProgress(0);
      if (localFileInputRef.current) {
        localFileInputRef.current.value = '';
      }
    }
  };

  const handleKeywordFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (file.name.endsWith('.csv')) {
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length > 1) { const [, ...rows] = lines; for (const row of rows) { const cols = row.split(',').map(c => c.trim().replace(/^"|"$/g, '')); if (cols[0]) { postApi('/api/tags', { name: cols[0] }).then(() => { queryClient.invalidateQueries({ queryKey: ['saved-keywords'] }); toast.success(`${t('automation.builder.toastImportedPrefix')} ${cols[0]}`); }).catch(() => {}); } } }
      } else if (file.name.endsWith('.txt')) { const match = text.match(/Primary Keyword:\s*(.+)/i); if (match?.[1]) { const kw = match[1].trim(); postApi('/api/tags', { name: kw }).then(() => { queryClient.invalidateQueries({ queryKey: ['saved-keywords'] }); toast.success(`${t('automation.builder.toastImportedPrefix')} ${kw}`); }).catch(() => {}); } }
    };
    reader.readAsText(file); if (keywordFileRef.current) keywordFileRef.current.value = '';
  };

  const handleAddSingleTopic = () => {
    if (!singleTopicText.trim()) return;
    const newItem: TopicQueueItem = {
      id: `tq_${nanoid(8)}`,
      topic: singleTopicText.trim(),
      primaryKeyword: singlePrimaryKw.trim() || singleTopicText.trim(),
      secondaryKeywords: singleSecondaryKws.trim(),
      status: 'AVAILABLE',
      addedAt: new Date().toISOString(),
    };
    setTopicQueue(prev => [...prev, newItem]);
    setSingleTopicText('');
    setSinglePrimaryKw('');
    setSingleSecondaryKws('');
    toast.success('Topic added to queue');
  };

  const handleStartEditItem = (item: TopicQueueItem) => {
    setEditingItemId(item.id);
    setEditTopicText(item.topic);
    setEditPrimaryKw(item.primaryKeyword || '');
    setEditSecondaryKws(item.secondaryKeywords || '');
  };

  const handleSaveEditItem = () => {
    if (!editingItemId) return;
    setTopicQueue(prev =>
      prev.map(it =>
        it.id === editingItemId
          ? {
              ...it,
              topic: editTopicText.trim(),
              primaryKeyword: editPrimaryKw.trim() || editTopicText.trim(),
              secondaryKeywords: editSecondaryKws.trim(),
            }
          : it
      )
    );
    setEditingItemId(null);
    toast.success('Topic updated');
  };

  const handleCancelEditItem = () => {
    setEditingItemId(null);
  };

  const handleAddTopicsToQueue = () => {
    if (!rawTopicList.trim()) return;
    const parsed = parseMultilineTopics(rawTopicList);
    if (parsed.length > 0) {
      setTopicQueue(prev => [...prev, ...parsed]);
      setRawTopicList('');
      toast.success(`Added ${parsed.length} topics to queue`);
    } else {
      toast.error('Could not parse any topics. Please check formatting.');
    }
  };

  const handleRemoveTopicQueueItem = (id: string) => {
    setTopicQueue(prev => prev.filter(item => item.id !== id));
  };

  const handleClearTopicQueue = () => {
    setTopicQueue([]);
  };

  const handleTopicFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        const parsed = parseMultilineTopics(text);
        if (parsed.length > 0) {
          setTopicQueue(prev => [...prev, ...parsed]);
          toast.success(`Imported ${parsed.length} topics from ${file.name}`);
        } else {
          toast.error(`No topics found in ${file.name}`);
        }
      }
    };
    reader.readAsText(file);
    if (topicFileRef.current) topicFileRef.current.value = '';
  };

  // ── Create + Run mutation (generate mode creates automation, runs it, redirects to article) ──
  const createMutation = useMutation({
    mutationFn: async () => {
      const finalAiKeywordCount = aiKeywordCount === 'Custom' ? parseInt(aiKeywordCustomCount) || 25 : parseInt(aiKeywordCount);
      const finalContentLength = contentLength === 'Custom' ? `Custom (${customWordCount} words)` : contentLength;
      const finalTone = tone === 'Custom' ? customTone : tone;
      const finalImageCount = imageCount === 'Custom' ? parseInt(customImageCount) || 3 : parseInt(imageCount);
      const finalImageStyle = imageStyle === 'Custom' ? customImageStyle : imageStyle;
      const finalAspectRatio = aspectRatio === 'Custom' ? customAspectRatio : aspectRatio;
      const finalImageTone = imageTone === 'Custom' ? customImageTone : imageTone;
      const actualFinalAction = isGenerateMode ? 'DRAFT' : finalAction;
      const workflowConfig = JSON.stringify({
        contentGeneration: {
          generationMode,
          articlesPerDay: finalArticlesPerDay,
          topicDiscovery:
            generationMode === 'AI_TOPIC_DISCOVERY'
              ? {
                  niche,
                  subNiches,
                  preferredCategories,
                  targetAudience,
                  language,
                  country,
                  selectionStrategy,
                  excludedTopics,
                }
              : undefined,
          topicQueue: generationMode === 'MANUAL_QUEUE' && topicQueue.length > 0 ? topicQueue : undefined,
          allowReuseCompletedTopics,
          topic: topic || (generationMode === 'AI_TOPIC_DISCOVERY' ? niche : topicQueue[0]?.topic || 'Topic'),
          keywordSource,
          primaryKeyword: keywordSource === 'MANUAL' ? primaryKeyword : undefined,
          secondaryKeywords: keywordSource === 'MANUAL' ? secondaryKeywords : undefined,
          semanticKeywords: keywordSource === 'MANUAL' ? semanticKeywords : undefined,
          savedKeywordIds: keywordSource === 'SAVED' ? selectedSavedKeywordIds : undefined,
          aiKeywordCount: keywordSource === 'AI_GENERATE' ? finalAiKeywordCount : undefined,
          aiKeywordTone: keywordSource === 'AI_GENERATE' ? (aiKeywordTone === 'Custom' ? aiKeywordCustomTone : aiKeywordTone) : undefined,
          competitorResearchEnabled,
          outlineStrategy,
          internalLinkingEnabled,
          externalLinkingEnabled,
          tone: finalTone,
          contentLength: finalContentLength,
          articleStructure: {
            introduction: structIntro,
            tableOfContents: structToc,
            h2Sections: structH2,
            h3Subsections: structH3,
            faqSection: structFaq,
            conclusion: structConclusion,
          },
        },
        seoProcessing: { generateSeoTitle, generateMetaDescription, generateSlug, optimizePrimaryKeyword, includeSecondaryKeywords, includeSemanticKeywords, generateFaq, generateFaqSchema, generateArticleSchema },
        media: { source: mediaSource, folderId: mediaSource === 'MEDIA_LIBRARY' ? selectedFolderId : undefined, selectedMediaIds: mediaSource === 'MEDIA_LIBRARY' && selectedMediaIds.length > 0 ? selectedMediaIds : undefined, imageSelectionMode: mediaSource === 'MEDIA_LIBRARY' ? imageSelectionMode : undefined, generateFeaturedImage: mediaSource === 'AI_GENERATE' ? generateFeaturedImage : undefined, generateSectionImages: mediaSource === 'AI_GENERATE' ? generateSectionImages : undefined, imageCount: mediaSource === 'AI_GENERATE' ? finalImageCount : undefined, imageStyle: mediaSource === 'AI_GENERATE' ? finalImageStyle : undefined, aspectRatio: mediaSource === 'AI_GENERATE' ? finalAspectRatio : undefined, imageTone: mediaSource === 'AI_GENERATE' ? finalImageTone : undefined, imagePromptInstructions: mediaSource === 'AI_GENERATE' ? imagePromptInstructions : undefined, placement: mediaSource !== 'NONE' ? imagePlacement : undefined },
        finalAction: { action: actualFinalAction, publishDate: actualFinalAction === 'SCHEDULE' ? publishDate : undefined, publishTime: actualFinalAction === 'SCHEDULE' ? publishTime : undefined },
      });
      const parsedTime = parseScheduleTime(time);
      const canonicalTime = `${String(parsedTime.hour).padStart(2, '0')}:${String(parsedTime.minute).padStart(2, '0')}`;

      // Validate scheduled date and time before saving
      if (!isGenerateMode && triggerType === 'SCHEDULED') {
        const scheduleCheck = validateScheduleNotPassed({
          frequency,
          time: canonicalTime,
          timezone,
          startDate: startDate || undefined,
        });
        if (!scheduleCheck.isValid) {
          const errMsg = scheduleCheck.error || 'This date and time has already passed. Please choose a future date and time.';
          setScheduleError(errMsg);
          setStep(1);
          toast.error(errMsg);
          throw new Error(errMsg);
        }
      }

      // Validate publication schedule date and time before saving
      if (!isGenerateMode && actualFinalAction === 'SCHEDULE') {
        const isValidPub = validatePublicationSchedule(publishDate, publishTime, true);
        if (!isValidPub) {
          setStep(4);
          throw new Error(publicationScheduleError || 'Invalid publication schedule date and time');
        }
      }

      const scheduleConfig = JSON.stringify({
        frequency,
        time: canonicalTime,
        timezone,
        startDate: startDate || undefined,
        articlesPerDay: finalArticlesPerDay,
      });

      if (isEditMode) {
        await patchApi(`/api/automations/${automationId}`, {
          name,
          description,
          triggerType: isGenerateMode ? 'MANUAL' : triggerType,
          scheduleConfig,
          workflowConfig,
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.automations.all });
        queryClient.invalidateQueries({ queryKey: ['automations'] });
        queryClient.invalidateQueries({ queryKey: ['automation', automationId] });
        queryClient.invalidateQueries({ queryKey: ['calendar'] });
        return { isEdit: true };
      }

      const created = await postApi<any>('/api/automations', {
        name: isGenerateMode ? `Generate: ${topic || niche}` : name,
        description,
        triggerType: isGenerateMode ? 'MANUAL' : triggerType,
        scheduleConfig,
        workflowConfig,
        siteId: activeSiteDbId || undefined,
      });
      const createdId = created?.id || created?.data?.id;
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all });
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });

      if (isGenerateMode && createdId) {
        // Run the automation immediately
        setGenerating(true);
        await postApi(`/api/automations/${createdId}/run`);
        // Poll for completion — check the run status until it finishes
        let articleId: string | null = null;
        for (let attempt = 0; attempt < 30; attempt++) {
          await new Promise(r => setTimeout(r, 2000));
          try {
            const runRes = await getApi<any>(`/api/automations/${createdId}`);
            const runData = runRes?.data ?? runRes;
            // Check the latest run's generatedArticleId
            const runs = runData?.runs ?? [];
            const latestRun = runs[0];
            if (latestRun?.status === 'COMPLETED' && latestRun?.generatedArticleId) {
              articleId = latestRun.generatedArticleId;
              break;
            }
            if (latestRun?.status === 'FAILED') {
              throw new Error(latestRun?.errorMessage || 'AI generation failed');
            }
          } catch { /* keep polling */ }
        }
        return { articleId };
      }
      return { articleId: null };
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.content.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      if (result?.isEdit) {
        toast.success('Automation updated successfully');
        navigate(targetAutoMod);
        return;
      }
      if (isGenerateMode) {
        setGenerating(false);
        if (result?.articleId) {
          toast.success(t('automation.builder.toastArticleGenerated'));
          navigate(targetContentMod, result.articleId);
        } else {
          toast.success(t('automation.builder.toastGenerationCompleted'));
          navigate(targetContentMod);
        }
      } else {
        toast.success(t('automation.builder.toastAutomationCreated'));
        navigate(targetAutoMod);
      }
    },
    onError: (err: Error) => {
      setGenerating(false);
      const msg = err.message || t('automation.builder.toastFailed');
      if (msg.includes('already passed') || msg.includes('future date')) {
        setScheduleError(msg);
      }
      toast.error(msg);
    },
  });

  const steps = isGenerateMode
    ? [{ num: 2, label: t('automation.builder.stepContent'), icon: FileText, desc: t('automation.builder.stepContentDesc') }, { num: 3, label: t('automation.builder.stepSeoMedia'), icon: Sparkles, desc: t('automation.builder.stepSeoMediaDesc') }, { num: 4, label: t('automation.builder.stepAction'), icon: Send, desc: t('automation.builder.stepActionDesc') }]
    : [{ num: 1, label: t('automation.builder.stepTrigger'), icon: Zap, desc: t('automation.builder.stepTriggerDesc') }, { num: 2, label: t('automation.builder.stepContent'), icon: FileText, desc: t('automation.builder.stepContentDesc') }, { num: 3, label: t('automation.builder.stepSeoMedia'), icon: Sparkles, desc: t('automation.builder.stepSeoMediaDesc') }, { num: 4, label: t('automation.builder.stepAction'), icon: Send, desc: t('automation.builder.stepActionDesc') }];

  const canProceed = useMemo(() => {
    if (step === 1) {
      if (name.trim().length === 0) return false;
      const count = articlesPerDay === 'Custom' ? parseInt(customArticlesPerDay) : parseInt(articlesPerDay);
      if (isNaN(count) || count < 1) return false;
      return true;
    }
    if (step === 2) {
      if (country && !isValidCountryCode(country)) return false;
      if (generationMode === 'AI_TOPIC_DISCOVERY') {
        if (!niche.trim()) return false;
      } else {
        if (!topic.trim() && topicQueue.length === 0) return false;
      }
      if (keywordSource === 'MANUAL' && !primaryKeyword.trim() && !topic.trim() && topicQueue.length === 0) return false;
      if (keywordSource === 'SAVED' && selectedSavedKeywordIds.length === 0) return false;
      if (keywordSource === 'AI_GENERATE' && aiKeywordCount === 'Custom' && (!aiKeywordCustomCount || parseInt(aiKeywordCustomCount) < 1)) return false;
      if (tone === 'Custom' && !customTone.trim()) return false;
      if (contentLength === 'Custom' && (!customWordCount || parseInt(customWordCount) < 1)) return false;
      return true;
    }
    if (step === 3) {
      if (mediaSource === 'MEDIA_LIBRARY' && selectedMediaIds.length === 0 && imageSelectionMode !== 'ALL') return false;
      if (mediaSource === 'LOCAL_UPLOAD' && selectedMediaIds.length === 0) return false;
      if (mediaSource === 'AI_GENERATE') {
        if (!generateFeaturedImage && !generateSectionImages) return false;
        if (imageCount === 'Custom' && (!customImageCount || parseInt(customImageCount) < 1)) return false;
        if (imageStyle === 'Custom' && !customImageStyle.trim()) return false;
        if (aspectRatio === 'Custom' && !customAspectRatio.trim()) return false;
        if (imageTone === 'Custom' && !customImageTone.trim()) return false;
      }
      return true;
    }
    if (step === 4) {
      if (finalAction === 'SCHEDULE' && (!publishDate || !publishTime || Boolean(publicationScheduleError))) return false;
      return true;
    }
    return true;
  }, [step, name, articlesPerDay, customArticlesPerDay, country, topic, generationMode, niche, topicQueue, keywordSource, primaryKeyword, selectedSavedKeywordIds, aiKeywordCount, aiKeywordCustomCount, tone, customTone, contentLength, customWordCount, mediaSource, selectedMediaIds, imageSelectionMode, generateFeaturedImage, generateSectionImages, imageCount, customImageCount, imageStyle, customImageStyle, aspectRatio, customAspectRatio, imageTone, customImageTone, finalAction, publishDate, publishTime, publicationScheduleError]);

  const validateStep1Schedule = (): boolean => {
    if (!isGenerateMode && triggerType === 'SCHEDULED') {
      const parsedTime = parseScheduleTime(time);
      const canonicalTime = `${String(parsedTime.hour).padStart(2, '0')}:${String(parsedTime.minute).padStart(2, '0')}`;
      const scheduleCheck = validateScheduleNotPassed({
        frequency,
        time: canonicalTime,
        timezone,
        startDate: startDate || undefined,
      });

      if (!scheduleCheck.isValid) {
        const errMsg = scheduleCheck.error || 'This date and time has already passed. Please choose a future date and time.';
        setScheduleError(errMsg);
        toast.error(errMsg);
        return false;
      }
      setScheduleError(null);
      return true;
    }
    setScheduleError(null);
    return true;
  };

  const handleNextStep = () => {
    if (step === 1 && !validateStep1Schedule()) {
      return;
    }
    setStep((prev) => prev + 1);
  };

  // ── Preview helpers ──
  const kwPreview =
    keywordSource === 'MANUAL'
      ? primaryKeyword || '—'
      : keywordSource === 'SAVED'
      ? `${selectedSavedKeywordIds.length} ${t('automation.builder.previewKwSavedSuffix')}`
      : keywordSource === 'GSC_PERFORMANCE'
      ? `Search Console (${gscData?.topQueries?.length || 0} queries)`
      : `${t('automation.builder.previewMediaAi')}: ${aiKeywordCount === 'Custom' ? aiKeywordCustomCount : aiKeywordCount} (${aiKeywordTone === 'Custom' ? aiKeywordCustomTone : aiKeywordTone})`;
  const structParts = [structIntro && t('automation.builder.previewStructureIntro'), structToc && t('automation.builder.previewStructureToc'), structH2 && t('automation.builder.previewStructureH2'), structH3 && t('automation.builder.previewStructureH3'), structFaq && t('automation.builder.previewStructureFaq'), structConclusion && t('automation.builder.previewStructureConclusion')].filter(Boolean);
  const seoParts = [
    generateSeoTitle && t('automation.builder.previewSeoTitle'),
    generateMetaDescription && t('automation.builder.previewSeoMeta'),
    generateSlug && t('automation.builder.previewSeoSlug'),
    optimizePrimaryKeyword && t('automation.builder.previewSeoPrimaryKw'),
    includeSecondaryKeywords && t('automation.builder.previewSeoSecondary'),
    includeSemanticKeywords && t('automation.builder.previewSeoSemantic'),
    internalLinkingEnabled && 'Internal Links',
    externalLinkingEnabled && 'External References',
    generateFaq && t('automation.builder.previewStructureFaq'),
    generateFaqSchema && t('automation.builder.previewSeoFaqSchema'),
    generateArticleSchema && t('automation.builder.previewSeoArticleSchema'),
  ].filter(Boolean);
  const mediaPreview =
    mediaSource === 'NONE'
      ? t('automation.builder.previewNone')
      : mediaSource === 'MEDIA_LIBRARY'
      ? `${t('automation.builder.previewMediaLibrary')} (${selectedMediaIds.length || t('automation.builder.previewMediaAuto')}, ${imageSelectionMode})`
      : mediaSource === 'LOCAL_UPLOAD'
      ? `Computer Uploads (${selectedMediaIds.length} selected)`
      : `${t('automation.builder.previewMediaAi')} (${imageCount === 'Custom' ? customImageCount : imageCount}, ${imageStyle === 'Custom' ? customImageStyle : imageStyle})`;
  const placementLabel = { AI_AUTOMATIC: t('automation.builder.previewPlacementAiAuto'), AFTER_INTRO: t('automation.builder.previewPlacementAfterIntro'), BEFORE_FIRST_H2: t('automation.builder.previewPlacementBeforeH2'), AFTER_EACH_H2: t('automation.builder.previewPlacementAfterEachH2'), MANUAL_MAPPING: t('automation.builder.previewPlacementManual') }[imagePlacement];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Page Header — integrated, no rectangle */}
      <div>
        <button
          type="button"
          onClick={() => navigate(isGenerateMode ? targetContentMod : targetAutoMod)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {isGenerateMode ? t('automation.builder.backToArticles') : t('automation.builder.backToAutomations')}
        </button>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {isGenerateMode ? t('automation.builder.generateArticle') : isEditMode ? 'Edit Automation' : t('automation.builder.newAutomation')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isGenerateMode ? t('automation.builder.generateArticleDesc') : isEditMode ? 'Update saved schedule, topic discovery strategy, topic queues, and execution settings.' : t('automation.builder.newAutomationDesc')}
        </p>
      </div>

      {/* Stepper */}
      <div>
        <div className="flex items-center">
          {steps.map((s, i) => (
            <React.Fragment key={s.num}>
              <button
                type="button"
                onClick={() => {
                  if (s.num > step && step === 1 && !validateStep1Schedule()) {
                    return;
                  }
                  if (s.num < step || canProceed) setStep(s.num);
                }}
                className={cn('flex items-center gap-2.5 transition-all', s.num < step ? 'cursor-pointer' : s.num === step ? '' : 'opacity-40 cursor-not-allowed')}
              >
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all shrink-0', s.num < step ? 'bg-primary text-primary-foreground' : s.num === step ? 'bg-primary text-primary-foreground ring-4 ring-primary/15' : 'bg-muted text-muted-foreground')}>
                  {s.num < step ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                </div>
                <div className="hidden sm:block text-left">
                  <p className={cn('text-xs font-semibold leading-tight', s.num <= step ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{s.desc}</p>
                </div>
              </button>
              {i < steps.length - 1 && <div className={cn('h-0.5 flex-1 mx-4 transition-colors', s.num < step ? 'bg-primary' : 'bg-border')} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step Content Card */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-6 sm:p-8">
          {/* ─────────── STEP 1: TRIGGER ─────────── */}
          {step === 1 && (
            <div className="space-y-6">
              <SectionLabel icon={Zap}>{t('automation.builder.triggerConfig')}</SectionLabel>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  {t('automation.builder.automationName')} <span className="text-red-500">*</span>
                </Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('automation.builder.automationNamePlaceholder')} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{t('automation.builder.descriptionLabel')}</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('automation.builder.descriptionPlaceholder')} rows={2} className="resize-none" />
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldRow label={t('automation.builder.triggerType')}>
                  <Select value={triggerType} onValueChange={(v) => setTriggerType(v as 'MANUAL' | 'SCHEDULED')}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANUAL">{t('automation.builder.triggerTypeManual')}</SelectItem>
                      <SelectItem value="SCHEDULED">{t('automation.builder.triggerTypeScheduled')}</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label="Timezone" hint="Controls daily quota and execution calendar">
                  <Select
                    value={timezone}
                    onValueChange={(newTz) => {
                      setTimezone(newTz);
                      setScheduleError(null);
                      const todayInNewTz = getTodayDateStringInTz(newTz);
                      if (!startDate || startDate < todayInNewTz) {
                        setStartDate(todayInNewTz);
                      }
                    }}
                  >
                    <SelectTrigger className="h-10 font-mono text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {!COMMON_TIMEZONES.includes(timezone) && (
                        <SelectItem key={timezone} value={timezone} className="font-mono text-xs">{timezone} (Detected)</SelectItem>
                      )}
                      {COMMON_TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz} className="font-mono text-xs">{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>
              </div>

              {triggerType === 'SCHEDULED' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FieldRow label={t('automation.builder.frequency')}>
                      <Select value={frequency} onValueChange={setFrequency}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DAILY">{t('automation.builder.frequencyDaily')}</SelectItem>
                          <SelectItem value="WEEKLY">{t('automation.builder.frequencyWeekly')}</SelectItem>
                          <SelectItem value="MONTHLY">{t('automation.builder.frequencyMonthly')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldRow>
                    <FieldRow label={t('automation.builder.timeLabel')} hint={`Timezone: ${timezone}`}>
                      <PublishTimePicker
                        dateValue={startDate}
                        onDateChange={(d) => {
                          setStartDate(d);
                          setScheduleError(null);
                        }}
                        value={time}
                        onChange={(t) => {
                          setTime(t);
                          setScheduleError(null);
                        }}
                        showDateInButton={true}
                        className={cn("w-full sm:w-[280px]", scheduleError && "border-red-500 ring-1 ring-red-500")}
                      />
                    </FieldRow>
                  </div>
                  {scheduleError && (
                    <div className="flex items-center gap-2 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 text-xs font-medium">
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                      <span>{scheduleError}</span>
                    </div>
                  )}
                </div>
              )}

              <Separator />
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Articles Per Day <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Controls how many distinct articles the automation attempts to generate per calendar day in your selected timezone.
                  </p>
                </div>
                <div className="grid grid-cols-5 gap-2 pt-1">
                  {['1', '2', '3', '5', 'Custom'].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setArticlesPerDay(q)}
                      className={cn(
                        "h-10 rounded-lg border text-xs font-semibold transition-all",
                        articlesPerDay === q
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border hover:bg-muted/40 text-foreground"
                      )}
                    >
                      {q === 'Custom' ? 'Custom' : `${q} / day`}
                    </button>
                  ))}
                </div>
                {articlesPerDay === 'Custom' && (
                  <div className="pt-2">
                    <FieldRow label="Custom Daily Quantity" hint="Must be at least 1">
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={customArticlesPerDay}
                        onChange={(e) => setCustomArticlesPerDay(e.target.value)}
                        placeholder="e.g. 4"
                        className="h-10 w-40"
                      />
                    </FieldRow>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────── STEP 2: CONTENT & TOPIC MODES ─────────── */}
          {step === 2 && (
            <div className="space-y-6">
              <SectionLabel icon={FileText}>{t('automation.builder.contentGeneration')}</SectionLabel>

              {/* Two Simple Selectable Cards */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Article Generation Mode
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setGenerationMode('AI_TOPIC_DISCOVERY')}
                    className={cn(
                      "flex flex-col text-left p-4 rounded-xl border transition-all text-xs",
                      generationMode === 'AI_TOPIC_DISCOVERY'
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                        : "border-border/60 hover:border-border hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Sparkles className={cn("h-4 w-4", generationMode === 'AI_TOPIC_DISCOVERY' ? "text-primary" : "text-muted-foreground")} />
                      <span className="text-sm font-semibold text-foreground">Find Topics with AI</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed text-xs">
                      AI researches relevant topics online and generates articles automatically.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGenerationMode('MANUAL_QUEUE')}
                    className={cn(
                      "flex flex-col text-left p-4 rounded-xl border transition-all text-xs",
                      generationMode === 'MANUAL_QUEUE'
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                        : "border-border/60 hover:border-border hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <ListOrdered className={cn("h-4 w-4", generationMode === 'MANUAL_QUEUE' ? "text-primary" : "text-muted-foreground")} />
                      <span className="text-sm font-semibold text-foreground">Use My Topics</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed text-xs">
                      Provide your own topics or keywords and let AI generate the articles.
                    </p>
                  </button>
                </div>
              </div>

              {/* MODE A: FIND TOPICS WITH AI */}
              {generationMode === 'AI_TOPIC_DISCOVERY' && (
                <div className="space-y-4 p-5 rounded-xl border bg-card/50">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">
                      Website Niche <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={niche}
                      onChange={(e) => {
                        setNiche(e.target.value);
                        if (!topic) setTopic(e.target.value);
                      }}
                      placeholder="e.g. Gardening, Technology, Home Improvement"
                      className="h-10"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FieldRow label="Target Language" hint="35+ supported languages">
                      <SearchableLanguageSelect value={language} onChange={setLanguage} />
                    </FieldRow>
                    <FieldRow
                      label="Target Country"
                      hint="Optional (e.g. US)"
                    >
                      <Input
                        value={country}
                        onChange={(e) => setCountry(e.target.value.toUpperCase().trim())}
                        placeholder="Global / International"
                        className="h-10 font-mono text-xs"
                        maxLength={2}
                      />
                      {country && !isValidCountryCode(country) && (
                        <p className="text-[11px] text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          <span>Please enter a valid 2-letter ISO country code (e.g. US, GB, DE, FR, JP).</span>
                        </p>
                      )}
                    </FieldRow>
                  </div>

                  {/* Search Status Notice */}
                  {searchProviderInfo?.isLive ? (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                      <Globe className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>Live search active via <strong>{searchProviderInfo.provider}</strong>. AI analyzes real internet results and competitor headings.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/60 border text-xs text-muted-foreground">
                      <Globe className="h-4 w-4 shrink-0 text-muted-foreground/80" />
                      <span>Live search is not configured. Topic suggestions will be AI-generated without live search validation.</span>
                    </div>
                  )}

                  {/* Collapsible Advanced Research Options */}
                  <Collapsible open={advancedResearchOpen} onOpenChange={setAdvancedResearchOpen} className="pt-1">
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8 px-2">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        <span>Advanced Research Options</span>
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", advancedResearchOpen && "rotate-180")} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 pt-3 border-t mt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FieldRow label="Optional Sub-Niches" hint="Comma-separated">
                          <Input
                            value={subNiches}
                            onChange={(e) => setSubNiches(e.target.value)}
                            placeholder="e.g., Organic gardening, Heirloom seeds"
                            className="h-9 text-xs"
                          />
                        </FieldRow>
                        <FieldRow label="Target Audience" hint="Who will read this">
                          <Input
                            value={targetAudience}
                            onChange={(e) => setTargetAudience(e.target.value)}
                            placeholder="e.g., Homeowners & DIY Gardeners"
                            className="h-9 text-xs"
                          />
                        </FieldRow>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FieldRow label="Preferred Topic Categories" hint="Comma-separated">
                          <Input
                            value={preferredCategories}
                            onChange={(e) => setPreferredCategories(e.target.value)}
                            placeholder="e.g., Seasonal Tips, Troubleshooting"
                            className="h-9 text-xs"
                          />
                        </FieldRow>
                        <FieldRow label="Topic Selection Strategy" hint="Research priority rule">
                          <Select value={selectionStrategy} onValueChange={(v: any) => setSelectionStrategy(v)}>
                            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent className="max-w-md">
                              <SelectItem value="HIGH_SEARCH_INTENT">
                                <div className="text-left py-0.5">
                                  <div className="font-semibold text-xs text-foreground">High Search Intent & Problem Solving</div>
                                  <div className="text-[11px] text-muted-foreground">Prioritize specific problems, actionable solutions, and topics with clear search intent.</div>
                                </div>
                              </SelectItem>
                              <SelectItem value="QUESTION_BASED">
                                <div className="text-left py-0.5">
                                  <div className="font-semibold text-xs text-foreground">Informational / People Also Ask</div>
                                  <div className="text-[11px] text-muted-foreground">Prioritize educational questions, definitions, how-to topics, and relevant FAQ opportunities.</div>
                                </div>
                              </SelectItem>
                              <SelectItem value="TOPICAL_AUTHORITY_PILLARS">
                                <div className="text-left py-0.5">
                                  <div className="font-semibold text-xs text-foreground">Topical Authority / Pillar Content</div>
                                  <div className="text-[11px] text-muted-foreground">Identify pillar topics and supporting cluster articles that build comprehensive topical coverage.</div>
                                </div>
                              </SelectItem>
                              <SelectItem value="COMPETITOR_GAPS">
                                <div className="text-left py-0.5">
                                  <div className="font-semibold text-xs text-foreground">Competitor Content Gap Exploration</div>
                                  <div className="text-[11px] text-muted-foreground">Find topics competitors cover that this site does not (requires live search provider).</div>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FieldRow>
                      </div>
                      <FieldRow label="Optional Excluded Topics" hint="Topics the engine must strictly avoid">
                        <Textarea
                          value={excludedTopics}
                          onChange={(e) => setExcludedTopics(e.target.value)}
                          placeholder="e.g., Commercial farming, indoor hydroponics..."
                          rows={2}
                          className="text-xs resize-none"
                        />
                      </FieldRow>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}

              {/* MODE B: USE MY TOPICS */}
              {generationMode === 'MANUAL_QUEUE' && (
                <div className="space-y-4 p-5 rounded-xl border bg-card/50">
                  {/* Topic Input Textarea */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-foreground">
                      Topics (one per line)
                    </Label>
                    <Textarea
                      value={rawTopicList}
                      onChange={(e) => setRawTopicList(e.target.value)}
                      placeholder={"Enter or paste your topics here, one per line...\ne.g. Organic Pest Control Methods\ne.g. Best Soil Mix for Tomatoes | Tomato soil | gardening, soil tips"}
                      rows={3}
                      className="text-xs font-mono resize-none"
                    />
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <input ref={topicFileRef} type="file" accept=".txt,.csv" className="hidden" onChange={handleTopicFileImport} />
                      <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => topicFileRef.current?.click()}>
                        <Upload className="h-3 w-3" /> Import File
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 gap-1 text-xs"
                        onClick={handleAddTopicsToQueue}
                        disabled={!rawTopicList.trim()}
                      >
                        <Plus className="h-3 w-3" /> Add to Queue
                      </Button>
                    </div>
                  </div>

                  {/* Compact Queue (Only visible when items exist) */}
                  {topicQueue.length > 0 && (
                    <div className="space-y-2.5 pt-2 border-t">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-foreground">Queue ({topicQueue.length})</span>
                          <div className="flex gap-1.5 text-[10px] flex-wrap">
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                              {topicQueue.filter((q) => q.status === 'AVAILABLE').length} Available
                            </Badge>
                            <Badge variant="outline" className="bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/30">
                              {topicQueue.filter((q) => q.status === 'COMPLETED').length} Done
                            </Badge>
                            {topicQueue.some((q) => q.status === 'FAILED') && (
                              <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30">
                                {topicQueue.filter((q) => q.status === 'FAILED').length} Failed
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="h-6 text-[11px] text-destructive hover:text-destructive" onClick={handleClearTopicQueue}>
                          Clear Queue
                        </Button>
                      </div>

                      <div className="max-h-56 overflow-y-auto rounded-lg border bg-card divide-y">
                        {topicQueue.map((item) => {
                          const isEditing = editingItemId === item.id;
                          return (
                            <div key={item.id} className="p-2.5 text-xs">
                              {isEditing ? (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <Input
                                      value={editTopicText}
                                      onChange={(e) => setEditTopicText(e.target.value)}
                                      placeholder="Topic title"
                                      className="h-8 text-xs"
                                    />
                                    <Input
                                      value={editPrimaryKw}
                                      onChange={(e) => setEditPrimaryKw(e.target.value)}
                                      placeholder="Primary Keyword"
                                      className="h-8 text-xs"
                                    />
                                  </div>
                                  <div className="flex items-center justify-end gap-2">
                                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCancelEditItem}>
                                      Cancel
                                    </Button>
                                    <Button type="button" size="sm" className="h-7 text-xs gap-1" onClick={handleSaveEditItem}>
                                      <Check className="h-3 w-3" /> Save
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-foreground truncate">{item.topic}</span>
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[10px] px-1.5 py-0 uppercase font-mono",
                                          item.status === 'AVAILABLE' && "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
                                          item.status === 'RESERVED' && "bg-amber-500/10 text-amber-600 border-amber-500/30",
                                          item.status === 'PROCESSING' && "bg-blue-500/10 text-blue-600 border-blue-500/30",
                                          item.status === 'COMPLETED' && "bg-muted text-muted-foreground border-border",
                                          item.status === 'FAILED' && "bg-destructive/10 text-destructive border-destructive/30"
                                        )}
                                      >
                                        {item.status}
                                      </Badge>
                                    </div>
                                    {item.primaryKeyword && item.primaryKeyword !== item.topic && (
                                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                        Keyword: {item.primaryKeyword}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                      onClick={() => handleStartEditItem(item)}
                                      title="Edit topic"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                      onClick={() => handleRemoveTopicQueueItem(item.id)}
                                      title="Delete topic"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div>
                          <Label className="text-xs font-medium cursor-pointer" onClick={() => setAllowReuseCompletedTopics(!allowReuseCompletedTopics)}>
                            Reuse completed topics when queue is exhausted
                          </Label>
                          <p className="text-[11px] text-muted-foreground">When disabled, execution finishes cleanly once all queued topics are completed.</p>
                        </div>
                        <Switch checked={allowReuseCompletedTopics} onCheckedChange={setAllowReuseCompletedTopics} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Essential Content Controls: Tone & Length */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div className="space-y-3">
                  <FieldRow label={t('automation.builder.articleTone')}>
                    <Select value={tone} onValueChange={setTone}>
                      <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Professional">{t('automation.builder.toneProfessional')}</SelectItem>
                        <SelectItem value="Informative">{t('automation.builder.toneInformative')}</SelectItem>
                        <SelectItem value="Casual">{t('automation.builder.toneCasual')}</SelectItem>
                        <SelectItem value="Friendly">{t('automation.builder.toneFriendly')}</SelectItem>
                        <SelectItem value="Expert">{t('automation.builder.toneExpert')}</SelectItem>
                        <SelectItem value="Conversational">{t('automation.builder.toneConversational')}</SelectItem>
                        <SelectItem value="Custom">{t('automation.builder.custom')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>
                  {tone === 'Custom' && (
                    <FieldRow label={t('automation.builder.describeWritingStyle')}>
                      <Textarea
                        value={customTone}
                        onChange={(e) => setCustomTone(e.target.value)}
                        placeholder={t('automation.builder.describeWritingStylePlaceholder')}
                        rows={2}
                        className="text-sm resize-none w-full"
                      />
                    </FieldRow>
                  )}
                </div>

                <div className="space-y-3">
                  <FieldRow label={t('automation.builder.contentLength')}>
                    <Select value={contentLength} onValueChange={setContentLength}>
                      <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Short (300-600 words)">{t('automation.builder.lengthShort')}</SelectItem>
                        <SelectItem value="Medium (800-1200 words)">{t('automation.builder.lengthMedium')}</SelectItem>
                        <SelectItem value="Long (1500-2500 words)">{t('automation.builder.lengthLong')}</SelectItem>
                        <SelectItem value="Comprehensive (3000+ words)">{t('automation.builder.lengthComprehensive')}</SelectItem>
                        <SelectItem value="Custom">{t('automation.builder.custom')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>
                  {contentLength === 'Custom' && (
                    <FieldRow label={t('automation.builder.targetWordCount')}>
                      <Input
                        type="number"
                        value={customWordCount}
                        onChange={(e) => setCustomWordCount(e.target.value)}
                        placeholder="2200"
                        className="h-9 w-full"
                        min="1"
                      />
                    </FieldRow>
                  )}
                </div>
              </div>

              {/* Compact Article Structure Layout */}
              <div>
                <h3 className="text-sm font-semibold mb-1">{t('automation.builder.articleStructure')}</h3>
                <p className="text-xs text-muted-foreground mb-2.5">{t('automation.builder.articleStructureHint')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { label: t('automation.builder.structureIntro'), val: structIntro, set: setStructIntro },
                    { label: t('automation.builder.structureToc'), val: structToc, set: setStructToc },
                    { label: t('automation.builder.structureH2'), val: structH2, set: setStructH2 },
                    { label: t('automation.builder.structureH3'), val: structH3, set: setStructH3 },
                    { label: t('automation.builder.structureFaq'), val: structFaq, set: setStructFaq },
                    { label: t('automation.builder.structureConclusion'), val: structConclusion, set: setStructConclusion },
                  ].map((item) => (
                    <div
                      key={item.label}
                      onClick={() => item.set(!item.val)}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all text-xs",
                        item.val ? "border-primary/40 bg-primary/5 font-medium text-foreground" : "border-border/60 text-muted-foreground hover:bg-muted/30"
                      )}
                    >
                      <span>{item.label}</span>
                      <Switch checked={item.val} onCheckedChange={item.set} className="scale-90 pointer-events-none" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Collapsible Advanced Content Settings */}
              <Collapsible open={advancedContentOpen} onOpenChange={setAdvancedContentOpen} className="pt-1">
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8 px-2">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Advanced Content Settings</span>
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", advancedContentOpen && "rotate-180")} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-3 border-t mt-2">
                  <div className="rounded-lg border bg-card/50 overflow-hidden divide-y">
                    <ToggleRow
                      label="Competitor & SERP Research"
                      description={
                        searchProviderInfo?.isLive
                          ? "Searches competing Google results for your target topic, country, and language to extract ranking headings and identify content gaps."
                          : "Live search is not configured. When enabled, live competitor SERP analysis will be skipped without fabricating results."
                      }
                      checked={competitorResearchEnabled}
                      onChange={setCompetitorResearchEnabled}
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 px-3">
                      <div>
                        <p className="text-sm font-medium leading-tight">Outline Strategy</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {outlineStrategy === 'AUTOMATIC'
                            ? "Automatic Outline: AI generates the outline and proceeds immediately to writing."
                            : "Require Outline Approval: AI pauses writing until you review and approve the outline."}
                        </p>
                      </div>
                      <Select value={outlineStrategy} onValueChange={(v) => setOutlineStrategy(v as 'AUTOMATIC' | 'REVIEW')}>
                        <SelectTrigger className="h-9 w-52 text-xs shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AUTOMATIC">Automatic Outline</SelectItem>
                          <SelectItem value="REVIEW">Require Outline Approval</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* ─────────── STEP 3: SEO + MEDIA ─────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <SectionLabel icon={Sparkles}>{t('automation.builder.seoOptimization')}</SectionLabel>
              <div className="rounded-lg border bg-card/50 overflow-hidden">
                {[
                  { label: t('automation.builder.seoTitleToggle'), desc: t('automation.builder.seoTitleToggleHint'), val: generateSeoTitle, set: setGenerateSeoTitle },
                  { label: t('automation.builder.metaDescToggle'), desc: t('automation.builder.metaDescToggleHint'), val: generateMetaDescription, set: setGenerateMetaDescription },
                  { label: t('automation.builder.urlSlugToggle'), desc: t('automation.builder.urlSlugToggleHint'), val: generateSlug, set: setGenerateSlug },
                  { label: t('automation.builder.optimizePrimaryKw'), desc: t('automation.builder.optimizePrimaryKwHint'), val: optimizePrimaryKeyword, set: setOptimizePrimaryKeyword },
                  { label: t('automation.builder.includeSecondaryKw'), val: includeSecondaryKeywords, set: setIncludeSecondaryKeywords },
                  { label: t('automation.builder.includeSemanticKw'), desc: t('automation.builder.includeSemanticKwHint'), val: includeSemanticKeywords, set: setIncludeSemanticKeywords },
                  { label: 'Contextual Internal Linking', desc: 'Finds published articles on this website and injects natural contextual links (tenant-isolated, never links to drafts)', val: internalLinkingEnabled, set: setInternalLinkingEnabled },
                  { label: 'External Reference Linking', desc: 'Adds verified external references to high-authority resources without inventing URLs', val: externalLinkingEnabled, set: setExternalLinkingEnabled },
                  { label: t('automation.builder.generateFaqSection'), desc: t('automation.builder.generateFaqSectionHint'), val: generateFaq, set: setGenerateFaq },
                  { label: t('automation.builder.generateFaqSchema'), val: generateFaqSchema, set: setGenerateFaqSchema },
                  { label: t('automation.builder.generateArticleSchema'), val: generateArticleSchema, set: setGenerateArticleSchema },
                ].map((item) => (
                  <ToggleRow key={item.label} label={item.label} description={item.desc} checked={item.val} onChange={item.set} />
                ))}
              </div>
              <Separator />
              <SectionLabel icon={FolderOpen}>{t('automation.builder.mediaSource')}</SectionLabel>
              <FieldRow label="Image Source Strategy">
                <Select value={mediaSource} onValueChange={(v) => setMediaSource(v as MediaSource)}>
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AI_GENERATE">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <span>AI Generate Images</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="MEDIA_LIBRARY">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-3.5 w-3.5 text-primary" />
                        <span>Use Media Library</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="LOCAL_UPLOAD">
                      <div className="flex items-center gap-2">
                        <Upload className="h-3.5 w-3.5 text-primary" />
                        <span>Upload from Computer</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="NONE">
                      <span className="text-muted-foreground">{t('automation.builder.sourceNone')}</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>

              {/* MEDIA LIBRARY */}
              {mediaSource === 'MEDIA_LIBRARY' && (
                <ConditionalBlock>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <FieldRow label="Select Media Folder">
                        <Select
                          value={selectedFolderId || 'ALL_MEDIA'}
                          onValueChange={(v) => {
                            setSelectedFolderId(v === 'ALL_MEDIA' ? '' : v);
                            setSelectedMediaIds([]);
                          }}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="All Media (No folder)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL_MEDIA">All Media (Root / Uncategorized)</SelectItem>
                            {mediaFolders.map((f) => (
                              <SelectItem key={f.id} value={f.id}>
                                {f.name} {typeof f._count?.media === 'number' ? `(${f._count.media} items)` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FieldRow>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs gap-1.5 shrink-0"
                      onClick={() => setCreateFolderOpen(true)}
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                      Create Folder
                    </Button>
                  </div>

                  {mediaFolders.length === 0 && (
                    <div className="p-3 rounded-lg border border-dashed text-xs text-muted-foreground flex items-center justify-between">
                      <span>No custom media folders created yet. You can reuse root images or create a new folder.</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-primary"
                        onClick={() => setCreateFolderOpen(true)}
                      >
                        Create Folder
                      </Button>
                    </div>
                  )}

                  {mediaItems.length > 0 ? (
                    <>
                      <FieldRow label={t('automation.builder.imageSelection')}>
                        <Select
                          value={imageSelectionMode}
                          onValueChange={(v) => setImageSelectionMode(v as 'ALL' | 'RANDOM' | 'AI_CHOOSE')}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">{t('automation.builder.imageSelectionAll')}</SelectItem>
                            <SelectItem value="RANDOM">{t('automation.builder.imageSelectionRandom')}</SelectItem>
                            <SelectItem value="AI_CHOOSE">{t('automation.builder.imageSelectionAiChoose')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FieldRow>

                      {imageSelectionMode !== 'ALL' && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium text-muted-foreground">
                              {t('automation.builder.selectImages')} ({selectedMediaIds.length} selected)
                            </Label>
                            {selectedMediaIds.length > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[11px] text-muted-foreground"
                                onClick={() => setSelectedMediaIds([])}
                              >
                                Clear Selection
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1 border rounded-lg">
                            {mediaItems.map((item) => {
                              const isSelected = selectedMediaIds.includes(item.id);
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => toggleMediaSelection(item.id)}
                                  className={cn(
                                    'relative aspect-square rounded-lg overflow-hidden border-2 transition-all group',
                                    isSelected
                                      ? 'border-primary ring-2 ring-primary/20'
                                      : 'border-border hover:border-primary/50'
                                  )}
                                >
                                  <img
                                    src={item.thumbnailUrl || item.url}
                                    alt={item.filename}
                                    className="h-full w-full object-cover"
                                  />
                                  {isSelected && (
                                    <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow">
                                      <Check className="h-3 w-3 stroke-[3]" />
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-4 text-center rounded-lg border border-dashed text-xs text-muted-foreground">
                      No images found in this folder. Upload images or select another folder.
                    </div>
                  )}
                </ConditionalBlock>
              )}

              {/* LOCAL UPLOAD */}
              {mediaSource === 'LOCAL_UPLOAD' && (
                <ConditionalBlock>
                  <input
                    ref={localFileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleLocalFileUpload(e.target.files);
                      }
                    }}
                    className="hidden"
                  />

                  <div className="space-y-3">
                    <div
                      onClick={() => !isUploadingFiles && localFileInputRef.current?.click()}
                      className={cn(
                        "p-6 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-colors",
                        isUploadingFiles
                          ? "border-primary/40 bg-primary/5 cursor-wait"
                          : "border-border hover:border-primary/60 hover:bg-muted/30"
                      )}
                    >
                      {isUploadingFiles ? (
                        <div className="space-y-2 flex flex-col items-center">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <p className="text-xs font-medium text-foreground">
                            Uploading images to tenant media storage ({uploadProgress}%)...
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 flex flex-col items-center">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Upload className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              Click to upload image files from your computer
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Supports JPG, PNG, WebP up to 10MB each. Multiple files supported.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Optional Folder to organize uploads */}
                    {mediaFolders.length > 0 && (
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <Label className="text-xs text-muted-foreground">Target Folder (Optional):</Label>
                        <Select value={selectedFolderId || 'ALL_MEDIA'} onValueChange={(v) => setSelectedFolderId(v === 'ALL_MEDIA' ? '' : v)}>
                          <SelectTrigger className="h-8 w-56 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL_MEDIA">No Folder (Root)</SelectItem>
                            {mediaFolders.map(f => (
                              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Uploaded images display */}
                    {uploadedMediaItems.length > 0 && (
                      <div className="space-y-2 pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">
                            Uploaded Images ({uploadedMediaItems.length})
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {selectedMediaIds.length} selected for automation
                          </span>
                        </div>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1 border rounded-lg">
                          {uploadedMediaItems.map((item) => {
                            const isSelected = selectedMediaIds.includes(item.id);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => toggleMediaSelection(item.id)}
                                className={cn(
                                  'relative aspect-square rounded-lg overflow-hidden border-2 transition-all group',
                                  isSelected
                                    ? 'border-primary ring-2 ring-primary/20'
                                    : 'border-border opacity-70 hover:opacity-100'
                                )}
                              >
                                <img
                                  src={item.thumbnailUrl || item.url}
                                  alt={item.filename}
                                  className="h-full w-full object-cover"
                                />
                                {isSelected && (
                                  <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow">
                                    <Check className="h-3 w-3 stroke-[3]" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </ConditionalBlock>
              )}

              {/* AI GENERATE */}
              {mediaSource === 'AI_GENERATE' && (
                <ConditionalBlock>
                  <ToggleRow label={t('automation.builder.generateFeaturedImage')} checked={generateFeaturedImage} onChange={setGenerateFeaturedImage} />
                  <ToggleRow label={t('automation.builder.generateSectionImages')} checked={generateSectionImages} onChange={setGenerateSectionImages} />
                  {(generateFeaturedImage || generateSectionImages) && (
                    <>
                      {/* Row 1: Number of images, Image style, Aspect ratio */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                        <div className="space-y-2">
                          <FieldRow label={t('automation.builder.numberOfImages')}>
                            <Select value={imageCount} onValueChange={setImageCount}>
                              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1</SelectItem>
                                <SelectItem value="2">2</SelectItem>
                                <SelectItem value="3">3</SelectItem>
                                <SelectItem value="5">5</SelectItem>
                                <SelectItem value="Custom">{t('automation.builder.custom')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </FieldRow>
                          {imageCount === 'Custom' && (
                            <FieldRow label={t('automation.builder.customCount')}>
                              <Input
                                type="number"
                                value={customImageCount}
                                onChange={(e) => setCustomImageCount(e.target.value)}
                                placeholder="7"
                                className="h-9 w-full"
                                min="1"
                              />
                            </FieldRow>
                          )}
                        </div>

                        <div className="space-y-2">
                          <FieldRow label={t('automation.builder.imageStyle')}>
                            <Select value={imageStyle} onValueChange={setImageStyle}>
                              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Realistic">{t('automation.builder.imageStyleRealistic')}</SelectItem>
                                <SelectItem value="Illustration">{t('automation.builder.imageStyleIllustration')}</SelectItem>
                                <SelectItem value="3D">{t('automation.builder.imageStyle3d')}</SelectItem>
                                <SelectItem value="Minimal">{t('automation.builder.imageStyleMinimal')}</SelectItem>
                                <SelectItem value="Professional">{t('automation.builder.imageStyleProfessional')}</SelectItem>
                                <SelectItem value="Editorial">{t('automation.builder.imageStyleEditorial')}</SelectItem>
                                <SelectItem value="Custom">{t('automation.builder.custom')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </FieldRow>
                          {imageStyle === 'Custom' && (
                            <FieldRow label={t('automation.builder.describeImageStyle')}>
                              <Input
                                value={customImageStyle}
                                onChange={(e) => setCustomImageStyle(e.target.value)}
                                placeholder={t('automation.builder.describeImageStylePlaceholder')}
                                className="h-9 w-full"
                              />
                            </FieldRow>
                          )}
                        </div>

                        <div className="space-y-2">
                          <FieldRow label={t('automation.builder.aspectRatio')}>
                            <Select value={aspectRatio} onValueChange={setAspectRatio}>
                              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="16:9">{t('automation.builder.aspect16x9')}</SelectItem>
                                <SelectItem value="4:3">{t('automation.builder.aspect4x3')}</SelectItem>
                                <SelectItem value="1:1">{t('automation.builder.aspect1x1')}</SelectItem>
                                <SelectItem value="3:4">{t('automation.builder.aspect3x4')}</SelectItem>
                                <SelectItem value="9:16">{t('automation.builder.aspect9x16')}</SelectItem>
                                <SelectItem value="Custom">{t('automation.builder.custom')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </FieldRow>
                          {aspectRatio === 'Custom' && (
                            <FieldRow label={t('automation.builder.customRatio')}>
                              <Input
                                value={customAspectRatio}
                                onChange={(e) => setCustomAspectRatio(e.target.value)}
                                placeholder="21:9"
                                className="h-9 w-full"
                              />
                            </FieldRow>
                          )}
                        </div>
                      </div>

                      {/* Row 2: Image generation tone */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                        <div className="space-y-2">
                          <FieldRow label={t('automation.builder.imageGenerationTone')}>
                            <Select value={imageTone} onValueChange={setImageTone}>
                              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Modern">{t('automation.builder.imageToneModern')}</SelectItem>
                                <SelectItem value="Professional">{t('automation.builder.imageStyleProfessional')}</SelectItem>
                                <SelectItem value="Minimal">{t('automation.builder.imageStyleMinimal')}</SelectItem>
                                <SelectItem value="Creative">{t('automation.builder.imageToneCreative')}</SelectItem>
                                <SelectItem value="Premium">{t('automation.builder.imageTonePremium')}</SelectItem>
                                <SelectItem value="Custom">{t('automation.builder.custom')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </FieldRow>
                          {imageTone === 'Custom' && (
                            <FieldRow label={t('automation.builder.describeImageTone')}>
                              <Input
                                value={customImageTone}
                                onChange={(e) => setCustomImageTone(e.target.value)}
                                placeholder={t('automation.builder.describeImageTonePlaceholder')}
                                className="h-9 w-full"
                              />
                            </FieldRow>
                          )}
                        </div>
                      </div>

                      {/* Row 3: Additional image instructions (optional) */}
                      <FieldRow label={t('automation.builder.additionalImageInstructions')} hint={t('automation.builder.hintOptional')}>
                        <Textarea
                          value={imagePromptInstructions}
                          onChange={(e) => setImagePromptInstructions(e.target.value)}
                          placeholder={t('automation.builder.additionalImageInstructionsPlaceholder')}
                          rows={3}
                          className="text-sm resize-y w-full"
                        />
                      </FieldRow>
                    </>
                  )}
                </ConditionalBlock>
              )}

              {/* Subsection: Image Placement */}
              {mediaSource !== 'NONE' && (
                <div className="pt-4 border-t border-border/60 space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">{t('automation.builder.imagePlacement')}</Label>
                    <p className="text-[11px] text-muted-foreground">Select where images will appear within the generated article.</p>
                  </div>
                  <Select value={imagePlacement} onValueChange={(v) => setImagePlacement(v as ImagePlacement)}>
                    <SelectTrigger className="h-10 w-full sm:w-[320px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AI_AUTOMATIC">{t('automation.builder.placementAiAuto')}</SelectItem>
                      <SelectItem value="AFTER_INTRO">{t('automation.builder.placementAfterIntro')}</SelectItem>
                      <SelectItem value="BEFORE_FIRST_H2">{t('automation.builder.placementBeforeFirstH2')}</SelectItem>
                      <SelectItem value="AFTER_EACH_H2">{t('automation.builder.placementAfterEachH2')}</SelectItem>
                      <SelectItem value="MANUAL_MAPPING">{t('automation.builder.placementManualMapping')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* ─────────── STEP 4: ACTION ─────────── */}
          {step === 4 && (
            <div className="space-y-6">
              <SectionLabel icon={Send}>{t('automation.builder.finalAction')}</SectionLabel>
              <FieldRow label={t('automation.builder.finalActionQuestion')}>
                <Select
                  value={finalAction}
                  onValueChange={(val) => {
                    setFinalAction(val);
                    if (val === 'SCHEDULE') {
                      const d = publishDate || getTodayDateStringInTz(timezone);
                      const tVal = publishTime || '12:00';
                      if (!publishDate) setPublishDate(d);
                      if (!publishTime) setPublishTime(tVal);
                      validatePublicationSchedule(d, tVal, false);
                    } else {
                      setPublicationScheduleError(null);
                    }
                  }}
                >
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">{t('automation.builder.actionSaveAsDraft')}</SelectItem>
                    <SelectItem value="PUBLISH">{t('automation.builder.actionPublishImmediately')}</SelectItem>
                    <SelectItem value="SCHEDULE">{t('automation.builder.actionSchedule')}</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>

              {finalAction === 'SCHEDULE' && (
                <div className="space-y-3 p-4 rounded-xl border bg-muted/20">
                  <FieldRow label="Publication Schedule" hint={`Timezone: ${timezone}`}>
                    <PublishTimePicker
                      dateValue={publishDate}
                      onDateChange={(newDate) => {
                        setPublishDate(newDate);
                        validatePublicationSchedule(newDate, publishTime || '12:00', true);
                      }}
                      value={publishTime}
                      onChange={(newTime) => {
                        setPublishTime(newTime);
                        validatePublicationSchedule(publishDate || getTodayDateStringInTz(timezone), newTime, true);
                      }}
                      showDateInButton={true}
                      className={cn(
                        "w-full sm:w-[320px]",
                        publicationScheduleError && "border-red-500 focus:ring-red-500"
                      )}
                    />
                  </FieldRow>
                  {publicationScheduleError && (
                    <div className="flex items-center gap-1.5 p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-medium">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{publicationScheduleError}</span>
                    </div>
                  )}
                </div>
              )}
              <Separator />
              {/* Enhanced Workflow Preview */}
              <div className="rounded-xl border bg-gradient-to-br from-muted/40 to-muted/10 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('automation.builder.workflowPreview')}</p>
                </div>
                <div className="space-y-3">
                  {/* Trigger & Cadence */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/20 shrink-0">
                      <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="pt-0.5 flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {triggerType === 'SCHEDULED'
                          ? `Every ${frequency === 'DAILY' ? 'day' : frequency === 'WEEKLY' ? 'week' : frequency === 'MONTHLY' ? 'month' : frequency.toLowerCase()} at ${formatScheduleTimeTo12Hour(time)}`
                          : t('automation.builder.previewManualTrigger')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Timezone: <span className="font-mono text-[11px]">{timezone}</span> • Target: <span className="font-semibold text-foreground">{finalArticlesPerDay} articles/day</span>
                      </p>
                    </div>
                  </div>
                  <div className="ml-4 h-4 w-px bg-border" />

                  {/* Topic Mode & Research / Queue */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-900/20 shrink-0">
                      <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 font-medium">
                          {generationMode === 'AI_TOPIC_DISCOVERY' ? 'Mode A: AI Internet Research' : 'Mode B: My Topics / Manual List'}
                        </span>
                      </div>
                      <p className="text-sm font-medium mt-1">
                        {generationMode === 'AI_TOPIC_DISCOVERY'
                          ? `Niche: ${niche}${subNiches ? ` (${subNiches})` : ''}`
                          : `Queue: ${topicQueue.length} topic${topicQueue.length === 1 ? '' : 's'} registered`}
                      </p>
                      <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                        <span className="text-muted-foreground/60">Source / Engine</span>
                        <span className="text-muted-foreground">
                          {generationMode === 'AI_TOPIC_DISCOVERY' ? (
                            searchProviderInfo?.configured ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Live SERP Search ({searchProviderInfo.provider}) • {country || 'Global'} / {language}</span>
                            ) : (
                              <span>AI Topic Discovery • {country || 'Global'} / {language}</span>
                            )
                          ) : (
                            <span>
                              {topicQueue.filter(q => q.status === 'AVAILABLE').length} Available,{' '}
                              {topicQueue.filter(q => q.status === 'COMPLETED').length} Done,{' '}
                              {topicQueue.filter(q => q.status === 'FAILED').length} Failed
                              {allowReuseCompletedTopics ? ' (reuse enabled)' : ''}
                            </span>
                          )}
                        </span>
                        <span className="text-muted-foreground/60">{t('automation.builder.previewToneLabel')}</span>
                        <span className="text-muted-foreground">{tone === 'Custom' ? customTone : tone}</span>
                        <span className="text-muted-foreground/60">{t('automation.builder.previewLengthLabel')}</span>
                        <span className="text-muted-foreground">{contentLength === 'Custom' ? `${customWordCount} ${t('automation.builder.previewWordsUnit')}` : contentLength}</span>
                        <span className="text-muted-foreground/60">{t('automation.builder.previewStructureLabel')}</span>
                        <span className="text-muted-foreground">{structParts.join(' + ') || t('automation.builder.previewNone')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 h-4 w-px bg-border" />

                  {/* SEO + Media */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/20 shrink-0">
                      <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{t('automation.builder.previewSeoMedia')}</p>
                      <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                        <span className="text-muted-foreground/60">{t('automation.builder.previewSeoLabel')}</span>
                        <span className="text-muted-foreground">{seoParts.join(', ') || t('automation.builder.previewNone')}</span>
                        <span className="text-muted-foreground/60">{t('automation.builder.previewMediaLabel')}</span>
                        <span className="text-muted-foreground">{mediaPreview}</span>
                        <span className="text-muted-foreground/60">{t('automation.builder.previewPlacementLabel')}</span>
                        <span className="text-muted-foreground">{placementLabel}</span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 h-4 w-px bg-border" />

                  {/* Final Action */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20 shrink-0">
                      <Send className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="pt-1">
                      <p className="text-sm font-medium">
                        {finalAction === 'DRAFT'
                          ? t('automation.builder.actionSaveAsDraft')
                          : finalAction === 'PUBLISH'
                          ? t('automation.builder.actionPublishImmediately')
                          : `${t('automation.builder.actionSchedule')}: ${publishDate || 'TBD'}${publishTime ? ` at ${formatScheduleTimeTo12Hour(publishTime)}` : ''}`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer Navigation — integrated with the page, no container */}
      <div className="flex items-center justify-end gap-4 pt-1">
        {(step > (isGenerateMode ? 2 : 1)) && (
          <Button variant="ghost" onClick={() => setStep(step - 1)} className="gap-1.5 mr-auto">
            <ChevronLeft className="h-4 w-4" /> {t('automation.builder.backButton')}
          </Button>
        )}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">{isGenerateMode ? `${t('automation.builder.stepLabel')} ${step - 1} ${t('automation.builder.of3')}` : `${t('automation.builder.stepLabel')} ${step} ${t('automation.builder.of4')}`}</span>
          <Button variant="ghost" onClick={() => navigate(isGenerateMode ? targetContentMod : targetAutoMod)}>{t('automation.builder.cancel')}</Button>
          {step < 4 ? (
            <Button onClick={handleNextStep} disabled={!canProceed} className="gap-1.5">
              {t('automation.builder.next')} <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || generating || !canProceed} className="gap-1.5">
              {(createMutation.isPending || generating) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isGenerateMode ? (generating ? t('automation.builder.generating') : t('automation.builder.generateArticleButton')) : isEditMode ? 'Update Automation' : t('automation.builder.createAutomationButton')}
            </Button>
          )}
        </div>
      </div>

      <CreateFolderDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        onFolderCreated={(newFolderId) => {
          queryClient.invalidateQueries({ queryKey: ['media-folders'] });
          setSelectedFolderId(newFolderId);
        }}
      />
    </div>
  );
}
