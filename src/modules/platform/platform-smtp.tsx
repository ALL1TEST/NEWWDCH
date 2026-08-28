'use client';

// ============================================================
// PLATFORM SMTP SETTINGS — outbound email configuration.
// ============================================================
// Reuses the existing SmtpSetting model + /api/smtp-settings API.
// SMTP credentials (password / username) are NEVER exposed to the
// frontend or in API responses — only host, port, encryption, from
// name/email and reply-to are surfaced here. "Send test email" is
// available via the existing /api/settings/smtp/test-email endpoint.
// Visual language mirrors the Client Dashboard SMTP Settings page:
// same PageHeader, same grid of ProviderCards, same EmptyState, same
// alert box pattern.
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { getApi } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Server, ShieldCheck, Info } from 'lucide-react';
import {
  PageHeader,
  EmptyState,
} from '@/components/patterns';
import { ErrorState, formatRelative } from '@/modules/platform/shared';
import { cn } from '@/lib/utils';

interface SmtpSettingRow {
  id: string;
  name: string;
  host: string;
  port: number;
  encryption: string;
  username: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  isDefault: boolean;
  isActive: boolean;
  updatedAt?: string;
}

export function PlatformSmtpModule() {
  const smtpQuery = useQuery({
    queryKey: ['platform-smtp'],
    queryFn: () => getApi<{ data: SmtpSettingRow[] } | SmtpSettingRow[]>('/api/smtp-settings'),
    retry: false,
  });

  const raw = smtpQuery.data;
  const list: SmtpSettingRow[] = Array.isArray(raw) ? raw : ((raw as { data?: SmtpSettingRow[] })?.data ?? []);

  return (
    <div className="space-y-6">
      {/* ==================== Page Header (Client Dashboard style) ==================== */}
      <PageHeader
        breadcrumbs={false}
        title="SMTP Settings"
        description="Outbound email configuration. Credentials are encrypted at rest and never returned to the client."
      />

      {/* ==================== Credentials security alert (same alert pattern) ==================== */}
      <Card>
        <CardContent className="p-4 flex items-start gap-3 bg-emerald-50/50 dark:bg-emerald-950/20">
          <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-emerald-800 dark:text-emerald-400">Credentials never exposed</p>
            <p className="text-muted-foreground">
              SMTP passwords + usernames are stored server-side only. This view intentionally omits them from responses.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ==================== Configured SMTP Servers ==================== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Configured SMTP Servers</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Host, port, encryption, from-name/email and reply-to only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {smtpQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-xl" />
              ))}
            </div>
          ) : smtpQuery.isError ? (
            <ErrorState message="Unable to load SMTP settings." onRetry={() => smtpQuery.refetch()} />
          ) : list.length === 0 ? (
            <EmptyState
              icon={Server}
              title="No Email Providers"
              description="No SMTP server is configured yet. Configure one to enable outbound email."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((s) => (
                <ProviderCard key={s.id} setting={s} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ==================== Info footer (same alert pattern) ==================== */}
      <div className="flex items-start gap-2.5 rounded-lg border bg-muted/30 p-3">
        <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          &quot;Send test email&quot; is available via the existing{' '}
          <span className="font-mono">/api/settings/smtp/test-email</span> endpoint. Full SMTP editing lives in the
          client Settings → SMTP sub-page.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Provider Card — mirrors the Client Dashboard SMTP ProviderCard
// layout: rounded-xl border bg-card shadow-sm hover:shadow-md,
// header with icon + name + Default badge, body with InfoRow,
// status row with badge + last updated.
// ============================================================

function ProviderCard({ setting }: { setting: SmtpSettingRow }) {
  return (
    <div
      className={cn(
        'relative group rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md',
        !setting.isActive && 'opacity-60',
      )}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              'flex items-center justify-center h-10 w-10 rounded-lg shrink-0',
              'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
            )}
          >
            <Server className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground truncate">
                {setting.name || setting.host || 'SMTP server'}
              </h3>
              {setting.isDefault && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 shrink-0 text-[10px]">
                  Default
                </Badge>
              )}
            </div>
            <Badge variant="outline" className="text-[10px] mt-1">
              {setting.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="px-4 pb-4 space-y-2.5">
        {/* Host info */}
        <InfoRow label="Host">
          <span className="font-mono text-xs truncate">{setting.host || '—'}</span>
          {setting.host && (
            <span className="text-muted-foreground text-xs">:{setting.port}</span>
          )}
        </InfoRow>

        {/* Encryption */}
        <InfoRow label="Encryption">
          <span className="text-xs text-muted-foreground">{setting.encryption || '—'}</span>
        </InfoRow>

        {/* From Email */}
        {setting.fromEmail && (
          <InfoRow label="From">
            <span className="text-xs text-muted-foreground truncate">
              {setting.fromName && `${setting.fromName} <`}
              {setting.fromEmail}
              {setting.fromName && '>'}
            </span>
          </InfoRow>
        )}

        {/* Reply-To */}
        {setting.replyTo && (
          <InfoRow label="Reply-To">
            <span className="text-xs text-muted-foreground truncate">{setting.replyTo}</span>
          </InfoRow>
        )}

        {/* Status & Updated */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Badge
            variant="outline"
            className={cn(
              'font-medium border-transparent text-[10px] leading-4 px-1.5',
              setting.isActive
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
            )}
          >
            {setting.isActive ? 'Active' : 'Inactive'}
          </Badge>
          {setting.updatedAt && (
            <span className="text-[11px] text-muted-foreground">
              Updated {formatRelative(setting.updatedAt)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Info Row Helper — matches the Client Dashboard SMTP InfoRow.
// ============================================================

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[11px] font-medium text-muted-foreground w-16 shrink-0 pt-0.5">{label}</span>
      <div className="min-w-0 flex-1 text-foreground">{children}</div>
    </div>
  );
}
