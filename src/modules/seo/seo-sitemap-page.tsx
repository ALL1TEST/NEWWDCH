'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileCode,
  Globe,
  RefreshCw,
  Send,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Zap,
  Link2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { getApi, postApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useSiteStore } from '@/lib/stores/site-store';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ==================== Types ====================

interface SitemapData {
  id: string;
  siteId: string;
  sitemapUrl: string;
  xmlContent: string;
  totalUrls: number;
  status: string;
  isPubliclyAccessible?: boolean;
  publicHttpStatus?: number;
  publishingStatus?: 'PUBLISHED' | 'GENERATED_LOCAL' | 'PENDING';
  publishingMessage?: string;
  autoGenerate: boolean;
  lastGenerated: string | null;
  lastPingGoogle: string | null;
  lastPingBing: string | null;
  createdAt: string;
  updatedAt: string;
}

// ==================== Helpers ====================

function formatDate(dateStr: string | null, t: (key: string) => string): string {
  if (!dateStr) return t('seo.never');
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return t('seo.unknown');
  }
}

function getStatusBadge(sitemap: SitemapData, t: (key: string) => string) {
  if (sitemap.isPubliclyAccessible) {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-transparent font-medium gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Published & Live
      </Badge>
    );
  }

  if (sitemap.status === 'GENERATED' || sitemap.publishingStatus === 'GENERATED_LOCAL') {
    return (
      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800 font-medium gap-1">
        <Clock className="h-3 w-3" />
        Generated in CMS — not published
      </Badge>
    );
  }

  if (sitemap.status === 'ERROR') {
    return (
      <Badge variant="destructive" className="font-medium gap-1">
        <XCircle className="h-3 w-3" />
        {t('seo.statusError')}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="font-medium gap-1">
      <Clock className="h-3 w-3" />
      Not Generated
    </Badge>
  );
}

function downloadBlob(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==================== Info Row ====================

function InfoRow({
  icon: Icon,
  label,
  value,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  iconColor?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', iconColor ?? 'text-muted-foreground')} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium mt-0.5">{value}</div>
      </div>
    </div>
  );
}

// ==================== Loading Skeleton ====================

function SitemapSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-4" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-36" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-32" />
        ))}
      </div>
    </div>
  );
}

// ==================== Main Page ====================

export function SeoSitemapPage() {
  const { t } = useT();
  const queryClient = useQueryClient();
  const [previewOpen, setPreviewOpen] = useState(false);
  const activeSite = useSiteStore((s) => s.getActiveSite());
  const domain = activeSite?.domain || 'verdantt.vercel.app';

  const { data: sitemap, isLoading, error } = useQuery({
    queryKey: queryKeys.seoSitemap.all,
    queryFn: () => getApi<SitemapData>('/api/seo/sitemap'),
    staleTime: 30_000,
  });

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: () => postApi<{ data: SitemapData }>('/api/seo/sitemap?action=generate'),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSitemap.all });
      const data = res?.data ?? res;
      if (data?.publishingMessage) {
        toast.info(data.publishingMessage);
      } else {
        toast.success(t('seo.sitemapGenerated'));
      }
    },
    onError: () => {
      toast.error(t('seo.sitemapGenerateFailed'));
    },
  });

  // Toggle auto mutation
  const toggleAutoMutation = useMutation({
    mutationFn: () => postApi('/api/seo/sitemap?action=toggle-auto'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSitemap.all });
      toast.success(t('seo.autoGenerateUpdated'));
    },
    onError: () => {
      toast.error(t('seo.autoGenerateUpdateFailed'));
    },
  });

  // Ping Google mutation
  const pingGoogleMutation = useMutation({
    mutationFn: async () => {
      const res = await postApi<{ pingResult?: string; pingHttpStatus?: number }>('/api/seo/sitemap?action=ping-google');
      return res;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSitemap.all });
      toast.success(res?.pingResult || t('seo.pingGoogleSuccess'));
    },
    onError: (err: Error & { details?: { httpStatus?: number } }) => {
      const msg = err.message || t('seo.pingGoogleFailed');
      toast.error(msg);
    },
  });

  // Ping Bing mutation
  const pingBingMutation = useMutation({
    mutationFn: async () => {
      const res = await postApi<{ pingResult?: string; pingHttpStatus?: number }>('/api/seo/sitemap?action=ping-bing');
      return res;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSitemap.all });
      toast.success(res?.pingResult || t('seo.pingBingSuccess'));
    },
    onError: (err: Error) => {
      toast.error(err.message || t('seo.pingBingFailed'));
    },
  });

  const sitemapUrl = sitemap?.sitemapUrl ?? `https://${domain}/sitemap.xml`;
  const xmlContent = sitemap?.xmlContent ?? '';

  return (
    <div className="space-y-6">
      {/* Error state */}
      {error && (
        <Card className="border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">
              {t('seo.sitemapLoadFailed')}
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <SitemapSkeleton />
      ) : sitemap ? (
        <>
          {/* Informational Banner for Public Deployment State */}
          {!sitemap.isPubliclyAccessible && sitemap.status === 'GENERATED' && (
            <Card className="border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
                    Generated in CMS — not published to the public site
                  </p>
                  <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                    The sitemap containing <strong>{sitemap.totalUrls} verified public URLs</strong> was generated from your live Verdant site structure. However, the public endpoint{' '}
                    <a
                      href={sitemapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono font-medium underline text-amber-900 dark:text-amber-100"
                    >
                      {sitemapUrl}
                    </a>{' '}
                    returned HTTP {sitemap.publicHttpStatus || 404}. Real sitemap generation is active in the CMS, but publishing requires deploying the generated <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/60 rounded font-mono text-[11px]">sitemap.xml</code> file to your connected frontend repository.
                  </p>
                  <p className="text-amber-800/80 dark:text-amber-300/80 pt-1">
                    Click <strong>Preview XML</strong> or <strong>Download sitemap.xml</strong> below to inspect or deploy the verified file.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {sitemap.isPubliclyAccessible && (
            <Card className="border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200 text-sm">
                    Published and Live on Public Site
                  </p>
                  <p className="text-emerald-800/90 dark:text-emerald-300/90 leading-relaxed">
                    The public sitemap at{' '}
                    <a
                      href={sitemapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono font-medium underline text-emerald-900 dark:text-emerald-100"
                    >
                      {sitemapUrl}
                    </a>{' '}
                    is verified accessible and serving valid XML for search engine indexation.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Info Card */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold text-sm">{t('seo.sitemapInformation')}</h3>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(sitemap, t)}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              <InfoRow
                icon={ExternalLink}
                label={t('seo.currentSitemapUrl')}
                value={
                  <a
                    href={sitemapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-mono text-xs break-all"
                  >
                    {sitemapUrl}
                  </a>
                }
                iconColor="text-primary"
              />
              <InfoRow
                icon={Clock}
                label={t('seo.lastGenerated')}
                value={formatDate(sitemap.lastGenerated, t)}
              />
              <InfoRow
                icon={Link2}
                label={t('seo.totalUrls')}
                value={(sitemap.totalUrls ?? 0).toLocaleString()}
                iconColor="text-emerald-600 dark:text-emerald-400"
              />
              <InfoRow
                icon={Globe}
                label={t('seo.lastPingGoogle')}
                value={formatDate(sitemap.lastPingGoogle, t)}
              />
              <InfoRow
                icon={Zap}
                label={t('seo.autoGenerate')}
                value={
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={sitemap.autoGenerate}
                      onCheckedChange={() => toggleAutoMutation.mutate()}
                      disabled={toggleAutoMutation.isPending}
                    />
                    <span className="text-xs text-muted-foreground">
                      {sitemap.autoGenerate ? t('seo.enabled') : t('seo.disabled')}
                    </span>
                  </div>
                }
              />
              <InfoRow
                icon={Send}
                label={t('seo.lastPingBing')}
                value={formatDate(sitemap.lastPingBing, t)}
              />
            </div>
          </Card>

          {/* Action Buttons */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-sm">{t('common.actions')}</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {generateMutation.isPending ? t('seo.generating') : t('seo.generateSitemap')}
              </Button>

              <Button
                variant="outline"
                onClick={() => pingGoogleMutation.mutate()}
                disabled={pingGoogleMutation.isPending}
              >
                {pingGoogleMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4 mr-2" />
                )}
                {pingGoogleMutation.isPending ? t('seo.pinging') : t('seo.pingGoogle')}
              </Button>

              <Button
                variant="outline"
                onClick={() => pingBingMutation.mutate()}
                disabled={pingBingMutation.isPending}
              >
                {pingBingMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {pingBingMutation.isPending ? t('seo.pinging') : t('seo.pingBing')}
              </Button>

              <Separator orientation="vertical" className="h-9 hidden sm:block" />

              <Button
                variant="outline"
                onClick={() => setPreviewOpen(true)}
                disabled={!xmlContent}
              >
                <Eye className="h-4 w-4 mr-2" />
                {t('seo.previewSitemap')}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  if (xmlContent) {
                    downloadBlob(xmlContent, 'sitemap.xml');
                    toast.success(t('seo.sitemapDownloaded'));
                  } else {
                    toast.error(t('seo.noSitemapContent'));
                  }
                }}
                disabled={!xmlContent}
              >
                <Download className="h-4 w-4 mr-2" />
                {t('seo.downloadSitemap')}
              </Button>
            </div>
          </Card>

          {/* XML Preview Dialog */}
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>{t('seo.sitemapXmlPreview')}</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-auto rounded bg-muted p-4 font-mono text-xs">
                <pre className="whitespace-pre-wrap break-all">
                  <code>{xmlContent || '<?xml version="1.0" encoding="UTF-8"?>\n<!-- No sitemap content available -->'}</code>
                </pre>
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}
