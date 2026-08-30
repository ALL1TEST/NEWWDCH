'use client';

// ============================================================
// PLATFORM EMAIL TEMPLATES — thin scope-aware wrapper.
//
// ONE email-templates system, TWO scopes. The Client Email Templates
// router (src/modules/email-templates/email-templates-page.tsx)
// accepts { scope?: 'client' | 'platform' } (default 'client').
// This wrapper renders the SAME router with scope="platform", which:
//
//   • renders PlatformPageHeader (keeps the PLATFORM badge) on the
//     list page instead of the legacy PageHeader
//   • sends scope=platform on every GET /api/email-templates list
//     query + on the category-counts queries (so platform sees only
//     system templates: siteId IS NULL, guarded by requirePlatformAdmin)
//   • sends scope=platform on POST /api/email-templates (create) and
//     POST /api/email-templates/seed (seed defaults) — both guarded by
//     requirePlatformAdmin on the server
//   • uses platform-scoped TanStack Query cache keys so client and
//     platform lists never collide
//   • navigates under 'platform-email-templates' so the URL hash is
//     #platform-email-templates/<id> and the platform module router
//     picks up the editor / preview sub-pages
//   • reuses the COMPLETE Client TemplateList (category tabs, counts,
//     search, status filter, sort, table, provider/status/category/
//     language badges, pagination, row actions, Seed Defaults) and
//     the COMPLETE Client TemplateEditor (Template Name, Subject,
//     Category, Status, HTML editor with toolbar / line numbers /
//     search-replace / fullscreen, Dynamic Variables panel with all
//     variable groups, variable insertion, validation, Cancel/Create,
//     unsaved-changes handling, auto-save) and the COMPLETE Client
//     TemplatePreview (device toggles, dark mode, variable replacement).
//
// No duplicate list / table / create modal / edit modal / preview
// modal. The previous 1141-line duplicate implementation is replaced
// by this ~10-line wrapper.
//
// Platform permissions: the GET/POST list + seed endpoints guard
// scope=platform with requirePlatformAdmin, so client users cannot
// read or mutate platform templates. The per-id GET/PATCH/DELETE and
// duplicate endpoints are scope-agnostic (work by ID) — the list view
// naturally separates scopes, and system templates cannot be deleted
// (server-side guard in the DELETE route).
// ============================================================

import { EmailTemplatesPage } from '@/modules/email-templates/email-templates-page';

export function PlatformEmailTemplatesModule() {
  return <EmailTemplatesPage scope="platform" />;
}
