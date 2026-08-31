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
//   → Platform AI ('ai_platform') and Client's Own AI API ('ai_client')
//     are two INDEPENDENT Feature Access checkboxes — a plan may have
//     either, both, or neither:
//       • Platform AI        — the platform provides the AI; the plan's
//         AI usage limits (articles / words / images per month) apply.
//       • Client's Own AI API — the client connects their own provider
//         /API; that usage NEVER consumes the Platform AI limits.
//
// API ACCESS DEPENDENCY (the ONE rule between features):
//   API Access REQUIRES Client's Own AI API — a saved plan can never
//   have api_access without ai_client. Enabling API Access also
//   enables Client's Own AI API; turning Client's Own AI API off also
//   turns API Access off (enforced in the plan editor UI, in input
//   validation, and in normalizeEntitlementKeys). Platform AI does NOT
//   satisfy this dependency.
//
// SITE IDENTITY IS NOT A PLAN ENTITLEMENT: clients already create and
// manage their own sites/blogs from the dashboard — every site carries
// its own domain/site configuration and its own brand identity. So
// 'custom_domains' and 'white_label' are NOT plan features (the legacy
// keys are stripped by normalizeEntitlementKeys on load/save). The
// plan controls access to actual platform TOOLS, not basic site
// identity or site configuration.
// ============================================================

export const ENTITLEMENT_KEYS = [
  'automation',
  'advanced_seo',
  'advanced_analytics',
  'comments',
  'newsletter',
  'email_templates',
  'backups',
  'api_access',
  // Platform AI + Client's Own AI API — independent Feature Access
  // keys (a plan may have either, both, or neither). 'ai_content'
  // below is the legacy pre-migration key, normalized to 'ai_platform'
  // on load.
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
  comments: 'Comments',
  newsletter: 'Newsletter',
  email_templates: 'Email Templates',
  backups: 'Backups',
  api_access: 'API Access',
  ai_platform: 'Platform AI',
  ai_client: "Client's Own AI API",
  ai_content: 'AI Tools',
  audit_log: 'Audit Log',
};

export const ENTITLEMENT_DESCRIPTIONS: Record<EntitlementKey, string> = {
  automation: 'Schedule + run workflow automations',
  advanced_seo: 'Broken links, redirects, schema, search console',
  advanced_analytics: 'Detailed traffic + content analytics',
  comments: 'Comments moderation + management',
  newsletter: 'Subscriber management + campaigns (client-managed delivery)',
  email_templates: 'Create + manage reusable email templates',
  backups: 'Create + restore CMS backups (client-managed storage)',
  api_access: 'Programmatic API access — requires Client\'s Own AI API',
  // Exact customer-facing wording from the plan spec (also rendered
  // next to the Platform AI checkbox in the plan editor, above its
  // nested Usage Limits block).
  ai_platform: 'AI provided by the platform — usage is subject to the plan\'s AI limits.',
  ai_client: "Client connects their own AI provider — platform AI usage limits do not apply.",
  ai_content: 'Generate articles, images and rewrites with AI',
  audit_log: 'Detailed activity + audit trail',
};

// -------------------- Plan editor Feature Access --------------------

/** The Feature Access checkboxes exposed in the Create/Edit Plan
 *  modal (in display order) — 10 INDEPENDENT features, including
 *  Platform AI and Client's Own AI API as normal checkboxes (a plan
 *  may have either, both, or neither; they are NOT mutually
 *  exclusive). The ONE inter-feature rule lives here as a note:
 *  API Access requires Client's Own AI API (the plan editor
 *  auto-enables it; the backend rejects/normalizes invalid combos).
 *  Custom Domains and White Label are deliberately NOT here: sites
 *  (with their own domain + branding) are client-owned in this
 *  architecture, so they are not plan entitlements at all. */
export const PLAN_EDITOR_FEATURE_KEYS = [
  'automation',
  'advanced_seo',
  'advanced_analytics',
  'comments',
  'newsletter',
  'email_templates',
  'backups',
  'ai_platform',
  'ai_client',
  'api_access',
] as const;

export type PlanEditorFeatureKey = (typeof PLAN_EDITOR_FEATURE_KEYS)[number];

/** AI feature keys — kept as named constants for server-side checks
 *  (requireFeature('ai_platform') / ('ai_client')). */
export const AI_MODE_PLATFORM = 'ai_platform';
export const AI_MODE_CLIENT = 'ai_client';

export type AiMode = 'none' | 'platform' | 'client';

/** Resolve the plan's Platform AI availability from its entitlement
 *  keys — NOT a mutual-exclusion "mode" anymore:
 *  - 'platform' → Platform AI is enabled (alone OR together with
 *    Client's Own AI API — platform AI usage limits apply to usage
 *    through Platform AI whenever the plan includes it)
 *  - 'client'   → only Client's Own AI API (never counted/limited)
 *  - 'none'    → both AI features disabled
 *  The legacy 'ai_content' key normalizes to 'platform' (it predates
 *  the split and always meant the platform-provided AI). */
export function aiModeOfEntitlements(entitlements: readonly string[]): AiMode {
  const hasPlatform = entitlements.includes(AI_MODE_PLATFORM) || entitlements.includes('ai_content');
  const hasClient = entitlements.includes(AI_MODE_CLIENT);
  if (hasPlatform) return 'platform';
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

/** Platform AI usage limits — shown/configured ONLY while Platform AI
 *  is enabled. Client's Own AI API usage never consumes them. */
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
