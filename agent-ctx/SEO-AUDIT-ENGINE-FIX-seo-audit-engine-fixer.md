# SEO-AUDIT-ENGINE-FIX — Work Record

**Agent:** seo-audit-engine-fixer
**Task ID:** SEO-AUDIT-ENGINE-FIX
**Status:** ✅ Complete

## Scope
Fix the destructive SEO audit engine so re-running an audit preserves issue history, timestamps, IDs, and resolution state — instead of wiping and recreating everything.

## Files Changed
1. `src/app/api/seo/issues/route.ts` — POST `?action=audit`
2. `src/app/api/seo/issues/[id]/route.ts` — PATCH + DELETE

## What was broken
`POST /api/seo/issues?action=audit` called `db.seoIssue.deleteMany({ where: { ...siteFilter, isResolved: false } })` then `db.seoIssue.createMany(...)` on every run. This destroyed:
- original `createdAt` timestamps (all reset to "now"),
- stable `id`s (broke any external references / audit-log joins),
- user-set `isResolved` state (manually-resolved issues got resurrected as open),
- issue history (no way to tell "still broken" from "newly broken").

## Fix applied — route.ts (audit)
- **Removed** the `deleteMany` block entirely. Issues are never deleted during an audit.
- **Kept 100% of the scanning logic** unchanged (all reads + every check: meta title/description, H1, featured image, canonical URL, OG image, image ALT, content length, internal links, H2 structure, duplicate titles, duplicate/external canonical URLs).
- **Replaced** the trailing `createMany` with upsert persistence inside `db.$transaction(async (tx) => {...})`:
  1. `tx.seoIssue.findMany({ where: siteFilter })` → all existing issues for the site.
  2. Build `Map<`${pageUrl}::${problem}`, SeoIssue>` for O(1) lookup. The composite key is the deterministic identity of an issue across runs.
  3. For each detected issue: if key exists → `tx.seoIssue.update` of `recommendation` + `severity` only (preserves `id`, `createdAt`, `isResolved`); add id to `seenIds`. Else → queue in `toCreate`.
  4. Stale = existing issues NOT in `seenIds` AND `!isResolved` → `tx.seoIssue.updateMany({ data: { isResolved: true } })`. These were fixed since the last audit.
  5. `tx.seoIssue.createMany({ data: toCreate })` only for genuinely new issues.
- **Response** now returns `audited`, `issuesFound`, `created`, `updated`, `resolved` + descriptive message (backward-compatible fields retained).

## Fix applied — [id]/route.ts (cross-site hardening)
- Added `import { getSiteWhere } from '@/lib/site-context'`.
- PATCH: `findUnique({ where: { id } })` → `findFirst({ where: { id, ...siteFilter } })`.
- DELETE: `_request` → `request` (now used); same `findFirst` + site filter change.
- Effect: an issue belonging to another site no longer matches → 404, blocking cross-site read/modify/delete.

## Verification
- `bun run lint 2>&1 | grep "seo/issues"` → **empty** (0 errors in edited files).
- Repo-wide lint still shows 2 pre-existing errors in *unrelated* files (`seo-broken-links-page.tsx`, `seo-social-preview-page.tsx`) — not introduced by this change.
- Dev server log: clean compilation (`✓ Compiled in 672ms`), no errors on the edited routes.

## Notes for downstream agents
- The audit transaction wraps only the **persistence** phase (existing-issue fetch + upsert loop + mark-stale + create). The scanning reads (`contentItem`, `seoConfig`, `site`) intentionally stay *outside* the transaction because (a) they touch different tables and don't contend with the writes, (b) keeping them outside avoids re-indenting ~270 lines of proven scanning logic and minimizes regression risk. The atomicity that matters — "don't leave the DB half-audited" — is fully guaranteed by the transaction around the writes.
- `updatedAt` is auto-managed by Prisma's `@updatedAt` on `SeoIssue`; the `update` calls refresh it implicitly.
- `isResolved` is deliberately NOT reset on matched issues: a user who manually resolved an issue keeps it resolved even if the scanner still detects the problem. If the product later wants "re-open manually-resolved issues that are still present", that's a separate, opt-in behavior.
