'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  Globe,
  Lock,
  Shield,
  AlertCircle,
  Server,
  FileText,
  Key,
  Newspaper,
  Search,
  Tags,
  MessageSquare,
  Navigation,
  HardDrive,
  Eye,
  Zap,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { METHOD_COLORS } from '@/lib/api-constants';
import { API_SCOPES } from '@/lib/api/api-service';
import { toast } from 'sonner';

// -------------------- Types --------------------

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface EndpointDef {
  method: HttpMethod;
  path: string;
  description: string;
}

interface EndpointCategory {
  name: string;
  icon: React.ReactNode;
  endpoints: EndpointDef[];
}

// -------------------- Method Colors --------------------
// Uses shared METHOD_COLORS from @/lib/api-constants

const METHOD_BADGE_WIDTH: Record<HttpMethod, string> = {
  GET: 'w-[52px]',
  POST: 'w-[56px]',
  PUT: 'w-[46px]',
  PATCH: 'w-[58px]',
  DELETE: 'w-[64px]',
};

// -------------------- Endpoint Definitions --------------------

const ENDPOINT_CATEGORIES: EndpointCategory[] = [
  {
    name: 'Authentication',
    icon: <Lock className='h-4 w-4' />,
    endpoints: [
      { method: 'POST', path: '/api/auth/login', description: 'Authenticate user and obtain session token' },
      { method: 'POST', path: '/api/auth/logout', description: 'End current session and invalidate token' },
      { method: 'GET', path: '/api/auth/me', description: 'Get current authenticated user profile' },
      { method: 'POST', path: '/api/auth/refresh', description: 'Refresh an expired access token' },
      { method: 'POST', path: '/api/auth/forgot-password', description: 'Request a password reset email' },
      { method: 'POST', path: '/api/auth/reset-password', description: 'Reset password using a token' },
    ],
  },
  {
    name: 'Content',
    icon: <FileText className='h-4 w-4' />,
    endpoints: [
      { method: 'GET', path: '/api/content', description: 'List all content with pagination, filters, and search' },
      { method: 'POST', path: '/api/content', description: 'Create a new content entry' },
      { method: 'GET', path: '/api/content/[id]', description: 'Get a single content entry by ID' },
      { method: 'PATCH', path: '/api/content/[id]', description: 'Update fields on an existing content entry' },
      { method: 'DELETE', path: '/api/content/[id]', description: 'Delete a content entry permanently' },
      { method: 'POST', path: '/api/content/[id]/publish', description: 'Publish a draft content entry' },
      { method: 'POST', path: '/api/content/[id]/unpublish', description: 'Unpublish a published content entry' },
      { method: 'GET', path: '/api/content/[id]/revisions', description: 'Get revision history for a content entry' },
      { method: 'POST', path: '/api/content/bulk', description: 'Bulk create or update multiple entries' },
      { method: 'DELETE', path: '/api/content/bulk', description: 'Bulk delete multiple content entries' },
    ],
  },
  {
    name: 'Media',
    icon: <HardDrive className='h-4 w-4' />,
    endpoints: [
      { method: 'GET', path: '/api/media', description: 'List all media files with filters' },
      { method: 'POST', path: '/api/media', description: 'Upload a new media file' },
      { method: 'GET', path: '/api/media/[id]', description: 'Get a single media file metadata and URL' },
      { method: 'PATCH', path: '/api/media/[id]', description: 'Update media metadata (alt text, name, etc.)' },
      { method: 'DELETE', path: '/api/media/[id]', description: 'Delete a media file' },
      { method: 'POST', path: '/api/media/bulk-delete', description: 'Bulk delete multiple media files' },
      { method: 'GET', path: '/api/media/folders', description: 'List all media folders' },
      { method: 'POST', path: '/api/media/folders', description: 'Create a new media folder' },
    ],
  },
  {
    name: 'Users',
    icon: <Shield className='h-4 w-4' />,
    endpoints: [
      { method: 'GET', path: '/api/users', description: 'List all users with pagination and filters' },
      { method: 'POST', path: '/api/users', description: 'Create a new user account' },
      { method: 'GET', path: '/api/users/[id]', description: 'Get a single user profile' },
      { method: 'PATCH', path: '/api/users/[id]', description: 'Update user profile or settings' },
      { method: 'DELETE', path: '/api/users/[id]', description: 'Delete or deactivate a user' },
      { method: 'PATCH', path: '/api/users/[id]/role', description: 'Change a user\'s role' },
      { method: 'GET', path: '/api/users/[id]/activity', description: 'Get user activity log' },
    ],
  },
  {
    name: 'Categories',
    icon: <Tags className='h-4 w-4' />,
    endpoints: [
      { method: 'GET', path: '/api/categories', description: 'List all categories with hierarchy' },
      { method: 'POST', path: '/api/categories', description: 'Create a new category' },
      { method: 'GET', path: '/api/categories/[id]', description: 'Get a single category with details' },
      { method: 'PATCH', path: '/api/categories/[id]', description: 'Update category properties' },
      { method: 'DELETE', path: '/api/categories/[id]', description: 'Delete a category' },
      { method: 'POST', path: '/api/categories/reorder', description: 'Reorder category positions' },
    ],
  },
  {
    name: 'Tags',
    icon: <Zap className='h-4 w-4' />,
    endpoints: [
      { method: 'GET', path: '/api/tags', description: 'List all tags with filtering' },
      { method: 'POST', path: '/api/tags', description: 'Create a new tag' },
      { method: 'GET', path: '/api/tags/[id]', description: 'Get a single tag' },
      { method: 'PATCH', path: '/api/tags/[id]', description: 'Update tag properties' },
      { method: 'DELETE', path: '/api/tags/[id]', description: 'Delete a tag' },
      { method: 'POST', path: '/api/tags/merge', description: 'Merge multiple tags into one' },
    ],
  },
  {
    name: 'Comments',
    icon: <MessageSquare className='h-4 w-4' />,
    endpoints: [
      { method: 'GET', path: '/api/comments', description: 'List comments with filters and pagination' },
      { method: 'POST', path: '/api/comments', description: 'Submit a new comment' },
      { method: 'GET', path: '/api/comments/[id]', description: 'Get a single comment with replies' },
      { method: 'PATCH', path: '/api/comments/[id]', description: 'Update comment content or status' },
      { method: 'DELETE', path: '/api/comments/[id]', description: 'Delete a comment and its replies' },
      { method: 'PATCH', path: '/api/comments/[id]/approve', description: 'Approve a pending comment' },
      { method: 'PATCH', path: '/api/comments/[id]/spam', description: 'Mark comment as spam' },
    ],
  },
  {
    name: 'Newsletters',
    icon: <Newspaper className='h-4 w-4' />,
    endpoints: [
      { method: 'GET', path: '/api/newsletters', description: 'List all newsletters with filters' },
      { method: 'POST', path: '/api/newsletters', description: 'Create a new newsletter' },
      { method: 'GET', path: '/api/newsletters/[id]', description: 'Get a single newsletter' },
      { method: 'PATCH', path: '/api/newsletters/[id]', description: 'Update newsletter content or settings' },
      { method: 'DELETE', path: '/api/newsletters/[id]', description: 'Delete a newsletter' },
      { method: 'POST', path: '/api/newsletters/[id]/send', description: 'Send newsletter to subscribers' },
      { method: 'POST', path: '/api/newsletters/[id]/schedule', description: 'Schedule newsletter for later delivery' },
      { method: 'GET', path: '/api/newsletters/subscribers', description: 'List newsletter subscribers' },
      { method: 'POST', path: '/api/newsletters/subscribe', description: 'Subscribe an email address' },
      { method: 'POST', path: '/api/newsletters/unsubscribe', description: 'Unsubscribe an email address' },
    ],
  },
  {
    name: 'SEO',
    icon: <Search className='h-4 w-4' />,
    endpoints: [
      { method: 'GET', path: '/api/seo/overview', description: 'Get SEO dashboard overview statistics' },
      { method: 'GET', path: '/api/seo/analytics', description: 'Get detailed SEO analytics data' },
      { method: 'GET', path: '/api/seo/sitemap', description: 'Get sitemap configuration and status' },
      { method: 'POST', path: '/api/seo/sitemap/generate', description: 'Trigger sitemap regeneration' },
      { method: 'GET', path: '/api/seo/robots', description: 'Get robots.txt configuration' },
      { method: 'PATCH', path: '/api/seo/robots', description: 'Update robots.txt rules' },
      { method: 'GET', path: '/api/seo/redirects', description: 'List all URL redirects' },
      { method: 'POST', path: '/api/seo/redirects', description: 'Create a new URL redirect' },
      { method: 'DELETE', path: '/api/seo/redirects/[id]', description: 'Delete a URL redirect' },
      { method: 'GET', path: '/api/seo/keywords', description: 'Get keyword rankings and metrics' },
      { method: 'GET', path: '/api/seo/backlinks', description: 'Get backlink analysis data' },
      { method: 'GET', path: '/api/seo/competitors', description: 'Get competitor analysis data' },
    ],
  },
  {
    name: 'Navigation',
    icon: <Navigation className='h-4 w-4' />,
    endpoints: [
      { method: 'GET', path: '/api/navigation', description: 'List all navigation menus' },
      { method: 'POST', path: '/api/navigation', description: 'Create a new navigation menu' },
      { method: 'GET', path: '/api/navigation/[id]', description: 'Get a navigation menu with items' },
      { method: 'PATCH', path: '/api/navigation/[id]', description: 'Update navigation menu properties' },
      { method: 'DELETE', path: '/api/navigation/[id]', description: 'Delete a navigation menu' },
      { method: 'POST', path: '/api/navigation/[id]/items', description: 'Add an item to navigation menu' },
      { method: 'PATCH', path: '/api/navigation/[id]/items/reorder', description: 'Reorder navigation menu items' },
    ],
  },
  {
    name: 'System',
    icon: <Server className='h-4 w-4' />,
    endpoints: [
      // API Keys
      { method: 'GET', path: '/api/api-keys', description: 'List all API keys' },
      { method: 'POST', path: '/api/api-keys', description: 'Create a new API key' },
      { method: 'GET', path: '/api/api-keys/[id]', description: 'Get a single API key' },
      { method: 'PATCH', path: '/api/api-keys/[id]', description: 'Update API key settings' },
      { method: 'DELETE', path: '/api/api-keys/[id]', description: 'Revoke an API key' },
      // OAuth Clients
      { method: 'GET', path: '/api/oauth-clients', description: 'List all OAuth clients' },
      { method: 'POST', path: '/api/oauth-clients', description: 'Register a new OAuth client' },
      { method: 'GET', path: '/api/oauth-clients/[id]', description: 'Get a single OAuth client' },
      { method: 'PATCH', path: '/api/oauth-clients/[id]', description: 'Update OAuth client settings' },
      { method: 'DELETE', path: '/api/oauth-clients/[id]', description: 'Delete an OAuth client' },
      // Personal Access Tokens
      { method: 'GET', path: '/api/pats', description: 'List all personal access tokens' },
      { method: 'POST', path: '/api/pats', description: 'Create a new personal access token' },
      { method: 'DELETE', path: '/api/pats/[id]', description: 'Revoke a personal access token' },
      // API Logs
      { method: 'GET', path: '/api/api-logs', description: 'Get API request logs with filters' },
      { method: 'GET', path: '/api/api-logs/stats', description: 'Get API usage statistics' },
      // Webhooks
      { method: 'GET', path: '/api/webhooks', description: 'List all webhooks' },
      { method: 'POST', path: '/api/webhooks', description: 'Create a new webhook' },
      { method: 'GET', path: '/api/webhooks/[id]', description: 'Get a single webhook' },
      { method: 'PATCH', path: '/api/webhooks/[id]', description: 'Update webhook configuration' },
      { method: 'DELETE', path: '/api/webhooks/[id]', description: 'Delete a webhook' },
      // Backups
      { method: 'GET', path: '/api/backups', description: 'List all backups' },
      { method: 'POST', path: '/api/backups', description: 'Create a new backup' },
      { method: 'POST', path: '/api/backups/[id]/restore', description: 'Restore from a backup' },
      { method: 'GET', path: '/api/backups/[id]/download', description: 'Download a backup file' },
      { method: 'POST', path: '/api/backups/[id]/verify', description: 'Verify backup integrity' },
      { method: 'GET', path: '/api/backups/stats', description: 'Get backup statistics' },
      // Monitoring
      { method: 'GET', path: '/api/monitoring/overview', description: 'Get monitoring overview dashboard' },
      { method: 'GET', path: '/api/monitoring/health', description: 'Get system health check results' },
      { method: 'GET', path: '/api/monitoring/system-info', description: 'Get detailed system information' },
      { method: 'GET', path: '/api/monitoring/performance', description: 'Get performance metrics' },
      { method: 'GET', path: '/api/monitoring/alerts', description: 'List monitoring alerts' },
      { method: 'GET', path: '/api/monitoring/security', description: 'Get security event logs' },
      { method: 'GET', path: '/api/monitoring/api-status', description: 'Get external service status' },
      // Settings
      { method: 'GET', path: '/api/settings', description: 'Get all system settings' },
      { method: 'PATCH', path: '/api/settings', description: 'Update system settings' },
      { method: 'GET', path: '/api/settings/smtp', description: 'Get SMTP configuration' },
      { method: 'PATCH', path: '/api/settings/smtp', description: 'Update SMTP configuration' },
      { method: 'POST', path: '/api/settings/smtp/test', description: 'Send a test email' },
    ],
  },
];

// -------------------- Error Codes --------------------

const ERROR_CODES = [
  { code: 400, title: 'Bad Request', description: 'The request body or parameters are invalid. Check the request syntax and ensure all required fields are provided with correct types.', color: 'text-amber-600 dark:text-amber-400' },
  { code: 401, title: 'Unauthorized', description: 'Authentication is required or the provided credentials are invalid. Ensure a valid API key, PAT, or OAuth token is included in the Authorization header.', color: 'text-orange-600 dark:text-orange-400' },
  { code: 403, title: 'Forbidden', description: 'The authenticated identity does not have permission to perform this action. Verify the API key or token has the required scopes.', color: 'text-red-600 dark:text-red-400' },
  { code: 404, title: 'Not Found', description: 'The requested resource does not exist. Verify the resource ID and that it has not been deleted.', color: 'text-slate-600 dark:text-slate-400' },
  { code: 429, title: 'Too Many Requests', description: 'Rate limit has been exceeded. The response includes a Retry-After header indicating when to retry.', color: 'text-purple-600 dark:text-purple-400' },
  { code: 500, title: 'Internal Server Error', description: 'An unexpected server error occurred. Retry the request and contact support if the error persists.', color: 'text-red-700 dark:text-red-500' },
];

// -------------------- Auth Methods --------------------

const AUTH_METHODS = [
  {
    title: 'API Key (Bearer Token)',
    badge: 'Recommended',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    description: 'Use a server-side API key for machine-to-machine authentication. Keys can be scoped to specific permissions and environments.',
    header: 'Authorization: Bearer cms_live_xxxxxxxxxxxxxxxxxxxx',
    note: 'Replace cms_live_ with cms_test_ for sandbox/testing environments.',
  },
  {
    title: 'Personal Access Token (PAT)',
    badge: 'User',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    description: 'Personal Access Tokens are tied to a specific user account and inherit their permissions. Ideal for CLI tools and personal scripts.',
    header: 'Authorization: Bearer cms_pat_xxxxxxxxxxxxxxxxxxxx',
    note: 'PATs inherit the permissions of the user who created them.',
  },
  {
    title: 'OAuth 2.0 — Authorization Code',
    badge: 'Enterprise',
    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
    description: 'Standard OAuth 2.0 authorization code flow. Users authorize your application to access their CMS data on their behalf.',
    header: 'Authorization: Bearer <access_token>',
    note: 'Redirect users to /oauth/authorize?client_id=xxx&response_type=code. Exchange the code for tokens at /oauth/token.',
  },
  {
    title: 'OAuth 2.0 — Client Credentials',
    badge: 'M2M',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    description: 'Machine-to-machine flow using client_id and client_secret to obtain an access token directly, without user involvement.',
    header: 'Authorization: Bearer <access_token>',
    note: 'POST to /oauth/token with grant_type=client_credentials, client_id, and client_secret.',
  },
  {
    title: 'OAuth 2.0 — PKCE',
    badge: 'Public Client',
    badgeClass: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400',
    description: 'Proof Key for Code Exchange (PKCE) is designed for public clients (SPAs, mobile apps) that cannot securely store a client secret.',
    header: 'Authorization: Bearer <access_token>',
    note: 'Generate a code_verifier and code_challenge (S256) during authorization. Include the code_verifier when exchanging the code.',
  },
];

// -------------------- Helper Components --------------------

function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold tracking-wide',
        METHOD_COLORS[method],
        METHOD_BADGE_WIDTH[method]
      )}
    >
      {method}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Button
      variant='ghost'
      size='icon'
      className='h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground'
      onClick={handleCopy}
    >
      {copied ? <Check className='h-3.5 w-3.5' /> : <Copy className='h-3.5 w-3.5' />}
    </Button>
  );
}

function EndpointRow({ endpoint }: { endpoint: EndpointDef }) {
  return (
    <div className='group flex items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:bg-muted/50 hover:border-border'>
      <MethodBadge method={endpoint.method} />
      <code className='min-w-0 shrink-0 rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground sm:text-sm'>
        {endpoint.path}
      </code>
      <span className='min-w-0 flex-1 text-sm text-muted-foreground leading-5'>
        {endpoint.description}
      </span>
    </div>
  );
}

function EndpointCategorySection({ category }: { category: EndpointCategory }) {
  const [isOpen, setIsOpen] = useState(
    category.name === 'Content' || category.name === 'Authentication'
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className='group/collapsible'>
      <Card>
        <CollapsibleTrigger className='w-full text-left'>
          <CardHeader className='pb-3 cursor-pointer select-none'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2.5'>
                <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                  {category.icon}
                </div>
                <CardTitle className='text-base font-semibold'>{category.name}</CardTitle>
                <Badge variant='secondary' className='ml-1 text-xs'>
                  {category.endpoints.length} endpoints
                </Badge>
              </div>
              <ChevronDown className={cn(
                'h-4 w-4 text-muted-foreground transition-transform duration-200',
                isOpen && 'rotate-180'
              )} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className='pt-0'>
            <div className='space-y-0.5'>
              {category.endpoints.map((ep, idx) => (
                <React.Fragment key={`${ep.method}-${ep.path}`}>
                  {idx > 0 && <Separator className='my-1 opacity-50' />}
                  <EndpointRow endpoint={ep} />
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// -------------------- Main Component --------------------

export function ApiDocsPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = searchQuery.trim()
    ? ENDPOINT_CATEGORIES
        .map((cat) => ({
          ...cat,
          endpoints: cat.endpoints.filter(
            (ep) =>
              ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
              ep.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
              ep.method.toLowerCase().includes(searchQuery.toLowerCase()) ||
              cat.name.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter((cat) => cat.endpoints.length > 0)
    : ENDPOINT_CATEGORIES;

  const totalEndpoints = ENDPOINT_CATEGORIES.reduce((sum, cat) => sum + cat.endpoints.length, 0);

  return (
    <div className='space-y-6'>
      {/* Page Header */}
      <div className='flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-center gap-3'>
          <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10'>
            <BookOpen className='h-5 w-5 text-primary' />
          </div>
          <div>
            <h2 className='text-xl font-bold tracking-tight'>API Documentation</h2>
            <p className='text-sm text-muted-foreground'>
              Complete reference for all CMS REST API endpoints
            </p>
          </div>
          <Badge
            variant='outline'
            className='border-primary/30 bg-primary/5 text-primary text-xs font-medium'
          >
            OpenAPI 3.0
          </Badge>
        </div>
        <div className='mt-2 flex items-center gap-3 text-sm text-muted-foreground sm:mt-0'>
          <span className='flex items-center gap-1.5'>
            <Globe className='h-3.5 w-3.5' />
            {totalEndpoints} endpoints
          </span>
          <span className='text-border'>|</span>
          <span>v1 &amp; v2</span>
        </div>
      </div>

      {/* Base URL Card */}
      <Card>
        <CardContent className='p-4'>
          <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
            <div className='space-y-1'>
              <p className='text-sm font-medium'>Base URL</p>
              <div className='flex items-center gap-2'>
                <code className='rounded-md bg-muted px-3 py-1.5 font-mono text-sm'>
                  https://your-cms-domain.com
                </code>
                <CopyButton text='https://your-cms-domain.com' />
              </div>
            </div>
            <div className='flex gap-2'>
              <Badge variant='outline' className='font-mono text-xs'>v1</Badge>
              <Badge variant='outline' className='font-mono text-xs'>v2</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authentication Section */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2.5'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'>
              <Key className='h-4 w-4' />
            </div>
            <CardTitle className='text-base'>Authentication</CardTitle>
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <p className='text-sm text-muted-foreground'>
            All API requests require authentication unless accessing public endpoints. Choose an authentication method based on your use case.
          </p>
          <div className='grid gap-4 lg:grid-cols-2'>
            {AUTH_METHODS.map((auth) => (
              <div
                key={auth.title}
                className='rounded-lg border p-4 space-y-3'
              >
                <div className='flex items-center justify-between'>
                  <h4 className='text-sm font-semibold'>{auth.title}</h4>
                  <Badge className={cn('text-[10px] font-medium', auth.badgeClass)} variant='outline'>
                    {auth.badge}
                  </Badge>
                </div>
                <p className='text-xs text-muted-foreground leading-5'>{auth.description}</p>
                <div className='flex items-center gap-2 rounded-md bg-muted/80 px-3 py-2'>
                  <code className='flex-1 overflow-x-auto font-mono text-xs text-foreground whitespace-nowrap'>
                    {auth.header}
                  </code>
                  <CopyButton text={auth.header} />
                </div>
                <p className='text-xs text-muted-foreground/80 italic'>{auth.note}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className='relative'>
        <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
        <input
          type='text'
          placeholder='Search endpoints by path, method, or description...'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className='flex h-10 w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        />
      </div>

      {/* Endpoint Categories */}
      <div className='space-y-3'>
        {filteredCategories.map((category) => (
          <EndpointCategorySection key={category.name} category={category} />
        ))}
        {filteredCategories.length === 0 && searchQuery.trim() && (
          <Card>
            <CardContent className='flex flex-col items-center justify-center py-12'>
              <AlertCircle className='h-8 w-8 text-muted-foreground/50' />
              <p className='mt-2 text-sm text-muted-foreground'>No endpoints found matching &ldquo;{searchQuery}&rdquo;</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Scopes Section */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2.5'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400'>
              <Eye className='h-4 w-4' />
            </div>
            <CardTitle className='text-base'>OAuth Scopes</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className='mb-4 text-sm text-muted-foreground'>
            Scopes control what an API key, PAT, or OAuth token can access. Each token is assigned a set of scopes during creation.
          </p>
          <div className='overflow-hidden rounded-lg border'>
            <div className='grid grid-cols-[1fr_1fr] bg-muted/50 px-4 py-2.5 text-xs font-semibold text-muted-foreground'>
              <span>Scope</span>
              <span>Description</span>
            </div>
            <div className='max-h-72 overflow-y-auto'>
              {API_SCOPES.map((scope) => (
                <div
                  key={scope.key}
                  className='grid grid-cols-[1fr_1fr] border-t px-4 py-2 text-sm transition-colors hover:bg-muted/30'
                >
                  <code className='font-mono text-xs text-foreground'>{scope.key}</code>
                  <span className='text-xs text-muted-foreground'>{scope.label}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Codes Section */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2.5'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400'>
              <AlertCircle className='h-4 w-4' />
            </div>
            <CardTitle className='text-base'>Error Codes</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className='mb-4 text-sm text-muted-foreground'>
            Standard HTTP status codes used across all API endpoints. Error responses include a JSON body with code, message, and details fields.
          </p>
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {ERROR_CODES.map((err) => (
              <div
                key={err.code}
                className='rounded-lg border p-4 space-y-1.5'
              >
                <div className='flex items-center gap-2'>
                  <span className={cn('text-lg font-bold tabular-nums', err.color)}>{err.code}</span>
                  <span className='text-sm font-medium'>{err.title}</span>
                </div>
                <p className='text-xs text-muted-foreground leading-5'>{err.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
