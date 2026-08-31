'use client';

import React, { useState } from 'react';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sparkles,
  FileText,
  PenLine,
  Image as ImageIcon,
  Lightbulb,
  Lock,
  Copy,
  ArrowRight,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import {
  useAiWorkspace,
  useInvalidateAiWorkspace,
  generateArticle,
  editTextWithAi,
  generateAiImages,
  generateArticleIdeas,
  writeAiDraftHandoff,
  type AiGeneratedDraft,
  type AiGeneratedImage,
  type AiArticleIdea,
} from '@/hooks/use-ai-workspace';

// ============================================================
// CLIENT AI WORKSPACE — the client-facing AI experience.
// ============================================================
// This is the CLIENT side of the Platform Admin / Client AI
// separation:
//   • The client USES Platform AI here: generate articles, generate
//     titles/outlines/rewrites/SEO fields, generate AI images and
//     article ideas — plus their remaining monthly usage.
//   • The client never configures providers, API keys, models,
//     temperature/max tokens or prompt templates — the platform's
//     configured provider/model and the Platform Admin prompts are
//     used automatically (server-side).
//   • Without the Platform AI plan feature the tools are locked
//     (hidden UI + 403 on the endpoints — enforced server-side).
// ============================================================

const WRITING_STYLES = [
  'Professional',
  'Casual',
  'Friendly',
  'Authoritative',
  'Persuasive',
  'Technical',
  'Storytelling',
] as const;

const TARGET_LENGTHS = [
  'Short (300-600 words)',
  'Medium (800-1200 words)',
  'Long (1500-2500 words)',
  'Comprehensive (3000+ words)',
] as const;

const ASPECT_RATIOS = [
  { value: '1:1', label: 'Square (1:1)' },
  { value: '16:9', label: 'Landscape (16:9)' },
  { value: '9:16', label: 'Portrait (9:16)' },
  { value: '4:3', label: 'Classic (4:3)' },
  { value: '3:4', label: 'Portrait (3:4)' },
] as const;

const CONTENT_TOOLS = [
  { action: 'Generate Title', hint: 'A compelling title for this text' },
  { action: 'Generate Outline', hint: 'A structured outline' },
  { action: 'Rewrite this content', hint: 'Same meaning, fresh wording' },
  { action: 'Improve this content', hint: 'Sharper, stronger, clearer' },
  { action: 'Generate SEO title', hint: 'SEO-optimized title tag' },
  { action: 'Generate SEO meta description', hint: 'Search-snippet description' },
] as const;

function formatCount(limit: number, used: number): string {
  if (limit === -1) return `${used} used — unlimited`;
  return `${used} / ${limit}`;
}

// -------------------- Usage card --------------------

function UsageCard() {
  const { data: workspace } = useAiWorkspace();
  if (!workspace) return null;

  const { mode, limits, usage } = workspace;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Platform AI usage this month</CardTitle>
        </div>
        <CardDescription>
          AI provided by the platform — usage is subject to your plan&apos;s AI limits.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">AI Articles</span>
              <span className="font-medium tabular-nums">
                {mode === 'unlimited' ? `${usage.articles} used — unlimited` : formatCount(limits.aiArticlesPerMonth, usage.articles)}
              </span>
            </div>
            <Progress
              value={
                mode === 'unlimited' || limits.aiArticlesPerMonth <= 0
                  ? 0
                  : Math.min(100, (usage.articles / limits.aiArticlesPerMonth) * 100)
              }
              aria-label="AI articles used this month"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">AI Images</span>
              <span className="font-medium tabular-nums">
                {mode === 'unlimited' ? `${usage.images} used — unlimited` : formatCount(limits.aiImagesPerMonth, usage.images)}
              </span>
            </div>
            <Progress
              value={
                mode === 'unlimited' || limits.aiImagesPerMonth <= 0
                  ? 0
                  : Math.min(100, (usage.images / limits.aiImagesPerMonth) * 100)
              }
              aria-label="AI images used this month"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Counts reset at the start of each calendar month.
        </p>
      </CardContent>
    </Card>
  );
}

// -------------------- Locked state --------------------

function LockedCard() {
  const { data: workspace } = useAiWorkspace();
  const navigate = useNavigationStore((s) => s.navigate);
  const hasOwnApi = workspace?.entitlements.aiClient ?? false;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Platform AI is not included in your plan</CardTitle>
        </div>
        <CardDescription>
          Upgrade to a plan with Platform AI to generate articles, images and SEO content with
          the platform&apos;s AI.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasOwnApi && (
          <p className="text-sm text-muted-foreground">
            Your plan includes <strong>Client&apos;s Own AI API</strong> — you can connect and
            manage your own AI provider in the <strong>My Providers</strong> tab. Your own API
            usage is never counted against Platform AI limits.
          </p>
        )}
        <div>
          <Button size="sm" onClick={() => navigate('billing')}>
            View plans
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// -------------------- Generate Article --------------------

function GenerateArticleCard() {
  const navigate = useNavigationStore((s) => s.navigate);
  const invalidateWorkspace = useInvalidateAiWorkspace();

  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [keywords, setKeywords] = useState('');
  const [style, setStyle] = useState<string>('Professional');
  const [length, setLength] = useState<string>('Medium (800-1200 words)');
  const [includeCta, setIncludeCta] = useState(false);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<AiGeneratedDraft | null>(null);

  const handleGenerate = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title for the article');
      return;
    }
    setPending(true);
    try {
      const drafts = await generateArticle({
        title: title.trim(),
        brief: brief.trim() || undefined,
        keywords: keywords.trim() || undefined,
        writingStyle: style,
        targetLength: length,
        numberOfDrafts: 1,
        includeCta,
      });
      if (drafts.length > 0) {
        setDraft(drafts[0]);
        toast.success('Article generated');
        invalidateWorkspace();
      } else {
        toast.error('AI returned no draft. Please try again.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI generation failed');
    } finally {
      setPending(false);
    }
  };

  const handleUse = () => {
    if (!draft) return;
    writeAiDraftHandoff({ title: title.trim(), content: draft.content });
    navigate('content', null, 'new');
  };

  const handleCopy = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft.content);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Generate Article</CardTitle>
        </div>
        <CardDescription>
          Write a full article draft from a title and a short brief. The platform&apos;s AI model
          and prompt are used automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ai-article-title">Title</Label>
          <Input
            id="ai-article-title"
            placeholder="e.g. 10 Sustainable Gardening Tips for Small Spaces"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ai-article-brief">Brief / description</Label>
          <Textarea
            id="ai-article-brief"
            placeholder="What should the article cover? Tone, audience, key points…"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ai-article-keywords">Target keywords</Label>
          <Input
            id="ai-article-keywords"
            placeholder="e.g. gardening, small spaces, sustainability"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Writing style</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger aria-label="Writing style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WRITING_STYLES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Target length</Label>
            <Select value={length} onValueChange={setLength}>
              <SelectTrigger aria-label="Target length">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_LENGTHS.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="ai-article-cta"
            type="checkbox"
            className="h-4 w-4 rounded border-border accent-primary"
            checked={includeCta}
            onChange={(e) => setIncludeCta(e.target.checked)}
          />
          <Label htmlFor="ai-article-cta" className="text-sm font-normal cursor-pointer">
            Include a call-to-action at the end
          </Label>
        </div>
        <Button onClick={handleGenerate} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Article
            </>
          )}
        </Button>

        {pending && !draft && (
          <div className="space-y-2 pt-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        )}

        {draft && (
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{draft.wordCount} words</Badge>
                <span className="text-xs text-muted-foreground">Draft preview</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleCopy}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button size="sm" onClick={handleUse}>
                  Use in new article
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto rounded-md border bg-muted/30 p-4">
              <div
                className="prose prose-sm prose-zinc dark:prose-invert max-w-none break-words"
                // The platform AI generates the article as sanitized HTML (the
                // same markup the CMS article editor stores and renders).
                dangerouslySetInnerHTML={{ __html: draft.content }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -------------------- Content tools --------------------

function ContentToolsCard() {
  const invalidateWorkspace = useInvalidateAiWorkspace();

  const [text, setText] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [result, setResult] = useState<{ action: string; text: string } | null>(null);

  const handleTool = async (action: string) => {
    if (!text.trim()) {
      toast.error('Paste or write some content first');
      return;
    }
    setPendingAction(action);
    try {
      const edited = await editTextWithAi({ text: text.trim(), action });
      if (edited) {
        setResult({ action, text: edited });
        toast.success(`${action} — done`);
        invalidateWorkspace();
      } else {
        toast.error('AI returned no content. Please try again.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI edit failed');
    } finally {
      setPendingAction(null);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Copy failed');
    }
  };

  const handleReplaceText = () => {
    if (!result) return;
    setText(result.text);
    setResult(null);
    toast.success('Result applied to the input');
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <PenLine className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Content Tools</CardTitle>
        </div>
        <CardDescription>
          Paste content and apply an AI action — generate a title, an outline, rewrite, improve,
          or generate SEO fields.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ai-tools-text">Your content</Label>
          <Textarea
            id="ai-tools-text"
            placeholder="Paste or write the text you want to work with…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {CONTENT_TOOLS.map((tool) => (
            <Button
              key={tool.action}
              size="sm"
              variant="outline"
              title={tool.hint}
              disabled={pendingAction !== null}
              onClick={() => handleTool(tool.action)}
            >
              {pendingAction === tool.action && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {tool.action}
            </Button>
          ))}
        </div>

        {result && (
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="secondary">{result.action}</Badge>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleCopy}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button size="sm" variant="outline" onClick={handleReplaceText}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Apply to input
                </Button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto rounded-md border bg-muted/30 p-4">
              <p className="whitespace-pre-wrap break-words text-sm">{result.text}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -------------------- Generate AI Images --------------------

function GenerateImagesCard() {
  const navigate = useNavigationStore((s) => s.navigate);
  const invalidateWorkspace = useInvalidateAiWorkspace();

  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState<string>('1:1');
  const [count, setCount] = useState<string>('1');
  const [pending, setPending] = useState(false);
  const [images, setImages] = useState<AiGeneratedImage[]>([]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please describe the image you want');
      return;
    }
    setPending(true);
    try {
      const generated = await generateAiImages({
        prompt: prompt.trim(),
        aspectRatio: aspect,
        count: Number(count),
      });
      if (generated.length > 0) {
        setImages((prev) => [...generated, ...prev]);
        toast.success(`${generated.length} image${generated.length > 1 ? 's' : ''} generated and saved to your Media library`);
        invalidateWorkspace();
      } else {
        toast.error('Image generation returned no results. Please try again.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Image generation failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Generate AI Images</CardTitle>
        </div>
        <CardDescription>
          Describe an image and generate it with the platform&apos;s AI — results are saved
          directly into your Media library.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ai-image-prompt">Image description</Label>
          <Textarea
            id="ai-image-prompt"
            placeholder="e.g. A minimal hero banner with soft gradients and abstract leaves"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Aspect ratio</Label>
            <Select value={aspect} onValueChange={setAspect}>
              <SelectTrigger aria-label="Aspect ratio">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>How many</Label>
            <Select value={count} onValueChange={setCount}>
              <SelectTrigger aria-label="Number of images">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleGenerate} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <ImageIcon className="h-4 w-4 mr-2" />
              Generate Images
            </>
          )}
        </Button>

        {images.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                Saved to your Media library
              </span>
              <Button size="sm" variant="outline" onClick={() => navigate('media')}>
                Open Media
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((img) => (
                 
                <img
                  key={img.id}
                  src={img.url}
                  alt={img.originalName || 'AI generated image'}
                  className="w-full rounded-md border object-cover aspect-square"
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -------------------- Article Ideas --------------------

function ArticleIdeasCard() {
  const navigate = useNavigationStore((s) => s.navigate);
  const invalidateWorkspace = useInvalidateAiWorkspace();

  const [niche, setNiche] = useState('');
  const [keywords, setKeywords] = useState('');
  const [count, setCount] = useState<string>('6');
  const [pending, setPending] = useState(false);
  const [ideas, setIdeas] = useState<AiArticleIdea[]>([]);

  const handleGenerate = async () => {
    setPending(true);
    try {
      const generated = await generateArticleIdeas({
        niche: niche.trim() || undefined,
        keywords: keywords.trim() || undefined,
        count: Number(count),
      });
      if (generated.length > 0) {
        setIdeas(generated);
        toast.success(`Generated ${generated.length} article ideas`);
        invalidateWorkspace();
      } else {
        toast.info('No strong topic ideas found. Try refining your niche or keywords.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate ideas');
    } finally {
      setPending(false);
    }
  };

  const handleUseIdea = (idea: AiArticleIdea) => {
    writeAiDraftHandoff({
      title: idea.title,
      content: `<p>${idea.description || ''}</p>`,
    });
    navigate('content', null, 'new');
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Article Ideas</CardTitle>
        </div>
        <CardDescription>
          Get SEO-scored topic ideas for your next articles — with target keywords, competition
          and a suggested angle.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="ai-ideas-niche">Niche</Label>
            <Input
              id="ai-ideas-niche"
              placeholder="e.g. urban gardening"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-ideas-keywords">Keywords</Label>
            <Input
              id="ai-ideas-keywords"
              placeholder="e.g. balcony, composting"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-32 space-y-2">
            <Label>How many</Label>
            <Select value={count} onValueChange={setCount}>
              <SelectTrigger aria-label="Number of ideas">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 4, 5, 6, 8, 10].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleGenerate} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Lightbulb className="h-4 w-4 mr-2" />
                Generate Ideas
              </>
            )}
          </Button>
        </div>

        {pending && ideas.length === 0 && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {ideas.length > 0 && (
          <div className="space-y-3 pt-1">
            {ideas.map((idea, i) => (
              <div key={`${idea.title}-${i}`} className="rounded-md border bg-muted/20 p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium text-sm leading-snug">{idea.title}</p>
                  <Button size="sm" variant="ghost" onClick={() => handleUseIdea(idea)}>
                    Use
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
                {idea.description && (
                  <p className="text-xs text-muted-foreground">{idea.description}</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {idea.primaryKeyword && (
                    <Badge variant="secondary" className="text-[11px]">{idea.primaryKeyword}</Badge>
                  )}
                  {idea.competition && (
                    <Badge variant="outline" className="text-[11px]">{idea.competition} competition</Badge>
                  )}
                  {idea.searchIntent && (
                    <Badge variant="outline" className="text-[11px]">{idea.searchIntent}</Badge>
                  )}
                  <Badge variant="outline" className="text-[11px]">
                    SEO {idea.seoOpportunity}/100
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -------------------- Main workspace --------------------

export function ClientAiWorkspace() {
  const { data: workspace, isLoading } = useAiWorkspace();

  if (isLoading || !workspace) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  const unlocked = workspace.mode === 'platform' || workspace.mode === 'unlimited';

  return (
    <div className="space-y-6">
      <UsageCard />
      {!unlocked ? (
        <LockedCard />
      ) : (
        <>
          <GenerateArticleCard />
          <ContentToolsCard />
          <GenerateImagesCard />
          <ArticleIdeasCard />
        </>
      )}
    </div>
  );
}
