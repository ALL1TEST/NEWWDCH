// ============================================================
// SETTINGS SERVICE — Enterprise CMS Central Configuration
// Single source of truth for all CMS settings
// ============================================================

import { db } from '@/lib/db';

// -------------------- Types --------------------

export type SettingFieldControl =
  | 'text'
  | 'textarea'
  | 'number'
  | 'switch'
  | 'select'
  | 'multiselect'
  | 'color'
  | 'password'
  | 'url'
  | 'email'
  | 'json'
  | 'code';

export interface SettingFieldOption {
  label: string;
  value: string;
}

export interface SettingFieldDef {
  key: string;
  label: string;
  description: string;
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'EMAIL' | 'URL' | 'COLOR' | 'ENCRYPTED' | 'SECRET';
  control: SettingFieldControl;
  defaultValue: string;
  group?: string;
  options?: SettingFieldOption[];
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  validation?: 'email' | 'url' | 'json' | 'positive' | 'port' | 'cron' | 'regex' | string;
  validationPattern?: string;
  isPublic?: boolean;
  isSensitive?: boolean;
}

export interface SettingsCategoryDef {
  key: string;
  label: string;
  description: string;
  icon: string;
  fields: SettingFieldDef[];
}

// -------------------- In-Memory Cache --------------------

class SettingsCache {
  private cache: Map<string, string> = new Map();
  private timestamp: number = 0;
  private readonly TTL_MS = 60_000; // 1 minute

  get(key: string): string | undefined {
    if (Date.now() - this.timestamp > this.TTL_MS) {
      this.cache.clear();
      return undefined;
    }
    return this.cache.get(key);
  }

  set(key: string, value: string): void {
    this.cache.set(key, value);
    this.timestamp = Date.now();
  }

  invalidate(): void {
    this.cache.clear();
    this.timestamp = 0;
  }

  invalidateKey(key: string): void {
    this.cache.delete(key);
  }
}

const settingsCache = new SettingsCache();

// -------------------- Audit Logging --------------------

export interface AuditLogEntry {
  settingId?: string;
  key: string;
  category: string;
  oldValue?: string;
  newValue?: string;
  changedBy?: string;
  changedByName?: string;
  siteId?: string;
  ipAddress?: string;
  action?: string;
}

export async function logSettingChange(entry: AuditLogEntry): Promise<void> {
  try {
    await db.settingsAuditLog.create({
      data: {
        settingId: entry.settingId,
        key: entry.key,
        category: entry.category as any,
        oldValue: entry.oldValue ?? null,
        newValue: entry.newValue ?? null,
        changedBy: entry.changedBy ?? null,
        changedByName: entry.changedByName ?? null,
        siteId: entry.siteId ?? null,
        ipAddress: entry.ipAddress ?? null,
        action: entry.action ?? 'UPDATE',
      },
    });
  } catch (err) {
    console.error('[SETTINGS:AUDIT] Failed to log setting change:', err);
  }
}

// -------------------- Settings Definitions --------------------

// Common option sets
const TIMEZONES = [
  'Africa/Casablanca', 'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'America/Mexico_City',
  'America/Toronto', 'America/Vancouver',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Seoul',
  'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Bangkok', 'Asia/Karachi',
  'Australia/Sydney', 'Australia/Melbourne',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome',
  'Europe/Amsterdam', 'Europe/Zurich', 'Europe/Moscow', 'Europe/Istanbul',
  'Pacific/Auckland', 'Pacific/Honolulu', 'UTC',
];

const DATE_FORMATS = [
  { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
  { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
  { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
  { label: 'DD.MM.YYYY', value: 'DD.MM.YYYY' },
  { label: 'MMM D, YYYY', value: 'MMM D, YYYY' },
  { label: 'MMMM D, YYYY', value: 'MMMM D, YYYY' },
];

const TIME_FORMATS = [
  { label: '24-hour (HH:mm)', value: '24h' },
  { label: '12-hour (h:mm A)', value: '12h' },
];

const CURRENCIES = [
  { label: 'USD ($)', value: 'USD' }, { label: 'EUR (€)', value: 'EUR' },
  { label: 'GBP (£)', value: 'GBP' }, { label: 'JPY (¥)', value: 'JPY' },
  { label: 'CNY (¥)', value: 'CNY' }, { label: 'INR (₹)', value: 'INR' },
  { label: 'AUD (A$)', value: 'AUD' }, { label: 'CAD (C$)', value: 'CAD' },
  { label: 'CHF (Fr)', value: 'CHF' }, { label: 'MAD (DH)', value: 'MAD' },
];

const ENCRYPTION_TYPES = [
  { label: 'None', value: 'none' },
  { label: 'SSL/TLS', value: 'ssl' },
  { label: 'STARTTLS', value: 'starttls' },
];

export const SETTINGS_CATEGORIES: SettingsCategoryDef[] = [
  // ==================== GENERAL ====================
  {
    key: 'GENERAL',
    label: 'General',
    description: 'Core site information and branding',
    icon: 'Globe',
    fields: [
      { key: 'site_title', label: 'Site Title', description: 'The name of your site displayed in the browser tab and headers', type: 'STRING', control: 'text', defaultValue: 'CMS Admin Dashboard', group: 'Site Info', isPublic: true },
      { key: 'site_description', label: 'Site Description', description: 'A brief description used in meta tags and search results', type: 'STRING', control: 'textarea', defaultValue: 'A powerful content management system', group: 'Site Info', isPublic: true },
      { key: 'site_url', label: 'Site URL', description: 'The canonical URL of your site', type: 'URL', control: 'url', defaultValue: 'https://cms.example.com', group: 'Site Info', validation: 'url', isPublic: true },
      { key: 'site_logo', label: 'Logo URL', description: 'URL or path to the site logo image', type: 'STRING', control: 'text', defaultValue: '/uploads/logo.svg', group: 'Branding', isPublic: true },
      { key: 'site_favicon', label: 'Favicon URL', description: 'URL or path to the favicon', type: 'STRING', control: 'text', defaultValue: '/favicon.ico', group: 'Branding', isPublic: true },
      { key: 'site_email', label: 'Site Email', description: 'Primary contact email for the site', type: 'EMAIL', control: 'email', defaultValue: 'admin@example.com', group: 'Contact', validation: 'email', isPublic: true },
      { key: 'site_language', label: 'Site Language', description: 'Default language for the site', type: 'STRING', control: 'select', defaultValue: 'en', group: 'Site Info', options: [{ label: 'English', value: 'en' }, { label: 'French', value: 'fr' }, { label: 'Spanish', value: 'es' }, { label: 'Arabic', value: 'ar' }, { label: 'German', value: 'de' }, { label: 'Japanese', value: 'ja' }, { label: 'Chinese', value: 'zh' }] },
      { key: 'default_homepage', label: 'Default Homepage', description: 'The default page to show on the homepage', type: 'STRING', control: 'text', defaultValue: 'latest-posts', group: 'Site Info' },
      { key: 'organization_name', label: 'Organization Name', description: 'Name of the organization', type: 'STRING', control: 'text', defaultValue: '', group: 'Organization' },
      { key: 'organization_logo', label: 'Organization Logo', description: 'URL to the organization logo', type: 'STRING', control: 'text', defaultValue: '', group: 'Organization' },
      { key: 'contact_email', label: 'Contact Email', description: 'Public contact email address', type: 'EMAIL', control: 'email', defaultValue: '', group: 'Contact', validation: 'email' },
      { key: 'contact_phone', label: 'Contact Phone', description: 'Public contact phone number', type: 'STRING', control: 'text', defaultValue: '', group: 'Contact' },
    ],
  },

  // ==================== LOCALIZATION ====================
  {
    key: 'LOCALIZATION',
    label: 'Localization',
    description: 'Language, timezone, and regional settings',
    icon: 'Globe',
    fields: [
      { key: 'locale_language', label: 'Language', description: 'Primary language for the admin interface', type: 'STRING', control: 'select', defaultValue: 'en', options: [{ label: 'English', value: 'en' }, { label: 'French', value: 'fr' }, { label: 'Spanish', value: 'es' }, { label: 'Arabic', value: 'ar' }, { label: 'German', value: 'de' }] },
      { key: 'locale_timezone', label: 'Timezone', description: 'Default timezone for date/time display', type: 'STRING', control: 'select', defaultValue: 'UTC', options: TIMEZONES.map(tz => ({ label: tz, value: tz })) },
      { key: 'locale_date_format', label: 'Date Format', description: 'How dates are displayed', type: 'STRING', control: 'select', defaultValue: 'YYYY-MM-DD', options: DATE_FORMATS },
      { key: 'locale_time_format', label: 'Time Format', description: '12-hour or 24-hour time display', type: 'STRING', control: 'select', defaultValue: '24h', options: TIME_FORMATS },
      { key: 'locale_first_day_of_week', label: 'First Day of Week', description: 'Which day starts the calendar week', type: 'STRING', control: 'select', defaultValue: 'monday', options: [{ label: 'Monday', value: 'monday' }, { label: 'Sunday', value: 'sunday' }, { label: 'Saturday', value: 'saturday' }] },
      { key: 'locale_currency', label: 'Currency', description: 'Default currency for pricing', type: 'STRING', control: 'select', defaultValue: 'USD', options: CURRENCIES },
      { key: 'locale_measurement_units', label: 'Measurement Units', description: 'Metric or Imperial', type: 'STRING', control: 'select', defaultValue: 'metric', options: [{ label: 'Metric', value: 'metric' }, { label: 'Imperial', value: 'imperial' }] },
      { key: 'locale_text_direction', label: 'Text Direction', description: 'Left-to-right or Right-to-left', type: 'STRING', control: 'select', defaultValue: 'ltr', options: [{ label: 'Left to Right (LTR)', value: 'ltr' }, { label: 'Right to Left (RTL)', value: 'rtl' }] },
      { key: 'locale_number_format', label: 'Number Format', description: 'How numbers are formatted', type: 'STRING', control: 'select', defaultValue: 'en-US', options: [{ label: '1,234.56 (US)', value: 'en-US' }, { label: '1.234,56 (EU)', value: 'de-DE' }, { label: '1 234.56 (FR)', value: 'fr-FR' }] },
    ],
  },

  // ==================== READING ====================
  {
    key: 'READING',
    label: 'Reading',
    description: 'Content display and reading experience',
    icon: 'BookOpen',
    fields: [
      { key: 'posts_per_page', label: 'Posts Per Page', description: 'Number of posts to show per page', type: 'NUMBER', control: 'number', defaultValue: '10', min: 1, max: 100 },
      { key: 'default_content_type', label: 'Default Content Type', description: 'Default content type for new posts', type: 'STRING', control: 'select', defaultValue: 'post', options: [{ label: 'Post', value: 'post' }, { label: 'Page', value: 'page' }, { label: 'Article', value: 'article' }] },
      { key: 'reading_default_status', label: 'Default Status', description: 'Default status for new content', type: 'STRING', control: 'select', defaultValue: 'DRAFT', options: [{ label: 'Draft', value: 'DRAFT' }, { label: 'Published', value: 'PUBLISHED' }, { label: 'Pending Review', value: 'IN_REVIEW' }] },
      { key: 'reading_default_sort_order', label: 'Default Sort Order', description: 'How content is sorted by default', type: 'STRING', control: 'select', defaultValue: 'newest', options: [{ label: 'Newest First', value: 'newest' }, { label: 'Oldest First', value: 'oldest' }, { label: 'Alphabetical', value: 'alpha' }, { label: 'Last Modified', value: 'modified' }] },
      { key: 'reading_pagination_style', label: 'Pagination Style', description: 'Type of pagination to use', type: 'STRING', control: 'select', defaultValue: 'numbered', options: [{ label: 'Numbered', value: 'numbered' }, { label: 'Load More', value: 'load-more' }, { label: 'Infinite Scroll', value: 'infinite' }] },
      { key: 'reading_default_editor', label: 'Default Editor', description: 'Default content editor', type: 'STRING', control: 'select', defaultValue: 'rich-text', options: [{ label: 'Rich Text (WYSIWYG)', value: 'rich-text' }, { label: 'Markdown', value: 'markdown' }, { label: 'Code Editor', value: 'code' }] },
      { key: 'reading_enable_infinite_scroll', label: 'Enable Infinite Scroll', description: 'Automatically load more content when scrolling', type: 'BOOLEAN', control: 'switch', defaultValue: 'false' },
      { key: 'reading_show_excerpt', label: 'Show Excerpts', description: 'Display excerpts in post listings', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'reading_feed_enabled', label: 'Enable RSS Feed', description: 'Generate RSS/Atom feed', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'reading_feed_items', label: 'Feed Item Count', description: 'Number of items in the RSS feed', type: 'NUMBER', control: 'number', defaultValue: '20', min: 1, max: 100 },
    ],
  },

  // ==================== DISCUSSION ====================
  {
    key: 'DISCUSSION',
    label: 'Discussion',
    description: 'Comment and discussion settings',
    icon: 'MessageSquare',
    fields: [
      { key: 'enable_comments', label: 'Enable Comments', description: 'Allow comments on content globally', type: 'BOOLEAN', control: 'switch', defaultValue: 'true', isPublic: true },
      { key: 'comment_moderation', label: 'Comment Moderation', description: 'Require manual approval for comments', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'comment_require_approval', label: 'Require Approval', description: 'All comments must be approved before appearing', type: 'BOOLEAN', control: 'switch', defaultValue: 'false' },
      { key: 'comment_nesting', label: 'Comment Nesting', description: 'Allow threaded/nested replies', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'comment_max_reply_depth', label: 'Maximum Reply Depth', description: 'Maximum nesting level for replies', type: 'NUMBER', control: 'number', defaultValue: '5', min: 1, max: 20 },
      { key: 'comment_order', label: 'Comment Order', description: 'How comments are sorted', type: 'STRING', control: 'select', defaultValue: 'newest', options: [{ label: 'Newest First', value: 'newest' }, { label: 'Oldest First', value: 'oldest' }, { label: 'Most Liked', value: 'popular' }] },
      { key: 'comment_allow_guest', label: 'Allow Guest Comments', description: 'Allow unauthenticated users to comment', type: 'BOOLEAN', control: 'switch', defaultValue: 'false' },
      { key: 'comment_close_after_days', label: 'Close After Days', description: 'Automatically close comments after X days (0 = never)', type: 'NUMBER', control: 'number', defaultValue: '0', min: 0, max: 365 },
      { key: 'comment_auto_spam_detection', label: 'Auto Spam Detection', description: 'Automatically detect and filter spam', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'comment_spam_provider', label: 'Spam Provider', description: 'Service for spam detection', type: 'STRING', control: 'select', defaultValue: 'none', options: [{ label: 'None', value: 'none' }, { label: 'Akismet', value: 'akismet' }, { label: 'Custom', value: 'custom' }] },
      { key: 'comment_blacklisted_words', label: 'Blacklisted Words', description: 'Comma-separated list of prohibited words', type: 'STRING', control: 'textarea', defaultValue: '', placeholder: 'word1, word2, word3' },
      { key: 'comment_notification', label: 'Comment Notifications', description: 'Notify authors of new comments', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
    ],
  },

  // ==================== SEO ====================
  {
    key: 'SEO',
    label: 'SEO',
    description: 'Search engine optimization defaults',
    icon: 'Search',
    fields: [
      { key: 'seo_title_template', label: 'Meta Title Template', description: 'Template for auto-generated meta titles (%title%, %site%)', type: 'STRING', control: 'text', defaultValue: '%title% | %site%', group: 'Meta Tags' },
      { key: 'seo_description', label: 'Default Meta Description', description: 'Default description when none is specified', type: 'STRING', control: 'textarea', defaultValue: '', group: 'Meta Tags' },
      { key: 'seo_keywords_template', label: 'Meta Keywords Template', description: 'Template for auto-generated keywords', type: 'STRING', control: 'text', defaultValue: '', group: 'Meta Tags' },
      { key: 'seo_canonical_rules', label: 'Canonical URL Rules', description: 'How canonical URLs are generated', type: 'STRING', control: 'select', defaultValue: 'auto', group: 'Meta Tags', options: [{ label: 'Auto (recommended)', value: 'auto' }, { label: 'Manual Only', value: 'manual' }, { label: 'None', value: 'none' }] },
      { key: 'seo_robots_meta', label: 'Default Robots Meta', description: 'Default robots meta tag', type: 'STRING', control: 'select', defaultValue: 'index, follow', group: 'Meta Tags', options: [{ label: 'Index, Follow', value: 'index, follow' }, { label: 'Noindex, Follow', value: 'noindex, follow' }, { label: 'Index, Nofollow', value: 'index, nofollow' }, { label: 'Noindex, Nofollow', value: 'noindex, nofollow' }] },
      { key: 'seo_schema_type', label: 'Default Schema Type', description: 'Default JSON-LD schema type', type: 'STRING', control: 'select', defaultValue: 'Article', group: 'Structured Data', options: [{ label: 'Article', value: 'Article' }, { label: 'BlogPosting', value: 'BlogPosting' }, { label: 'WebPage', value: 'WebPage' }, { label: 'Product', value: 'Product' }, { label: 'FAQ', value: 'FAQ' }] },
      { key: 'seo_og_image', label: 'Default OG Image', description: 'Default Open Graph image URL', type: 'STRING', control: 'text', defaultValue: '', group: 'Open Graph' },
      { key: 'seo_twitter_card', label: 'Twitter Card Type', description: 'Default Twitter card style', type: 'STRING', control: 'select', defaultValue: 'summary_large_image', group: 'Social', options: [{ label: 'Summary Large Image', value: 'summary_large_image' }, { label: 'Summary', value: 'summary' }, { label: 'App', value: 'app' }, { label: 'Player', value: 'player' }] },
      { key: 'seo_breadcrumb_enabled', label: 'Enable Breadcrumbs', description: 'Show breadcrumb navigation', type: 'BOOLEAN', control: 'switch', defaultValue: 'true', group: 'Structured Data' },
      { key: 'seo_structured_data_defaults', label: 'Structured Data Defaults', description: 'Default JSON-LD structured data (JSON)', type: 'JSON', control: 'json', defaultValue: '{}', group: 'Structured Data' },
    ],
  },

  // ==================== MEDIA ====================
  {
    key: 'MEDIA',
    label: 'Media',
    description: 'File upload and media management',
    icon: 'Image',
    fields: [
      { key: 'media_upload_max_size', label: 'Max Upload Size (MB)', description: 'Maximum file upload size in megabytes', type: 'NUMBER', control: 'number', defaultValue: '50', min: 1, max: 500 },
      { key: 'media_allowed_types', label: 'Allowed File Types', description: 'Comma-separated list of allowed MIME types or extensions', type: 'STRING', control: 'textarea', defaultValue: 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml,application/pdf' },
      { key: 'media_image_quality', label: 'Image Quality (%)', description: 'Default compression quality for images', type: 'NUMBER', control: 'number', defaultValue: '85', min: 10, max: 100 },
      { key: 'media_auto_webp', label: 'Auto Convert to WebP', description: 'Automatically convert uploaded images to WebP', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'media_auto_avif', label: 'Auto Convert to AVIF', description: 'Also generate AVIF versions', type: 'BOOLEAN', control: 'switch', defaultValue: 'false' },
      { key: 'media_lazy_loading', label: 'Lazy Loading', description: 'Enable lazy loading for images', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'media_cdn_url', label: 'CDN URL', description: 'Base URL for CDN-delivered media', type: 'STRING', control: 'url', defaultValue: '', validation: 'url' },
      { key: 'media_storage_provider', label: 'Storage Provider', description: 'Where uploaded files are stored', type: 'STRING', control: 'select', defaultValue: 'LOCAL', options: [{ label: 'Local', value: 'LOCAL' }, { label: 'Amazon S3', value: 'S3' }, { label: 'Google Cloud Storage', value: 'GCS' }, { label: 'Azure Blob', value: 'AZURE' }] },
      { key: 'media_optimization_enabled', label: 'Image Optimization', description: 'Automatically optimize uploaded images', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'media_thumbnail_sizes', label: 'Thumbnail Sizes', description: 'Generated thumbnail sizes (JSON array)', type: 'JSON', control: 'json', defaultValue: '["150x150","300x300","600x400","1200x630"]' },
    ],
  },

  // ==================== SEARCH ENGINE ====================
  {
    key: 'SEARCH_ENGINE',
    label: 'Search',
    description: 'Internal site search configuration',
    icon: 'Search',
    fields: [
      { key: 'search_default_engine', label: 'Search Engine', description: 'Default search backend', type: 'STRING', control: 'select', defaultValue: 'database', options: [{ label: 'Database', value: 'database' }, { label: 'Meilisearch', value: 'meilisearch' }, { label: 'Algolia', value: 'algolia' }, { label: 'Elasticsearch', value: 'elasticsearch' }] },
      { key: 'search_weight_title', label: 'Title Weight', description: 'Search relevance weight for title matches', type: 'NUMBER', control: 'number', defaultValue: '10', min: 1, max: 20, group: 'Weights' },
      { key: 'search_weight_content', label: 'Content Weight', description: 'Search relevance weight for content matches', type: 'NUMBER', control: 'number', defaultValue: '5', min: 1, max: 20, group: 'Weights' },
      { key: 'search_weight_description', label: 'Description Weight', description: 'Search relevance weight for description matches', type: 'NUMBER', control: 'number', defaultValue: '3', min: 1, max: 20, group: 'Weights' },
      { key: 'search_synonyms', label: 'Search Synonyms', description: 'Synonym mappings for search (JSON)', type: 'JSON', control: 'json', defaultValue: '{}' },
      { key: 'search_fuzzy_enabled', label: 'Fuzzy Search', description: 'Enable fuzzy matching for typos', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'search_suggestions', label: 'Search Suggestions', description: 'Show suggestions while typing', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'search_index_delay', label: 'Index Delay (ms)', description: 'Delay before re-indexing after content change', type: 'NUMBER', control: 'number', defaultValue: '1000', min: 0, max: 30000 },
      { key: 'search_cache_enabled', label: 'Search Cache', description: 'Cache search results', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'search_min_length', label: 'Minimum Query Length', description: 'Minimum characters for a search query', type: 'NUMBER', control: 'number', defaultValue: '2', min: 1, max: 10 },
    ],
  },

  // ==================== EMAIL (SMTP) ====================
  {
    key: 'EMAIL',
    label: 'Email (SMTP)',
    description: 'Email delivery and SMTP configuration',
    icon: 'Mail',
    fields: [
      { key: 'smtp_host', label: 'SMTP Host', description: 'Hostname of the SMTP server', type: 'STRING', control: 'text', defaultValue: '', group: 'Connection', isSensitive: true },
      { key: 'smtp_port', label: 'SMTP Port', description: 'Port number for the SMTP server', type: 'NUMBER', control: 'number', defaultValue: '587', min: 1, max: 65535, group: 'Connection', isSensitive: true },
      { key: 'smtp_username', label: 'Username', description: 'SMTP authentication username', type: 'STRING', control: 'text', defaultValue: '', group: 'Authentication', isSensitive: true },
      { key: 'smtp_password', label: 'Password', description: 'SMTP authentication password', type: 'ENCRYPTED', control: 'password', defaultValue: '', group: 'Authentication', isSensitive: true },
      { key: 'smtp_encryption', label: 'Encryption', description: 'Encryption method for SMTP', type: 'STRING', control: 'select', defaultValue: 'starttls', group: 'Connection', options: ENCRYPTION_TYPES },
      { key: 'smtp_from_name', label: 'From Name', description: 'Name displayed in sent emails', type: 'STRING', control: 'text', defaultValue: 'CMS Admin', group: 'Sending' },
      { key: 'smtp_from_email', label: 'From Email', description: 'Email address for outgoing messages', type: 'EMAIL', control: 'email', defaultValue: 'noreply@example.com', group: 'Sending', validation: 'email' },
      { key: 'smtp_reply_to', label: 'Reply-To', description: 'Reply-to email address', type: 'EMAIL', control: 'email', defaultValue: '', group: 'Sending', validation: 'email' },
      { key: 'smtp_test_email', label: 'Test Email', description: 'Send a test email to verify configuration', type: 'STRING', control: 'email', defaultValue: '', group: 'Testing', validation: 'email' },
    ],
  },

  // ==================== SECURITY ====================
  {
    key: 'SECURITY',
    label: 'Security',
    description: 'Authentication, authorization, and security policies',
    icon: 'Shield',
    fields: [
      { key: 'security_2fa_enabled', label: 'Two-Factor Authentication', description: 'Require 2FA for all admin users', type: 'BOOLEAN', control: 'switch', defaultValue: 'false', group: 'Authentication' },
      { key: 'security_password_policy', label: 'Password Policy', description: 'Enforce strong password requirements', type: 'BOOLEAN', control: 'switch', defaultValue: 'true', group: 'Passwords' },
      { key: 'security_min_password_length', label: 'Min Password Length', description: 'Minimum password length', type: 'NUMBER', control: 'number', defaultValue: '8', min: 6, max: 128, group: 'Passwords' },
      { key: 'security_password_expiration_days', label: 'Password Expiration (days)', description: 'Days before password must be changed (0 = never)', type: 'NUMBER', control: 'number', defaultValue: '0', min: 0, max: 365, group: 'Passwords' },
      { key: 'security_session_timeout', label: 'Session Timeout (minutes)', description: 'Minutes of inactivity before session expires', type: 'NUMBER', control: 'number', defaultValue: '60', min: 5, max: 1440, group: 'Sessions' },
      { key: 'security_max_login_attempts', label: 'Max Login Attempts', description: 'Maximum failed login attempts before lockout', type: 'NUMBER', control: 'number', defaultValue: '5', min: 1, max: 20, group: 'Authentication' },
      { key: 'security_account_lockout_minutes', label: 'Account Lockout (minutes)', description: 'How long an account is locked after max attempts', type: 'NUMBER', control: 'number', defaultValue: '15', min: 1, max: 1440, group: 'Authentication' },
      { key: 'security_captcha_enabled', label: 'CAPTCHA', description: 'Enable CAPTCHA on login form', type: 'BOOLEAN', control: 'switch', defaultValue: 'false', group: 'Authentication' },
      { key: 'security_csrf_protection', label: 'CSRF Protection', description: 'Enable Cross-Site Request Forgery protection', type: 'BOOLEAN', control: 'switch', defaultValue: 'true', group: 'Protection' },
      { key: 'security_cors_origins', label: 'CORS Allowed Origins', description: 'Comma-separated list of allowed origins', type: 'STRING', control: 'textarea', defaultValue: '', group: 'Protection', placeholder: 'https://example.com, https://app.example.com' },
      { key: 'security_trusted_devices', label: 'Trusted Devices', description: 'Allow users to mark devices as trusted', type: 'BOOLEAN', control: 'switch', defaultValue: 'true', group: 'Sessions' },
      { key: 'security_ip_whitelist', label: 'IP Whitelist', description: 'Comma-separated IP addresses that bypass security', type: 'STRING', control: 'textarea', defaultValue: '', group: 'Protection', placeholder: '192.168.1.0/24, 10.0.0.1' },
      { key: 'security_headers_enabled', label: 'Security Headers', description: 'Enable security-related HTTP headers', type: 'BOOLEAN', control: 'switch', defaultValue: 'true', group: 'Protection' },
    ],
  },

  // ==================== API ====================
  {
    key: 'API',
    label: 'API',
    description: 'REST API configuration and access control',
    icon: 'Key',
    fields: [
      { key: 'api_enabled', label: 'Enable API', description: 'Enable the public REST API', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'api_version', label: 'API Version', description: 'Current API version', type: 'STRING', control: 'select', defaultValue: 'v1', options: [{ label: 'v1', value: 'v1' }, { label: 'v2 (beta)', value: 'v2' }] },
      { key: 'api_auth_method', label: 'Authentication Method', description: 'How API consumers authenticate', type: 'STRING', control: 'select', defaultValue: 'api_key', options: [{ label: 'API Key', value: 'api_key' }, { label: 'Bearer Token', value: 'bearer' }, { label: 'OAuth 2.0', value: 'oauth2' }, { label: 'None (Public)', value: 'none' }] },
      { key: 'api_default_pagination', label: 'Default Pagination', description: 'Default number of results per page', type: 'NUMBER', control: 'number', defaultValue: '25', min: 1, max: 100 },
      { key: 'api_rate_limit', label: 'Rate Limit (req/min)', description: 'Requests per minute per API key', type: 'NUMBER', control: 'number', defaultValue: '60', min: 1, max: 10000 },
      { key: 'api_cors_origins', label: 'CORS Origins', description: 'Allowed origins for API requests', type: 'STRING', control: 'textarea', defaultValue: '*' },
      { key: 'api_timeout', label: 'API Timeout (ms)', description: 'Request timeout in milliseconds', type: 'NUMBER', control: 'number', defaultValue: '30000', min: 1000, max: 300000 },
      { key: 'api_docs_url', label: 'API Documentation URL', description: 'Link to API documentation', type: 'STRING', control: 'url', defaultValue: '', validation: 'url' },
    ],
  },

  // ==================== AI ====================
  {
    key: 'AI',
    label: 'AI',
    description: 'AI provider and model defaults',
    icon: 'Sparkles',
    fields: [
      { key: 'ai_default_provider', label: 'Default Provider', description: 'Primary AI provider', type: 'STRING', control: 'select', defaultValue: 'OPENAI', options: [{ label: 'OpenAI', value: 'OPENAI' }, { label: 'Anthropic', value: 'ANTHROPIC' }, { label: 'Google Gemini', value: 'GEMINI' }, { label: 'OpenRouter', value: 'OPENROUTER' }, { label: 'Groq', value: 'GROQ' }, { label: 'DeepSeek', value: 'DEEPSEEK' }, { label: 'Ollama (Local)', value: 'OLLAMA' }] },
      { key: 'ai_default_model', label: 'Default Model', description: 'Default model for AI operations', type: 'STRING', control: 'text', defaultValue: 'gpt-4o' },
      { key: 'ai_temperature', label: 'Temperature', description: 'Default temperature for text generation', type: 'NUMBER', control: 'number', defaultValue: '0.7', min: 0, max: 2, step: 0.1 },
      { key: 'ai_max_tokens', label: 'Max Tokens', description: 'Default maximum tokens per response', type: 'NUMBER', control: 'number', defaultValue: '4096', min: 1, max: 128000 },
      { key: 'ai_streaming_enabled', label: 'Enable Streaming', description: 'Stream AI responses in real-time', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'ai_json_mode', label: 'JSON Mode', description: 'Force structured JSON output', type: 'BOOLEAN', control: 'switch', defaultValue: 'false' },
      { key: 'ai_fallback_provider', label: 'Fallback Provider', description: 'Fallback AI provider when primary fails', type: 'STRING', control: 'select', defaultValue: '', options: [{ label: 'None', value: '' }, { label: 'OpenAI', value: 'OPENAI' }, { label: 'Anthropic', value: 'ANTHROPIC' }, { label: 'Google Gemini', value: 'GEMINI' }] },
      { key: 'ai_monthly_budget', label: 'Monthly Budget (USD)', description: 'Maximum monthly AI spending', type: 'NUMBER', control: 'number', defaultValue: '100', min: 0, max: 100000 },
      { key: 'ai_cost_limit_per_request', label: 'Cost Limit Per Request (USD)', description: 'Max cost per single AI request', type: 'NUMBER', control: 'number', defaultValue: '1', min: 0.01, max: 100, step: 0.01 },
      { key: 'ai_default_prompt_variables', label: 'Default Prompt Variables', description: 'Global variables available in all prompts (JSON)', type: 'JSON', control: 'json', defaultValue: '{}' },
    ],
  },

  // ==================== CACHE ====================
  {
    key: 'CACHE',
    label: 'Cache',
    description: 'Caching strategy and configuration',
    icon: 'Database',
    fields: [
      { key: 'cache_enabled', label: 'Enable Cache', description: 'Enable server-side caching', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'cache_driver', label: 'Cache Driver', description: 'Caching backend', type: 'STRING', control: 'select', defaultValue: 'memory', options: [{ label: 'In-Memory', value: 'memory' }, { label: 'Redis', value: 'redis' }, { label: 'File', value: 'file' }] },
      { key: 'cache_ttl', label: 'Cache TTL (seconds)', description: 'Default time-to-live for cached items', type: 'NUMBER', control: 'number', defaultValue: '3600', min: 0, max: 86400 },
      { key: 'cache_compression', label: 'Cache Compression', description: 'Compress cached data', type: 'BOOLEAN', control: 'switch', defaultValue: 'false' },
      { key: 'cache_auto_cache', label: 'Auto Cache', description: 'Automatically cache API responses', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'cache_clear_on_update', label: 'Auto-Invalidate on Update', description: 'Clear related cache when content is updated', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
    ],
  },

  // ==================== PERFORMANCE ====================
  {
    key: 'PERFORMANCE',
    label: 'Performance',
    description: 'Performance optimization settings',
    icon: 'Gauge',
    fields: [
      { key: 'perf_compression_enabled', label: 'Response Compression', description: 'Enable Gzip/Brotli compression', type: 'BOOLEAN', control: 'switch', defaultValue: 'true', group: 'Compression' },
      { key: 'perf_compression_type', label: 'Compression Type', description: 'Preferred compression algorithm', type: 'STRING', control: 'select', defaultValue: 'brotli', group: 'Compression', options: [{ label: 'Brotli', value: 'brotli' }, { label: 'Gzip', value: 'gzip' }, { label: 'Both', value: 'both' }] },
      { key: 'perf_minify_css', label: 'Minify CSS', description: 'Minify CSS output', type: 'BOOLEAN', control: 'switch', defaultValue: 'true', group: 'Minification' },
      { key: 'perf_minify_js', label: 'Minify JavaScript', description: 'Minify JavaScript output', type: 'BOOLEAN', control: 'switch', defaultValue: 'true', group: 'Minification' },
      { key: 'perf_http_cache', label: 'HTTP Cache Headers', description: 'Set cache-control headers for static assets', type: 'BOOLEAN', control: 'switch', defaultValue: 'true', group: 'Browser' },
      { key: 'perf_preload', label: 'Resource Preloading', description: 'Preload critical resources', type: 'BOOLEAN', control: 'switch', defaultValue: 'true', group: 'Optimization' },
      { key: 'perf_prefetch', label: 'Link Prefetching', description: 'Prefetch linked pages', type: 'BOOLEAN', control: 'switch', defaultValue: 'false', group: 'Optimization' },
      { key: 'perf_image_optimization', label: 'Image Optimization', description: 'Serve optimized image formats', type: 'BOOLEAN', control: 'switch', defaultValue: 'true', group: 'Optimization' },
      { key: 'perf_browser_cache_ttl', label: 'Browser Cache TTL (seconds)', description: 'How long browsers cache assets', type: 'NUMBER', control: 'number', defaultValue: '31536000', min: 0, max: 31536000, group: 'Browser' },
    ],
  },

  // ==================== ANALYTICS ====================
  {
    key: 'ANALYTICS',
    label: 'Analytics',
    description: 'Analytics and tracking configuration',
    icon: 'BarChart3',
    fields: [
      { key: 'analytics_provider', label: 'Analytics Provider', description: 'Primary analytics service', type: 'STRING', control: 'select', defaultValue: 'none', options: [{ label: 'None', value: 'none' }, { label: 'Google Analytics', value: 'ga' }, { label: 'Plausible', value: 'plausible' }, { label: 'PostHog', value: 'posthog' }, { label: 'Matomo', value: 'matomo' }] },
      { key: 'analytics_tracking_id', label: 'Tracking ID', description: 'Analytics tracking ID or measurement ID', type: 'STRING', control: 'text', defaultValue: '', isSensitive: true },
      { key: 'analytics_custom_domain', label: 'Custom Domain', description: 'Custom analytics domain (for self-hosted)', type: 'STRING', control: 'url', defaultValue: '', validation: 'url' },
      { key: 'analytics_cookie_consent', label: 'Cookie Consent', description: 'Require cookie consent before tracking', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'analytics_event_tracking', label: 'Event Tracking', description: 'Track custom events', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'analytics_anonymize_ip', label: 'Anonymize IP', description: 'Anonymize visitor IP addresses', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'analytics_disable_for_admins', label: 'Disable for Admins', description: 'Do not track admin users', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
    ],
  },

  // ==================== SEARCH CONSOLE ====================
  {
    key: 'SEARCH_CONSOLE',
    label: 'Search Console',
    description: 'Google Search Console integration',
    icon: 'BarChart3',
    fields: [
      { key: 'gsc_connected', label: 'Connected', description: 'Whether Google Search Console is connected', type: 'BOOLEAN', control: 'switch', defaultValue: 'false', isPublic: false },
      { key: 'gsc_default_property', label: 'Default Property', description: 'Default Search Console property URL', type: 'STRING', control: 'url', defaultValue: '', validation: 'url' },
      { key: 'gsc_last_sync', label: 'Last Sync', description: 'Timestamp of last data sync', type: 'STRING', control: 'text', defaultValue: '' },
      { key: 'gsc_auto_sync_enabled', label: 'Auto Sync', description: 'Automatically sync Search Console data', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'gsc_sync_frequency', label: 'Sync Frequency', description: 'How often to sync data', type: 'STRING', control: 'select', defaultValue: 'daily', options: [{ label: 'Hourly', value: 'hourly' }, { label: 'Daily', value: 'daily' }, { label: 'Weekly', value: 'weekly' }] },
    ],
  },

  // ==================== SITEMAP ====================
  {
    key: 'SITEMAP',
    label: 'Sitemap',
    description: 'XML Sitemap generation settings',
    icon: 'FileText',
    fields: [
      { key: 'sitemap_auto_generate', label: 'Auto Generate', description: 'Automatically regenerate sitemap on content changes', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'sitemap_default_priority', label: 'Default Priority', description: 'Default priority for sitemap entries', type: 'NUMBER', control: 'number', defaultValue: '0.5', min: 0, max: 1, step: 0.1 },
      { key: 'sitemap_default_frequency', label: 'Default Frequency', description: 'Default change frequency', type: 'STRING', control: 'select', defaultValue: 'weekly', options: [{ label: 'Always', value: 'always' }, { label: 'Hourly', value: 'hourly' }, { label: 'Daily', value: 'daily' }, { label: 'Weekly', value: 'weekly' }, { label: 'Monthly', value: 'monthly' }, { label: 'Yearly', value: 'yearly' }, { label: 'Never', value: 'never' }] },
      { key: 'sitemap_excluded_types', label: 'Excluded Content Types', description: 'Content types to exclude from sitemap', type: 'STRING', control: 'textarea', defaultValue: '', placeholder: 'draft, internal' },
      { key: 'sitemap_ping_engines', label: 'Ping Search Engines', description: 'Notify search engines of sitemap changes', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'sitemap_last_generated', label: 'Last Generated', description: 'Timestamp of last sitemap generation', type: 'STRING', control: 'text', defaultValue: '' },
    ],
  },

  // ==================== ROBOTS ====================
  {
    key: 'ROBOTS',
    label: 'Robots',
    description: 'Robots.txt configuration',
    icon: 'Shield',
    fields: [
      { key: 'robots_content', label: 'robots.txt Content', description: 'Custom robots.txt file content', type: 'STRING', control: 'code', defaultValue: 'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nSitemap: /sitemap.xml', group: 'Editor' },
      { key: 'robots_allow_rules', label: 'Allow Rules', description: 'Additional allow rules', type: 'STRING', control: 'textarea', defaultValue: '/', group: 'Rules' },
      { key: 'robots_disallow_rules', label: 'Disallow Rules', description: 'Paths to disallow (one per line)', type: 'STRING', control: 'textarea', defaultValue: '/admin/\n/api/\n/_next/', group: 'Rules' },
      { key: 'robots_crawl_delay', label: 'Crawl Delay (seconds)', description: 'Delay between crawler requests (0 = no delay)', type: 'NUMBER', control: 'number', defaultValue: '0', min: 0, max: 60, group: 'Rules' },
      { key: 'robots_default_policy', label: 'Default Policy', description: 'Default robots policy for new content', type: 'STRING', control: 'select', defaultValue: 'allow', group: 'Rules', options: [{ label: 'Allow All', value: 'allow' }, { label: 'Block All', value: 'block' }, { label: 'Custom', value: 'custom' }] },
    ],
  },

  // ==================== BACKUPS (Defaults) ====================
  {
    key: 'BACKUPS',
    label: 'Backups',
    description: 'Backup configuration defaults',
    icon: 'Database',
    fields: [
      { key: 'backup_auto_enabled', label: 'Auto Backup', description: 'Enable automatic backups', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'backup_frequency', label: 'Backup Frequency', description: 'How often to create automatic backups', type: 'STRING', control: 'select', defaultValue: 'DAILY', options: [{ label: 'Hourly', value: 'HOURLY' }, { label: 'Every 6 Hours', value: 'EVERY_6_HOURS' }, { label: 'Daily', value: 'DAILY' }, { label: 'Weekly', value: 'WEEKLY' }, { label: 'Monthly', value: 'MONTHLY' }] },
      { key: 'backup_retention_count', label: 'Retention Count', description: 'Number of backups to keep', type: 'NUMBER', control: 'number', defaultValue: '10', min: 1, max: 100 },
      { key: 'backup_storage_provider', label: 'Storage Provider', description: 'Where to store backups', type: 'STRING', control: 'select', defaultValue: 'LOCAL', options: [{ label: 'Local', value: 'LOCAL' }, { label: 'Google Drive', value: 'GOOGLE_DRIVE' }, { label: 'Dropbox', value: 'DROPBOX' }, { label: 'OneDrive', value: 'ONEDRIVE' }, { label: 'Cloudflare R2', value: 'CLOUDFLARE_R2' }, { label: 'FTP', value: 'FTP' }] },
      { key: 'backup_encryption_enabled', label: 'Encryption', description: 'Encrypt backup files', type: 'BOOLEAN', control: 'switch', defaultValue: 'false' },
      { key: 'backup_verification_enabled', label: 'Verification', description: 'Verify backup integrity after creation', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'backup_compression_enabled', label: 'Compression', description: 'Compress backup files', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
    ],
  },

  // ==================== SCHEDULER / CRON ====================
  {
    key: 'SCHEDULER',
    label: 'Scheduler',
    description: 'Task scheduling and queue configuration',
    icon: 'Clock',
    fields: [
      { key: 'scheduler_enabled', label: 'Enable Scheduler', description: 'Enable the task scheduler', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'scheduler_timezone', label: 'Timezone', description: 'Scheduler timezone', type: 'STRING', control: 'select', defaultValue: 'UTC', options: TIMEZONES.map(tz => ({ label: tz, value: tz })) },
      { key: 'scheduler_driver', label: 'Queue Driver', description: 'Queue processing backend', type: 'STRING', control: 'select', defaultValue: 'database', options: [{ label: 'Database', value: 'database' }, { label: 'Redis', value: 'redis' }, { label: 'In-Memory', value: 'sync' }] },
      { key: 'scheduler_retry_failed', label: 'Retry Failed Jobs', description: 'Automatically retry failed jobs', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'scheduler_max_retries', label: 'Max Retries', description: 'Maximum retry attempts for failed jobs', type: 'NUMBER', control: 'number', defaultValue: '3', min: 1, max: 10 },
      { key: 'scheduler_max_workers', label: 'Max Workers', description: 'Maximum concurrent job workers', type: 'NUMBER', control: 'number', defaultValue: '5', min: 1, max: 50 },
      { key: 'scheduler_retry_delay', label: 'Retry Delay (seconds)', description: 'Delay between retry attempts', type: 'NUMBER', control: 'number', defaultValue: '60', min: 1, max: 3600 },
    ],
  },

  // ==================== NOTIFICATIONS ====================
  {
    key: 'NOTIFICATIONS',
    label: 'Notifications',
    description: 'Notification channel configuration',
    icon: 'Bell',
    fields: [
      { key: 'notif_email_enabled', label: 'Email Notifications', description: 'Send notifications via email', type: 'BOOLEAN', control: 'switch', defaultValue: 'true', group: 'Channels' },
      { key: 'notif_browser_enabled', label: 'Browser Notifications', description: 'Show in-app browser notifications', type: 'BOOLEAN', control: 'switch', defaultValue: 'true', group: 'Channels' },
      { key: 'notif_slack_enabled', label: 'Slack', description: 'Send notifications to Slack', type: 'BOOLEAN', control: 'switch', defaultValue: 'false', group: 'Channels' },
      { key: 'notif_slack_webhook', label: 'Slack Webhook URL', description: 'Slack incoming webhook URL', type: 'STRING', control: 'url', defaultValue: '', validation: 'url', group: 'Channels' },
      { key: 'notif_discord_enabled', label: 'Discord', description: 'Send notifications to Discord', type: 'BOOLEAN', control: 'switch', defaultValue: 'false', group: 'Channels' },
      { key: 'notif_discord_webhook', label: 'Discord Webhook URL', description: 'Discord webhook URL', type: 'STRING', control: 'url', defaultValue: '', validation: 'url', group: 'Channels' },
      { key: 'notif_telegram_enabled', label: 'Telegram', description: 'Send notifications to Telegram', type: 'BOOLEAN', control: 'switch', defaultValue: 'false', group: 'Channels' },
      { key: 'notif_telegram_bot_token', label: 'Telegram Bot Token', description: 'Telegram bot API token', type: 'SECRET', control: 'password', defaultValue: '', group: 'Channels', isSensitive: true },
      { key: 'notif_telegram_chat_id', label: 'Telegram Chat ID', description: 'Telegram chat/group ID', type: 'STRING', control: 'text', defaultValue: '', group: 'Channels' },
      { key: 'notif_webhook_enabled', label: 'Custom Webhooks', description: 'Send notifications via custom webhooks', type: 'BOOLEAN', control: 'switch', defaultValue: 'false', group: 'Channels' },
      { key: 'notif_webhook_url', label: 'Webhook URL', description: 'Custom notification webhook URL', type: 'STRING', control: 'url', defaultValue: '', validation: 'url', group: 'Channels' },
      { key: 'notif_sms_enabled', label: 'SMS Notifications', description: 'Send notifications via SMS', type: 'BOOLEAN', control: 'switch', defaultValue: 'false', group: 'Channels' },
      { key: 'notif_push_enabled', label: 'Push Notifications', description: 'Send browser push notifications', type: 'BOOLEAN', control: 'switch', defaultValue: 'false', group: 'Channels' },
    ],
  },

  // ==================== MAINTENANCE MODE ====================
  {
    key: 'MAINTENANCE',
    label: 'Maintenance',
    description: 'Maintenance mode and site availability',
    icon: 'AlertTriangle',
    fields: [
      { key: 'maintenance_enabled', label: 'Enable Maintenance Mode', description: 'Take the site offline for maintenance', type: 'BOOLEAN', control: 'switch', defaultValue: 'false' },
      { key: 'maintenance_message', label: 'Maintenance Message', description: 'Message displayed to visitors during maintenance', type: 'STRING', control: 'textarea', defaultValue: 'We are performing scheduled maintenance. We will be back shortly.' },
      { key: 'maintenance_allowed_users', label: 'Allowed Users', description: 'Comma-separated email addresses that can access the site', type: 'STRING', control: 'textarea', defaultValue: '' },
      { key: 'maintenance_allowed_ips', label: 'Allowed IPs', description: 'IP addresses that bypass maintenance mode', type: 'STRING', control: 'textarea', defaultValue: '' },
      { key: 'maintenance_scheduled_start', label: 'Scheduled Start', description: 'When maintenance mode starts (ISO datetime)', type: 'STRING', control: 'text', defaultValue: '' },
      { key: 'maintenance_scheduled_end', label: 'Scheduled End', description: 'When maintenance mode ends (ISO datetime)', type: 'STRING', control: 'text', defaultValue: '' },
      { key: 'maintenance_page_template', label: 'Page Template', description: 'Custom HTML template for maintenance page', type: 'STRING', control: 'code', defaultValue: '' },
    ],
  },

  // ==================== MULTI-SITE ====================
  {
    key: 'MULTI_SITE',
    label: 'Multi-Site',
    description: 'Multi-site configuration and defaults',
    icon: 'Layers',
    fields: [
      { key: 'multisite_enabled', label: 'Multi-Site Enabled', description: 'Enable multi-site functionality', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'multisite_inherit_global', label: 'Inherit Global Settings', description: 'New sites inherit global settings by default', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
      { key: 'multisite_default_site_config', label: 'Default Site Config', description: 'Default configuration for new sites (JSON)', type: 'JSON', control: 'json', defaultValue: '{}' },
      { key: 'multisite_cross_site_publish', label: 'Cross-Site Publishing', description: 'Allow publishing content across sites', type: 'BOOLEAN', control: 'switch', defaultValue: 'false' },
      { key: 'multisite_shared_media', label: 'Shared Media Library', description: 'Share media library across sites', type: 'BOOLEAN', control: 'switch', defaultValue: 'false' },
    ],
  },

  // ==================== IMPORT / EXPORT ====================
  {
    key: 'IMPORT_EXPORT',
    label: 'Import / Export',
    description: 'Settings import, export, and reset',
    icon: 'Upload',
    fields: [
      { key: 'import_export_format', label: 'Export Format', description: 'Default format for exporting settings', type: 'STRING', control: 'select', defaultValue: 'json', options: [{ label: 'JSON', value: 'json' }, { label: 'CSV', value: 'csv' }] },
      { key: 'import_include_sensitive', label: 'Include Sensitive Data', description: 'Include encrypted/sensitive values in exports', type: 'BOOLEAN', control: 'switch', defaultValue: 'false' },
      { key: 'import_validate_before_apply', label: 'Validate Before Import', description: 'Validate imported settings before applying', type: 'BOOLEAN', control: 'switch', defaultValue: 'true' },
    ],
  },

  // ==================== ADVANCED ====================
  {
    key: 'ADVANCED',
    label: 'Advanced',
    description: 'Developer options and system configuration',
    icon: 'Settings',
    fields: [
      { key: 'advanced_environment', label: 'Environment', description: 'Current application environment', type: 'STRING', control: 'select', defaultValue: 'production', options: [{ label: 'Production', value: 'production' }, { label: 'Staging', value: 'staging' }, { label: 'Development', value: 'development' }, { label: 'Testing', value: 'testing' }] },
      { key: 'advanced_debug_mode', label: 'Debug Mode', description: 'Enable detailed error messages and logging', type: 'BOOLEAN', control: 'switch', defaultValue: 'false' },
      { key: 'advanced_log_level', label: 'Log Level', description: 'Minimum log level', type: 'STRING', control: 'select', defaultValue: 'INFO', options: [{ label: 'DEBUG', value: 'DEBUG' }, { label: 'INFO', value: 'INFO' }, { label: 'WARNING', value: 'WARNING' }, { label: 'ERROR', value: 'ERROR' }, { label: 'FATAL', value: 'FATAL' }] },
      { key: 'advanced_feature_flags', label: 'Feature Flags', description: 'Feature flags as JSON', type: 'JSON', control: 'json', defaultValue: '{}' },
      { key: 'advanced_experimental_features', label: 'Experimental Features', description: 'Enable experimental features', type: 'BOOLEAN', control: 'switch', defaultValue: 'false' },
    ],
  },
];

// -------------------- UI-Visible Categories --------------------
// Only these categories appear in the Settings UI.
// The remaining categories (ANALYTICS, SEARCH_CONSOLE, SITEMAP, ROBOTS,
// BACKUPS, SCHEDULER, NOTIFICATIONS) are kept in SETTINGS_CATEGORIES for
// backend programmatic access (getSettingValue, validation, defaults)
// but are NOT exposed in the Settings UI — their primary modules own them.

export const UI_VISIBLE_CATEGORY_KEYS = new Set([
  'GENERAL',
  'LOCALIZATION',
  'READING',
  'DISCUSSION',
  'SEO',
  'MEDIA',
  'SEARCH_ENGINE',
  'EMAIL',
  'SECURITY',
  'API',
  'AI',
  'CACHE',
  'PERFORMANCE',
  'MAINTENANCE',
  'MULTI_SITE',
  'IMPORT_EXPORT',
  'ADVANCED',
]);

/** Return only the categories that should appear in the Settings UI */
export function getVisibleCategories(): SettingsCategoryDef[] {
  return SETTINGS_CATEGORIES.filter((cat) => UI_VISIBLE_CATEGORY_KEYS.has(cat.key));
}

// -------------------- Helper Functions --------------------

/** Build a flat map of all setting keys → field definitions */
export const SETTING_DEFS: Record<string, SettingFieldDef> = {};
export const CATEGORY_MAP: Record<string, SettingsCategoryDef> = {};

for (const cat of SETTINGS_CATEGORIES) {
  CATEGORY_MAP[cat.key] = cat;
  for (const field of cat.fields) {
    SETTING_DEFS[field.key] = field;
  }
}

/** Get a setting definition by key */
export function getSettingDef(key: string): SettingFieldDef | undefined {
  return SETTING_DEFS[key];
}

/** Get the category for a given setting key */
export function getSettingCategory(key: string): string | undefined {
  return SETTING_DEFS[key]?.key ? getCategoryForKey(key) : undefined;
}

function getCategoryForKey(key: string): string | undefined {
  for (const cat of SETTINGS_CATEGORIES) {
    if (cat.fields.some(f => f.key === key)) return cat.key;
  }
  return undefined;
}

/** Get default value for a setting key */
export function getDefaultValue(key: string): string {
  return SETTING_DEFS[key]?.defaultValue ?? '';
}

/** Get all keys for a category */
export function getCategoryKeys(category: string): string[] {
  return SETTINGS_CATEGORIES.find(c => c.key === category)?.fields.map(f => f.key) ?? [];
}

/** Validate a single setting value */
export function validateSettingValue(key: string, value: string): { valid: boolean; error?: string } {
  const def = SETTING_DEFS[key];
  if (!def) return { valid: true }; // Unknown keys are allowed (custom settings)

  // Check required
  if (!value && value !== '0' && value !== 'false') {
    // Allow empty for optional fields
  }

  // Type validation
  if (def.type === 'NUMBER') {
    const num = Number(value);
    if (isNaN(num)) return { valid: false, error: 'Must be a valid number' };
    if (def.min !== undefined && num < def.min) return { valid: false, error: `Must be at least ${def.min}` };
    if (def.max !== undefined && num > def.max) return { valid: false, error: `Must be at most ${def.max}` };
  }

  if (def.type === 'BOOLEAN') {
    if (value !== 'true' && value !== 'false') return { valid: false, error: 'Must be true or false' };
  }

  if (def.type === 'JSON') {
    try { JSON.parse(value); } catch { return { valid: false, error: 'Must be valid JSON' }; }
  }

  // Validation rules
  if (def.validation === 'email' && value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return { valid: false, error: 'Must be a valid email address' };
  }

  if (def.validation === 'url' && value) {
    try { new URL(value); } catch { return { valid: false, error: 'Must be a valid URL' }; }
  }

  return { valid: true };
}

// -------------------- Core CRUD Operations --------------------

/** Get all settings, merging with defaults */
export async function getAllSettings(options?: { category?: string; scope?: string; siteId?: string }) {
  const where: Record<string, unknown> = {};
  if (options?.category) where.category = options.category;
  if (options?.scope) where.scope = options.scope;
  if (options?.siteId) where.siteId = options.siteId;

  const dbSettings = await db.setting.findMany({ where, orderBy: [{ key: 'asc' }, { updatedAt: 'desc' }] });

  // Merge with defaults
  const result: Record<string, string> = {};
  for (const cat of SETTINGS_CATEGORIES) {
    if (options?.category && cat.key !== options.category) continue;
    for (const field of cat.fields) {
      const dbSetting = dbSettings.find((s: { key: string }) => s.key === field.key);
      result[field.key] = dbSetting?.value ?? field.defaultValue;
    }
  }

  // Include any custom settings not in definitions
  for (const s of dbSettings) {
    if (!(s.key in result)) {
      result[s.key] = s.isEncrypted ? '[ENCRYPTED]' : s.value;
    }
  }

  return result;
}

/** Get a single setting value */
export async function getSettingValue(key: string, scope: string = 'GLOBAL'): Promise<string> {
  const cacheKey = `${scope}:${key}`;
  const cached = settingsCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const setting = await db.setting.findFirst({ where: { key, scope } });
  const def = getSettingDef(key);
  const value = setting ? (setting.isEncrypted ? '[ENCRYPTED]' : setting.value) : (def?.defaultValue ?? '');

  settingsCache.set(cacheKey, value);
  return value;
}

/** Batch upsert settings with audit logging */
export async function batchUpsertSettings(
  settings: Array<{ key: string; value: string; type?: string; category?: string }>,
  meta?: { changedBy?: string; changedByName?: string; siteId?: string; ipAddress?: string }
) {
  const results = [];
  const errors: string[] = [];

  for (const s of settings) {
    // Validate
    const validation = validateSettingValue(s.key, s.value);
    if (!validation.valid) {
      errors.push(`${s.key}: ${validation.error}`);
      continue;
    }

    const def = getSettingDef(s.key);
    const category = s.category ?? getCategoryForKey(s.key) ?? 'GENERAL';

    try {
      // Find existing — use findFirst (not upsert's unique key) because
      // userId and siteId are null, and Prisma unique constraints treat
      // NULL as distinct, so upsert.where can't match null-valued keys.
      const existing = await db.setting.findFirst({
        where: { key: s.key, scope: 'GLOBAL', userId: null, siteId: null },
      });

      const oldValue = existing?.isEncrypted ? undefined : existing?.value;
      const newValue = (s.type === 'ENCRYPTED' || s.type === 'SECRET') ? '[ENCRYPTED]' : s.value;

      const data = {
        value: s.value,
        type: (s.type as any) ?? def?.type ?? 'STRING',
        category: category as any,
        description: def?.description ?? null,
        isEncrypted: s.type === 'ENCRYPTED' || s.type === 'SECRET' || def?.type === 'ENCRYPTED' || def?.type === 'SECRET',
        isPublic: def?.isPublic ?? false,
      };

      let item;
      if (existing) {
        item = await db.setting.update({
          where: { id: existing.id },
          data,
        });
      } else {
        item = await db.setting.create({
          data: {
            ...data,
            key: s.key,
            scope: 'GLOBAL',
          },
        });
      }

      // Audit log
      if (oldValue !== s.value) {
        await logSettingChange({
          settingId: item.id,
          key: s.key,
          category,
          oldValue,
          newValue: s.value,
          ...meta,
        });
      }

      // Update cache
      settingsCache.invalidateKey(`GLOBAL:${s.key}`);
      results.push(item);
    } catch (err) {
      errors.push(`${s.key}: ${(err as Error).message}`);
    }
  }

  return { results, errors, updated: results.length, failed: errors.length };
}

/** Search settings by name, key, or description */
export function searchSettingDefs(query: string, options?: { visibleOnly?: boolean }) {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const cats = options?.visibleOnly !== false
    ? SETTINGS_CATEGORIES.filter((cat) => UI_VISIBLE_CATEGORY_KEYS.has(cat.key))
    : SETTINGS_CATEGORIES;

  const matches: Array<{ category: string; categoryLabel: string; field: SettingFieldDef }> = [];

  for (const cat of cats) {
    for (const field of cat.fields) {
      const searchStr = `${field.key} ${field.label} ${field.description} ${field.group ?? ''}`.toLowerCase();
      if (searchStr.includes(q)) {
        matches.push({ category: cat.key, categoryLabel: cat.label, field });
      }
    }
  }

  return matches;
}

/** Export all settings */
export async function exportSettings(options?: { includeSensitive?: boolean; category?: string }) {
  const all = await getAllSettings({ category: options?.category });
  const exportData: Record<string, { value: string; type?: string; category?: string; encrypted: boolean }> = {};

  for (const [key, value] of Object.entries(all)) {
    const def = getSettingDef(key);
    if (def?.isSensitive && !options?.includeSensitive) continue;

    exportData[key] = {
      value,
      type: def?.type,
      category: getCategoryForKey(key),
      encrypted: def?.type === 'ENCRYPTED' || def?.type === 'SECRET' || false,
    };
  }

  return {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    settings: exportData,
    totalSettings: Object.keys(exportData).length,
  };
}

/** Import settings from JSON */
export async function importSettings(
  data: Record<string, { value: string; type?: string; category?: string }>,
  meta?: { changedBy?: string; changedByName?: string; siteId?: string; ipAddress?: string }
) {
  const entries = Object.entries(data).map(([key, val]) => ({
    key,
    value: val.value,
    type: val.type,
    category: val.category,
  }));

  return batchUpsertSettings(entries, meta);
}

/** Reset settings in a category to defaults */
export async function resetCategoryToDefaults(category: string, meta?: { changedBy?: string; changedByName?: string; siteId?: string; ipAddress?: string }) {
  const keys = getCategoryKeys(category);
 const entries = keys.map(key => {
    const def = getSettingDef(key)!;
    return { key, value: def.defaultValue, type: def.type, category };
  });

  return batchUpsertSettings(entries, meta);
}

/** Reset ALL settings to defaults */
export async function resetAllSettings(meta?: { changedBy?: string; changedByName?: string; siteId?: string; ipAddress?: string }) {
  const entries: Array<{ key: string; value: string; type: string; category: string }> = [];
  for (const cat of SETTINGS_CATEGORIES) {
    for (const field of cat.fields) {
      entries.push({ key: field.key, value: field.defaultValue, type: field.type, category: cat.key });
    }
  }
  return batchUpsertSettings(entries, meta);
}

/** Get audit log entries */
export async function getAuditLog(options?: {
  category?: string;
  key?: string;
  page?: number;
  pageSize?: number;
  siteId?: string;
}) {
  const where: Record<string, unknown> = {};
  if (options?.category) where.category = options.category;
  if (options?.key) where.key = { contains: options.key };
  if (options?.siteId) where.siteId = options.siteId;

  const page = options?.page ?? 1;
  const pageSize = Math.min(options?.pageSize ?? 25, 100);

  const [items, total] = await Promise.all([
    db.settingsAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.settingsAuditLog.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
