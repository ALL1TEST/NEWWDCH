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
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { getApi, putApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useSiteStore } from '@/lib/stores/site-store';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ==================== Types ====================

interface RobotsData {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface ValidationWarning {
  type: 'warning' | 'error';
  message: string;
  line?: number;
  /** Stable locale-independent marker for the "Disallow: /" wildcard rule —
   *  used instead of matching on the (translated) message text. */
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
      if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        warnings.push({ type: 'warning', message: `${t('seo.validationSitemapPrefix')}${url}${t('seo.validationQuote')}`, line: idx + 1 });
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
      if (lastLineWasUserAgent) {
        // continuation of multi-agent group
      } else {
        inWildcardGroup = value === '*';
      }
      lastLineWasUserAgent = true;
    } else {
      lastLineWasUserAgent = false;
      if (directive === 'disallow' && value === '/' && inWildcardGroup) {
        warnings.push({
          type: 'error',
          message: t('seo.validationBlockAll'),
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
      warnings.push({ type: 'warning', message: `${t('seo.validationConflictPrefix')}${conflicts.join(', ')}${t('seo.validationConflictMid')}${group.agents.join(', ')}${t('seo.validationConflictSuffix')}` });
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
  return `User-agent: *\nAllow: /\n\nSitemap: https://${domain}/sitemap.xml`;
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

  // Sync scroll between the line-numbers gutter and the textarea
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
  const domain = activeSite?.domain ?? 'cms.example.com';

  const { data: robots, isLoading, error } = useQuery({
    queryKey: queryKeys.seoRobots.all,
    queryFn: () => getApi<RobotsData>('/api/seo/robots'),
    staleTime: 30_000,
  });

  const serverContent = robots?.content ?? '';
  // Sync content from server when loaded — key-based approach to avoid
  // setState-in-render lint by using a guard + lastSynced tracker.
  const [lastSynced, setLastSynced] = useState('');
  if (serverContent && serverContent !== lastSynced && !isDirty) {
    setLastSynced(serverContent);
    setContent(serverContent);
  }

  const handleContentChange = useCallback((val: string) => {
    setContent(val);
    setIsDirty(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: (newContent: string) => putApi('/api/seo/robots', { content: newContent }),
    onSuccess: () => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.seoRobots.all });
      toast.success(t('seo.robotsSaved'));
    },
    onError: () => {
      toast.error(t('seo.robotsSaveFailed'));
    },
  });

  const handleRestore = useCallback(() => {
    const defaultContent = getDefaultContent(domain);
    setContent(defaultContent);
    setIsDirty(true);
    setRestoreConfirmOpen(false);
    toast.info(t('seo.robotsRestored'));
  }, [domain, t]);

  // IMPORTANT: never validate while the server content is still loading — an
  // editor that is empty only because the GET /api/seo/robots response has not
  // arrived yet is NOT a validation error. Rendering the red "Robots.txt content
  // is empty" banner during that window flashed an incorrect intermediate
  // Robots.txt screen before the real content appeared. While loading we render
  // the page skeleton instead (see editor card below).
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

      {/* Validation Warnings — only renders when there are actual issues */}
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
            {/* Toolbar header strip — Editor label + actions */}
            <div className="flex flex-col gap-3 border-b border-border bg-muted/30 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">{t('seo.editor')}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
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

      {/* Block All Confirmation — SEO Safety */}
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
