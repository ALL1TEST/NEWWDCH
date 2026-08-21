'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Loader2, Zap, FileText, Sparkles, Send, ChevronRight, X, Search, FolderOpen, Upload } from 'lucide-react';
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

interface SavedKeyword {
  id: string;
  keyword: string;
  searchVolume?: number;
}
interface MediaFolder { id: string; name: string; }
interface MediaItem { id: string; filename: string; url: string; thumbnailUrl?: string; }

// -------------------- Component --------------------

export function AutomationBuilderPage() {
  const navigate = useNavigationStore((s) => s.navigate);
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const keywordFileRef = useRef<HTMLInputElement>(null);

  // ── Step 1: Trigger ──
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<'MANUAL' | 'SCHEDULED'>('SCHEDULED');
  const [frequency, setFrequency] = useState('DAILY');
  const [time, setTime] = useState('09:00');

  // ── Step 2: Content ──
  const [topic, setTopic] = useState('');
  const [keywordSource, setKeywordSource] = useState<KeywordSource>('MANUAL');
  // Manual
  const [primaryKeyword, setPrimaryKeyword] = useState('');
  const [secondaryKeywords, setSecondaryKeywords] = useState('');
  const [semanticKeywords, setSemanticKeywords] = useState('');
  // Saved
  const [savedKeywordSearch, setSavedKeywordSearch] = useState('');
  const [selectedSavedKeywordIds, setSelectedSavedKeywordIds] = useState<string[]>([]);
  // AI Generate
  const [aiKeywordCount, setAiKeywordCount] = useState('5');
  const [aiKeywordCustomCount, setAiKeywordCustomCount] = useState('');
  const [aiKeywordTone, setAiKeywordTone] = useState('Informational');
  const [aiKeywordCustomTone, setAiKeywordCustomTone] = useState('');
  // Content settings
  const [tone, setTone] = useState('Professional');
  const [customTone, setCustomTone] = useState('');
  const [contentLength, setContentLength] = useState('Medium (800-1200 words)');
  const [customWordCount, setCustomWordCount] = useState('');
  // Article structure
  const [structIntro, setStructIntro] = useState(true);
  const [structToc, setStructToc] = useState(false);
  const [structH2, setStructH2] = useState(true);
  const [structH3, setStructH3] = useState(true);
  const [structFaq, setStructFaq] = useState(false);
  const [structConclusion, setStructConclusion] = useState(true);

  // ── Step 3: SEO + Media ──
  const [generateSeoTitle, setGenerateSeoTitle] = useState(true);
  const [generateMetaDescription, setGenerateMetaDescription] = useState(true);
  const [generateSlug, setGenerateSlug] = useState(true);
  const [optimizePrimaryKeyword, setOptimizePrimaryKeyword] = useState(true);
  const [includeSecondaryKeywords, setIncludeSecondaryKeywords] = useState(true);
  const [includeSemanticKeywords, setIncludeSemanticKeywords] = useState(true);
  const [generateFaq, setGenerateFaq] = useState(false);
  const [generateFaqSchema, setGenerateFaqSchema] = useState(false);
  const [generateArticleSchema, setGenerateArticleSchema] = useState(true);
  // Media
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

  // ── Step 4: Final Action ──
  const [finalAction, setFinalAction] = useState('DRAFT');
  const [publishDate, setPublishDate] = useState('');
  const [publishTime, setPublishTime] = useState('');

  // ── Fetch saved keywords (tags) ──
  const { data: savedKeywordsData } = useQuery({
    queryKey: ['saved-keywords', savedKeywordSearch],
    queryFn: () => getApi(`/api/tags?pageSize=100${savedKeywordSearch ? `&search=${encodeURIComponent(savedKeywordSearch)}` : ''}`),
    enabled: keywordSource === 'SAVED' && step === 2,
    staleTime: 30_000,
  });
  const savedKeywords: SavedKeyword[] = useMemo(() => {
    const d = savedKeywordsData as any;
    if (Array.isArray(d)) return d;
    if (d?.data && Array.isArray(d.data)) return d.data;
    return [];
  }, [savedKeywordsData]);

  // ── Fetch media folders ──
  const { data: foldersData } = useQuery({
    queryKey: ['media-folders'],
    queryFn: () => getApi('/api/media-folders?pageSize=100'),
    enabled: mediaSource === 'MEDIA_LIBRARY' && step === 3,
    staleTime: 60_000,
  });
  const mediaFolders: MediaFolder[] = useMemo(() => {
    const d = foldersData as any;
    if (Array.isArray(d)) return d;
    if (d?.data && Array.isArray(d.data)) return d.data;
    return [];
  }, [foldersData]);

  // ── Fetch media items ──
  const { data: mediaItemsData } = useQuery({
    queryKey: ['media-folder-items', selectedFolderId],
    queryFn: () => getApi(`/api/media?folderId=${selectedFolderId}&pageSize=50`),
    enabled: mediaSource === 'MEDIA_LIBRARY' && !!selectedFolderId && step === 3,
    staleTime: 30_000,
  });
  const mediaItems: MediaItem[] = useMemo(() => {
    const d = mediaItemsData as any;
    if (Array.isArray(d)) return d;
    if (d?.data && Array.isArray(d.data)) return d.data;
    return [];
  }, [mediaItemsData]);

  // ── Helpers ──
  const toggleSavedKeyword = (id: string) => setSelectedSavedKeywordIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleMediaSelection = (id: string) => setSelectedMediaIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // ── Keyword file import ──
  const handleKeywordFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      // Parse CSV: primary_keyword,secondary_keywords,semantic_keywords
      if (file.name.endsWith('.csv')) {
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length > 1) {
          const [, ...rows] = lines;
          for (const row of rows) {
            const cols = row.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            if (cols[0]) {
              // Create a tag with the primary keyword
              postApi('/api/tags', { name: cols[0] }).then(() => {
                queryClient.invalidateQueries({ queryKey: ['saved-keywords'] });
                toast.success(`Imported keyword: ${cols[0]}`);
              }).catch(() => {});
            }
          }
        }
      } else if (file.name.endsWith('.txt')) {
          // Parse TXT: "Primary Keyword: ..." format
          const match = text.match(/Primary Keyword:\s*(.+)/i);
          if (match && match[1]) {
            const kw = match[1].trim();
            postApi('/api/tags', { name: kw }).then(() => {
              queryClient.invalidateQueries({ queryKey: ['saved-keywords'] });
              toast.success(`Imported keyword: ${kw}`);
            }).catch(() => {});
          }
      }
    };
    reader.readAsText(file);
    if (keywordFileRef.current) keywordFileRef.current.value = '';
  };

  // ── Create mutation ──
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
        contentGeneration: {
          topic,
          keywordSource,
          primaryKeyword: keywordSource === 'MANUAL' ? primaryKeyword : undefined,
          secondaryKeywords: keywordSource === 'MANUAL' ? secondaryKeywords : undefined,
          semanticKeywords: keywordSource === 'MANUAL' ? semanticKeywords : undefined,
          savedKeywordIds: keywordSource === 'SAVED' ? selectedSavedKeywordIds : undefined,
          aiKeywordCount: keywordSource === 'AI_GENERATE' ? finalAiKeywordCount : undefined,
          aiKeywordTone: keywordSource === 'AI_GENERATE' ? (aiKeywordTone === 'Custom' ? aiKeywordCustomTone : aiKeywordTone) : undefined,
          tone: finalTone,
          contentLength: finalContentLength,
          articleStructure: { introduction: structIntro, tableOfContents: structToc, h2Sections: structH2, h3Subsections: structH3, faqSection: structFaq, conclusion: structConclusion },
        },
        seoProcessing: { generateSeoTitle, generateMetaDescription, generateSlug, optimizePrimaryKeyword, includeSecondaryKeywords, includeSemanticKeywords, generateFaq, generateFaqSchema, generateArticleSchema },
        media: {
          source: mediaSource,
          folderId: mediaSource === 'MEDIA_LIBRARY' ? selectedFolderId : undefined,
          selectedMediaIds: mediaSource === 'MEDIA_LIBRARY' && selectedMediaIds.length > 0 ? selectedMediaIds : undefined,
          imageSelectionMode: mediaSource === 'MEDIA_LIBRARY' ? imageSelectionMode : undefined,
          generateFeaturedImage: mediaSource === 'AI_GENERATE' ? generateFeaturedImage : undefined,
          generateSectionImages: mediaSource === 'AI_GENERATE' ? generateSectionImages : undefined,
          imageCount: mediaSource === 'AI_GENERATE' ? finalImageCount : undefined,
          imageStyle: mediaSource === 'AI_GENERATE' ? finalImageStyle : undefined,
          aspectRatio: mediaSource === 'AI_GENERATE' ? finalAspectRatio : undefined,
          imageTone: mediaSource === 'AI_GENERATE' ? finalImageTone : undefined,
          imagePromptInstructions: mediaSource === 'AI_GENERATE' ? imagePromptInstructions : undefined,
          placement: mediaSource !== 'NONE' ? imagePlacement : undefined,
        },
        finalAction: { action: finalAction, publishDate: finalAction === 'SCHEDULE' ? publishDate : undefined, publishTime: finalAction === 'SCHEDULE' ? publishTime : undefined },
      });
      const scheduleConfig = JSON.stringify({ frequency, time });
      return postApi('/api/automations', { name, description, triggerType, scheduleConfig, workflowConfig });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['automations'] }); toast.success('Automation created successfully'); navigate('automation'); },
    onError: (err: Error) => toast.error(err.message || 'Failed to create automation'),
  });

  const steps = [{ num: 1, label: 'Trigger', icon: Zap }, { num: 2, label: 'Content', icon: FileText }, { num: 3, label: 'SEO + Media', icon: Sparkles }, { num: 4, label: 'Action', icon: Send }];

  // ── Conditional validation ──
  const canProceed = useMemo(() => {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) {
      if (!topic.trim()) return false;
      if (keywordSource === 'MANUAL' && !primaryKeyword.trim()) return false;
      if (keywordSource === 'SAVED' && selectedSavedKeywordIds.length === 0) return false;
      if (keywordSource === 'AI_GENERATE' && aiKeywordCount === 'Custom' && (!aiKeywordCustomCount || parseInt(aiKeywordCustomCount) < 1)) return false;
      if (tone === 'Custom' && !customTone.trim()) return false;
      if (contentLength === 'Custom' && (!customWordCount || parseInt(customWordCount) < 1)) return false;
      return true;
    }
    if (step === 3) {
      if (mediaSource === 'MEDIA_LIBRARY' && selectedMediaIds.length === 0 && imageSelectionMode !== 'ALL') return false;
      if (mediaSource === 'AI_GENERATE') {
        if (!generateFeaturedImage && !generateSectionImages) return false;
        if (imageCount === 'Custom' && (!customImageCount || parseInt(customImageCount) < 1)) return false;
        if (imageStyle === 'Custom' && !customImageStyle.trim()) return false;
        if (aspectRatio === 'Custom' && !customAspectRatio.trim()) return false;
        if (imageTone === 'Custom' && !customImageTone.trim()) return false;
      }
      return true;
    }
    return true;
  }, [step, name, topic, keywordSource, primaryKeyword, selectedSavedKeywordIds, aiKeywordCount, aiKeywordCustomCount, tone, customTone, contentLength, customWordCount, mediaSource, selectedMediaIds, imageSelectionMode, generateFeaturedImage, generateSectionImages, imageCount, customImageCount, imageStyle, customImageStyle, aspectRatio, customAspectRatio, imageTone, customImageTone]);

  // ── Workflow preview helpers ──
  const kwPreview = keywordSource === 'MANUAL' ? (primaryKeyword || 'No primary keyword') :
    keywordSource === 'SAVED' ? `${selectedSavedKeywordIds.length} saved keywords` :
    `AI generated – ${aiKeywordCount === 'Custom' ? aiKeywordCustomCount : aiKeywordCount} keywords (${aiKeywordTone === 'Custom' ? aiKeywordCustomTone : aiKeywordTone} intent)`;
  const structParts = [structIntro && 'Introduction', structToc && 'Table of Contents', structH2 && 'H2 Sections', structH3 && 'H3 Subsections', structFaq && 'FAQ Section', structConclusion && 'Conclusion'].filter(Boolean);
  const seoParts = [generateSeoTitle && 'SEO title', generateMetaDescription && 'Meta description', generateSlug && 'URL slug', optimizePrimaryKeyword && 'Primary keyword', includeSecondaryKeywords && 'Secondary keywords', includeSemanticKeywords && 'Semantic keywords', generateFaq && 'FAQ', generateFaqSchema && 'FAQ schema', generateArticleSchema && 'Article schema'].filter(Boolean);
  const mediaPreview = mediaSource === 'NONE' ? 'No images' :
    mediaSource === 'MEDIA_LIBRARY' ? `Media Library (${selectedMediaIds.length || 'auto'} images, ${imageSelectionMode})` :
    `AI generated images (${imageCount === 'Custom' ? customImageCount : imageCount} images, ${imageStyle === 'Custom' ? customImageStyle : imageStyle}, ${aspectRatio === 'Custom' ? customAspectRatio : aspectRatio})`;

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('automation')}><ArrowLeft className="h-4 w-4" /></Button>
        <div><h1 className="text-2xl font-bold tracking-tight">Create Automation</h1><p className="text-sm text-muted-foreground">Set up an automated content workflow.</p></div>
      </div>

      {/* Step Progress */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <React.Fragment key={s.num}>
            <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors', step >= s.num ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
              <s.icon className="h-4 w-4" />{s.label}
            </div>
            {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          {/* ─────────── STEP 1: TRIGGER ─────────── */}
          {step === 1 && (
            <>
              <div className="space-y-2"><Label>Automation Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Daily SEO Article" /></div>
              <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." rows={2} /></div>
              <div className="space-y-2"><Label>Trigger Type</Label>
                <Select value={triggerType} onValueChange={(v) => setTriggerType(v as 'MANUAL' | 'SCHEDULED')}>
                  <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                    <SelectItem value="MANUAL">Manual — Run when admin clicks "Run Now"</SelectItem>
                    <SelectItem value="SCHEDULED">Scheduled — Run automatically at a specific time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {triggerType === 'SCHEDULED' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Frequency</Label>
                    <Select value={frequency} onValueChange={setFrequency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                      <SelectItem value="DAILY">Daily</SelectItem><SelectItem value="WEEKLY">Weekly</SelectItem><SelectItem value="MONTHLY">Monthly</SelectItem>
                    </SelectContent></Select>
                  </div>
                  <div className="space-y-2"><Label>Time</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
                </div>
              )}
            </>
          )}

          {/* ─────────── STEP 2: CONTENT ─────────── */}
          {step === 2 && (
            <>
              <div className="space-y-2"><Label>Article Topic *</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., Productivity tips for remote workers" /></div>
              <Separator />

              {/* Keyword Source */}
              <div className="space-y-2"><Label className="text-sm font-semibold">Keyword Source</Label>
                <Select value={keywordSource} onValueChange={(v) => setKeywordSource(v as KeywordSource)}>
                  <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                    <SelectItem value="MANUAL">Manual Keywords</SelectItem>
                    <SelectItem value="SAVED">Saved Keywords</SelectItem>
                    <SelectItem value="AI_GENERATE">AI Generate Keywords</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Manual Keywords */}
              {keywordSource === 'MANUAL' && (
                <div className="space-y-3 pl-1 border-l-2 border-primary/20 ml-1">
                  <div className="space-y-2"><Label className="text-xs text-muted-foreground">Primary Keyword *</Label><Input value={primaryKeyword} onChange={(e) => setPrimaryKeyword(e.target.value)} placeholder="e.g., remote work productivity" /></div>
                  <div className="space-y-2"><Label className="text-xs text-muted-foreground">Secondary Keywords</Label><Input value={secondaryKeywords} onChange={(e) => setSecondaryKeywords(e.target.value)} placeholder="comma, separated, keywords" /></div>
                  <div className="space-y-2"><Label className="text-xs text-muted-foreground">Semantic / Related Keywords</Label><Input value={semanticKeywords} onChange={(e) => setSemanticKeywords(e.target.value)} placeholder="comma, separated, keywords" /></div>
                </div>
              )}

              {/* Saved Keywords */}
              {keywordSource === 'SAVED' && (
                <div className="space-y-3 pl-1 border-l-2 border-primary/20 ml-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input value={savedKeywordSearch} onChange={(e) => setSavedKeywordSearch(e.target.value)} placeholder="Search saved keywords..." className="pl-8 h-8 text-sm" />
                    </div>
                    <input ref={keywordFileRef} type="file" accept=".txt,.csv" className="hidden" onChange={handleKeywordFileImport} />
                    <Button variant="outline" size="sm" className="h-8 gap-1 shrink-0" onClick={() => keywordFileRef.current?.click()}>
                      <Upload className="h-3 w-3" /> Import .txt/.csv
                    </Button>
                  </div>
                  {selectedSavedKeywordIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSavedKeywordIds.map(id => {
                        const kw = savedKeywords.find(k => k.id === id);
                        return <Badge key={id} variant="secondary" className="gap-1 text-xs pr-1">{kw?.keyword ?? id}<button type="button" onClick={() => toggleSavedKeyword(id)} className="hover:text-destructive"><X className="h-3 w-3" /></button></Badge>;
                      })}
                    </div>
                  )}
                  <div className="max-h-48 overflow-y-auto rounded-md border">
                    {savedKeywords.length === 0 ? (
                      <p className="p-4 text-center text-xs text-muted-foreground">No saved keywords found. Import a .txt/.csv file or save keywords from the Tags page first.</p>
                    ) : savedKeywords.filter(k => !selectedSavedKeywordIds.includes(k.id)).map(kw => (
                      <button key={kw.id} type="button" onClick={() => toggleSavedKeyword(kw.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b last:border-0">{kw.keyword}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Generate Keywords */}
              {keywordSource === 'AI_GENERATE' && (
                <div className="space-y-3 pl-1 border-l-2 border-primary/20 ml-1">
                  <div className="space-y-2"><Label className="text-xs text-muted-foreground">Number of keywords to generate</Label>
                    <Select value={aiKeywordCount} onValueChange={setAiKeywordCount}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>
                      <SelectItem value="3">3 keywords</SelectItem><SelectItem value="5">5 keywords</SelectItem><SelectItem value="10">10 keywords</SelectItem><SelectItem value="Custom">Custom</SelectItem>
                    </SelectContent></Select>
                  </div>
                  {aiKeywordCount === 'Custom' && (
                    <div className="space-y-2"><Label className="text-xs text-muted-foreground">Custom keyword count</Label><Input type="number" value={aiKeywordCustomCount} onChange={(e) => setAiKeywordCustomCount(e.target.value)} placeholder="e.g., 25" className="w-32" min="1" /></div>
                  )}
                  <div className="space-y-2"><Label className="text-xs text-muted-foreground">Keyword Generation Tone / Intent</Label>
                    <Select value={aiKeywordTone} onValueChange={setAiKeywordTone}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                      <SelectItem value="Informational">Informational</SelectItem><SelectItem value="Commercial">Commercial</SelectItem><SelectItem value="Transactional">Transactional</SelectItem><SelectItem value="Navigational">Navigational</SelectItem><SelectItem value="Conversational">Conversational</SelectItem><SelectItem value="Custom">Custom</SelectItem>
                    </SelectContent></Select>
                  </div>
                  {aiKeywordTone === 'Custom' && (
                    <div className="space-y-2"><Label className="text-xs text-muted-foreground">Describe the desired keyword generation style</Label><Textarea value={aiKeywordCustomTone} onChange={(e) => setAiKeywordCustomTone(e.target.value)} placeholder='e.g., "Generate long-tail keywords for beginners with low competition."' rows={2} className="text-sm" /></div>
                  )}
                  <p className="text-xs text-muted-foreground">AI will generate primary, secondary, long-tail, and semantic keywords based on the article topic and selected intent.</p>
                </div>
              )}

              <Separator />

              {/* Tone */}
              <div className="space-y-2"><Label>Tone</Label>
                <Select value={tone} onValueChange={setTone}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="Professional">Professional</SelectItem><SelectItem value="Informative">Informative</SelectItem><SelectItem value="Casual">Casual</SelectItem><SelectItem value="Friendly">Friendly</SelectItem><SelectItem value="Expert">Expert</SelectItem><SelectItem value="Conversational">Conversational</SelectItem><SelectItem value="Custom">Custom</SelectItem>
                </SelectContent></Select>
              </div>
              {tone === 'Custom' && (
                <div className="space-y-2"><Label className="text-xs text-muted-foreground">Describe the writing style...</Label><Textarea value={customTone} onChange={(e) => setCustomTone(e.target.value)} placeholder='e.g., "Write in a simple, beginner-friendly style with practical examples."' rows={2} className="text-sm" /></div>
              )}

              {/* Content Length */}
              <div className="space-y-2"><Label>Content Length</Label>
                <Select value={contentLength} onValueChange={setContentLength}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="Short (300-600 words)">Short (300-600 words)</SelectItem><SelectItem value="Medium (800-1200 words)">Medium (800-1200 words)</SelectItem><SelectItem value="Long (1500-2500 words)">Long (1500-2500 words)</SelectItem><SelectItem value="Comprehensive (3000+ words)">Comprehensive (3000+ words)</SelectItem><SelectItem value="Custom">Custom word count</SelectItem>
                </SelectContent></Select>
              </div>
              {contentLength === 'Custom' && (
                <div className="space-y-2"><Label className="text-xs text-muted-foreground">Target Word Count</Label><Input type="number" value={customWordCount} onChange={(e) => setCustomWordCount(e.target.value)} placeholder="e.g., 2200" className="w-40" min="1" /></div>
              )}

              <Separator />

              {/* Article Structure */}
              <div><Label className="text-sm font-semibold">Article Structure</Label>
                <div className="mt-2 space-y-2">
                  {[{ label: 'Introduction', val: structIntro, set: setStructIntro }, { label: 'Table of Contents', val: structToc, set: setStructToc }, { label: 'H2 Sections', val: structH2, set: setStructH2 }, { label: 'H3 Subsections', val: structH3, set: setStructH3 }, { label: 'FAQ Section', val: structFaq, set: setStructFaq }, { label: 'Conclusion', val: structConclusion, set: setStructConclusion }].map(item => (
                    <div key={item.label} className="flex items-center justify-between"><Label className="text-sm">{item.label}</Label><Switch checked={item.val} onCheckedChange={item.set} /></div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ─────────── STEP 3: SEO + MEDIA ─────────── */}
          {step === 3 && (
            <div className="space-y-5">
              {/* SEO */}
              <div><Label className="text-sm font-semibold">SEO Optimization</Label>
                <div className="mt-2 space-y-2">
                  {[{ label: 'Generate SEO optimized title', val: generateSeoTitle, set: setGenerateSeoTitle }, { label: 'Generate meta description', val: generateMetaDescription, set: setGenerateMetaDescription }, { label: 'Generate URL slug', val: generateSlug, set: setGenerateSlug }, { label: 'Optimize for primary keyword', val: optimizePrimaryKeyword, set: setOptimizePrimaryKeyword }, { label: 'Include secondary keywords naturally', val: includeSecondaryKeywords, set: setIncludeSecondaryKeywords }, { label: 'Include semantic keywords', val: includeSemanticKeywords, set: setIncludeSemanticKeywords }, { label: 'Generate FAQ section', val: generateFaq, set: setGenerateFaq }, { label: 'Generate FAQ schema (JSON-LD)', val: generateFaqSchema, set: setGenerateFaqSchema }, { label: 'Generate Article schema (JSON-LD)', val: generateArticleSchema, set: setGenerateArticleSchema }].map(item => (
                    <div key={item.label} className="flex items-center justify-between"><Label className="text-sm">{item.label}</Label><Switch checked={item.val} onCheckedChange={item.set} /></div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Media Source */}
              <div><Label className="text-sm font-semibold">Media Source</Label>
                <div className="mt-2 space-y-2">
                  <Select value={mediaSource} onValueChange={(v) => setMediaSource(v as MediaSource)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                    <SelectItem value="NONE">No Images — Generate article without images</SelectItem><SelectItem value="MEDIA_LIBRARY">Use Media Library — Select existing images</SelectItem><SelectItem value="AI_GENERATE">AI Generate Images — Generate new images</SelectItem>
                  </SelectContent></Select>
                </div>
              </div>

              {/* Media Library */}
              {mediaSource === 'MEDIA_LIBRARY' && (
                <div className="space-y-3 pl-1 border-l-2 border-primary/20 ml-1">
                  <div className="space-y-2"><Label className="text-xs text-muted-foreground">Select Folder</Label>
                    <Select value={selectedFolderId} onValueChange={(v) => { setSelectedFolderId(v); setSelectedMediaIds([]); }}><SelectTrigger><SelectValue placeholder="Choose a media folder" /></SelectTrigger><SelectContent>
                      {mediaFolders.length === 0 ? <SelectItem value="_none" disabled>No folders available</SelectItem> : mediaFolders.map(f => <SelectItem key={f.id} value={f.id}><FolderOpen className="h-3.5 w-3.5 mr-1.5 inline" />{f.name}</SelectItem>)}
                    </SelectContent></Select>
                  </div>
                  {selectedFolderId && mediaItems.length > 0 && (
                    <div className="space-y-2"><Label className="text-xs text-muted-foreground">Image Selection</Label>
                      <Select value={imageSelectionMode} onValueChange={(v) => setImageSelectionMode(v as 'ALL' | 'RANDOM' | 'AI_CHOOSE')}><SelectTrigger className="w-64"><SelectValue /></SelectTrigger><SelectContent>
                        <SelectItem value="ALL">Use all selected images</SelectItem><SelectItem value="RANDOM">Random selection</SelectItem><SelectItem value="AI_CHOOSE">AI choose best images</SelectItem>
                      </SelectContent></Select>
                    </div>
                  )}
                  {selectedFolderId && mediaItems.length > 0 && imageSelectionMode !== 'ALL' && (
                    <div className="space-y-2"><Label className="text-xs text-muted-foreground">Select images</Label>
                      <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                        {mediaItems.map(item => (
                          <button key={item.id} type="button" onClick={() => toggleMediaSelection(item.id)} className={cn('relative aspect-square rounded-lg overflow-hidden border-2 transition-all', selectedMediaIds.includes(item.id) ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50')}>
                            <img src={item.thumbnailUrl || item.url} alt={item.filename} className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* AI Generate Images */}
              {mediaSource === 'AI_GENERATE' && (
                <div className="space-y-3 pl-1 border-l-2 border-primary/20 ml-1">
                  <div className="flex items-center justify-between"><Label className="text-sm">Generate featured image</Label><Switch checked={generateFeaturedImage} onCheckedChange={setGenerateFeaturedImage} /></div>
                  <div className="flex items-center justify-between"><Label className="text-sm">Generate images for article sections</Label><Switch checked={generateSectionImages} onCheckedChange={setGenerateSectionImages} /></div>
                  {(generateFeaturedImage || generateSectionImages) && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2"><Label className="text-xs text-muted-foreground">Number of images</Label>
                          <Select value={imageCount} onValueChange={setImageCount}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                            <SelectItem value="1">1 image</SelectItem><SelectItem value="2">2 images</SelectItem><SelectItem value="3">3 images</SelectItem><SelectItem value="5">5 images</SelectItem><SelectItem value="Custom">Custom</SelectItem>
                          </SelectContent></Select>
                        </div>
                        {imageCount === 'Custom' && <div className="space-y-2"><Label className="text-xs text-muted-foreground">Custom image count</Label><Input type="number" value={customImageCount} onChange={(e) => setCustomImageCount(e.target.value)} placeholder="e.g., 7" className="w-24" min="1" /></div>}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2"><Label className="text-xs text-muted-foreground">Image style</Label>
                          <Select value={imageStyle} onValueChange={setImageStyle}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                            <SelectItem value="Realistic">Realistic</SelectItem><SelectItem value="Illustration">Illustration</SelectItem><SelectItem value="3D">3D</SelectItem><SelectItem value="Minimal">Minimal</SelectItem><SelectItem value="Professional">Professional</SelectItem><SelectItem value="Editorial">Editorial</SelectItem><SelectItem value="Custom">Custom</SelectItem>
                          </SelectContent></Select>
                        </div>
                        <div className="space-y-2"><Label className="text-xs text-muted-foreground">Aspect Ratio</Label>
                          <Select value={aspectRatio} onValueChange={setAspectRatio}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                            <SelectItem value="16:9">16:9 Landscape</SelectItem><SelectItem value="4:3">4:3 Landscape</SelectItem><SelectItem value="1:1">1:1 Square</SelectItem><SelectItem value="3:4">3:4 Portrait</SelectItem><SelectItem value="9:16">9:16 Vertical</SelectItem><SelectItem value="Custom">Custom</SelectItem>
                          </SelectContent></Select>
                        </div>
                      </div>
                      {imageStyle === 'Custom' && <div className="space-y-2"><Label className="text-xs text-muted-foreground">Describe the desired image style...</Label><Input value={customImageStyle} onChange={(e) => setCustomImageStyle(e.target.value)} placeholder='e.g., "Modern flat illustration with soft gradients."' className="text-sm" /></div>}
                      {aspectRatio === 'Custom' && <div className="space-y-2"><Label className="text-xs text-muted-foreground">Custom aspect ratio</Label><Input value={customAspectRatio} onChange={(e) => setCustomAspectRatio(e.target.value)} placeholder="e.g., 21:9" className="w-24 text-sm" /></div>}
                      <div className="space-y-2"><Label className="text-xs text-muted-foreground">Image Generation Tone</Label>
                        <Select value={imageTone} onValueChange={setImageTone}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>
                          <SelectItem value="Modern">Modern</SelectItem><SelectItem value="Professional">Professional</SelectItem><SelectItem value="Minimal">Minimal</SelectItem><SelectItem value="Creative">Creative</SelectItem><SelectItem value="Premium">Premium</SelectItem><SelectItem value="Custom">Custom</SelectItem>
                        </SelectContent></Select>
                      </div>
                      {imageTone === 'Custom' && <div className="space-y-2"><Label className="text-xs text-muted-foreground">Describe the image tone</Label><Input value={customImageTone} onChange={(e) => setCustomImageTone(e.target.value)} placeholder="e.g., Warm, cinematic lighting" className="text-sm" /></div>}
                      <div className="space-y-2"><Label className="text-xs text-muted-foreground">Additional image generation instructions</Label><Textarea value={imagePromptInstructions} onChange={(e) => setImagePromptInstructions(e.target.value)} placeholder='e.g., "Do not include text, logos, watermarks, or recognizable brand elements."' rows={2} className="text-sm" /></div>
                    </>
                  )}
                </div>
              )}

              {/* Image Placement */}
              {mediaSource !== 'NONE' && (
                <>
                  <Separator />
                  <div className="space-y-2"><Label className="text-sm font-semibold">Image Placement</Label>
                    <Select value={imagePlacement} onValueChange={(v) => setImagePlacement(v as ImagePlacement)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                      <SelectItem value="AI_AUTOMATIC">AI Automatic Placement — Analyze article structure and insert images naturally</SelectItem>
                      <SelectItem value="AFTER_INTRO">After Introduction — Place image after the intro</SelectItem>
                      <SelectItem value="BEFORE_FIRST_H2">Before First H2 — Place image before the first heading</SelectItem>
                      <SelectItem value="AFTER_EACH_H2">After Each Major H2 — Place image after every H2 section</SelectItem>
                      <SelectItem value="MANUAL_MAPPING">Manual Mapping — Assign images to sections manually</SelectItem>
                    </SelectContent></Select>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─────────── STEP 4: ACTION ─────────── */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-2"><Label>Final Action</Label>
                <Select value={finalAction} onValueChange={setFinalAction}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="DRAFT">Save as Draft</SelectItem><SelectItem value="REVIEW">Send to Review</SelectItem><SelectItem value="PUBLISH">Publish Immediately</SelectItem><SelectItem value="SCHEDULE">Schedule for Publishing</SelectItem>
                </SelectContent></Select>
              </div>
              {finalAction === 'SCHEDULE' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Publication Date</Label><Input type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Publication Time</Label><Input type="time" value={publishTime} onChange={(e) => setPublishTime(e.target.value)} /></div>
                </div>
              )}
              {/* Enhanced Workflow Preview */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Workflow Preview</p>
                <div className="flex items-center gap-2 text-sm"><Zap className="h-4 w-4 text-amber-500 shrink-0" /><span>{triggerType === 'SCHEDULED' ? `Every ${frequency.toLowerCase()} at ${time}` : 'Manual trigger'}</span></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-sky-500 shrink-0" /><span>Topic: {topic || 'Untitled'}</span></div>
                <p className="text-xs text-muted-foreground ml-6">🔑 Keywords: {kwPreview}</p>
                <p className="text-xs text-muted-foreground ml-6">✍️ Content: {tone === 'Custom' ? customTone : tone} tone, {contentLength === 'Custom' ? `${customWordCount} words` : contentLength}</p>
                <p className="text-xs text-muted-foreground ml-6">📋 Structure: {structParts.join(' + ') || 'None'}</p>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-2 text-sm"><Sparkles className="h-4 w-4 text-violet-500 shrink-0" /><span>SEO + Media</span></div>
                <p className="text-xs text-muted-foreground ml-6">🔍 SEO: {seoParts.join(', ') || 'None'}</p>
                <p className="text-xs text-muted-foreground ml-6">🖼 Media: {mediaPreview}</p>
                <p className="text-xs text-muted-foreground ml-6">📐 Placement: {imagePlacement === 'AI_AUTOMATIC' ? 'AI Automatic' : imagePlacement === 'AFTER_INTRO' ? 'After Introduction' : imagePlacement === 'BEFORE_FIRST_H2' ? 'Before First H2' : imagePlacement === 'AFTER_EACH_H2' ? 'After Each H2' : 'Manual Mapping'}</p>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-2 text-sm"><Send className="h-4 w-4 text-emerald-500 shrink-0" /><span>{finalAction === 'DRAFT' ? 'Save as Draft' : finalAction === 'REVIEW' ? 'Send to Review' : finalAction === 'PUBLISH' ? 'Publish Immediately' : `Schedule: ${publishDate || 'TBD'} ${publishTime || ''}`}</span></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => step > 1 ? setStep(step - 1) : navigate('automation')}>{step > 1 ? 'Back' : 'Cancel'}</Button>
        {step < 4 ? <Button onClick={() => setStep(step + 1)} disabled={!canProceed}>Next</Button> : (
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !canProceed}>
            {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Create Automation
          </Button>
        )}
      </div>
    </div>
  );
}
