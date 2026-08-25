# Task: SEO-SITEMAP-SC-FIX — Sitemap ping + Search Console page fixes

## Scope
Two SEO fixes requested by user:

1. **Backend** — `src/app/api/seo/sitemap/route.ts`: replace the fake ping-google / ping-bing logic (which just bumped a timestamp) with REAL outbound `fetch()` calls to `https://www.google.com/ping?sitemap=...` and `https://www.bing.com/ping?sitemap=...`. Surface the real upstream HTTP status in the response. Only persist `lastPinged{Google,Bing}` on a 2xx upstream response.

2. **Frontend** — `src/modules/seo/seo-search-console-page.tsx`:
   - 2a: Add a 7/14/28/90-day `<Select>` date-range selector to the Performance Chart card header; wire it through to the stats query; make the "Last N days" badge dynamic.
   - 2b: Hide the Performance Chart, Top Queries, and Top Pages cards when `!isConnected`; show a single "Connect Google Search Console" CTA card instead. Add a "Sync Now" button to the in-chart empty state.
   - 2c: Replace the `: null}` branch (blank page when `data` is null) with a proper "Retry" empty-state card.

## What I changed

### `src/app/api/seo/sitemap/route.ts`
- Added `resolveBaseUrl(request)`: reads `db.setting.findFirst({ where: { key: 'site_url' } })`, strips trailing slash, falls back to request `x-forwarded-proto` + `host` headers, final fallback `https://example.com`.
- Added `pingSearchEngine(engine, sitemapUrl)`: real `fetch()` to the engine ping URL with `redirect: 'manual'`, `AbortSignal.timeout(15_000)`, custom UA. Returns `{ ok, httpStatus, message }`. Network/timeout errors are caught and returned as `{ ok: false, httpStatus: null, message }` — they do NOT throw.
- Rewrote `ping-google` and `ping-bing` branches to call `pingSearchEngine(...)`:
  - Success (2xx): update `lastPingedGoogle`/`lastPingedBing`, return 200 with `pingResult` + `pingHttpStatus` + `sitemapUrl`.
  - Failure (non-2xx or network error): leave the DB row untouched, return HTTP 502 with `error.code='PING_FAILED'`, `error.details.httpStatus`, and `data.pingHttpStatus` so the frontend can show the actual upstream status.

### `src/modules/seo/seo-search-console-page.tsx`
- Imported `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` from `@/components/ui/select`.
- Added `const [chartDays, setChartDays] = useState(14);`.
- Hoisted `isConnected` to before the stats query and removed the duplicate declaration lower down.
- Changed the stats query to use `chartDays` (both queryKey and queryFn param).
- Added a `<Select>` with 7/14/28/90-day options to the Performance Chart card header.
- Extended `PerformanceChartProps` with `days`, `onSync`, `isSyncing`; badge now renders `Last {days} days`; empty state now shows "No performance data available yet." + a "Sync Now" button when `onSync` is provided.
- Wrapped the Performance Chart, Top Queries, and Top Pages cards in `{isConnected && (...)}`.
- Added a "Connect Google Search Console" CTA card (border-dashed, Search icon, "Connect Search Console" button) shown when `!isConnected`.
- Replaced the `: null}` branch with a "No Search Console data" Retry card (border-dashed, Globe icon, Retry button that invalidates the main query).

## Constraints honored
- KPI cards section unchanged.
- QueriesTable and PagesTable components unchanged.
- Existing design language preserved (Card / CardHeader / CardTitle / Button / Badge / muted-foreground).
- No new dependencies — used the already-installed shadcn/ui `Select`.
- The `request.json()` parse for the default "generate sitemap" action was left exactly as-is.

## Verification
- `bun run lint 2>&1 | grep -E "sitemap|search-console-page"` → empty (no errors in edited files).
- `npx tsc --noEmit --skipLibCheck` → zero new errors. The only TS error in `sitemap/route.ts` is `TS18047 'result' is possibly 'null'` at line 33, which exists in HEAD (pre-existing, in the GET handler that wasn't touched).
- Dev server log shows clean `✓ Compiled in 672ms` with no errors related to either edited file.

## Note on stash recovery
While running a `git stash` to verify pre-existing lint errors, a concurrent agent (SEO-REDIRECTS-FIX) wrote to `worklog.md`, which blocked the subsequent `git stash pop`. Recovered by: backing up the current worklog.md, `git checkout worklog.md` to HEAD, popping the stash (restored all my code changes), then appending the SEO-REDIRECTS-FIX section from the backup. Final worklog.md contains SEO-OVERVIEW-FIX → SEO-AUDIT-ENGINE-FIX → SEO-REDIRECTS-FIX → SEO-SITEMAP-SC-FIX in order.
