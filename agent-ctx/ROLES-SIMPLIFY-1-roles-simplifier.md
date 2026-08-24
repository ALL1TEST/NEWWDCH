# Task ROLES-SIMPLIFY-1 — Simplified Users & Roles System

**Agent:** main (roles-simplifier)
**Task:** Replace the legacy 5-role system (SUPER_ADMIN/ADMIN/EDITOR/AUTHOR/CONTRIBUTOR) with a simplified 2-role system (ADMIN/EDITOR) backed by per-user `pagePermissions` arrays + admin-defined `CustomPermission` records.

## Work Log

### 1. Prisma schema (`prisma/schema.prisma`)
- Replaced `enum UserRole { SUPER_ADMIN, ADMIN, EDITOR, AUTHOR, CONTRIBUTOR }` with `enum UserRole { ADMIN, EDITOR }`.
- Changed the default value on `User.role` from `AUTHOR` to `EDITOR` (needed because the old default was no longer valid in the new enum).
- Added `pagePermissions String?` field to the `User` model (stores a JSON array of page keys, e.g. `'["content","media","calendar"]'`).
- Added new `CustomPermission` model — `id`, `name` (unique), `description?`, `route?`, `createdBy?`, `createdAt`, `updatedAt`. Used by admins to define extra page-level permissions that can be granted to EDITOR users (e.g. "Manage Authors" → key `manage-authors`).
- Ran `bun run db:push` to sync the schema (the push uses `--accept-data-loss` since the enum shrink is destructive).

### 2. Shared types & constants
- `src/shared/types/index.ts`: trimmed `UserRole` to `'ADMIN' | 'EDITOR'`.
- `src/shared/constants/index.ts`: trimmed `ROLE_HIERARCHY` to `['ADMIN', 'EDITOR']`.
- `src/lib/validators.ts`: updated `userCreateSchema.role` and `userUpdateSchema.role` enums to `['ADMIN', 'EDITOR']`; default changed from `'AUTHOR'` to `'EDITOR'`.

### 3. Centralized permission system (`src/lib/permissions.ts`)
Replaced the legacy `ROLE_PERMISSIONS` map (which had per-role permission lists for SUPER_ADMIN/ADMIN/EDITOR/AUTHOR/CONTRIBUTOR) with a page-based system:
- `BUILTIN_PAGES` — 11 entries (`dashboard`, `calendar`, `content`, `media`, `users`, `comments`, `newsletter`, `seo`, `ai`, `automation`, `settings`) with `key`/`label`/`icon`.
- `SETTINGS_SUBPAGES` — 4 entries (`email-templates`, `smtp`, `notifications`, `backups`).
- `customPermissionKeyFromName(name)` — converts "Manage Authors" → "manage-authors" (lowercase, hyphenated, sanitised).
- `canAccessPage(role, pagePermissions, pageKey)` — ADMIN always returns true; EDITOR returns true if `pageKey` is in their `pagePermissions` array (or if `pageKey` is a settings sub-page and they have `settings`).
- `getAccessiblePages(role, pagePermissions)` — expands an EDITOR's `pagePermissions` to include all settings sub-pages if `settings` is present; returns all pages for ADMIN.
- `parsePagePermissions(raw)` / `serializePagePermissions(pages)` — JSON string ↔ string[] helpers (used by every API route that touches `User.pagePermissions`).
- `getVisibleNavItems(userRole, allItems, pagePermissions)` — sidebar filter: ADMIN sees everything; EDITOR sees only items whose hash-derived page key is in their `pagePermissions` array, with children (settings sub-pages) filtered the same way.
- `hasPermission(userRole, requiredRole)` — kept for backward compat with the existing `requiredRole` prop on `NavItem`; ADMIN beats everything, EDITOR beats only EDITOR.

### 4. Custom Permissions API (`src/app/api/custom-permissions/`)
- `route.ts` (GET / POST):
  - GET → returns all `CustomPermission` rows with a derived `key` field added (`customPermissionKeyFromName(name)`).
  - POST → accepts `{ name, description?, route?, createdBy? }`, validates with zod, enforces uniqueness on the derived key (since SQLite has no case-insensitive derived-column unique constraint), returns the created record with its `key`.
- `[id]/route.ts` (DELETE):
  - Deletes the `CustomPermission` row.
  - Then walks every user whose `pagePermissions` column is non-null and removes the deleted permission's key from their array, persisting the updated JSON via `serializePagePermissions`. This guarantees no dangling references survive a delete.

### 5. Users API
- `src/app/api/users/route.ts` (GET, POST):
  - Added `pagePermissions: true` to `userSelect`.
  - GET response now parses each user's `pagePermissions` from JSON string → `string[] | null` via `parsePagePermissions`.
  - POST accepts an optional `pagePermissions: string[]`; serializes to JSON only when role is EDITOR (ADMIN gets `null` = full access).
  - Default role changed from `'AUTHOR'` to `'EDITOR'`.
- `src/app/api/users/[id]/route.ts` (GET, PATCH, DELETE):
  - Added `pagePermissions: true` to `userSelect`.
  - GET response parses `pagePermissions` for the client.
  - PATCH accepts `pagePermissions: string[]`; serializes for EDITOR; if the role is being switched to ADMIN in the same PATCH, `pagePermissions` is forced to `null`.
- `src/app/api/users/invite/route.ts` (POST):
  - Added `pagePermissions` to schema + `userSelect`; same serialize/parse logic as above.
  - Trimmed the legacy `role` enum down to `['ADMIN', 'EDITOR']` (was previously allowing SUPER_ADMIN/ADMIN/EDITOR/AUTHOR/CONTRIBUTOR/VIEWER/SEO_MANAGER/CONTENT_MANAGER/MARKETING_MANAGER).

### 6. Auth API
- `src/app/api/auth/me/route.ts`: removed the legacy `permissions: ROLE_PERMISSIONS[role]` field; now returns `pagePermissions: parsePagePermissions(user.pagePermissions)` in the user payload.
- `src/app/api/auth/login/route.ts`: same change — `pagePermissions` replaces the old `permissions` array in the login response.

### 7. Auth store (`src/lib/stores/auth-store.ts`)
- Added `pagePermissions?: string[] | null` to `CurrentUser`.
- Added `pagePermissions?: string[] | null` to the raw `ApiUser` interface.
- `mapApiUser` now copies `pagePermissions` through (defensive: only when it's actually an array).
- The persistent `localStorage` cache (`cms_auth_user` key) now stores `pagePermissions` alongside the other user fields, so the sidebar can render with the correct nav items before `/api/auth/me` resolves on a fresh page load.

### 8. Sidebar (`src/components/layout/sidebar.tsx`)
- `AppSidebar` now reads `user.pagePermissions` from `useAuthStore` and passes it as the third argument to `getVisibleNavItems(userRole, NAV_ITEMS, pagePermissions)`.
- ADMIN sees every item; EDITOR sees only items whose hash-derived page key is in their `pagePermissions` array. The Settings expandable submenu only shows the sub-pages the EDITOR has access to. If an EDITOR doesn't have `settings`, the entire Settings menu item is hidden.
- Existing sidebar styling, accordion behavior, route-derived section tracking, footer user badge — all unchanged.

### 9. Admin app (`src/components/layout/admin-app.tsx`)
- Wrapped the module renderer with a `canAccessPage(user.role, user.pagePermissions, pageKey)` check.
- When the current user lacks access to the current module, an "Access Denied" panel is rendered instead (amber ShieldAlert icon + heading + explanation). This is a defense-in-depth layer on top of the sidebar filter — direct hash navigation to a forbidden page now shows a clean denial state instead of a half-rendered module.
- ADMIN always passes; unauthenticated users fall through to the login screen (no false denial during initial load).

### 10. Users page (`src/modules/users/users-list-page.tsx`)
Complete rewrite of the invite/edit dialog and minor table updates:
- **Role options** reduced to `ADMIN` / `EDITOR` (was 5 options before).
- **`ROLE_COLORS`** trimmed to ADMIN (orange) and EDITOR (emerald) — was 5 colors before; EDITOR color switched from blue to emerald to avoid the "no indigo or blue" rule.
- **`InviteUserDialog`** simplified:
  - `InviteFormData` is now `{ email, name, role, pagePermissions }` (removed the unused `assignedSites` + `sitePermissions` plumbing from the legacy version).
  - When role is ADMIN, the Page Access section is replaced with an amber info box: "Admin users have full access to every page — no per-page configuration needed."
  - When role is EDITOR, a Page Access multi-select is shown inside a scrollable bordered card (`max-h-72 overflow-y-auto`) with:
    - A `<Checkbox>` row for each `BUILTIN_PAGES` entry (11 rows).
    - The Settings row expands inline to reveal the 4 `SETTINGS_SUBPAGES` as indented checkboxes — checking "Settings" doesn't auto-check the sub-pages, but granting "Settings" alone grants access to all sub-pages at runtime (per `canAccessPage`).
    - A "Custom Permissions" sub-section at the bottom (subtle muted background) listing every `CustomPermission` row fetched from `/api/custom-permissions`, each with a `<Checkbox>` row + a trash icon (revealed on hover) that opens a `ConfirmDialog` before deleting.
    - A "+ Custom" button in the sub-section header opens `CreateCustomPermissionDialog` — a small modal with Name (required), Description (optional), Route (optional), a live "Key:" preview as you type, and a Create button. On success, the parent query is invalidated and the new permission appears in the list immediately.
- **Table**: added a new "Page Access" column between Status and Last Login — ADMIN rows show a "Full access" badge; EDITOR rows show "N pages" (or "No access" if 0). Existing columns (User, Email, Role, Status, Last Login, Created, Actions) unchanged.
- **Role badge** cell still uses `RoleBadge` + `labelize(role)` — works cleanly for both ADMIN and EDITOR.
- **`editMutation`** now sends `pagePermissions` alongside `name`/`email`/`role`.
- **`inviteMutation`** posts to `/api/users/invite` with `{ email, name, role, pagePermissions }`.
- The `editMode` + `initialData` plumbing for `InviteUserDialog` (added in a prior task) is preserved; `initialData` now hydrates `pagePermissions` from the row's parsed array.
- Added `toast` (sonner) for invite/edit/delete success + error feedback (the previous code referenced `toast.success`/`toast.error` without importing it).
- Re-exports `canAccessPage` from `@/lib/permissions` for downstream consumers.

### 11. Users detail page (`src/modules/users/users-detail-page.tsx`)
- Trimmed `ROLE_OPTIONS` to ADMIN + EDITOR.
- Trimmed `ROLE_COLORS` to ADMIN (orange) + EDITOR (emerald).
- Default form role changed from `'AUTHOR'` to `'EDITOR'`.

### 12. Migration script (`prisma/migrate-roles.ts`)
Idempotent script that converts the existing 14 users from the legacy 5-role schema to the new 2-role schema:
- Uses `db.$queryRawUnsafe` + `db.$executeRawUnsafe` to bypass Prisma's enum validation (the new Prisma Client refuses to load rows whose `role` column still holds `SUPER_ADMIN`/`AUTHOR`/`CONTRIBUTOR`).
- Rules applied per row:
  - `SUPER_ADMIN` → `ADMIN`, `pagePermissions = null` (full access).
  - `ADMIN` → `ADMIN`, `pagePermissions = null`.
  - `EDITOR` → `EDITOR`, `pagePermissions = JSON of all 15 builtin + settings sub-pages` (so existing editors don't lose access).
  - `AUTHOR` → `EDITOR`, `pagePermissions = ["content","media","calendar","comments"]`.
  - `CONTRIBUTOR` → `EDITOR`, `pagePermissions = ["content","media"]`.
- For rows already on the new schema (`role ∈ {ADMIN, EDITOR}`), the script still enforces consistency: ADMINs with a non-null `pagePermissions` get it cleared; EDITORs with a null/empty `pagePermissions` get the full builtin list assigned.
- Prints a per-user log line + a final summary (`ADMIN: 4, EDITOR: 10, Already migrated: 5` after the first run).
- Run: `bun run prisma/migrate-roles.ts`.

### 13. Seed script (`prisma/seed-users.ts`)
Rewritten to seed 10 sample users under the new schema:
- **2 ADMIN users** — `pagePermissions = null` (full access). One ACTIVE, one INVITED.
- **8 EDITOR users** with varied `pagePermissions`:
  - 2 with most pages (`dashboard, calendar, content, media, comments, newsletter`).
  - 2 with `content + media` only.
  - 2 with `content + media + seo + ai`.
  - 2 with minimal (`dashboard + content` only).
- Mix of statuses across the EDITORs: ACTIVE, SUSPENDED, DEACTIVATED.
- Uses raw SQL INSERT/UPDATE (not Prisma's typed API) so the script can run even on a fresh DB before any legacy migration has been performed.
- Run: `bun run prisma/seed-users.ts`.
- After running on the existing DB: 4 ADMIN + 11 EDITOR (1 new EDITOR seeded, 9 updated, 0 deleted).

### 14. Main seed (`src/lib/seed.ts`)
- `admin@example.com` role: `SUPER_ADMIN` → `ADMIN`.
- `editor@example.com` role: `EDITOR` (unchanged).
- `author@example.com` role: `AUTHOR` → `EDITOR` (still works with the same password `author123`).

### 15. Lint + verification
- `bun run db:push` — synced schema successfully, regenerated Prisma Client.
- `bun run prisma/migrate-roles.ts` — migrated 14 existing users (4 → ADMIN, 10 → EDITOR).
- `bun run prisma/seed-users.ts` — upserted 10 sample users (1 created, 9 updated).
- `bun run lint` — 11 problems total, ALL in pre-existing files I did NOT touch:
  - `src/components/patterns/data-table.tsx` (warning: incompatible library — TanStack Table)
  - `src/modules/content/content-create-page.tsx` (warning: React Hook Form)
  - `src/modules/content/content-edit-page.tsx` (warning: React Hook Form)
  - `src/modules/seo/seo-broken-links-page.tsx` (error: manual memoization preservation)
  - `src/modules/seo/seo-social-preview-page.tsx` (error: missing `Search` import)
  - Plus mirror copies under `NEWWDCH/` (legacy cloned source tree, not in the active `src/`).
  - **Zero errors and zero warnings in any file I created or modified.**
- API verification (via curl against the live dev server):
  - `POST /api/auth/login` with `admin@example.com`/`admin123` → returns `role: "ADMIN"`, `pagePermissions: null`. ✓
  - `POST /api/auth/login` with `editor@example.com`/`editor123` → returns `role: "EDITOR"`, `pagePermissions: ["dashboard","calendar",...,"backups"]` (15 entries). ✓
  - `GET /api/auth/me` → returns the same shape with `pagePermissions` parsed correctly. ✓
  - `GET /api/users?pageSize=3` → returns 3 users with `role` ∈ {ADMIN, EDITOR} and `pagePermissions` as `string[] | null`. ✓
  - `POST /api/custom-permissions` with `{name: "Manage Authors", description, route}` → 201, returns `{id, name, description, route, key: "manage-authors", ...}`. ✓
  - `GET /api/custom-permissions` → returns the new permission in the list with derived `key`. ✓
  - `PATCH /api/users/[id]` with `{pagePermissions: ["content","media"]}` on an EDITOR → persists, GET returns the new array. ✓
  - `PATCH /api/users/[id]` with `{role: "ADMIN"}` on the same user → role flips to ADMIN, `pagePermissions` auto-cleared to `null`. ✓
  - `PATCH /api/users/[id]` with `{role: "EDITOR", pagePermissions: ["content","media","comments"]}` → role flips back to EDITOR, `pagePermissions` set to the new array. ✓
  - `DELETE /api/custom-permissions/[id]` → 200, returns `{id, key, deleted: true}`; subsequent `GET /api/custom-permissions` returns `[]`. ✓

## Stage Summary

- **ROOT APPROACH**: Replaced the 5-role enum (SUPER_ADMIN/ADMIN/EDITOR/AUTHOR/CONTRIBUTOR) with a 2-role enum (ADMIN/EDITOR) backed by a per-user `pagePermissions` JSON array. ADMIN = full access (null). EDITOR = explicit allow-list of page keys. A new `CustomPermission` table lets admins define extra page-level permissions ("Manage Authors" → `manage-authors`) that flow into the same `pagePermissions` array. The sidebar + module renderer both consult `canAccessPage()` so a direct hash navigation to a forbidden page now shows an Access Denied panel instead of a half-rendered module.
- **FILES CHANGED (16)**:
  1. `prisma/schema.prisma` — UserRole enum shrunk; User.pagePermissions added; CustomPermission model added; default role changed AUTHOR → EDITOR.
  2. `src/shared/types/index.ts` — UserRole trimmed to `'ADMIN' | 'EDITOR'`.
  3. `src/shared/constants/index.ts` — ROLE_HIERARCHY trimmed.
  4. `src/lib/validators.ts` — userCreateSchema / userUpdateSchema role enums trimmed; default role AUTHOR → EDITOR.
  5. `src/lib/permissions.ts` — completely rewritten (page-based system: BUILTIN_PAGES, SETTINGS_SUBPAGES, canAccessPage, getAccessiblePages, parsePagePermissions, serializePagePermissions, customPermissionKeyFromName, getVisibleNavItems, hasPermission).
  6. `src/app/api/custom-permissions/route.ts` — NEW: GET (list) + POST (create).
  7. `src/app/api/custom-permissions/[id]/route.ts` — NEW: DELETE (also cleans users' pagePermissions).
  8. `src/app/api/users/route.ts` — pagePermissions in select + response (parsed); POST accepts pagePermissions; default role EDITOR.
  9. `src/app/api/users/[id]/route.ts` — pagePermissions in select + response; PATCH accepts pagePermissions; ADMIN switch clears pagePermissions.
  10. `src/app/api/users/invite/route.ts` — pagePermissions added; role enum trimmed to ADMIN/EDITOR.
  11. `src/app/api/auth/me/route.ts` — returns pagePermissions (parsed) instead of legacy permissions array.
  12. `src/app/api/auth/login/route.ts` — same.
  13. `src/lib/stores/auth-store.ts` — CurrentUser + ApiUser types carry pagePermissions; mapApiUser copies it through.
  14. `src/components/layout/sidebar.tsx` — passes pagePermissions to getVisibleNavItems.
  15. `src/components/layout/admin-app.tsx` — canAccessPage check + Access Denied panel.
  16. `src/modules/users/users-list-page.tsx` — invite/edit dialog rewritten with Page Access multi-select, custom permissions list, "+ Custom" creator dialog, delete-with-confirm; table gets a new Page Access column; role options/colors trimmed.
  17. `src/modules/users/users-detail-page.tsx` — role options/colors trimmed; default form role EDITOR.
  18. `src/lib/seed.ts` — admin role SUPER_ADMIN → ADMIN; author role AUTHOR → EDITOR.
  19. `prisma/migrate-roles.ts` — NEW: idempotent migration script using raw SQL.
  20. `prisma/seed-users.ts` — NEW: 10 sample users (2 ADMIN + 8 EDITOR with varied pagePermissions).
- **EXISTING FUNCTIONALITY PRESERVED**:
  - Sidebar styling, accordion behavior, route-derived section tracking — unchanged.
  - Users table layout, search/sort/pagination, role/status filters — unchanged (just trimmed role options).
  - Invite / edit dialog opens the same way (top-right "Invite User" button + row click + "Edit" menu item).
  - Suspend/Activate + Delete confirmation flows — unchanged.
  - Login flow, session cookie, /api/auth/me response shape — unchanged except for the `pagePermissions` addition.
  - All `/api/comments`, `/api/content`, `/api/campaigns`, etc. routes — untouched.
  - `hasPermission(userRole, requiredRole)` API kept for backward compat with `NavItem.requiredRole`.
- **DATA STATE**:
  - 15 users in DB: 4 ADMIN (pagePermissions = null) + 11 EDITOR (pagePermissions = various arrays).
  - Login credentials unchanged: `admin@example.com`/`admin123` (ADMIN), `editor@example.com`/`editor123` (EDITOR, full builtin page access), `author@example.com`/`author123` (now EDITOR with `["content","media","calendar","comments"]`).
  - `CustomPermission` table starts empty — admins create custom permissions on demand via the "+ Custom" button in the Invite/Edit dialog.
- Work record: `agent-ctx/ROLES-SIMPLIFY-1-roles-simplifier.md`
