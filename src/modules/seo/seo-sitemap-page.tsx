'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileCode,
  RefreshCw,
  Download,
  Eye,
  Send,
  Globe,
  Loader2,
  Clock,
  Link2,
  Zap,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  XCircle,
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
  autoGenerate: boolean;
  lastGenerated: string | null;
  lastPingGoogle: string | null;
  lastPingBing: string | null;
  createdAt: string;
  updatedAt: string;
}

// ==================== Helpers ====================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Unknown';
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'GENERATED':
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-transparent font-medium">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Generated
        </Badge>
      );
    case 'PENDING':
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-transparent font-medium">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case 'ERROR':
      return (
        <Badge variant="destructive" className="font-medium">
          <XCircle className="h-3 w-3 mr-1" />
          Error
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="font-medium">
          {status}
        </Badge>
      );
  }
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
        <p className="text-sm font-medium mt-0.5">{value}</p>
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
  const queryClient = useQueryClient();
  const [previewOpen, setPreviewOpen] = useState(false);
  const activeSite = useSiteStore((s) => s.getActiveSite());
  const domain = activeSite?.domain ?? 'yourdomain.com';

  const { data: sitemap, isLoading, error } = useQuery({
    queryKey: queryKeys.seoSitemap.all,
    queryFn: () => getApi<SitemapData>('/api/seo/sitemap'),
    staleTime: 30_000,
  });

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: () => postApi('/api/seo/sitemap?action=generate'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSitemap.all });
      toast.success('Sitemap generated successfully');
    },
    onError: () => {
      toast.error('Failed to generate sitemap');
    },
  });

  // Toggle auto mutation
  const toggleAutoMutation = useMutation({
    mutationFn: () => postApi('/api/seo/sitemap?action=toggle-auto'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSitemap.all });
      toast.success('Auto-generate setting updated');
    },
    onError: () => {
      toast.error('Failed to update auto-generate setting');
    },
  });

  // Ping Google mutation
  const pingGoogleMutation = useMutation({
    mutationFn: () => postApi('/api/seo/sitemap?action=ping-google'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSitemap.all });
      toast.success('Successfully pinged Google');
    },
    onError: () => {
      toast.error('Failed to ping Google');
    },
  });

  // Ping Bing mutation
  const pingBingMutation = useMutation({
    mutationFn: () => postApi('/api/seo/sitemap?action=ping-bing'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seoSitemap.all });
      toast.success('Successfully pinged Bing');
    },
    onError: () => {
      toast.error('Failed to ping Bing');
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
              Failed to load sitemap data. Please try again later.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <SitemapSkeleton />
      ) : sitemap ? (
        <>
          {/* Info Card */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Sitemap Information</h3>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(sitemap.status)}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              <InfoRow
                icon={ExternalLink}
                label="Current Sitemap URL"
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
                label="Last Generated"
                value={formatDate(sitemap.lastGenerated)}
              />
              <InfoRow
                icon={Link2}
                label="Total URLs"
                value={(sitemap.totalUrls ?? 0).toLocaleString()}
                iconColor="text-emerald-600 dark:text-emerald-400"
              />
              <InfoRow
                icon={Globe}
                label="Last Ping — Google"
                value={formatDate(sitemap.lastPingGoogle)}
              />
              <InfoRow
                icon={Zap}
                label="Auto Generate"
                value={
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={sitemap.autoGenerate}
                      onCheckedChange={() => toggleAutoMutation.mutate()}
                      disabled={toggleAutoMutation.isPending}
                    />
                    <span className="text-xs text-muted-foreground">
                      {sitemap.autoGenerate ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                }
              />
              <InfoRow
                icon={Send}
                label="Last Ping — Bing"
                value={formatDate(sitemap.lastPingBing)}
              />
            </div>
          </Card>

          {/* Action Buttons */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Actions</h3>
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
                Generate Sitemap
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
                Ping Google
              </Button>

              <Button
                variant="outline"
                onClick={() => pingBingMutation.mutate()}
                disabled={pingBingMutation.isPending}
              >
                {pingBingMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Ping Bing
              </Button>

              <Separator orientation="vertical" className="h-9 hidden sm:block" />

              <Button
                variant="outline"
                onClick={() => setPreviewOpen(true)}
                disabled={!xmlContent}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview Sitemap
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  if (xmlContent) {
                    downloadBlob(xmlContent, 'sitemap.xml');
                    toast.success('Sitemap downloaded');
                  }
                }}
                disabled={!xmlContent}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Sitemap
              </Button>
            </div>
          </Card>
        </>
      ) : null}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Sitemap XML Preview</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto rounded-lg border bg-muted/30 p-4 max-h-[60vh]">
            <pre className="text-xs font-mono whitespace-pre-wrap break-all text-foreground/80">
              <code>{xmlContent || '<?xml version="1.0" encoding="UTF-8"?>\n<!-- No sitemap content available -->'}</code>
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
