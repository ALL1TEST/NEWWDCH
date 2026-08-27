# SEO-REDIRECTS-FIX — Work Record

**Agent:** seo-redirects-fixer
**Task ID:** SEO-REDIRECTS-FIX
**Status:** ✅ Complete

## Scope
Harden redirect validation across three areas: (1) loop detection on redirect reactivation, (2) in-batch loop detection during CSV import (plus transactional atomicity), and (3) RFC 4180 CSV field escaping on export.

## Files Changed
1. `src/app/api/redirects/[id]/route.ts` — PATCH handler
2. `src/app/api/redirects/bulk/route.ts` — GET export + POST import

## What was broken
1. **Reactivation bypassed loop detection.** The PATCH handler only ran `wouldCreateLoop` when `d.fromPath || d.toPath` was set. A PATCH of `{ isActive: true }` on an inactive redirect (e.g. one previously deactivated because it was involved in a loop, or where the surrounding chain changed while it was off) skipped loop detection entirely — reactivating could silently create an infinite redirect loop.
2. **In-batch loops slipped through CSV import.** In the confirm-import loop, each row's `wouldCreateLoop` check queried the **committed** DB. Rows created earlier in the *same* import were not yet visible (no transaction, sequential `db.redirect.create`), so two CSV rows like `/a → /b` and `/b → /a` both passed the loop check and got inserted, creating a live loop. Same problem for chains `/a → /b`, `/b → /c`.
3. **CSV export was not RFC 4180 escaped.** `fromPath`/`toPath` were written raw — any field containing a comma, double-quote, or newline would corrupt the exported CSV (and break round-trip re-import).

## Fix applied — `[id]/route.ts` (PATCH reactivation check)
- Added a second loop-detection block **after** the existing `if (d.fromPath || d.toPath)` block, **before** the `updateData` build:
  ```ts
  if (d.isActive === true && existing.isActive === false) {
    const loop = await wouldCreateLoop(existing.fromPath, existing.toPath, siteFilter, redirectId);
    if (loop) {
      return NextResponse.json(
        { error: { code: 'REDIRECT_LOOP', message: 'Reactivating this redirect would create a redirect loop' }, ... },
        { status: 400 },
      );
    }
  }
  ```
- Uses the **existing** (stored) `fromPath`/`toPath` per the task spec — path changes are already covered by the block above using `effectiveFromPath`/`effectiveToPath`.
- `wouldCreateLoop` signature unchanged; `excludeId` still passed so the redirect being reactivated doesn't match itself.

## Fix applied — `bulk/route.ts` (CSV export escaping)
- Added module-level helper:
  ```ts
  function escapeCsvField(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }
  ```
- GET export now wraps every field (`fromPath`, `toPath`, `typeNum`, `String(r.isActive)`) in `escapeCsvField(...)` and joins with `,`. Header line left bare (no special chars). Output is now RFC 4180 compliant and round-trips through the existing quoted-field CSV parser.

## Fix applied — `bulk/route.ts` (in-batch loop detection + transactional import)
- Extended `validRows` element type with `rowNum: number` so in-batch errors can report the original CSV row number.
- After the existing per-row validation loop and **before** the `!confirm` early-return, added an in-batch chain/loop detector:
  - Builds `Map<fromPath, index>` for all `validRows`.
  - For each row, if `row.toPath` is present as another row's `fromPath` (different index), the row is added to `batchSkipIndices` and an error `{ row: row.rowNum, message: 'In-batch loop detected: "to" path "..." matches another row\'s "from" path' }` is pushed to `errors`.
  - Produces `rowsToImport = validRows.filter((_, i) => !batchSkipIndices.has(i))`.
- Both the `!confirm` preview response and the confirm response now report `validRows: rowsToImport.length` (post in-batch filter) and `invalidRows: errors.length` (includes in-batch errors). `skipped` reflects `batchSkipIndices.size`.
- Restructured confirm-mode import so that **validation runs outside the transaction** and **only the creates are wrapped in `db.$transaction`**, per the task's atomicity requirement:
  1. Per-row DB loop check (`wouldCreateLoop`) iterates `rowsToImport` and builds `rowsToCreate`. Rows that would loop against existing committed redirects increment `errorsDuringImport` and are dropped.
  2. `await db.$transaction(async (tx) => { for (const row of rowsToCreate) await tx.redirect.create({ ... }) })`. If any create throws, the entire batch rolls back and `errorsDuringImport += rowsToCreate.length`.
  3. On success, `imported = rowsToCreate.length`.
- `wouldCreateLoop` signature unchanged. Create payload shape unchanged (`fromPath`, `toPath`, `type` cast, `siteId`).

## Verification
- `cd /home/z/my-project && bun run lint 2>&1 | grep -E "redirects" | head -5` → **empty** (zero lint errors/warnings in either edited file).
- Full lint output shows only the same 2 pre-existing errors + 3 pre-existing warnings noted by the prior SEO-AUDIT-ENGINE-FIX agent — both in unrelated files (`seo-broken-links-page.tsx` React Compiler memoization, `seo-social-preview-page.tsx` 'Search' undef). No new errors introduced.
- Dev server log shows clean compilation (`✓ Compiled in 672ms`); no errors emitted against the edited routes.

## Notes for downstream agents
- The transaction wraps **only** the `tx.redirect.create` loop. The `wouldCreateLoop` DB reads intentionally stay outside the transaction because (a) they query `db.redirect` (committed state) and we explicitly want the pre-import snapshot, and (b) the in-batch detector already covers sibling-row chains that the per-row DB check cannot see.
- In-batch detection is intentionally conservative: it skips any row whose `toPath` matches another row's `fromPath` (chains included), not just direct A↔B loops. This matches the task spec ("which would create a chain/loop"). Only the row whose `toPath` collides is skipped — the matched target row (the one with that `fromPath`) is still imported, leaving a clean non-chained redirect behind.
- Reactivation check uses the **existing** stored paths even when the same PATCH also changes paths. This is deliberate per the task spec; the path-change case is independently covered by the prior `effectiveFromPath`/`effectiveToPath` loop check.
- `escapeCsvField` is applied to all four export fields including `type` (always a 3-digit number, no special chars) and `active` (boolean literal) for consistency — slight size overhead, but guarantees the parser's quoted-field path is exercised uniformly and protects against future schema changes.
