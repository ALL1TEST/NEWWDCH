'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Loader2, Zap, FileText, Sparkles, Send, ChevronRight, ChevronLeft, X, Search, FolderOpen, Upload, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { postApi, getApi } from '@/lib/api-client';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// -------------------- Types --------------------

type KeywordSource = 'MANUAL' | 'SAVED' | 'AI_GENERATE';
type MediaSource = 'NONE' | 'MEDIA_LIBRARY' | 'AI_GENERATE';
type ImagePlacement = 'AI_AUTOMATIC' | 'AFTER_INTRO' | 'BEFORE_FIRST_H2' | 'AFTER_EACH_H2' | 'MANUAL_MAPPING';

interface SavedKeyword { id: string; name: string; slug?: string; color?: string; }
interface MediaFolder { id: string; name: string; }
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

// -------------------- Component --------------------

export function AutomationBuilderPage() {
  const navigate = useNavigationStore((s) => s.navigate);
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const keywordFileRef = useRef<HTMLInputElement>(null);

  // ── State (same as before, no logic changes) ──
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<'MANUAL' | 'SCHEDULED'>('SCHEDULED');
  const [frequency, setFrequency] = useState('DAILY');
  const [time, setTime] = useState('09:00');
  const [topic, setTopic] = useState('');
  const [keywordSource, setKeywordSource] = useState<KeywordSource>('MANUAL');
  const [primaryKeyword, setPrimaryKeyword] = useState('');
  const [secondaryKeywords, setSecondaryKeywords] = useState('');
  const [semanticKeywords, setSemanticKeywords] = useState('');
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

  // ── Queries ──
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
    queryKey: ['media-folders'], queryFn: () => getApi('/api/media-folders?pageSize=100'),
    enabled: mediaSource === 'MEDIA_LIBRARY' && step === 3, staleTime: 60_000,
  });
  const mediaFolders: MediaFolder[] = useMemo(() => { const d = foldersData as any; return Array.isArray(d) ? d : d?.data ?? []; }, [foldersData]);

  const { data: mediaItemsData } = useQuery({
    queryKey: ['media-folder-items', selectedFolderId], queryFn: () => getApi(`/api/media?folderId=${selectedFolderId}&pageSize=50`),
    enabled: mediaSource === 'MEDIA_LIBRARY' && !!selectedFolderId && step === 3, staleTime: 30_000,
  });
  const mediaItems: MediaItem[] = useMemo(() => { const d = mediaItemsData as any; return Array.isArray(d) ? d : d?.data ?? []; }, [mediaItemsData]);

  const toggleSavedKeyword = (id: string) => setSelectedSavedKeywordIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleMediaSelection = (id: string) => setSelectedMediaIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleKeywordFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (file.name.endsWith('.csv')) {
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length > 1) { const [, ...rows] = lines; for (const row of rows) { const cols = row.split(',').map(c => c.trim().replace(/^"|"$/g, '')); if (cols[0]) { postApi('/api/tags', { name: cols[0] }).then(() => { queryClient.invalidateQueries({ queryKey: ['saved-keywords'] }); toast.success(`Imported: ${cols[0]}`); }).catch(() => {}); } } }
      } else if (file.name.endsWith('.txt')) { const match = text.match(/Primary Keyword:\s*(.+)/i); if (match?.[1]) { const kw = match[1].trim(); postApi('/api/tags', { name: kw }).then(() => { queryClient.invalidateQueries({ queryKey: ['saved-keywords'] }); toast.success(`Imported: ${kw}`); }).catch(() => {}); } }
    };
    reader.readAsText(file); if (keywordFileRef.current) keywordFileRef.current.value = '';
  };

  // ── Create mutation (same logic) ──
  const createMutation = useMutation({
    mutationFn: () => {
      const finalAiKeywordCount = aiKeywordCount === 'Custom' ? parseInt(aiKeywordCustomCount) || 25 : parseInt(aiKeywordCount);
      const finalContentLength = contentLength === 'Custom' ? `Custom (${customWordCount} words)` : contentLength;
      const finalTone = tone === 'Custom' ? customTone : tone;
      const finalImageCount = imageCount === 'Custom' ? parseInt(customImageCount) || 3 : parseInt(imageCount);
      const finalImageStyle = imageStyle === 'Custom' ? customImageStyle : imageStyle;
      const finalAspectRatio = aspectRatio === 'Custom' ? customAspectRatio : aspectRatio;
      const finalImageTone = imageTone === 'Custom' ? customImageTone : imageTone;
      const workflowConfig = JSON.stringify({
        contentGeneration: { topic, keywordSource, primaryKeyword: keywordSource === 'MANUAL' ? primaryKeyword : undefined, secondaryKeywords: keywordSource === 'MANUAL' ? secondaryKeywords : undefined, semanticKeywords: keywordSource === 'MANUAL' ? semanticKeywords : undefined, savedKeywordIds: keywordSource === 'SAVED' ? selectedSavedKeywordIds : undefined, aiKeywordCount: keywordSource === 'AI_GENERATE' ? finalAiKeywordCount : undefined, aiKeywordTone: keywordSource === 'AI_GENERATE' ? (aiKeywordTone === 'Custom' ? aiKeywordCustomTone : aiKeywordTone) : undefined, tone: finalTone, contentLength: finalContentLength, articleStructure: { introduction: structIntro, tableOfContents: structToc, h2Sections: structH2, h3Subsections: structH3, faqSection: structFaq, conclusion: structConclusion } },
        seoProcessing: { generateSeoTitle, generateMetaDescription, generateSlug, optimizePrimaryKeyword, includeSecondaryKeywords, includeSemanticKeywords, generateFaq, generateFaqSchema, generateArticleSchema },
        media: { source: mediaSource, folderId: mediaSource === 'MEDIA_LIBRARY' ? selectedFolderId : undefined, selectedMediaIds: mediaSource === 'MEDIA_LIBRARY' && selectedMediaIds.length > 0 ? selectedMediaIds : undefined, imageSelectionMode: mediaSource === 'MEDIA_LIBRARY' ? imageSelectionMode : undefined, generateFeaturedImage: mediaSource === 'AI_GENERATE' ? generateFeaturedImage : undefined, generateSectionImages: mediaSource === 'AI_GENERATE' ? generateSectionImages : undefined, imageCount: mediaSource === 'AI_GENERATE' ? finalImageCount : undefined, imageStyle: mediaSource === 'AI_GENERATE' ? finalImageStyle : undefined, aspectRatio: mediaSource === 'AI_GENERATE' ? finalAspectRatio : undefined, imageTone: mediaSource === 'AI_GENERATE' ? finalImageTone : undefined, imagePromptInstructions: mediaSource === 'AI_GENERATE' ? imagePromptInstructions : undefined, placement: mediaSource !== 'NONE' ? imagePlacement : undefined },
        finalAction: { action: finalAction, publishDate: finalAction === 'SCHEDULE' ? publishDate : undefined, publishTime: finalAction === 'SCHEDULE' ? publishTime : undefined },
      });
      return postApi('/api/automations', { name, description, triggerType, scheduleConfig: JSON.stringify({ frequency, time }), workflowConfig });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['automations'] }); toast.success('Automation created'); navigate('automation'); },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const steps = [{ num: 1, label: 'Trigger', icon: Zap, desc: 'When to run' }, { num: 2, label: 'Content', icon: FileText, desc: 'What to generate' }, { num: 3, label: 'SEO + Media', icon: Sparkles, desc: 'Optimization & images' }, { num: 4, label: 'Action', icon: Send, desc: 'Final output' }];

  const canProceed = useMemo(() => {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) { if (!topic.trim()) return false; if (keywordSource === 'MANUAL' && !primaryKeyword.trim()) return false; if (keywordSource === 'SAVED' && selectedSavedKeywordIds.length === 0) return false; if (keywordSource === 'AI_GENERATE' && aiKeywordCount === 'Custom' && (!aiKeywordCustomCount || parseInt(aiKeywordCustomCount) < 1)) return false; if (tone === 'Custom' && !customTone.trim()) return false; if (contentLength === 'Custom' && (!customWordCount || parseInt(customWordCount) < 1)) return false; return true; }
    if (step === 3) { if (mediaSource === 'MEDIA_LIBRARY' && selectedMediaIds.length === 0 && imageSelectionMode !== 'ALL') return false; if (mediaSource === 'AI_GENERATE') { if (!generateFeaturedImage && !generateSectionImages) return false; if (imageCount === 'Custom' && (!customImageCount || parseInt(customImageCount) < 1)) return false; if (imageStyle === 'Custom' && !customImageStyle.trim()) return false; if (aspectRatio === 'Custom' && !customAspectRatio.trim()) return false; if (imageTone === 'Custom' && !customImageTone.trim()) return false; } return true; }
    return true;
  }, [step, name, topic, keywordSource, primaryKeyword, selectedSavedKeywordIds, aiKeywordCount, aiKeywordCustomCount, tone, customTone, contentLength, customWordCount, mediaSource, selectedMediaIds, imageSelectionMode, generateFeaturedImage, generateSectionImages, imageCount, customImageCount, imageStyle, customImageStyle, aspectRatio, customAspectRatio, imageTone, customImageTone]);

  // ── Preview helpers ──
  const kwPreview = keywordSource === 'MANUAL' ? (primaryKeyword || '—') : keywordSource === 'SAVED' ? `${selectedSavedKeywordIds.length} saved` : `AI: ${aiKeywordCount === 'Custom' ? aiKeywordCustomCount : aiKeywordCount} (${aiKeywordTone === 'Custom' ? aiKeywordCustomTone : aiKeywordTone})`;
  const structParts = [structIntro && 'Intro', structToc && 'TOC', structH2 && 'H2', structH3 && 'H3', structFaq && 'FAQ', structConclusion && 'Conclusion'].filter(Boolean);
  const seoParts = [generateSeoTitle && 'Title', generateMetaDescription && 'Meta', generateSlug && 'Slug', optimizePrimaryKeyword && 'Primary kw', includeSecondaryKeywords && 'Secondary', includeSemanticKeywords && 'Semantic', generateFaq && 'FAQ', generateFaqSchema && 'FAQ schema', generateArticleSchema && 'Article schema'].filter(Boolean);
  const mediaPreview = mediaSource === 'NONE' ? 'None' : mediaSource === 'MEDIA_LIBRARY' ? `Library (${selectedMediaIds.length || 'auto'}, ${imageSelectionMode})` : `AI (${imageCount === 'Custom' ? customImageCount : imageCount}, ${imageStyle === 'Custom' ? customImageStyle : imageStyle})`;
  const placementLabel = { AI_AUTOMATIC: 'AI Auto', AFTER_INTRO: 'After Intro', BEFORE_FIRST_H2: 'Before H2', AFTER_EACH_H2: 'After each H2', MANUAL_MAPPING: 'Manual' }[imagePlacement];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Page Header — integrated, no rectangle */}
      <div>
        <button
          type="button"
          onClick={() => navigate('automation')}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Automations
        </button>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">New Automation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up your automated publishing workflow in 4 simple steps.
        </p>
      </div>

      {/* Stepper */}
      <div>
        <div className="flex items-center">
          {steps.map((s, i) => (
            <React.Fragment key={s.num}>
              <button type="button" onClick={() => { if (s.num < step || canProceed) setStep(s.num); }} className={cn('flex items-center gap-2.5 transition-all', s.num < step ? 'cursor-pointer' : s.num === step ? '' : 'opacity-40 cursor-not-allowed')}>
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all shrink-0', s.num < step ? 'bg-primary text-primary-foreground' : s.num === step ? 'bg-primary text-primary-foreground ring-4 ring-primary/15' : 'bg-muted text-muted-foreground')}>
                  {s.num < step ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                </div>
                <div className="hidden sm:block text-left">
                  <p className={cn('text-xs font-semibold leading-tight', s.num <= step ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{s.desc}</p>
                </div>
              </button>
              {i < steps.length - 1 && <div className={cn('h-px flex-1 mx-2 transition-colors', s.num < step ? 'bg-primary' : 'bg-border')} />}
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
              <SectionLabel icon={Zap}>Trigger Configuration</SectionLabel>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Automation Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Daily SEO Article" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." rows={2} className="resize-none" />
              </div>
              <Separator />
              <FieldRow label="Trigger Type">
                <Select value={triggerType} onValueChange={(v) => setTriggerType(v as 'MANUAL' | 'SCHEDULED')}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANUAL">Manual — Run on demand</SelectItem>
                    <SelectItem value="SCHEDULED">Scheduled — Run automatically</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              {triggerType === 'SCHEDULED' && (
                <div className="grid grid-cols-2 gap-4">
                  <FieldRow label="Frequency">
                    <Select value={frequency} onValueChange={setFrequency}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DAILY">Daily</SelectItem><SelectItem value="WEEKLY">Weekly</SelectItem><SelectItem value="MONTHLY">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>
                  <FieldRow label="Time">
                    <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-10" />
                  </FieldRow>
                </div>
              )}
            </div>
          )}

          {/* ─────────── STEP 2: CONTENT ─────────── */}
          {step === 2 && (
            <div className="space-y-6">
              <SectionLabel icon={FileText}>Content Generation</SectionLabel>
              <FieldRow label="Article Topic *">
                <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., Productivity tips for remote workers" className="h-10" />
              </FieldRow>
              <Separator />
              <FieldRow label="Keyword Source">
                <Select value={keywordSource} onValueChange={(v) => setKeywordSource(v as KeywordSource)}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANUAL">Manual Keywords</SelectItem><SelectItem value="SAVED">Saved Keywords</SelectItem><SelectItem value="AI_GENERATE">AI Generate Keywords</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              {keywordSource === 'MANUAL' && (
                <ConditionalBlock>
                  <FieldRow label="Primary Keyword *"><Input value={primaryKeyword} onChange={(e) => setPrimaryKeyword(e.target.value)} placeholder="e.g., remote work productivity" className="h-9" /></FieldRow>
                  <FieldRow label="Secondary Keywords" hint="comma-separated"><Input value={secondaryKeywords} onChange={(e) => setSecondaryKeywords(e.target.value)} placeholder="remote work, work from home" className="h-9" /></FieldRow>
                  <FieldRow label="Semantic / Related Keywords" hint="comma-separated"><Input value={semanticKeywords} onChange={(e) => setSemanticKeywords(e.target.value)} placeholder="focus, collaboration, digital workplace" className="h-9" /></FieldRow>
                </ConditionalBlock>
              )}
              {keywordSource === 'SAVED' && (
                <ConditionalBlock>
                  {/* Search + Import */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input value={savedKeywordSearch} onChange={(e) => setSavedKeywordSearch(e.target.value)} placeholder="Search saved keywords..." className="pl-8 h-9 text-sm" />
                    </div>
                    <input ref={keywordFileRef} type="file" accept=".txt,.csv" className="hidden" onChange={handleKeywordFileImport} />
                    <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0" onClick={() => keywordFileRef.current?.click()}><Upload className="h-3.5 w-3.5" />Import</Button>
                  </div>
                  {/* Selected keywords chips */}
                  {selectedSavedKeywordIds.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">{selectedSavedKeywordIds.length} selected</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedSavedKeywordIds.map(id => { const kw = allSavedKeywords.find(k => k.id === id); return <Badge key={id} variant="secondary" className="gap-1 text-xs pr-1 py-1">{kw?.name ?? id}<button type="button" onClick={() => toggleSavedKeyword(id)} className="hover:text-destructive"><X className="h-3 w-3" /></button></Badge>; })}
                      </div>
                    </div>
                  )}
                  {/* Keyword list — real-time filtered, selected items highlighted */}
                  <div className="max-h-56 overflow-y-auto rounded-lg border bg-card">
                    {allSavedKeywords.length === 0 ? (
                      <div className="p-6 text-center">
                        <p className="text-sm font-medium text-muted-foreground">No saved keywords found</p>
                        <p className="text-xs text-muted-foreground mt-1">Import a .txt/.csv file or save keywords from the Tags page first.</p>
                      </div>
                    ) : savedKeywords.length === 0 && savedKeywordSearch.trim() ? (
                      <div className="p-6 text-center">
                        <p className="text-sm font-medium text-muted-foreground">No matching keywords found</p>
                        <p className="text-xs text-muted-foreground mt-1">Try a different search term.</p>
                      </div>
                    ) : (
                      savedKeywords.map(kw => {
                        const isSelected = selectedSavedKeywordIds.includes(kw.id);
                        return (
                          <button key={kw.id} type="button" onClick={() => toggleSavedKeyword(kw.id)} className={cn('w-full flex items-center justify-between text-left px-3 py-2.5 text-sm transition-colors border-b last:border-0', isSelected ? 'bg-primary/5' : 'hover:bg-muted/50')}>
                            <span className={cn(isSelected && 'font-medium text-primary')}>{kw.name}</span>
                            {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </ConditionalBlock>
              )}
              {keywordSource === 'AI_GENERATE' && (
                <ConditionalBlock>
                  <div className="grid grid-cols-2 gap-4">
                    <FieldRow label="Number of keywords">
                      <Select value={aiKeywordCount} onValueChange={setAiKeywordCount}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="3">3 keywords</SelectItem><SelectItem value="5">5 keywords</SelectItem><SelectItem value="10">10 keywords</SelectItem><SelectItem value="Custom">Custom</SelectItem></SelectContent></Select>
                    </FieldRow>
                    {aiKeywordCount === 'Custom' && <FieldRow label="Custom count"><Input type="number" value={aiKeywordCustomCount} onChange={(e) => setAiKeywordCustomCount(e.target.value)} placeholder="25" className="h-9" min="1" /></FieldRow>}
                  </div>
                  <FieldRow label="Keyword Generation Tone / Intent">
                    <Select value={aiKeywordTone} onValueChange={setAiKeywordTone}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Informational">Informational</SelectItem><SelectItem value="Commercial">Commercial</SelectItem><SelectItem value="Transactional">Transactional</SelectItem><SelectItem value="Navigational">Navigational</SelectItem><SelectItem value="Conversational">Conversational</SelectItem><SelectItem value="Custom">Custom</SelectItem></SelectContent></Select>
                  </FieldRow>
                  {aiKeywordTone === 'Custom' && <FieldRow label="Describe the keyword generation style"><Textarea value={aiKeywordCustomTone} onChange={(e) => setAiKeywordCustomTone(e.target.value)} placeholder='e.g., "Generate long-tail keywords for beginners with low competition."' rows={2} className="text-sm resize-none" /></FieldRow>}
                </ConditionalBlock>
              )}
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <FieldRow label="Article Tone">
                  <Select value={tone} onValueChange={setTone}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Professional">Professional</SelectItem><SelectItem value="Informative">Informative</SelectItem><SelectItem value="Casual">Casual</SelectItem><SelectItem value="Friendly">Friendly</SelectItem><SelectItem value="Expert">Expert</SelectItem><SelectItem value="Conversational">Conversational</SelectItem><SelectItem value="Custom">Custom</SelectItem></SelectContent></Select>
                </FieldRow>
                <FieldRow label="Content Length">
                  <Select value={contentLength} onValueChange={setContentLength}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Short (300-600 words)">Short (300-600)</SelectItem><SelectItem value="Medium (800-1200 words)">Medium (800-1200)</SelectItem><SelectItem value="Long (1500-2500 words)">Long (1500-2500)</SelectItem><SelectItem value="Comprehensive (3000+ words)">Comprehensive (3000+)</SelectItem><SelectItem value="Custom">Custom</SelectItem></SelectContent></Select>
                </FieldRow>
              </div>
              {tone === 'Custom' && <FieldRow label="Describe the writing style"><Textarea value={customTone} onChange={(e) => setCustomTone(e.target.value)} placeholder='e.g., "Write in a simple, beginner-friendly style with practical examples."' rows={2} className="text-sm resize-none" /></FieldRow>}
              {contentLength === 'Custom' && <FieldRow label="Target Word Count"><Input type="number" value={customWordCount} onChange={(e) => setCustomWordCount(e.target.value)} placeholder="2200" className="h-9 w-32" min="1" /></FieldRow>}
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-1">Article Structure</h3>
                <p className="text-xs text-muted-foreground mb-3">Control which sections the AI generates.</p>
                <div className="grid grid-cols-2 gap-1 rounded-lg border bg-card/50 overflow-hidden">
                  {[{ label: 'Introduction', val: structIntro, set: setStructIntro }, { label: 'Table of Contents', val: structToc, set: setStructToc }, { label: 'H2 Sections', val: structH2, set: setStructH2 }, { label: 'H3 Subsections', val: structH3, set: setStructH3 }, { label: 'FAQ Section', val: structFaq, set: setStructFaq }, { label: 'Conclusion', val: structConclusion, set: setStructConclusion }].map((item, i, arr) => (
                    <div key={item.label} className={cn('flex items-center justify-between px-3 py-2.5', i < arr.length - 2 && 'border-b', i % 2 === 0 && 'border-r border-border/50')}>
                      <Label className="text-sm cursor-pointer" onClick={() => item.set(!item.val)}>{item.label}</Label>
                      <Switch checked={item.val} onCheckedChange={item.set} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─────────── STEP 3: SEO + MEDIA ─────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <SectionLabel icon={Sparkles}>SEO Optimization</SectionLabel>
              <div className="rounded-lg border bg-card/50 overflow-hidden">
                {[{ label: 'Generate SEO optimized title', desc: 'AI creates a keyword-rich, readable title', val: generateSeoTitle, set: setGenerateSeoTitle }, { label: 'Generate meta description', desc: '140-160 chars, includes primary keyword', val: generateMetaDescription, set: setGenerateMetaDescription }, { label: 'Generate URL slug', desc: 'Clean, lowercase, hyphen-separated', val: generateSlug, set: setGenerateSlug }, { label: 'Optimize for primary keyword', desc: 'Natural placement in title, intro, H2, body', val: optimizePrimaryKeyword, set: setOptimizePrimaryKeyword }, { label: 'Include secondary keywords naturally', val: includeSecondaryKeywords, set: setIncludeSecondaryKeywords }, { label: 'Include semantic keywords', desc: 'Related entities for topical coverage', val: includeSemanticKeywords, set: setIncludeSemanticKeywords }, { label: 'Generate FAQ section', desc: 'Relevant Q&A from topic + keywords', val: generateFaq, set: setGenerateFaq }, { label: 'Generate FAQ schema (JSON-LD)', val: generateFaqSchema, set: setGenerateFaqSchema }, { label: 'Generate Article schema (JSON-LD)', val: generateArticleSchema, set: setGenerateArticleSchema }].map(item => <ToggleRow key={item.label} label={item.label} description={item.desc} checked={item.val} onChange={item.set} />)}
              </div>
              <Separator />
              <SectionLabel icon={FolderOpen}>Media Source</SectionLabel>
              <FieldRow label="Source">
                <Select value={mediaSource} onValueChange={(v) => setMediaSource(v as MediaSource)}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">No Images</SelectItem><SelectItem value="MEDIA_LIBRARY">Use Media Library</SelectItem><SelectItem value="AI_GENERATE">AI Generate Images</SelectItem></SelectContent></Select>
              </FieldRow>
              {mediaSource === 'MEDIA_LIBRARY' && (
                <ConditionalBlock>
                  <FieldRow label="Select Folder">
                    <Select value={selectedFolderId} onValueChange={(v) => { setSelectedFolderId(v); setSelectedMediaIds([]); }}><SelectTrigger className="h-9"><SelectValue placeholder="Choose folder" /></SelectTrigger><SelectContent>{mediaFolders.length === 0 ? <SelectItem value="_none" disabled>No folders</SelectItem> : mediaFolders.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent></Select>
                  </FieldRow>
                  {selectedFolderId && mediaItems.length > 0 && (
                    <>
                      <FieldRow label="Image Selection">
                        <Select value={imageSelectionMode} onValueChange={(v) => setImageSelectionMode(v as 'ALL' | 'RANDOM' | 'AI_CHOOSE')}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Use all images</SelectItem><SelectItem value="RANDOM">Random selection</SelectItem><SelectItem value="AI_CHOOSE">AI choose best images</SelectItem></SelectContent></Select>
                      </FieldRow>
                      {imageSelectionMode !== 'ALL' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground">Select images</Label>
                          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-40 overflow-y-auto">
                            {mediaItems.map(item => <button key={item.id} type="button" onClick={() => toggleMediaSelection(item.id)} className={cn('relative aspect-square rounded-lg overflow-hidden border-2 transition-all', selectedMediaIds.includes(item.id) ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50')}><img src={item.thumbnailUrl || item.url} alt={item.filename} className="h-full w-full object-cover" /></button>)}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </ConditionalBlock>
              )}
              {mediaSource === 'AI_GENERATE' && (
                <ConditionalBlock>
                  <ToggleRow label="Generate featured image" checked={generateFeaturedImage} onChange={setGenerateFeaturedImage} />
                  <ToggleRow label="Generate images for article sections" checked={generateSectionImages} onChange={setGenerateSectionImages} />
                  {(generateFeaturedImage || generateSectionImages) && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <FieldRow label="Number of images"><Select value={imageCount} onValueChange={setImageCount}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem><SelectItem value="3">3</SelectItem><SelectItem value="5">5</SelectItem><SelectItem value="Custom">Custom</SelectItem></SelectContent></Select></FieldRow>
                        {imageCount === 'Custom' && <FieldRow label="Custom count"><Input type="number" value={customImageCount} onChange={(e) => setCustomImageCount(e.target.value)} placeholder="7" className="h-9" min="1" /></FieldRow>}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FieldRow label="Image style"><Select value={imageStyle} onValueChange={setImageStyle}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Realistic">Realistic</SelectItem><SelectItem value="Illustration">Illustration</SelectItem><SelectItem value="3D">3D</SelectItem><SelectItem value="Minimal">Minimal</SelectItem><SelectItem value="Professional">Professional</SelectItem><SelectItem value="Editorial">Editorial</SelectItem><SelectItem value="Custom">Custom</SelectItem></SelectContent></Select></FieldRow>
                        <FieldRow label="Aspect ratio"><Select value={aspectRatio} onValueChange={setAspectRatio}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="16:9">16:9 Landscape</SelectItem><SelectItem value="4:3">4:3 Landscape</SelectItem><SelectItem value="1:1">1:1 Square</SelectItem><SelectItem value="3:4">3:4 Portrait</SelectItem><SelectItem value="9:16">9:16 Vertical</SelectItem><SelectItem value="Custom">Custom</SelectItem></SelectContent></Select></FieldRow>
                      </div>
                      {imageStyle === 'Custom' && <FieldRow label="Describe image style"><Input value={customImageStyle} onChange={(e) => setCustomImageStyle(e.target.value)} placeholder='e.g., "Modern flat illustration with soft gradients."' className="h-9" /></FieldRow>}
                      {aspectRatio === 'Custom' && <FieldRow label="Custom ratio"><Input value={customAspectRatio} onChange={(e) => setCustomAspectRatio(e.target.value)} placeholder="21:9" className="h-9 w-24" /></FieldRow>}
                      <FieldRow label="Image generation tone"><Select value={imageTone} onValueChange={setImageTone}><SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Modern">Modern</SelectItem><SelectItem value="Professional">Professional</SelectItem><SelectItem value="Minimal">Minimal</SelectItem><SelectItem value="Creative">Creative</SelectItem><SelectItem value="Premium">Premium</SelectItem><SelectItem value="Custom">Custom</SelectItem></SelectContent></Select></FieldRow>
                      {imageTone === 'Custom' && <FieldRow label="Describe image tone"><Input value={customImageTone} onChange={(e) => setCustomImageTone(e.target.value)} placeholder="Warm, cinematic lighting" className="h-9" /></FieldRow>}
                      <FieldRow label="Additional image instructions" hint="optional"><Textarea value={imagePromptInstructions} onChange={(e) => setImagePromptInstructions(e.target.value)} placeholder='e.g., "Do not include text, logos, or watermarks."' rows={2} className="text-sm resize-none" /></FieldRow>
                    </>
                  )}
                </ConditionalBlock>
              )}
              {mediaSource !== 'NONE' && (
                <>
                  <Separator />
                  <FieldRow label="Image Placement">
                    <Select value={imagePlacement} onValueChange={(v) => setImagePlacement(v as ImagePlacement)}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AI_AUTOMATIC">AI Automatic — Smart natural placement</SelectItem><SelectItem value="AFTER_INTRO">After Introduction</SelectItem><SelectItem value="BEFORE_FIRST_H2">Before First H2</SelectItem><SelectItem value="AFTER_EACH_H2">After Each Major H2</SelectItem><SelectItem value="MANUAL_MAPPING">Manual Mapping</SelectItem></SelectContent></Select>
                  </FieldRow>
                </>
              )}
            </div>
          )}

          {/* ─────────── STEP 4: ACTION ─────────── */}
          {step === 4 && (
            <div className="space-y-6">
              <SectionLabel icon={Send}>Final Action</SectionLabel>
              <FieldRow label="What should happen after the article is generated?">
                <Select value={finalAction} onValueChange={setFinalAction}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DRAFT">Save as Draft</SelectItem><SelectItem value="REVIEW">Send to Review</SelectItem><SelectItem value="PUBLISH">Publish Immediately</SelectItem><SelectItem value="SCHEDULE">Schedule for Publishing</SelectItem></SelectContent></Select>
              </FieldRow>
              {finalAction === 'SCHEDULE' && (
                <div className="grid grid-cols-2 gap-4">
                  <FieldRow label="Publication Date"><Input type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} className="h-10" /></FieldRow>
                  <FieldRow label="Publication Time"><Input type="time" value={publishTime} onChange={(e) => setPublishTime(e.target.value)} className="h-10" /></FieldRow>
                </div>
              )}
              <Separator />
              {/* Enhanced Workflow Preview */}
              <div className="rounded-xl border bg-gradient-to-br from-muted/40 to-muted/10 p-5 space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Workflow Preview</p>
                <div className="space-y-3">
                  {/* Trigger */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/20 shrink-0">
                      <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="pt-1">
                      <p className="text-sm font-medium">{triggerType === 'SCHEDULED' ? `Every ${frequency.toLowerCase()} at ${time}` : 'Manual trigger'}</p>
                    </div>
                  </div>
                  <div className="ml-4 h-4 w-px bg-border" />

                  {/* Content */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-900/20 shrink-0">
                      <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{topic || 'Untitled'}</p>
                      <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                        <span className="text-muted-foreground/60">Keywords</span>
                        <span className="text-muted-foreground">{kwPreview}</span>
                        <span className="text-muted-foreground/60">Tone</span>
                        <span className="text-muted-foreground">{tone === 'Custom' ? customTone : tone}</span>
                        <span className="text-muted-foreground/60">Length</span>
                        <span className="text-muted-foreground">{contentLength === 'Custom' ? `${customWordCount} words` : contentLength}</span>
                        <span className="text-muted-foreground/60">Structure</span>
                        <span className="text-muted-foreground">{structParts.join(' + ') || 'None'}</span>
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
                      <p className="text-sm font-medium">SEO + Media</p>
                      <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                        <span className="text-muted-foreground/60">SEO</span>
                        <span className="text-muted-foreground">{seoParts.join(', ') || 'None'}</span>
                        <span className="text-muted-foreground/60">Media</span>
                        <span className="text-muted-foreground">{mediaPreview}</span>
                        <span className="text-muted-foreground/60">Placement</span>
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
                      <p className="text-sm font-medium">{finalAction === 'DRAFT' ? 'Save as Draft' : finalAction === 'REVIEW' ? 'Send to Review' : finalAction === 'PUBLISH' ? 'Publish Immediately' : `Schedule: ${publishDate || 'TBD'} ${publishTime || ''}`}</p>
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
        {step > 1 && (
          <Button variant="ghost" onClick={() => setStep(step - 1)} className="gap-1.5 mr-auto">
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
        )}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">Step {step} of 4</span>
          <Button variant="ghost" onClick={() => navigate('automation')}>Cancel</Button>
          {step < 4 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed} className="gap-1.5">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !canProceed} className="gap-1.5">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Create Automation
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
