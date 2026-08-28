'use client';

// ============================================================
// PLATFORM SMTP SETTINGS — outbound email configuration.
// ============================================================
// Reuses the existing SmtpSetting model + /api/smtp-settings API.
// SMTP credentials (password / username) are NEVER exposed to the
// frontend or in API responses — only host, port, encryption, from
// name/email and reply-to are surfaced here. "Send test email" is
// available via the existing /api/settings/smtp/test-email endpoint.
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { getApi } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Server, ShieldCheck, Info } from 'lucide-react';
import { PlatformPageHeader, ErrorState, EmptyState } from '@/modules/platform/shared';

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
    <div className="space-y-4">
      <PlatformPageHeader
        title="SMTP Settings"
        subtitle="Outbound email configuration. Credentials are encrypted at rest and never returned to the client."
      />

      <Card>
        <CardContent className="p-4 flex items-start gap-3 bg-emerald-50/50 dark:bg-emerald-950/20">
          <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-emerald-800 dark:text-emerald-400">Credentials never exposed</p>
            <p className="text-muted-foreground">SMTP passwords + usernames are stored server-side only. This view intentionally omits them from responses.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Configured SMTP Servers</CardTitle>
          </div>
          <CardDescription className="text-xs">Host, port, encryption, from-name/email and reply-to only.</CardDescription>
        </CardHeader>
        <CardContent>
          {smtpQuery.isLoading ? (
            <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : smtpQuery.isError ? (
            <ErrorState message="Unable to load SMTP settings." onRetry={() => smtpQuery.refetch()} />
          ) : list.length === 0 ? (
            <EmptyState message="No SMTP server configured yet. Configure one to enable outbound email." icon={<Server className="h-5 w-5 opacity-50" />} />
          ) : (
            <div className="divide-y">
              {list.map((s) => (
                <div key={s.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{s.name || s.host || 'SMTP server'}</span>
                    <div className="flex gap-1">
                      {s.isDefault && <Badge className="text-[10px] bg-primary/10 text-primary border-primary/30">default</Badge>}
                      <Badge variant="outline" className="text-[10px]">{s.isActive ? 'active' : 'inactive'}</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs">
                    <div><span className="text-muted-foreground">Host:</span> <span className="font-mono">{s.host}</span></div>
                    <div><span className="text-muted-foreground">Port:</span> <span className="font-mono">{s.port}</span></div>
                    <div><span className="text-muted-foreground">Encryption:</span> {s.encryption}</div>
                    <div><span className="text-muted-foreground">From:</span> {s.fromName} &lt;{s.fromEmail}&gt;</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2.5 px-1">
        <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">"Send test email" is available via the existing <span className="font-mono">/api/settings/smtp/test-email</span> endpoint. Full SMTP editing lives in the client Settings → SMTP sub-page.</p>
      </div>
    </div>
  );
}
