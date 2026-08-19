'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Monitor,
  Tablet,
  Smartphone,
  Moon,
  Sun,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import type {
  EmailTemplateStatus,
  EmailTemplateCategory,
  EmailProvider,
} from '@/shared/types';

// ============================================================
// Types
// ============================================================

interface TemplatePreviewProps {
  templateId: string;
  onBack: () => void;
}

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  subject: string;
  htmlBody: string;
  category: EmailTemplateCategory;
  status: EmailTemplateStatus;
  provider: EmailProvider;
  language: string;
  isSystem: boolean;
  previewText: string | null;
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  trackOpens: boolean;
  trackClicks: boolean;
  enableAttachments: boolean;
  defaultBody: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { versions: number };
}

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

// ============================================================
// Variable Replacement Map
// ============================================================

const DUMMY_DATA: Record<string, string> = {
  '{{customer.first_name}}': 'John',
  '{{customer.last_name}}': 'Doe',
  '{{customer.name}}': 'John Doe',
  '{{customer.email}}': 'john.doe@example.com',
  '{{customer.phone}}': '+1 (555) 123-4567',
  '{{customer.company}}': 'Acme Inc.',
  '{{user.first_name}}': 'John',
  '{{user.last_name}}': 'Doe',
  '{{user.name}}': 'John Doe',
  '{{user.email}}': 'john.doe@example.com',
  '{{user.role}}': 'Admin',
  '{{site.name}}': 'Travel Blog',
  '{{site.url}}': 'https://travelblog.com',
  '{{site.domain}}': 'travelblog.com',
  '{{site.description}}': 'Your daily source of travel inspiration and guides.',
  '{{company.name}}': 'RankBolt',
  '{{company.url}}': 'https://rankbolt.com',
  '{{company.support_email}}': 'support@rankbolt.com',
  '{{article.title}}': '10 Best Travel Destinations for 2025',
  '{{article.url}}': 'https://travelblog.com/best-travel-destinations',
  '{{article.excerpt}}': 'Discover the top travel destinations that should be on your radar for 2025...',
  '{{article.author}}': 'Jane Smith',
  '{{article.category}}': 'Travel Guides',
  '{{article.published_at}}': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  '{{comment.author}}': 'Mike Johnson',
  '{{comment.content}}': 'Great article! I definitely want to visit Japan next year.',
  '{{comment.article_title}}': '10 Best Travel Destinations for 2025',
  '{{invite.sender_name}}': 'Admin User',
  '{{invite.sender_email}}': 'admin@travelblog.com',
  '{{invite.role}}': 'Editor',
  '{{invite.team_name}}': 'Travel Blog Team',
  '{{invoice.number}}': 'INV-2025-0042',
  '{{invoice.amount}}': '$99.00',
  '{{invoice.due_date}}': new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  '{{invoice.plan}}': 'Pro Plan',
  '{{subscription.plan}}': 'Pro Plan',
  '{{subscription.status}}': 'Active',
  '{{subscription.amount}}': '$99.00',
  '{{subscription.billing_cycle}}': 'monthly',
  '{{backup.name}}': 'daily-backup-2025-01-15',
  '{{backup.size}}': '2.4 GB',
  '{{backup.status}}': 'completed',
  '{{api_key.name}}': 'Production API Key',
  '{{api_key.prefix}}': 'rk_live_****...a3f2',
  '{{webhook.url}}': 'https://travelblog.com/api/webhooks/stripe',
  '{{webhook.event}}': 'payment.completed',
  '{{seo.score}}': '92',
  '{{seo.issues_count}}': '3',
  '{{ai.model}}': 'GPT-4o',
  '{{ai.words_generated}}': '1,250',
  '{{ai.execution_time}}': '4.2s',
  '{{notification.title}}': 'New Comment on Your Article',
  '{{notification.message}}': 'Mike Johnson commented on "10 Best Travel Destinations for 2025"',
  '{{media.file_name}}': 'hero-travel-photo.jpg',
  '{{media.file_size}}': '2.8 MB',
  '{{media.url}}': 'https://travelblog.com/uploads/hero-travel-photo.jpg',
  '{{reset_token}}': 'abc123xyz',
  '{{verification_token}}': 'xyz789abc',
  '{{magic_link}}': 'https://travelblog.com/auth/magic-link?token=demo',
  '{{login_ip}}': '192.168.1.100',
  '{{login_time}}': new Date().toLocaleString(),
  '{{current_date}}': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  '{{current_year}}': String(new Date().getFullYear()),
  '{{current_time}}': new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  '{{unsubscribe_url}}': '#unsubscribe',
  '{{verification_url}}': '#verify',
  '{{reset_password_url}}': '#reset',
  '{{manage_subscriptions_url}}': '#subscriptions',
  '{{preferences_url}}': '#preferences',
  '{{confirmation_url}}': '#confirm',
  '{{invite_url}}': '#invite',
  '{{article_url}}': 'https://travelblog.com/best-travel-destinations',
  '{{content_url}}': 'https://travelblog.com/best-travel-destinations',
  '{{dashboard_url}}': 'https://travelblog.com/dashboard',
  '{{site_url}}': 'https://travelblog.com',
  '{{logo_url}}': '',
  '{{profile_url}}': 'https://travelblog.com/profile',
  '{{features_url}}': 'https://travelblog.com/features',
  '{{help_url}}': 'https://travelblog.com/help',
  '{{reset_token}}': 'abc123xyz',
};

// ============================================================
// Device Width Map
// ============================================================

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: 'max-w-4xl w-full',
  tablet: 'max-w-2xl w-full',
  mobile: 'max-w-sm w-full',
};

// ============================================================
// Component
// ============================================================

export function TemplatePreview({ templateId, onBack }: TemplatePreviewProps) {
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [darkMode, setDarkMode] = useState(false);

  // -------------------- Fetch Template --------------------

  const {
    data: template,
    isLoading,
    isError,
  } = useQuery<EmailTemplate>({
    queryKey: queryKeys.emailTemplates.detail(templateId),
    queryFn: () => getApi<EmailTemplate>(`/api/email-templates/${templateId}`),
  });

  // -------------------- Replace Variables --------------------

  const htmlBody = template ? template.htmlBody : '';
  const subject = template ? template.subject : '';

  const processedHtml = useMemo(() => {
    if (!htmlBody) return '';
    let html = htmlBody;
    for (const [key, value] of Object.entries(DUMMY_DATA)) {
      html = html.replaceAll(key, value);
    }
    // Replace any remaining unreplaced {{variable}} patterns
    html = html.replace(/\{\{[^}]+\}\}/g, '<em style="color:#999">[variable]</em>');

    // Inject responsive email CSS for already-saved templates that lack it.
    // This ensures both old and new templates render correctly on mobile.
    const responsiveCss = `
<style type="text/css">
  /* ---- Email Preview Responsive Override ---- */
  /* Force all tables to respect container width */
  img { max-width: 100% !important; height: auto !important; }

  @media screen and (max-width: 640px) {
    /* Make the outer wrapper table full width */
    body { width: 100% !important; min-width: 0 !important; }

    /* Every table must not exceed its parent */
    table { max-width: 100% !important; width: 100% !important; min-width: 0 !important; }

    /* Exception: inner content tables that use 100% are fine */
    td { word-break: break-word !important; -webkit-hyphens: auto; hyphens: auto; }

    /* Reduce padding on mobile for cells with large horizontal padding */
    td[style*="padding:32px"],
    td[style*="padding: 32px"] {
      padding: 20px 16px !important;
    }
    td[style*="padding:24px 32px"],
    td[style*="padding: 24px 32px"] {
      padding: 20px 16px !important;
    }
    td[style*="padding:16px 32px"],
    td[style*="padding: 16px 32px"] {
      padding: 16px !important;
    }

    /* Make CTA button tables fluid */
    a { word-break: break-word !important; }
  }
</style>`;

    // Insert CSS right after <head> or before </head>. Prefer injecting after any existing <style>.
    if (html.includes('<head>')) {
      html = html.replace('<head>', '<head>\n' + responsiveCss);
    } else if (html.includes('</head>')) {
      html = html.replace('</head>', responsiveCss + '\n</head>');
    } else {
      // No <head> at all — prepend the styles
      html = responsiveCss + '\n' + html;
    }

    // Also ensure the outermost <table> that has width="600" gets responsive classes.
    // Replace width="600" on tables that look like the main container.
    html = html.replace(
      /(<table[^>]*\s)width="600"([^>]*>)/g,
      '$1width="100%"$2'
    );
    // Add max-width and width:100% inline style if not already present
    html = html.replace(
      /(<table[^>]*style="[^"]*")([^>]*>)/g,
      (match, beforeStyle, afterStyle) => {
        // Only add to tables that look like the main container (have border-radius or background)
        if (match.includes('border-radius') || match.includes('background-color:#fff') || match.includes('background-color: #fff')) {
          if (!beforeStyle.includes('max-width') && !beforeStyle.includes('width:')) {
            return beforeStyle + ';max-width:600px;width:100%' + afterStyle;
          }
          if (!beforeStyle.includes('max-width')) {
            return beforeStyle + ';max-width:600px' + afterStyle;
          }
        }
        return match;
      }
    );

    return html;
  }, [htmlBody]);

  const processedSubject = useMemo(() => {
    if (!subject) return '';
    let sub = subject;
    for (const [key, value] of Object.entries(DUMMY_DATA)) {
      sub = sub.replaceAll(key, value);
    }
    sub = sub.replace(/\{\{[^}]+\}\}/g, '[variable]');
    return sub;
  }, [subject]);

  // -------------------- Render --------------------

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ==================== Header Bar ==================== */}
      <div className="flex items-center justify-between gap-3 border-b bg-card px-4 py-3 shrink-0">
        {/* Left: Back + Title + Badge */}
        <div className="flex items-center gap-3 min-w-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Back</TooltipContent>
          </Tooltip>
          <h2 className="text-base font-semibold text-foreground truncate">
            Email Preview
          </h2>
          <Badge className="shrink-0 bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
            TEST MODE
          </Badge>
        </div>

        {/* Right: Device Toggles + Dark Mode */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center border rounded-md bg-background">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-8 w-8 rounded-r-none',
                    device === 'desktop' && 'bg-muted text-foreground',
                  )}
                  onClick={() => setDevice('desktop')}
                >
                  <Monitor className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Desktop</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-8 w-8 rounded-none border-x',
                    device === 'tablet' && 'bg-muted text-foreground',
                  )}
                  onClick={() => setDevice('tablet')}
                >
                  <Tablet className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Tablet</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-8 w-8 rounded-l-none',
                    device === 'mobile' && 'bg-muted text-foreground',
                  )}
                  onClick={() => setDevice('mobile')}
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mobile</TooltipContent>
            </Tooltip>
          </div>

          <div className="w-px h-6 bg-border mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-8 w-8', darkMode && 'bg-muted text-foreground')}
                onClick={() => setDarkMode(!darkMode)}
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{darkMode ? 'Light Mode' : 'Dark Mode'}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ==================== Content Area ==================== */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-muted/30">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full max-w-4xl mx-auto rounded-lg" />
            <Skeleton className="h-[500px] w-full max-w-4xl mx-auto rounded-lg" />
          </div>
        ) : isError || !template ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-muted-foreground">Failed to load email template.</p>
            <Button variant="outline" className="mt-4" onClick={onBack}>
              Go Back
            </Button>
          </div>
        ) : (
          <div className="space-y-4 mx-auto transition-all duration-300" style={{ maxWidth: device === 'desktop' ? 896 : device === 'tablet' ? 672 : 375 }}>
            {/* ==================== Email Meta Card ==================== */}
            <div className="rounded-lg border bg-card shadow-sm">
              <div className="px-4 py-3 border-b bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Email Details
                </p>
              </div>
              <div className="divide-y">
                <div className="flex items-start gap-3 px-4 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground w-16 shrink-0 pt-0.5">
                    To
                  </span>
                  <span className="text-sm text-foreground break-all">
                    john.doe@example.com
                  </span>
                </div>
                <div className="flex items-start gap-3 px-4 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground w-16 shrink-0 pt-0.5">
                    From
                  </span>
                  <span className="text-sm text-foreground break-all">
                    {template.fromName || 'Travel Blog'}{' '}
                    &lt;{template.fromEmail || 'noreply@travelblog.com'}&gt;
                  </span>
                </div>
                {template.replyTo && (
                  <div className="flex items-start gap-3 px-4 py-2.5">
                    <span className="text-xs font-medium text-muted-foreground w-16 shrink-0 pt-0.5">
                      Reply-To
                    </span>
                    <span className="text-sm text-foreground break-all">
                      {template.replyTo}
                    </span>
                  </div>
                )}
                <div className="flex items-start gap-3 px-4 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground w-16 shrink-0 pt-0.5">
                    Subject
                  </span>
                  <span className="text-sm text-foreground font-medium break-all">
                    {processedSubject}
                  </span>
                </div>
              </div>
            </div>

            {/* ==================== Preview Container ==================== */}
            <div
              className={cn(
                'rounded-lg border shadow-sm overflow-hidden transition-all duration-300',
                darkMode
                  ? 'bg-zinc-900 border-zinc-700'
                  : 'bg-white border-border',
              )}
            >
              {darkMode ? (
                <div
                  className="transition-all duration-300"
                  style={{
                    filter: 'invert(1) hue-rotate(180deg)',
                    backgroundColor: '#fff',
                  }}
                >
                  <div
                    dangerouslySetInnerHTML={{ __html: processedHtml }}
                    className="email-preview-content"
                    style={{ maxWidth: '100%', overflow: 'hidden' }}
                  />
                </div>
              ) : (
                <div
                  dangerouslySetInnerHTML={{ __html: processedHtml }}
                  className="email-preview-content"
                  style={{ maxWidth: '100%', overflow: 'hidden' }}
                />
              )}
            </div>

            {/* ==================== Footer Info ==================== */}
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1 py-2">
              <span>Template: {template.name}</span>
              <span>Category: {template.category.replace(/_/g, ' ')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
