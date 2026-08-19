# Task 2-a: Fix Paginated List Queries — Raw Envelope

## Summary
Fixed 4 API module files to use `{ raw: true }` in `getApi` for paginated list queries, restoring access to `meta.pagination` that was lost due to auto-unwrapping.

## Files Changed

### 1. `src/modules/api/api-keys-page.tsx`
- Import: `PaginatedResponse` → `PaginationMeta`
- Query: `getApi<PaginatedResponse<ApiKeyRow>>('/api/api-keys', { params })` → `getApi<{ data: ApiKeyRow[]; meta: { requestId: string; pagination: PaginationMeta } }>('/api/api-keys', { params }, { raw: true })`
- Data access: `data?.pagination` → `data?.meta?.pagination`

### 2. `src/modules/api/oauth-clients-page.tsx`
- Same pagination fix as above (import, query, data access)
- Additional fix: 6 incorrect status values corrected:
  - Edit Dialog SelectItems: `ACTIVE_OA` → `ACTIVE`, `INACTIVE_OA` → `INACTIVE`, `REVOKED_OA` → `REVOKED`
  - Filter SelectItems: same 3 fixes
  - Default EditForm status: `'ACTIVE_OA'` → `'ACTIVE'`

### 3. `src/modules/api/pat-page.tsx`
- Import: `PaginatedResponse` → `PaginationMeta`
- Query: `getApi<PaginatedResponse<PatRow>>('/api/personal-access-tokens', { params })` → raw envelope type with `{ raw: true }`
- Data access: `data?.pagination` → `data?.meta?.pagination`

### 4. `src/modules/api/rate-limits-page.tsx`
- Import: `PaginatedResponse` → `PaginationMeta`
- Query: `getApi<PaginatedResponse<ApiKeyRow>>('/api/api-keys', { params })` → raw envelope type with `{ raw: true }`
- Data access: `data?.pagination` → `data?.meta?.pagination`

## TypeScript Check
- Ran `npx tsc --noEmit` — 0 new errors in changed files
- 3 pre-existing errors confirmed (scope string type mismatches, unrelated to pagination)
