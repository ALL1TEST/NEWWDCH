// ============================================================
// FEATURE / ENTITLEMENT / LIMIT CONFIG — client-safe vocabulary.
// ============================================================
// Shared by the server (plan-config, entitlements, usage-limits) and
// the Platform Admin UI so there is ONE vocabulary for entitlements
// and limits. This module has no server-only imports so it is safe to
// import from client components.
//
// FEATURE ACCESS vs USAGE LIMITS (the architectural rule):
//   FEATURE ACCESS = "Is this tool available to the client?"
//   USAGE LIMIT    = "How much of a PLATFORM-CONTROLLED resource can
//                     the client consume?"
//
//   → Newsletter, Email Templates, Backups are Feature Access ONLY
//     (the client runs them on their own delivery/storage
//     infrastructure — no subscriber / send / backup-storage limits).
//   → Storage (CMS/media) and Max Sites are platform-controlled
//     resources → Usage Limits.
//   → AI Tools is Feature Access with TWO mutually exclusive modes:
//       • 'ai_platform' (Platform AI)      — the platform provides and
//         pays for the AI API → subject to the platform AI usage
//         limits (articles / words / images per month).
//       • 'ai_client' (Client's Own AI API) — the client connects
//         their own provider/API → NO platform AI usage limits.
// ============================================================

export const ENTITLEMENT_KEYS = [
  'automation',
  'advanced_seo',
  'advanced_analytics',
  'custom_domains',
  'newsletter',
  'email_templates',
  'backups',
  'api_access',
  'white_label',
  // AI Tools — the two mutually exclusive modes (a plan can have at
  // most ONE of them; 'ai_content' below is the legacy pre-migration
  // key, normalized to 'ai_platform' on load).
  'ai_platform',
  'ai_client',
  // Legacy key kept for backward compatibility with existing DB rows
  // and older API gates (requireFeature(request, 'ai_content')).
  // Never stored on new saves — rowToData normalizes it away.
  'ai_content',
  // Kept for backward compatibility with existing DB rows / routes
  // (/api/audit-logs gates on it). NOT part of the plan editor's
  // Feature Access list — preserved on save.
  'audit_log',
] as const;

export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];

export const ENTITLEMENT_LABELS: Record<EntitlementKey, string> = {
  automation: 'Automation',
  advanced_seo: 'Advanced SEO',
  advanced_analytics: 'Advanced Analytics',
  custom_domains: 'Custom Domains',
  newsletter: 'Newsletter',
  email_templates: 'Email Templates',
  backups: 'Backups',
  api_access: 'API Access',
  white_label: 'White Label',
  ai_platform: 'AI Tools — Platform AI',
  ai_client: "AI Tools — Client's Own AI API",
  ai_content: 'AI Tools',
  audit_log: 'Audit Log',
};

export const ENTITLEMENT_DESCRIPTIONS: Record<EntitlementKey, string> = {
  automation: 'Schedule + run workflow automations',
  advanced_seo: 'Broken links, redirects, schema, search console',
  advanced_analytics: 'Detailed traffic + content analytics',
  custom_domains: 'Publish sites on custom domains',
  newsletter: 'Subscriber management + campaigns (client-managed delivery)',
  email_templates: 'Create + manage reusable email templates',
  backups: 'Create + restore CMS backups (client-managed storage)',
  api_access: 'Programmatic API access + tokens',
  white_label: 'Remove platform branding (white-label)',
  ai_platform: "Platform provides and pays for the AI API — subject to the plan's AI usage limits",
  ai_client: "Client connects their own AI provider/API — not subject to platform AI usage limits",
  ai_content: 'Generate articles, images and rewrites with AI',
  audit_log: 'Detailed activity + audit trail',
};

// -------------------- Plan editor Feature Access --------------------

/** The simple checkbox features exposed in the Create/Edit Plan modal's
 *  "Feature Access" section (in display order). AI Tools is NOT in this
 *  list — it is rendered as its own two-mode block (see AI_MODE_*). */
export const PLAN_EDITOR_FEATURE_KEYS = [
  'automation',
  'advanced_seo',
  'advanced_analytics',
  'custom_domains',
  'newsletter',
  'email_templates',
  'backups',
  'api_access',
  'white_label',
] as const;

export type PlanEditorFeatureKey = (typeof PLAN_EDITOR_FEATURE_KEYS)[number];

/** AI Tools entitlement keys — the two mutually exclusive modes. */
export const AI_MODE_PLATFORM = 'ai_platform';
export const AI_MODE_CLIENT = 'ai_client';

export type AiMode = 'none' | 'platform' | 'client';

/** Resolve the AI Tools mode from a plan's entitlement keys.
 *  - 'platform' → Platform AI (platform-provided AI API + AI usage limits)
 *  - 'client'   → Client's Own AI API (client-managed provider, no limits)
 *  - 'none'     → AI Tools disabled
 *  The legacy 'ai_content' key normalizes to 'platform' (it predates the
 *  two-mode split and always meant the platform-provided AI). */
export function aiModeOfEntitlements(entitlements: readonly string[]): AiMode {
  const hasPlatform = entitlements.includes(AI_MODE_PLATFORM) || entitlements.includes('ai_content');
  const hasClient = entitlements.includes(AI_MODE_CLIENT);
  if (hasPlatform) return 'platform'; // both present (invalid data) → platform wins
  if (hasClient) return 'client';
  return 'none';
}

// -------------------- Usage limits --------------------

// Only limits for resources the PLATFORM actually controls/provides.
//   maxSites / storageBytes   — platform infrastructure (Site, Media).
//   ai*PerMonth               — Platform AI usage (ONLY applicable when
//                               the plan uses Platform AI; never applied
//                               to Client's Own AI API plans).
// Newsletter subscribers / email sends / backup storage / backup runs /
// email templates are FEATURE entitlements in this architecture, not
// platform usage limits.
export const LIMIT_KEYS = [
  'maxSites',
  'storageBytes',
  'aiArticlesPerMonth',
  'aiWordsPerMonth',
  'aiImagesPerMonth',
] as const;
export type LimitKey = (typeof LIMIT_KEYS)[number];

/** Always-visible plan limits (platform-controlled infrastructure). */
export const CORE_LIMIT_KEYS = ['maxSites', 'storageBytes'] as const;
export type CoreLimitKey = (typeof CORE_LIMIT_KEYS)[number];

/** Platform AI usage limits — shown/configured ONLY when the plan uses
 *  Platform AI. Never displayed for Client's Own AI API plans. */
export const AI_LIMIT_KEYS = ['aiArticlesPerMonth', 'aiWordsPerMonth', 'aiImagesPerMonth'] as const;
export type AiLimitKey = (typeof AI_LIMIT_KEYS)[number];

export const LIMIT_LABELS: Record<LimitKey, string> = {
  maxSites: 'Max Sites',
  storageBytes: 'Storage (bytes)',
  aiArticlesPerMonth: 'AI Articles / month',
  aiWordsPerMonth: 'AI Words / month',
  aiImagesPerMonth: 'AI Images / month',
};

/** -1 is the convention for "unlimited". */
export const UNLIMITED = -1;
