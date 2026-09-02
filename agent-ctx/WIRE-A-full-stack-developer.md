# WIRE-A — full-stack-developer (subagent)

Task: Wire t() into dashboard/articles/calendar/media client CMS pages + fill the en/fr client-content fragment dictionaries.

## Files modified (6)
- src/modules/dashboard/dashboard-page.tsx — useT() in KpiCard/SiteGrid/PendingActionItem/DashboardPage; all page titles, KPI labels + dynamic sublabels (suffix keys), card titles/descriptions, count badges, table headers, empty states, recharts Bar name.
- src/modules/content/content-list-page.tsx — useT() in IdeaCard/CategoriesTagsDialog/ContentListPage; STATUS_TABS + STATUS_LABELS converted to key-valued constants (same `?? rawStatus` fallback semantics), header, tabs, sort options, search, table, pagination (common.showing/of), AI Ideas sidebar (5 states), Categories & Tags dialog, bulk bar, delete ConfirmDialog (prefix/suffix keys), all 18 mutation toasts.
- src/modules/calendar/calendar-page.tsx — useT() in CalendarPage/CalendarHeader/FilterBar/MonthView/DayView/EventDetailsModal; VIEW_OPTIONS/FILTER_OPTIONS/WEEKDAYS → key-valued constants, eventTypeLabel() returns a key, header/today/aria labels, "+N more", singular/plural scheduled-items pair, event modal, EmptyState.
- src/modules/media/media-list-page.tsx — useT() in FolderCard/MediaGridCard/MediaListItem/MediaListPage; FILTER_OPTIONS → labelKey, counts with singular/plural pairs, header bar, breadcrumb, select-all, empty state, footer stats, selection bar, grid/list/context menus, 6 dialogs (upload/new-folder/rename/edit-details/move/AI generate), 2 ConfirmDialogs (prefix/suffix), every toast incl. per-file upload failure reasons.
- src/lib/i18n/fragments/en/client-content.ts — 275 keys (English source copy).
- src/lib/i18n/fragments/fr/client-content.ts — same 275 keys, natural French (typographic apostrophes, « » quotes, …, space before :/?, plural suffix keys).

## Rules followed
- Reused ONLY existing core keys (common.save/cancel/delete/edit/view/create/close/status/showing/of, title.dashboard/articles/calendar/media/executiveDashboard/comments); no new common.* keys; all other keys namespaced dashboard./articles./calendar/media.
- No business logic, API calls, mutations, permissions, or component structure changed; comments left in English; data values / dates / console.* untouched.

## Verification
- bunx eslint on all 6 files → 0 errors, 0 warnings (exit 0).
- bunx tsc --noEmit → 0 errors in the 6 touched files (pre-existing baseline errors elsewhere only).
- Audit script: EN/FR parity 275/275, all page-referenced keys resolve, no duplicates, no core collisions.
- dev.log clean; / compiles 200.

## Intentionally left in English
- date-fns formatted dates (periodLabel, 'EEEE, MMMM d') — needs a locale import, out of scope (dates).
- StatusBadge internals — shared component, not owned by this task.
- idea.competition/searchIntent/contentPotential — API data values.
- "The Efficient You" — proper-noun brand name kept literal inside articles.description.
- console.* calls and `HTTP {status}` technical fallback.
