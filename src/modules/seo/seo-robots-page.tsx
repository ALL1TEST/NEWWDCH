'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Save,
  RotateCcw,
  Loader2,
  AlertTriangle,
  XCircle,
  FileCode,
  CheckCircle2,
  ExternalLink,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getApi, putApi, postApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useSiteStore } from '@/lib/stores/site-store';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ==================== Types ====================

interface RobotsData {
  id: string;
  content: string;
  publicUrl?: string;
  sitemapUrl?: string;
  domain?: string;
  liveContent?: string;
  publicHttpStatus?: number;
  publicSitemapHttpStatus?: number;
  isLiveSynced?: boolean;
  status?: 'PUBLISHED' | 'SAVED_NOT_PUBLISHED' | 'VERIFICATION_FAILED' | 'MISMATCH_DETECTED';
  statusLabel?: string;
  publishingStatus?: string;
  publishingMessage?: string;
  verificationDetails?: string[];
  createdAt: string;
  updatedAt: string;
}

interface ValidationWarning {
  type: 'warning' | 'error';
  message: string;
  line?: number;
  isBlockAll?: boolean;
}

// ==================== Validation ====================

function validateRobots(content: string, t: (key: string) => string): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const lines = content.split('\n');

  if (!content.trim()) {
    warnings.push({ type: 'error', message: t('seo.validationEmpty'), line: 1 });
    return warnings;
  }

  const hasUserAgent = lines.some((line) =>
    line.toLowerCase().trimStart().startsWith('user-agent:'),
  );
  if (!hasUserAgent) {
    warnings.push({ type: 'error', message: t('seo.validationNoUserAgent') });
  }

  // Check Sitemap URL validity
  lines.forEach((line, idx) => {
    if (line.toLowerCase().trimStart().startsWith('sitemap:')) {
      const url = line.slice(line.indexOf(':') + 1).trim();
      if (!url) {
        warnings.push({
          type: 'error',
          message: 'Sitemap directive cannot be empty. Please specify a full URL (e.g. https://verdantt.vercel.app/sitemap.xml)',
          line: idx + 1,
        });
      } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
        warnings.push({
          type: 'warning',
          message: `${t('seo.validationSitemapPrefix')}${url}${t('seo.validationQuote')}`,
          line: idx + 1,
        });
      } else if (url.includes('example.com') || url.includes('cms.example.com')) {
        warnings.push({
          type: 'error',
          message: 'Sitemap URL must point to your real connected website, not example.com',
          line: idx + 1,
        });
      }
    }
  });

  // Check for dangerous Disallow: / in User-agent: * groups
  let inWildcardGroup = false;
  let lastLineWasUserAgent = false;
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) return;
    const directive = trimmed.slice(0, colonIdx).trim().toLowerCase();
    const value = trimmed.slice(colonIdx + 1).trim();

    if (directive === 'user-agent') {
      if (!lastLineWasUserAgent) {
        inWildcardGroup = value === '*';
      }
      lastLineWasUserAgent = true;
    } else {
      lastLineWasUserAgent = false;
      if (directive === 'disallow' && value === '/' && inWildcardGroup) {
        warnings.push({
          type: 'error',
          message: t('seo.validationBlockAllDesc'),
          line: idx + 1,
          isBlockAll: true,
        });
      }
    }
  });

  // Parse into groups for conflict detection
  interface RobotGroup { agents: string[]; allowPaths: string[]; disallowPaths: string[]; }
  const groups: RobotGroup[] = [];
  let currentGroup: RobotGroup | null = null;
  lastLineWasUserAgent = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const directive = trimmed.slice(0, colonIdx).trim().toLowerCase();
    const value = trimmed.slice(colonIdx + 1).trim();

    if (directive === 'user-agent') {
      if (lastLineWasUserAgent && currentGroup) {
        currentGroup.agents.push(value.toLowerCase());
      } else {
        currentGroup = { agents: [value.toLowerCase()], allowPaths: [], disallowPaths: [] };
        groups.push(currentGroup);
      }
      lastLineWasUserAgent = true;
    } else {
      lastLineWasUserAgent = false;
      if (!currentGroup) continue;
      if (directive === 'allow' && value) currentGroup.allowPaths.push(value.toLowerCase());
      else if (directive === 'disallow' && value) currentGroup.disallowPaths.push(value.toLowerCase());
    }
  }

  // Conflicting Allow/Disallow within same group
  for (const group of groups) {
    const conflicts = group.allowPaths.filter((p) => group.disallowPaths.includes(p));
    if (conflicts.length > 0) {
      warnings.push({
        type: 'warning',
        message: `${t('seo.validationConflictPrefix')}${conflicts.join(', ')}${t('seo.validationConflictMid')}${group.agents.join(', ')}${t('seo.validationConflictSuffix')}`,
      });
    }
  }

  // Duplicate user-agent groups
  const agentCounts = new Map<string, number>();
  for (const group of groups) for (const a of group.agents) agentCounts.set(a, (agentCounts.get(a) || 0) + 1);
  for (const [agent, count] of agentCounts) {
    if (count > 1) warnings.push({ type: 'warning', message: `${t('seo.validationDuplicatePrefix')}${agent}${t('seo.validationDuplicateSuffix')}` });
  }

  // Invalid directives
  const validDirectives = new Set(['user-agent', 'disallow', 'allow', 'sitemap', 'crawl-delay', 'request-rate', 'host', 'clean-param']);
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      warnings.push({ type: 'warning', message: `${t('seo.validationInvalidSyntaxPrefix')}${trimmed.slice(0, 50)}${t('seo.validationQuote')}`, line: idx + 1 });
    } else {
      const directive = trimmed.slice(0, colonIdx).trim().toLowerCase();
      if (!validDirectives.has(directive)) {
        warnings.push({ type: 'warning', message: `${t('seo.validationUnrecognizedPrefix')}${directive}${t('seo.validationQuote')}`, line: idx + 1 });
      }
    }
  });

  return warnings;
}

// ==================== Default Content ====================

function getDefaultContent(domain: string): string {
  const cleanDomain = domain.includes('example.com') ? 'verdantt.vercel.app' : domain;
  return `User-agent: *\nAllow: /\n\nSitemap: https://${cleanDomain}/sitemap.xml`;
}

// ==================== Status Badge ====================

function getRobotsStatusBadge(robots?: RobotsData) {
  if (!robots) return null;

  const status = robots.status || (robots.isLiveSynced ? 'PUBLISHED' : 'SAVED_NOT_PUBLISHED');

  switch (status) {
    case 'PUBLISHED':
      return (
        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-transparent font-medium gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Published & Live
        </Badge>
      );
    case 'MISMATCH_DETECTED':
      return (
        <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800 font-medium gap-1">
          <AlertTriangle className="h-3 w-3" />
          Mismatch detected
        </Badge>
      );
    case 'VERIFICATION_FAILED':
      return (
        <Badge variant="destructive" className="font-medium gap-1">
          <XCircle className="h-3 w-3" />
          Public verification failed
        </Badge>
      );
    case 'SAVED_NOT_PUBLISHED':
    default:
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800 font-medium gap-1">
          <Clock className="h-3 w-3" />
          Saved in CMS — not published
        </Badge>
      );
  }
}

// ==================== Code Editor ====================

function CodeEditor({
  content,
  onChange,
  warningLines,
}: {
  content: string;
  onChange: (val: string) => void;
  warningLines: Set<number>;
}) {
  const { t } = useT();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const lines = content.split('\n');

  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  return (
    <div className="relative rounded-md border border-border bg-background overflow-hidden transition-colors focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20">
      <div className="flex">
        {/* Line numbers gutter */}
        <div
          ref={lineNumbersRef}
          aria-hidden="true"
          className="flex-shrink-0 overflow-hidden bg-muted/30 border-r border-border py-3 select-none"
          style={{ width: '3.5rem' }}
        >
          {lines.map((_, i) => (
            <div
              key={i}
              className={cn(
                'text-right pr-3 text-xs leading-6 font-mono tabular-nums',
                warningLines.has(i + 1)
                  ? 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30'
                  : 'text-muted-foreground/50',
              )}
            >
              {i + 1}
            </div>
          ))}
        </div>
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          aria-label={t('seo.robotsContentAria')}
          className="flex-1 min-h-[440px] bg-transparent px-4 py-3 font-mono text-sm leading-6 resize-y border-0 focus-visible:outline-none text-foreground placeholder:text-muted-foreground/40"
          value={content}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
          placeholder="User-agent: *&#10;Allow: /"
        />
      </div>
    </div>
  );
}

// ==================== Main Page ====================

export function SeoRobotsPage() {
  const { t } = useT();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [blockAllConfirmOpen, setBlockAllConfirmOpen] = useState(false);
  const activeSite = useSiteStore((s) => s.getActiveSite());
  const domain = (activeSite?.domain && !activeSite.domain.includes('example.com'))
    ? activeSite.domain
    : 'verdantt.vercel.app';

  const { data: robots, isLoading, error } = useQuery({
    queryKey: queryKeys.seoRobots.all,
    queryFn: () => getApi<RobotsData>('/api/seo/robots'),
    staleTime: 30_000,
  });

  const rawServerContent = robots?.content ?? '';
  const [lastSynced, setLastSynced] = useState('');

  if (rawServerContent && rawServerContent !== lastSynced && !isDirty) {
    let sanitized = rawServerContent;
    if (sanitized.includes('example.com')) {
      sanitized = sanitized.replace(/https:\/\/(?:cms\.)?example\.com/g, `https://${domain}`);
    }
    if (/Sitemap:\s*(\n|$)/i.test(sanitized)) {
      sanitized = sanitized.replace(/Sitemap:\s*(\n|$)/gi, `Sitemap: https://${domain}/sitemap.xml$1`);
    }
    setLastSynced(rawServerContent);
    setContent(sanitized);
  }

  const handleContentChange = useCallback((val: string) => {
    setContent(val);
    setIsDirty(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: (newContent: string) => putApi<{ data: RobotsData }>('/api/seo/robots', { content: newContent }),
    onSuccess: (res: any) => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.seoRobots.all });
      const data = res?.data ?? res;
      if (data?.isLiveSynced) {
        toast.success(data?.publishingMessage || 'Published and Live on Public Site');
      } else {
        toast.warning(data?.publishingMessage || 'Saved in CMS, but not published to the public site.', {
          duration: 7000,
        });
      }
    },
    onError: () => {
      toast.error(t('seo.robotsSaveFailed'));
    },
  });

  // Verify Public Robots.txt mutation
  const verifyMutation = useMutation({
    mutationFn: () => postApi<{ data: RobotsData }>('/api/seo/robots?action=verify'),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoRobots.all });
      const data = res?.data ?? res;
      if (data?.isLiveSynced) {
        toast.success(data?.publishingMessage || 'Published and Live on Public Site');
      } else if (data?.status === 'MISMATCH_DETECTED') {
        toast.error(data?.publishingMessage || 'Mismatch detected with public robots.txt');
      } else if (data?.status === 'VERIFICATION_FAILED') {
        toast.error(data?.publishingMessage || 'Public verification failed');
      } else {
        toast.warning(data?.publishingMessage || 'Saved in CMS — not published');
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to verify public robots.txt');
    },
  });

  const handleRestore = useCallback(() => {
    const defaultContent = getDefaultContent(domain);
    setContent(defaultContent);
    setIsDirty(true);
    setRestoreConfirmOpen(false);
    toast.info(t('seo.robotsRestored'));
  }, [domain, t]);

  const warnings = useMemo(
    () => (isLoading ? [] : validateRobots(content, t)),
    [isLoading, content, t],
  );
  const warningLines = useMemo(() => {
    const s = new Set<number>();
    warnings.forEach((w) => { if (w.line) s.add(w.line); });
    return s;
  }, [warnings]);

  const hasBlockAllError = warnings.some((w) => w.isBlockAll);

  const handleSaveClick = useCallback(() => {
    if (hasBlockAllError) {
      setBlockAllConfirmOpen(true);
    } else {
      saveMutation.mutate(content);
    }
  }, [hasBlockAllError, saveMutation, content]);

  const lineCount = content.split('\n').length;
  const publicRobotsUrl = robots?.publicUrl || `https://${domain}/robots.txt`;
  const sitemapUrl = robots?.sitemapUrl || `https://${domain}/sitemap.xml`;
  const status = robots?.status || (robots?.isLiveSynced ? 'PUBLISHED' : 'SAVED_NOT_PUBLISHED');

  return (
    <div className="space-y-4">
      {/* Error state */}
      {error && !isLoading && (
        <Card className="border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">
              {t('seo.robotsLoadFailed')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Public Deployment & Live Sync Status Banner */}
      {!isLoading && robots && (
        <>
          {status === 'PUBLISHED' ? (
            <Card className="border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-emerald-900 dark:text-emerald-200 text-sm">
                      Published and Live on Public Site
                    </p>
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-300 font-mono text-[10px]">
                      HTTP {robots.publicHttpStatus || 200}
                    </Badge>
                  </div>
                  <p className="text-emerald-800/90 dark:text-emerald-300/90 leading-relaxed">
                    The live robots.txt at{' '}
                    <a
                      href={publicRobotsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono font-medium underline text-emerald-900 dark:text-emerald-100 inline-flex items-center gap-1"
                    >
                      {publicRobotsUrl}
                      <ExternalLink className="h-3 w-3" />
                    </a>{' '}
                    matches your CMS configuration and references the real verified sitemap (<code className="px-1 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 rounded font-mono text-[11px]">{sitemapUrl}</code>).
                  </p>
                </div>
              </div>
            </Card>
          ) : status === 'MISMATCH_DETECTED' ? (
            <Card className="border-orange-200 dark:border-orange-900/60 bg-orange-50/70 dark:bg-orange-950/30 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-orange-900 dark:text-orange-200 text-sm">
                    Mismatch detected with Public robots.txt
                  </p>
                  <p className="text-orange-800/90 dark:text-orange-300/90 leading-relaxed">
                    {robots.publishingMessage || 'Public robots.txt does not match CMS requirements.'}
                  </p>
                  {robots.verificationDetails && robots.verificationDetails.length > 0 && (
                    <ul className="list-disc list-inside text-orange-800/80 dark:text-orange-300/80 pt-1 space-y-0.5">
                      {robots.verificationDetails.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>
          ) : status === 'VERIFICATION_FAILED' ? (
            <Card className="border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 p-4">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-red-900 dark:text-red-200 text-sm">
                    Public verification failed
                  </p>
                  <p className="text-red-800/90 dark:text-red-300/90 leading-relaxed">
                    {robots.publishingMessage || 'Could not verify public endpoint.'}
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-4">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
                    Saved in CMS — not published to the public site
                  </p>
                  <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                    Changes saved here are stored in the CMS database. The public website at{' '}
                    <a
                      href={publicRobotsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono font-medium underline text-amber-900 dark:text-amber-100 inline-flex items-center gap-1"
                    >
                      {publicRobotsUrl}
                      <ExternalLink className="h-3 w-3" />
                    </a>{' '}
                    has not yet been updated with these directives.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Validation Warnings */}
      {warnings.length > 0 && (
        <Card className={cn(
          'border',
          warnings.some((w) => w.type === 'error')
            ? 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20'
            : 'border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20'
        )}>
          <CardContent className="p-4 space-y-2">
            <div className={cn(
              'flex items-center gap-2 text-sm font-medium',
              warnings.some((w) => w.type === 'error')
                ? 'text-red-700 dark:text-red-400'
                : 'text-amber-700 dark:text-amber-400'
            )}>
              {warnings.some((w) => w.type === 'error')
                ? <XCircle className="h-4 w-4 shrink-0" />
                : <AlertTriangle className="h-4 w-4 shrink-0" />}
              {warnings.some((w) => w.type === 'error') ? t('seo.validationErrors') : t('seo.validationWarnings')}
            </div>
            {warnings.map((w, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2 text-xs pl-6',
                  w.type === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-amber-600 dark:text-amber-400',
                )}
              >
                <span>
                  {w.line && <span className="text-muted-foreground/60">{t('seo.line')} {w.line}: </span>}
                  {w.message}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Editor Card */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-4 p-5">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-[440px] w-full" />
            <Skeleton className="h-4 w-64" />
          </div>
        ) : (
          <div>
            {/* Toolbar header strip */}
            <div className="flex flex-col gap-3 border-b border-border bg-muted/30 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">{t('seo.editor')}</h3>
                </div>
                {getRobotsStatusBadge(robots)}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => verifyMutation.mutate()}
                  disabled={verifyMutation.isPending}
                  className="gap-1.5"
                >
                  {verifyMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 text-primary" />
                  )}
                  Verify Public Robots.txt
                </Button>

                <Button
                  onClick={handleSaveClick}
                  disabled={saveMutation.isPending || !isDirty}
                  size="sm"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {t('common.save')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRestoreConfirmOpen(true)}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {t('seo.restoreDefault')}
                </Button>
              </div>
            </div>

            {/* Editor body */}
            <div className="p-5">
              <CodeEditor
                content={content}
                onChange={handleContentChange}
                warningLines={warningLines}
              />

              {/* Footer bar */}
              <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                <span className="font-mono tabular-nums">
                  {lineCount} {t('seo.lines')} · {content.length.toLocaleString()} {t('seo.characters')}
                </span>
                {isDirty && (
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    {t('seo.modified')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Restore Default Confirmation */}
      <AlertDialog open={restoreConfirmOpen} onOpenChange={setRestoreConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('seo.restoreDefaultTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('seo.restoreDefaultDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>
              {t('seo.restoreDefault')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block All Confirmation */}
      <AlertDialog open={blockAllConfirmOpen} onOpenChange={setBlockAllConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-500" />
              {t('seo.blockAllTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {t('seo.blockAllContains')} <code className="font-mono text-red-600 dark:text-red-400 font-medium">Disallow: /</code> {t('seo.blockAllFor')} <code className="font-mono font-medium">User-agent: *</code>.
              </span>
              <span className="block">
                {t('seo.blockAllDescription')}
              </span>
              <span className="block font-medium">
                {t('seo.blockAllConfirm')}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                setBlockAllConfirmOpen(false);
                saveMutation.mutate(content);
              }}
            >
              {t('seo.saveAnyway')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
