// ============================================================
// FEATURE / ENTITLEMENT / LIMIT CONFIG — client-safe vocabulary.
// ============================================================
// Shared by the server (plan-config, entitlements, usage-limits) and
// the Platform Admin UI so there is ONE vocabulary for entitlements
// and limits. This module has no server-only imports so it is safe to
// import from client components.
// ============================================================

export const ENTITLEMENT_KEYS = [
  'automation',
  'ai_content',
  'advanced_analytics',
  'custom_domains',
  'api_access',
  'white_label',
  'audit_log',
  'advanced_seo',
  'newsletter',
] as const;

export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];

export const ENTITLEMENT_LABELS: Record<EntitlementKey, string> = {
  automation: 'Automation',
  ai_content: 'AI Content',
  advanced_analytics: 'Advanced Analytics',
  custom_domains: 'Custom Domains',
  api_access: 'API Access',
  white_label: 'White Label',
  audit_log: 'Audit Log',
  advanced_seo: 'Advanced SEO',
  newsletter: 'Newsletter',
};

export const ENTITLEMENT_DESCRIPTIONS: Record<EntitlementKey, string> = {
  automation: 'Schedule + run workflow automations',
  ai_content: 'Generate articles, images and rewrites with AI',
  advanced_analytics: 'Detailed traffic + content analytics',
  custom_domains: 'Publish sites on custom domains',
  api_access: 'Programmatic API access + tokens',
  white_label: 'Remove platform branding (white-label)',
  audit_log: 'Detailed activity + audit trail',
  advanced_seo: 'Broken links, redirects, schema, search console',
  newsletter: 'Subscriber management + campaigns',
};

// Only limits that have a REAL, server-side enforcement system are listed
// here. AI Words / AI Articles / Automation Runs were removed because no
// real usage-tracking system exists for them — exposing them in the plan
// editor would have implied enforcement that never happened (fake limits).
// maxSites and storageBytes are backed by real tables (Site, Media) and
// are the only usage limits the platform actually tracks.
export const LIMIT_KEYS = ['maxSites', 'storageBytes'] as const;
export type LimitKey = (typeof LIMIT_KEYS)[number];

export const LIMIT_LABELS: Record<LimitKey, string> = {
  maxSites: 'Max Sites',
  storageBytes: 'Storage (bytes)',
};

/** -1 is the convention for "unlimited". */
export const UNLIMITED = -1;
