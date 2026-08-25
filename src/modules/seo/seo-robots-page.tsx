'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Save,
  RotateCcw,
  Eye,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FileCode,
  Type,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getApi, putApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useSiteStore } from '@/lib/stores/site-store';
import { toast } from 'sonner';
import { cn, truncate } from '@/lib/utils';

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
}

// ==================== Validation ====================

function validateRobots(content: string): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const lines = content.split('\n');

  if (!content.trim()) {
    warnings.push({ type: 'error', message: 'Robots.txt content is empty' });
    return warnings;
  }

  const hasUserAgent = lines.some((line) =>
    line.toLowerCase().trimStart().startsWith('user-agent:'),
  );
  if (!hasUserAgent) {
    warnings.push({ type: 'error', message: 'No "User-agent:" directive found — crawlers may ignore your rules' });
  }

  // Check Sitemap URL validity — use slice(indexOf(':') + 1) to handle URLs with colons (https://)
  const sitemapLines = lines.filter((line) =>
    line.toLowerCase().trimStart().startsWith('sitemap:'),
  );
  for (const sl of sitemapLines) {
    const url = sl.slice(sl.indexOf(':') + 1).trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      warnings.push({ type: 'warning', message: `Sitemap URL should start with http:// or https://: "${url}"` });
    }
  }

  // Check for dangerous rules: Disallow: /
  const disallowAll = lines.some((line) => {
    const trimmed = line.trim().toLowerCase();
    return trimmed === 'disallow: /';
  });
  if (disallowAll) {
    warnings.push({ type: 'error', message: 'WARNING: This rule blocks all crawlers from accessing the entire website.' });
  }

  // Parse robots.txt into user-agent groups to check for REAL conflicts within the same group.
  // Multiple consecutive User-agent lines are a valid multi-agent group (NOT duplicates).
  // Only flag EXACT duplicates that appear in SEPARATE groups (same agent, different rule blocks).
  interface RobotGroup {
    agents: string[];
    allowPaths: string[];
    disallowPaths: string[];
  }
  const groups: RobotGroup[] = [];
  let currentGroup: RobotGroup | null = null;
  let lastLineWasUserAgent = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const directive = trimmed.slice(0, colonIdx).trim().toLowerCase();
    const value = trimmed.slice(colonIdx + 1).trim();

    if (directive === 'user-agent') {
      // If the previous line was also a User-agent, we're in a multi-agent group
      if (lastLineWasUserAgent && currentGroup) {
        currentGroup.agents.push(value.toLowerCase());
      } else {
        // Start a new group
        currentGroup = { agents: [value.toLowerCase()], allowPaths: [], disallowPaths: [] };
        groups.push(currentGroup);
      }
      lastLineWasUserAgent = true;
    } else {
      lastLineWasUserAgent = false;
      if (!currentGroup) continue;

      if (directive === 'allow' && value) {
        currentGroup.allowPaths.push(value.toLowerCase());
      } else if (directive === 'disallow' && value) {
        currentGroup.disallowPaths.push(value.toLowerCase());
      }
    }
  }

  // Check for conflicting Allow/Disallow on the same path WITHIN the same group
  for (const group of groups) {
    const conflicts = group.allowPaths.filter((p) => group.disallowPaths.includes(p));
    if (conflicts.length > 0) {
      const agentLabel = group.agents.join(', ');
      warnings.push({ type: 'warning', message: `Conflicting Allow/Disallow rules for paths: ${conflicts.join(', ')} (in User-agent: ${agentLabel})` });
    }
  }

  // Check for duplicate user-agent groups (same agent appears in multiple separate groups, NOT multi-agent groups)
  const agentGroupCounts = new Map<string, number>();
  for (const group of groups) {
    for (const agent of group.agents) {
      agentGroupCounts.set(agent, (agentGroupCounts.get(agent) || 0) + 1);
    }
  }
  for (const [agent, count] of agentGroupCounts) {
    if (count > 1) {
      warnings.push({ type: 'warning', message: `Duplicate User-agent directive for "${agent}" — rules may conflict` });
    }
  }

  // Check for invalid directives
  const validDirectives = new Set(['user-agent', 'disallow', 'allow', 'sitemap', 'crawl-delay', 'request-rate', 'host', 'clean-param']);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      warnings.push({ type: 'warning', message: `Invalid syntax (missing colon): "${truncate(trimmed, 50)}"` });
    } else {
      const directive = trimmed.slice(0, colonIdx).trim().toLowerCase();
      if (!validDirectives.has(directive)) {
        warnings.push({ type: 'warning', message: `Unrecognized directive: "${directive}" — may be ignored by crawlers` });
      }
    }
  }

  return warnings;
}

// ==================== Default Content ====================

function getDefaultContent(domain: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: https://${domain}/sitemap.xml`;
}

// ==================== Main Page ====================

export function SeoRobotsPage() {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const activeSite = useSiteStore((s) => s.getActiveSite());
  const domain = activeSite?.domain ?? 'cms.example.com';

  const { data: robots, isLoading, error } = useQuery({
    queryKey: queryKeys.seoRobots.all,
    queryFn: () => getApi<RobotsData>('/api/seo/robots'),
    staleTime: 30_000,
  });

  // Sync content from server when loaded
  const serverContent = robots?.content ?? '';
  React.useEffect(() => {
    if (serverContent && !isDirty) {
      setContent(serverContent);
    }
  }, [serverContent, isDirty]);

  const handleContentChange = useCallback((val: string) => {
    setContent(val);
    setIsDirty(true);
  }, []);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (newContent: string) => putApi('/api/seo/robots', { content: newContent }),
    onSuccess: () => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.seoRobots.all });
      toast.success('Robots.txt saved successfully');
    },
    onError: () => {
      toast.error('Failed to save robots.txt');
    },
  });

  const handleRestore = useCallback(() => {
    const defaultContent = getDefaultContent(domain);
    setContent(defaultContent);
    setIsDirty(true);
    toast.info('Restored to default robots.txt template');
  }, [domain]);

  const handleSave = useCallback(() => {
    saveMutation.mutate(content);
  }, [content, saveMutation]);

  // Validation warnings
  const warnings = useMemo(() => validateRobots(content), [content]);

  const charCount = content.length;
  const lineCount = content.split('\n').length;

  return (
    <div className="space-y-6">
      {/* Error state */}
      {error && (
        <Card className="border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">
              Failed to load robots.txt. You can still edit and save.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Validation Warnings */}
      {warnings.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Validation {warnings.some((w) => w.type === 'error') ? 'Errors' : 'Warnings'}
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
                <span className={w.type === 'error' ? 'font-medium' : ''}>
                  {w.type === 'error' ? '✗' : '⚠'} {w.message}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Editor Card */}
      <Card className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-9 w-64" />
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Editor</h3>
                {isDirty && (
                  <Badge variant="outline" className="text-xs font-normal text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                    Unsaved changes
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending || !isDirty}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save
                </Button>
                <Button variant="outline" onClick={handleRestore}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore Default
                </Button>
                <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Result
                </Button>
              </div>
            </div>

            {/* Textarea */}
            <textarea
              className={cn(
                'w-full min-h-[400px] rounded-lg border border-border bg-muted/30 px-4 py-3',
                'font-mono text-sm leading-relaxed resize-y',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'placeholder:text-muted-foreground/60',
              )}
              placeholder={getDefaultContent(domain)}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              spellCheck={false}
            />

            {/* Character count bar */}
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Type className="h-3 w-3" />
                  {charCount.toLocaleString()} characters
                </span>
                <span className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  {lineCount.toLocaleString()} lines
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {isDirty ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Modified
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Saved
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Robots.txt Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Formatted rules */}
            <div className="overflow-auto rounded-lg border bg-muted/30 p-4 max-h-[60vh]">
              <pre className="text-sm font-mono whitespace-pre-wrap text-foreground/80">
                <code>{content || '# robots.txt is empty'}</code>
              </pre>
            </div>
            {warnings.length === 0 && content.trim() && (
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                No validation issues found
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
