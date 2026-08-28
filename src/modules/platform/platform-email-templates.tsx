'use client';

// ============================================================
// PLATFORM EMAIL TEMPLATES — manage transactional email templates.
// ============================================================
// Reuses the existing EmailTemplate model + /api/email-templates API.
// Templates support subject, HTML body, plain text and variables.
// This is a read-only platform view of the templates; the full editor
// lives in the existing Email Templates module.
// Visual language mirrors the Client Dashboard Email Templates page:
// same PageHeader, same rounded-lg border bg-card table container,
// same Skeleton rows, same EmptyState pattern.
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { getApi } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Mail, Info } from 'lucide-react';
import {
  PageHeader,
  EmptyState,
  StatusBadge,
} from '@/components/patterns';
import { ErrorState, formatDate } from '@/modules/platform/shared';
import { cn } from '@/lib/utils';

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
    <div className="space-y-6">
      {/* ==================== Page Header (Client Dashboard style) ==================== */}
      <PageHeader
        breadcrumbs={false}
        title="Email Templates"
        description="Transactional email templates with subject, HTML body, plain text and variables. Reuses the existing EmailTemplate store."
      />

      {/* ==================== Seed Templates Info Card ==================== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Seed Templates</CardTitle>
          <CardDescription className="text-xs">
            System templates seeded for the platform. Use the full editor to customize body + subject.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {SEED_TEMPLATES.map((t) => (
              <Badge
                key={t}
                variant="outline"
                className="text-[10px] font-mono border-dashed text-muted-foreground"
              >
                {t}
              </Badge>
            ))}
          </div>
          <div className="flex items-start gap-2.5 mt-4 rounded-lg border bg-muted/30 p-3">
            <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Templates support these variables:{' '}
              <span className="font-mono">{TEMPLATE_VARIABLES.join(', ')}</span>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ==================== Existing Templates Table (Client Dashboard style) ==================== */}
      <div className="rounded-lg border bg-card">
        {templatesQuery.isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-20 ml-auto" />
              </div>
            ))}
          </div>
        ) : templatesQuery.isError ? (
          <div className="py-6">
            <ErrorState
              message="Unable to load templates (the API may be site-scoped; seed templates first)."
              onRetry={() => templatesQuery.refetch()}
            />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No templates found"
            description="No email templates exist yet. Use the Email Templates module to seed + edit."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Template Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Language</TableHead>
                <TableHead className="pr-4 text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((t) => (
                <TableRow key={t.id} className="group">
                  {/* Template Name */}
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate font-medium text-foreground">{t.name}</span>
                    </div>
                    {t.subject && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.subject}</p>
                    )}
                  </TableCell>

                  {/* Slug */}
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono text-muted-foreground border-dashed"
                    >
                      {t.slug}
                    </Badge>
                  </TableCell>

                  {/* Category */}
                  <TableCell>
                    {t.category ? (
                      <StatusBadge status={t.category} size="sm" />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    {t.status ? (
                      <StatusBadge status={t.status} size="sm" />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>

                  {/* Language */}
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="shrink-0 px-1.5 py-0 text-[10px] font-bold uppercase"
                    >
                      {t.language || 'EN'}
                    </Badge>
                  </TableCell>

                  {/* Created */}
                  <TableCell className="pr-4 text-right">
                    <span className="text-xs text-muted-foreground">{formatDate(t.createdAt)}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
