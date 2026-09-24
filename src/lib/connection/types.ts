// ============================================================
// SITE CONNECTION TYPES — Standardized External Connection Layer
// ============================================================

export type PlatformType = 'standard' | 'wordpress';

export type ConnectionStatus =
  | 'CONNECTED'
  | 'INVALID_CREDENTIALS'
  | 'UNREACHABLE'
  | 'INVALID_API'
  | 'UNSUPPORTED_PLATFORM'
  | 'PENDING'
  | 'DISCONNECTED';

export interface StandardConnectionConfig {
  siteUrl: string;
  apiBaseUrl: string;
  apiKey?: string;
  encryptedApiKey?: string;
}

export interface WordPressConnectionConfig {
  siteUrl: string;
  restApiUrl: string;
  username?: string;
  appPassword?: string;
  encryptedPassword?: string;
}

export interface SiteConnectionData {
  platform: PlatformType;
  siteUrl: string;
  apiBaseUrl: string;
  connectionType: 'api_key' | 'application_password' | 'none';
  status: ConnectionStatus;
  lastVerifiedAt?: string;
  capabilities?: string[];
  diagnostics?: string;
  // Encrypted secrets (only stored server-side in DB, NEVER sent to frontend)
  encryptedCredentials?: string;
  // WordPress-specific public fields (safe to display)
  username?: string;
  // Sanitized client flags
  hasCredentials?: boolean;
}

export interface VerificationRequest {
  platform: PlatformType;
  siteUrl: string;
  apiBaseUrl?: string;
  apiKey?: string;
  restApiUrl?: string;
  username?: string;
  appPassword?: string;
}

export interface VerificationResponse {
  ok: boolean;
  status: ConnectionStatus;
  message: string;
  capabilities?: string[];
  details?: {
    siteName?: string;
    description?: string;
    version?: string;
    responseTimeMs?: number;
    username?: string;
    roles?: string[];
    [key: string]: unknown;
  };
}

export interface NormalizedSyncItem {
  externalId: string;
  title: string;
  slug: string;
  contentType: 'post' | 'page';
  content: string;
  excerpt?: string;
  status: 'PUBLISHED' | 'DRAFT';
  publishedAt?: string | Date;
  authorName?: string;
  authorAvatar?: string;
  authorRole?: string;
  authorBio?: string;
  categorySlug?: string;
  categoryName?: string;
  tagNames?: string[];
  featuredImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface NormalizedTaxonomyCategory {
  id?: string | number;
  name: string;
  slug: string;
  description?: string;
}

export interface NormalizedTaxonomyTag {
  id?: string | number;
  name: string;
  slug: string;
}

export interface DiscoveredSiteContent {
  posts: NormalizedSyncItem[];
  pages: NormalizedSyncItem[];
  categories: NormalizedTaxonomyCategory[];
  tags: NormalizedTaxonomyTag[];
  siteMetadata?: Record<string, unknown>;
}

export interface SyncReport {
  siteId: string;
  siteName: string;
  platform: string;
  postsDiscovered: number;
  pagesDiscovered: number;
  categoriesDiscovered: number;
  tagsDiscovered: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  errors?: string[];
  syncedAt: string;
}
