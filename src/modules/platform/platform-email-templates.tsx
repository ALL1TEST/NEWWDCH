'use client';

// ============================================================
// PLATFORM EMAIL TEMPLATES — manage transactional email templates.
// ============================================================
// Reuses the existing EmailTemplate model + /api/email-templates API.
// Templates support subject, HTML body, plain text and variables.
// This is a read-only platform view of the templates; the full editor
// lives in the existing Email Templates module.
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { getApi } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, Info } from 'lucide-react';
import { PlatformPageHeader, ErrorState, EmptyState, formatDate } from '@/modules/platform/shared';

interface EmailTemplateRow {
  id: string;
  name: string;
  slug: string;
  subject: string;
  category: string;
  status: string;
  language: string;
  createdAt: string;
}

const TEMPLATE_VARIABLES = [
  '{{user_name}}', '{{user_email}}', '{{plan_name}}', '{{amount}}', '{{currency}}', '{{billing_date}}',
];

const SEED_TEMPLATES = [
  'welcome', 'email-verification', 'password-reset', 'payment-successful', 'payment-failed',
  'subscription-created', 'subscription-cancelled', 'trial-ending', 'invoice-receipt', 'account-suspended',
];

export function PlatformEmailTemplatesModule() {
  const templatesQuery = useQuery({
    queryKey: ['platform-email-templates'],
    queryFn: () => getApi<{ data: EmailTemplateRow[] } | EmailTemplateRow[]>('/api/email-templates?pageSize=50'),
    retry: false,
  });

  const raw = templatesQuery.data;
  const list: EmailTemplateRow[] = Array.isArray(raw) ? raw : ((raw as { data?: EmailTemplateRow[] })?.data ?? []);

  return (
    <div className="space-y-4">
      <PlatformPageHeader
        title="Email Templates"
        subtitle="Transactional email templates with subject, HTML body, plain text and variables. Reuses the existing EmailTemplate store."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Seed Templates</CardTitle>
          <CardDescription className="text-xs">System templates seeded for the platform. Use the full editor to customize body + subject.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {SEED_TEMPLATES.map((t) => (
              <Badge key={t} variant="outline" className="text-[10px] font-mono">{t}</Badge>
            ))}
          </div>
          <div className="flex items-start gap-2.5 mt-3">
            <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">Templates support these variables: <span className="font-mono">{TEMPLATE_VARIABLES.join(', ')}</span>.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Existing Templates</CardTitle>
        </CardHeader>
        <CardContent>
          {templatesQuery.isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : templatesQuery.isError ? (
            <ErrorState message="Unable to load templates (the API may be site-scoped; seed templates first)." onRetry={() => templatesQuery.refetch()} />
          ) : list.length === 0 ? (
            <EmptyState message="No templates yet. Use the Email Templates module to seed + edit." icon={<Mail className="h-5 w-5 opacity-50" />} />
          ) : (
            <div className="divide-y">
              {list.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{t.name}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{t.slug}</Badge>
                      <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.subject || '—'}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">{formatDate(t.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
