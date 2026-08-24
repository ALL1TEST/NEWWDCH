// ============================================================
// CONSTANTS — Enterprise CMS Admin Dashboard
// ============================================================

import type { UserRole, PostStatus, CommentStatus, CampaignStatus, BackupStatus, JobStatus, WebhookDeliveryStatus, MediaProcessingStatus, MediaScanStatus, UserStatus, ReviewStatus } from '@/shared/types';

// -------------------- Routes --------------------

export const ROUTES = {
  dashboard: '/',
  content: {
    index: '/content',
    create: '/content/create',
    edit: (id: string) => `/content/${id}`,
    versions: (id: string) => `/content/${id}/versions`,
    translations: (id: string) => `/content/${id}/translations`,
  },
  media: {
    index: '/media',
    folders: '/media/folders',
    collections: '/media/collections',
  },
  users: {
    index: '/users',
    create: '/users/create',
    edit: (id: string) => `/users/${id}`,
  },
  categories: {
    index: '/categories',
    create: '/categories/create',
    edit: (id: string) => `/categories/${id}`,
  },
  tags: {
    index: '/tags',
    create: '/tags/create',
    edit: (id: string) => `/tags/${id}`,
  },
  comments: {
    index: '/comments',
  },
  newsletters: {
    index: '/newsletters',
    subscribers: '/newsletters/subscribers',
    campaigns: '/newsletters/campaigns',
  },
  seo: {
    index: '/seo',
    redirects: '/seo/redirects',
    sitemap: '/seo/sitemap',
    robots: '/seo/robots',
    searchConsole: '/seo/search-console',
    indexing: '/seo/indexing',
    brokenLinks: '/seo/broken-links',
  },
  navigation: {
    index: '/navigation',
    edit: (id: string) => `/navigation/${id}`,
  },
  analytics: {
    index: '/analytics',
  },
  notifications: {
    index: '/notifications',
  },
  ai: {
    index: '/ai',
    providers: '/ai/providers',
    prompts: '/ai/prompts',
    models: '/ai/models',
    playground: '/ai/playground',
    jobs: '/ai/jobs',
    usage: '/ai/usage',
    settings: '/ai/settings',
    logs: '/ai/logs',
    marketplace: '/ai/marketplace',
  },
  webhooks: {
    index: '/webhooks',
    create: '/webhooks/create',
    edit: (id: string) => `/webhooks/${id}`,
    deliveries: '/webhooks/deliveries',
    eventLogs: '/webhooks/event-logs',
    queue: '/webhooks/queue',
    settings: '/webhooks/settings',
  },
  settings: {
    index: '/settings',
    general: '/settings/general',
    localization: '/settings/localization',
    reading: '/settings/reading',
    discussion: '/settings/discussion',
    seo: '/settings/seo',
    media: '/settings/media',
    search: '/settings/search',
    email: '/settings/email',
    security: '/settings/security',
    api: '/settings/api',
    ai: '/settings/ai',
    cache: '/settings/cache',
    performance: '/settings/performance',
    analytics: '/settings/analytics',
    searchConsole: '/settings/search-console',
    sitemap: '/settings/sitemap',
    robots: '/settings/robots',
    backups: '/settings/backups',
    scheduler: '/settings/scheduler',
    notifications: '/settings/notifications',
    maintenance: '/settings/maintenance',
    multiSite: '/settings/multi-site',
    importExport: '/settings/import-export',
    advanced: '/settings/advanced',
    auditLog: '/settings/audit-log',
  },
  security: {
    index: '/security',
    ipRules: '/security/ip-rules',
    sessions: '/security/sessions',
  },
  backups: {
    index: '/backups',
  },
  monitoring: {
    index: '/monitoring',
    overview: '/monitoring',
    health: '/monitoring/health',
    performance: '/monitoring/performance',
    jobs: '/monitoring/jobs',
    queues: '/monitoring/queues',
    auditLog: '/monitoring/audit-log',
    errorLogs: '/monitoring/error-logs',
    scheduler: '/monitoring/scheduler',
    alerts: '/monitoring/alerts',
    apiStatus: '/monitoring/api-status',
    webhooks: '/monitoring/webhooks',
    aiMonitoring: '/monitoring/ai-monitoring',
    backupMonitoring: '/monitoring/backup-monitoring',
    security: '/monitoring/security',
    settings: '/monitoring/settings',
  },
  jobs: {
    index: '/monitoring/jobs',
  },
  api: {
    index: '/api',
    dashboard: '/api/dashboard',
    keys: '/api/keys',
    logs: '/api/logs',
    docs: '/api/docs',
    explorer: '/api/explorer',
    oauth: '/api/oauth',
    tokens: '/api/tokens',
    rateLimits: '/api/rate-limits',
  },
  emailTemplates: {
    index: '/email-templates',
    edit: (id: string) => `/email-templates/${id}`,
    smtpSettings: '/email-templates/smtp-settings',
  },
} as const;

// -------------------- Permissions --------------------

export const PERMISSIONS = {
  // Content
  content: {
    create: 'content:create',
    read: 'content:read',
    update: 'content:update',
    delete: 'content:delete',
    publish: 'content:publish',
    review: 'content:review',
    translate: 'content:translate',
  },
  media: {
    create: 'media:create',
    read: 'media:read',
    update: 'media:update',
    delete: 'media:delete',
  },
  users: {
    create: 'users:create',
    read: 'users:read',
    update: 'users:update',
    delete: 'users:delete',
    manageRoles: 'users:manage-roles',
  },
  categories: {
    create: 'categories:create',
    read: 'categories:read',
    update: 'categories:update',
    delete: 'categories:delete',
  },
  tags: {
    create: 'tags:create',
    read: 'tags:read',
    update: 'tags:update',
    delete: 'tags:delete',
  },
  comments: {
    read: 'comments:read',
    update: 'comments:update',
    delete: 'comments:delete',
    moderate: 'comments:moderate',
  },
  newsletters: {
    create: 'newsletters:create',
    read: 'newsletters:read',
    update: 'newsletters:update',
    delete: 'newsletters:delete',
    send: 'newsletters:send',
  },
  seo: {
    read: 'seo:read',
    update: 'seo:update',
    manageRedirects: 'seo:manage-redirects',
    manageSitemap: 'seo:manage-sitemap',
    manageRobots: 'seo:manage-robots',
    manageSearchConsole: 'seo:manage-search-console',
    manageIndexing: 'seo:manage-indexing',
    manageBrokenLinks: 'seo:manage-broken-links',
  },
  navigation: {
    read: 'navigation:read',
    update: 'navigation:update',
  },
  analytics: {
    read: 'analytics:read',
  },
  notifications: {
    read: 'notifications:read',
    update: 'notifications:update',
    manage: 'notifications:manage',
  },
  ai: {
    read: 'ai:read',
    use: 'ai:use',
    manage: 'ai:manage',
    createJobs: 'ai:create-jobs',
    viewLogs: 'ai:view-logs',
    managePrompts: 'ai:manage-prompts',
  },
  webhooks: {
    create: 'webhooks:create',
    read: 'webhooks:read',
    update: 'webhooks:update',
    delete: 'webhooks:delete',
    test: 'webhooks:test',
    retry: 'webhooks:retry',
    manageSettings: 'webhooks:manage-settings',
  },
  settings: {
    read: 'settings:read',
    update: 'settings:update',
    manage: 'settings:manage',
    export: 'settings:export',
    import: 'settings:import',
    reset: 'settings:reset',
    viewAudit: 'settings:view-audit',
  },
  security: {
    read: 'security:read',
    update: 'security:update',
    manageIpRules: 'security:manage-ip-rules',
  },
  backups: {
    create: 'backups:create',
    read: 'backups:read',
    restore: 'backups:restore',
    delete: 'backups:delete',
    download: 'backups:download',
    verify: 'backups:verify',
    manageSettings: 'backups:manage-settings',
    manageSchedules: 'backups:manage-schedules',
    manageStorage: 'backups:manage-storage',
  },
  monitoring: {
    read: 'monitoring:read',
    manageJobs: 'monitoring:manage-jobs',
    manageAlerts: 'monitoring:manage-alerts',
    manageSettings: 'monitoring:manage-settings',
    viewErrorLogs: 'monitoring:view-error-logs',
    viewSecurity: 'monitoring:view-security',
    exportLogs: 'monitoring:export-logs',
  },
  api: {
    create: 'api:create',
    read: 'api:read',
    update: 'api:update',
    delete: 'api:delete',
    manageOAuth: 'api:manage-oauth',
    managePat: 'api:manage-pat',
    viewLogs: 'api:view-logs',
    manageRateLimits: 'api:manage-rate-limits',
  },
  emailTemplates: {
    create: 'email-templates:create',
    read: 'email-templates:read',
    update: 'email-templates:update',
    delete: 'email-templates:delete',
    send: 'email-templates:send',
    manageSmtp: 'email-templates:manage-smtp',
  },
} as const;

// -------------------- Role Hierarchy --------------------

export const ROLE_HIERARCHY: UserRole[] = [
  'ADMIN',
  'EDITOR',
];

// -------------------- Status Colors --------------------

export const STATUS_COLORS: Record<string, string> = {
  // PostStatus
  DRAFT: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  IN_REVIEW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  PUBLISHED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  UNPUBLISHED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  ARCHIVED: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',

  // UserStatus
  INVITED: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  SUSPENDED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  DEACTIVATED: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',

  // CommentStatus
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  FLAGGED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  SPAM: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',

  // CampaignStatus
  SCHEDULED: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  SENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  SENT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  PAUSED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',

  // BackupStatus
  CREATING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  RESTORING: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  RESTORED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  VERIFYING: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  VERIFIED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  DELETING: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',

  // JobStatus
  WAITING: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  CANCELLED: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',

  // WebhookDeliveryStatus
  SUCCESS: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ABORTED: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  QUEUED: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',

  // AiConnectionStatus
  CONNECTED_AI: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  DISCONNECTED_AI: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  ERROR_AI: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',

  // AiJobStatus
  PENDING_JOB: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  RUNNING_JOB: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  COMPLETED_JOB: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  FAILED_JOB: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  RETRYING_JOB: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  CANCELLED_JOB: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',

  // AiGenerationStatus
  CANCELLED_AI: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',

  // MediaProcessingStatus
  UPLOADING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  READY: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ERROR: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',

  // MediaScanStatus
  CLEAN: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  INFECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',

  // ReviewStatus
  CHANGES_REQUESTED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',

  // DependencyHealthStatus
  UP: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  DEGRADED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  DOWN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',

  // NotificationType
  INFO: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  SUCCESS_NT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  WARNING_NT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  ERROR_NT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ACTION_REQUIRED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',

  // AlertStatus
  TRIGGERED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ACKNOWLEDGED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  RESOLVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',

  // Redirect types
  PERMANENT_301: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  TEMPORARY_302: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  TEMPORARY_307: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  PERMANENT_308: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',

  // SeoIssueSeverity
  CRITICAL_SEO: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  WARNING_SEO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  INFO_SEO: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',

  // IndexingStatusType
  INDEXED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  PENDING_IDX: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  EXCLUDED: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  DISCOVERED: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',

  // BrokenLinkStatus
  BROKEN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  IGNORED_BL: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  FIXED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',

  // SitemapGenStatus
  PENDING_SMAP: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  GENERATED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',

  // SearchConsoleConnStatus
  CONNECTED_SC: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  DISCONNECTED_SC: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  EXPIRED_SC: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',

  // MonitorSeverity
  LOW: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',

  // AlertStatus
  SNOOZED: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',

  // ErrorLogSeverity
  DEBUG: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  INFO_EL: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  WARNING_EL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  FATAL: 'bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-300',

  // SecurityEventType
  FAILED_LOGIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  BLOCKED_IP: 'bg-zinc-800 text-zinc-100 dark:bg-zinc-700 dark:text-zinc-200',
  RATE_LIMIT_HIT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  PERMISSION_ERROR: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  SUSPICIOUS_ACTIVITY: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  EXPIRED_SESSION: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  BRUTE_FORCE_ATTEMPT: 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300',

  // SchedulerJobStatus
  ENABLED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  DISABLED: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  RUNNING_SCH: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  FAILED_SCH: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  RETRYING_SCH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',

  // EmailTemplateStatus
  ENABLED_ET: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  DISABLED_ET: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  DRAFT_ET: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',

  // EmailTemplateCategory
  CUSTOMER_EMAILS: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  AUTHENTICATION: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  NEWSLETTER: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  MARKETING: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  TRANSACTIONAL: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  NOTIFICATIONS: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  BILLING: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  SYSTEM: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',

  // ApiKeyStatus
  ACTIVE_API: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  INACTIVE_API: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  REVOKED_API: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  EXPIRED_API: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',

  // ApiKeyType
  LIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  TEST: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',

  // ApiKeyEnvironment
  DEVELOPMENT: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  TESTING: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  PRODUCTION: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',

  // ApiKeySiteAccess
  CURRENT: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  SELECTED: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  ALL_SITES: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',

  // Shared status values (used by OAuth Clients, etc.)
  INACTIVE: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  REVOKED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',

  // OAuthGrantType
  AUTHORIZATION_CODE: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  CLIENT_CREDENTIALS: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  PKCE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
} as const;

// -------------------- Pagination --------------------

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

// -------------------- Misc --------------------

export const MAX_UPLOAD_SIZE_MB = 50;
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
] as const;

export const SUPPORTED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const DEFAULT_LOCALE = 'en';

export const DEBOUNCE_MS = 300;
