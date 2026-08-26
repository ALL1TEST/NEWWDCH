// ============================================================
// SHARED TYPES — Enterprise CMS Admin Dashboard
// Mirrors all Prisma enums + API / UI types
// ============================================================

// -------------------- Prisma Enum Mirrors --------------------

export type UserRole =
  | 'ADMIN'
  | 'EDITOR';

export type PostStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'UNPUBLISHED'
  | 'ARCHIVED';

export type UserStatus =
  | 'INVITED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'DEACTIVATED';

export type ReviewStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CHANGES_REQUESTED';

export type ContentContributorRole =
  | 'AUTHOR'
  | 'CO_AUTHOR'
  | 'REVIEWER'
  | 'TRANSLATOR';

export type TranslationAssignmentStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'APPROVED';

export type MediaScanStatus = 'PENDING' | 'CLEAN' | 'INFECTED';

export type MediaProcessingStatus =
  | 'UPLOADING'
  | 'PROCESSING'
  | 'READY'
  | 'ERROR';

export type ReusableBlockType =
  | 'RICH_TEXT'
  | 'HTML'
  | 'CODE_SNIPPET';

export type NavItemType =
  | 'PAGE_LINK'
  | 'CATEGORY_LINK'
  | 'CUSTOM_URL'
  | 'SEPARATOR'
  | 'DROPDOWN'
  | 'CONTENT_REFERENCE';

export type RedirectType = 'PERMANENT_301' | 'TEMPORARY_302' | 'TEMPORARY_307' | 'PERMANENT_308';

export type SeoIssueSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type IndexingStatusType = 'INDEXED' | 'PENDING' | 'EXCLUDED' | 'DISCOVERED' | 'ERROR';

export type BrokenLinkType = 'INTERNAL' | 'EXTERNAL' | 'IMAGE' | 'PDF' | 'ANCHOR';

export type BrokenLinkStatus = 'BROKEN' | 'IGNORED' | 'FIXED';

export type SitemapGenStatus = 'PENDING' | 'GENERATED' | 'ERROR';

export type SearchConsoleConnStatus = 'CONNECTED' | 'DISCONNECTED' | 'EXPIRED';

export type CommentStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'FLAGGED'
  | 'SPAM';

export type FormStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type SubmissionStatus =
  | 'RECEIVED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'SPAM';

export type SubscriberStatus =
  | 'SUBSCRIBED'
  | 'UNSUBSCRIBED'
  | 'BOUNCED'
  | 'COMPLAINED';

export type CampaignStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'SENDING'
  | 'SENT'
  | 'FAILED'
  | 'CANCELLED';

export type NotificationType =
  | 'INFO'
  | 'SUCCESS'
  | 'WARNING'
  | 'ERROR'
  | 'ACTION_REQUIRED';

export type NotificationChannel =
  | 'IN_APP'
  | 'EMAIL'
  | 'PUSH'
  | 'SLACK';

export type BackupStatus =
  | 'CREATING'
  | 'COMPLETED'
  | 'FAILED'
  | 'RESTORING'
  | 'RESTORED'
  | 'VERIFYING'
  | 'VERIFIED'
  | 'DELETING';

export type BackupType = 'AUTOMATED' | 'MANUAL';

export type BackupScope =
  | 'FULL'
  | 'DATABASE_ONLY'
  | 'MEDIA_ONLY'
  | 'FILES_ONLY'
  | 'SETTINGS_ONLY';

export type BackupStorageProvider =
  | 'LOCAL'
  | 'GOOGLE_DRIVE'
  | 'DROPBOX'
  | 'ONEDRIVE'
  | 'CLOUDFLARE_R2'
  | 'FTP';

export type BackupVerificationStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'WARNING'
  | 'FAILED'
  | 'SKIPPED';

export type BackupEncryptionStatus =
  | 'NONE'
  | 'ENCRYPTED'
  | 'DECRYPTED';

export type BackupScheduleFrequency =
  | 'HOURLY'
  | 'EVERY_6_HOURS'
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'CUSTOM_CRON';

export type IpRuleType = 'ALLOW' | 'BLOCK';

export type DependencyHealthStatus = 'UP' | 'DEGRADED' | 'DOWN';

export type BulkOperationType =
  | 'DELETE'
  | 'PUBLISH'
  | 'UNPUBLISH'
  | 'ARCHIVE'
  | 'RESTORE'
  | 'MOVE'
  | 'ASSIGN'
  | 'EXPORT'
  | 'IMPORT'
  | 'ADD_TAGS'
  | 'REMOVE_TAGS';

export type ImportExportType = 'IMPORT' | 'EXPORT';

export type ImportExportFormat = 'JSON' | 'CSV' | 'MARKDOWN';

export type ResourceType = 'MEDIA' | 'BACKUP' | 'EXPORT' | 'OTHER';

export type StoragePeriod = 'DAILY' | 'MONTHLY';

export type ApiKeyType = 'LIVE' | 'TEST';

export type ApiKeyStatus = 'ACTIVE' | 'INACTIVE' | 'REVOKED' | 'EXPIRED';

export type ApiKeyEnvironment = 'DEVELOPMENT' | 'TESTING' | 'PRODUCTION';

export type ApiKeySiteAccess = 'CURRENT' | 'SELECTED' | 'ALL';

export type OAuthGrantType = 'AUTHORIZATION_CODE' | 'CLIENT_CREDENTIALS' | 'PKCE';

export type OAuthClientStatus = 'ACTIVE' | 'INACTIVE' | 'REVOKED';

export type AiProviderKind = 'OPENAI' | 'ANTHROPIC' | 'GEMINI' | 'GROQ' | 'DEEPSEEK' | 'CUSTOM';

export type AiConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export type AiJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING' | 'CANCELLED';

export type AiJobType = 'GENERATE_ARTICLE' | 'REWRITE_CONTENT' | 'SEO_OPTIMIZATION' | 'GENERATE_IMAGES' | 'TRANSLATE_ARTICLE' | 'CUSTOM';

export type PromptCategoryNew =
  | 'CONTENT_GENERATION'
  | 'IMAGE_GENERATION'
  | 'SEO'
  | 'TRANSLATION'
  | 'SUMMARIZATION'
  | 'MARKETING'
  | 'SOCIAL_MEDIA'
  | 'EMAIL'
  | 'CODING'
  | 'ANALYSIS';

export type WebhookDeliveryStatus =
  | 'SUCCESS'
  | 'FAILED'
  | 'PENDING'
  | 'RETRYING'
  | 'ABORTED'
  | 'QUEUED';

export type WebhookAuthMethod =
  | 'NONE'
  | 'API_KEY'
  | 'BEARER_TOKEN'
  | 'BASIC_AUTH'
  | 'CUSTOM_SECRET';

export type WebhookPayloadFormat =
  | 'JSON'
  | 'XML'
  | 'FORM_DATA';

export type WebhookHttpMethod =
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'GET'
  | 'DELETE';

export type WebhookRetryPolicy =
  | 'NONE'
  | 'FIXED_DELAY'
  | 'EXPONENTIAL_BACKOFF';

export type WebhookScope =
  | 'ALL_SITES'
  | 'SPECIFIC_SITE';

export type EmailTemplateStatus = 'ENABLED' | 'DISABLED' | 'DRAFT';

export type EmailTemplateCategory =
  | 'CUSTOMER_EMAILS'
  | 'AUTHENTICATION'
  | 'NEWSLETTER'
  | 'MARKETING'
  | 'TRANSACTIONAL'
  | 'NOTIFICATIONS'
  | 'BILLING'
  | 'SYSTEM';

export type EmailProvider =
  | 'SMTP'
  | 'SES'
  | 'RESEND'
  | 'MAILGUN'
  | 'SENDGRID'
  | 'POSTMARK'
  | 'BREVO'
  | 'ELASTIC_EMAIL';

export type JobPriority =
  | 'CRITICAL'
  | 'HIGH'
  | 'NORMAL'
  | 'LOW'
  | 'BATCH';

export type JobStatus =
  | 'WAITING'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRYING'
  | 'CANCELLED';

export type AlertStatus = 'TRIGGERED' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SNOOZED';

export type MonitorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AlertChannel = 'IN_APP' | 'EMAIL' | 'WEBHOOK' | 'SLACK' | 'DISCORD' | 'TELEGRAM';

export type ErrorLogSeverity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'FATAL';

export type SecurityEventType =
  | 'FAILED_LOGIN'
  | 'BLOCKED_IP'
  | 'RATE_LIMIT_HIT'
  | 'PERMISSION_ERROR'
  | 'SUSPICIOUS_ACTIVITY'
  | 'EXPIRED_SESSION'
  | 'BRUTE_FORCE_ATTEMPT'
  | 'UNKNOWN';

export type SchedulerJobStatus = 'ENABLED' | 'DISABLED' | 'RUNNING' | 'FAILED' | 'RETRYING';

export type ErrorSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'FATAL';

export type ErrorType = 'RUNTIME' | 'DATABASE' | 'NETWORK' | 'VALIDATION' | 'UNKNOWN';

export type SettingType =
  | 'STRING'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'JSON'
  | 'EMAIL'
  | 'URL'
  | 'COLOR'
  | 'ENCRYPTED'
  | 'SECRET';

export type SettingScope = 'GLOBAL' | 'WORKSPACE' | 'USER' | 'SITE';

export type SettingsCategory =
  | 'GENERAL'
  | 'LOCALIZATION'
  | 'READING'
  | 'DISCUSSION'
  | 'SEO'
  | 'MEDIA'
  | 'SEARCH_ENGINE'
  | 'EMAIL'
  | 'SECURITY'
  | 'API'
  | 'AI'
  | 'CACHE'
  | 'PERFORMANCE'
  | 'ANALYTICS'
  | 'SEARCH_CONSOLE'
  | 'SITEMAP'
  | 'ROBOTS'
  | 'BACKUPS'
  | 'SCHEDULER'
  | 'NOTIFICATIONS'
  | 'MAINTENANCE'
  | 'MULTI_SITE'
  | 'IMPORT_EXPORT'
  | 'ADVANCED';

export type FieldType =
  | 'STRING'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'JSON'
  | 'ENUM'
  | 'FILE';

export type StorageProvider = 'LOCAL' | 'S3' | 'GCS' | 'AZURE';

export type FeatureFlagTargetType = 'USER' | 'ROLE';

// -------------------- API Envelope --------------------

export interface ApiResponseMeta {
  requestId: string;
  timestamp: string;
  duration?: number;
  pagination?: PaginationMeta;
}

export interface ApiResponse<T = unknown> {
  data: T;
  meta: ApiResponseMeta;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    doc_url?: string;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}

// -------------------- Pagination --------------------

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T = unknown> {
  data: T[];
  pagination: PaginationMeta;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface FilterParam {
  field: string;
  operator:
    | 'eq'
    | 'ne'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'contains'
    | 'startsWith'
    | 'endsWith'
    | 'in'
    | 'notIn'
    | 'isNull'
    | 'isNotNull';
  value: unknown;
}

export interface SortParam {
  field: string;
  direction: 'asc' | 'desc';
}

// -------------------- Permissions --------------------

export type Permission = string;

export interface RolePermissionMap {
  [role: string]: Permission[];
}

// -------------------- Navigation --------------------

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  badge?: string | number;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  requiredRole?: UserRole;
  requiredPermission?: Permission;
  children?: NavItem[];
  isExternal?: boolean;
  isSeparator?: boolean;
  isCollapsed?: boolean;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: string;
  isCurrent?: boolean;
}

// -------------------- Multi-Site --------------------

export type SiteStatus = 'ACTIVE' | 'MAINTENANCE' | 'SUSPENDED' | 'ARCHIVED';

export interface Site {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  description: string | null;
  logo: string | null;
  favicon: string | null;
  status: SiteStatus;
  config: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    contentItems: number;
    media: number;
    categories: number;
    tags: number;
  };
}

export interface SiteStats {
  totalSites: number;
  activeSites: number;
  totalContent: number;
  publishedContent: number;
  totalVisitors: number;
  aiArticlesToday: number;
  aiWordsToday: number;
  healthScore: number;
}

// -------------------- Common Query Helpers --------------------

export interface SelectOption<V = string> {
  label: string;
  value: V;
}

export interface DateRange {
  from: Date;
  to: Date;
}

// -------------------- Dashboard --------------------

export interface DashboardStatCard {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  [key: string]: unknown;
}
