# Task CALENDAR-1 — Calendar Module

**Agent:** main (calendar-developer)
**Task:** Build a "Calendar" page for the Next.js CMS Admin showing scheduled Articles + Newsletter Campaigns.

## Work Log

### 1. Module files created
- `src/modules/calendar/index.tsx` — module entry exporting `CalendarModule` and `CalendarPage`
- `src/modules/calendar/calendar-page.tsx` — full calendar page (~1100 lines, single file as instructed)

### 2. Calendar Page features
- **Header**: title "Calendar" + subtitle, Today button, Prev/Next buttons, period label (adapts per view), Month|Week|Day|Agenda view switcher, "Schedule Content" dropdown (New Article → `#content/create`, New Campaign → `#newsletter/campaigns`)
- **Filter bar**: All | Articles | Newsletter | Drafts | Scheduled | Published | Cancelled — pill-style tabs with live counts
- **Month view**: 7-col Sun–Sat grid, weekday header, min-h-[100px] day cells, today highlighted with amber circle, max 3 events + "+N more" overflow, out-of-month days muted
- **Week view**: 64px-wide hour-label column (6am–11pm) + 7 day columns, events absolutely positioned by start time, horizontally scrollable on mobile (min-w-[760px])
- **Day view**: single-day time grid with absolutely-positioned events, day header card, out-of-range events listed separately above the grid
- **Agenda view**: chronological list of upcoming items (from referenceDate forward, max 50), grouped by day with date header, each row shows time + type badge + status badge
- **Event details modal**: Dialog showing type badge, StatusBadge, scheduled date/time, type-specific fields (slug/excerpt for articles; subject/template for campaigns), View + Edit + Close actions that navigate to `#content/{id}`, `#content/{id}/edit`, or `#newsletter/campaigns`
- **Empty state**: "No scheduled content" / "Schedule an article or newsletter campaign to see it here."

### 3. Data fetching
- Articles: `getApi<PaginatedResponse<ArticleRow>>('/api/content', { pageSize: 100, sort: 'publishedAt', order: 'asc' })` via `useQuery` — maps items with `scheduledAt` OR `publishedAt` to events (prefers `scheduledAt`)
- Campaigns: `getApi<CampaignRow[]>('/api/campaigns', { pageSize: 100 })` via `useQuery` — maps items with `scheduledAt` to events
- Combined into unified `CalendarEvent[]` (id, title, type, status, date, raw) sorted chronologically
- Filters applied client-side
- Loading state → `CalendarSkeleton`; no events → `EmptyState`

### 4. Registration & navigation
- `src/lib/module-registry.tsx`: added `calendar` dynamic import + registered in `moduleRegistry` object (key `'calendar'`)
- `src/components/layout/sidebar.tsx`: imported `Calendar` icon from lucide-react, added to `ICON_MAP`, added nav item `{ label: 'Calendar', href: '#calendar', icon: 'Calendar' }` placed after "Articles"
- `src/lib/stores/navigation-store.ts`: no changes needed — `#calendar` parses cleanly to `{ mod: 'calendar', itemId: null, subPage: null }` since Calendar has no sub-pages
- `ROUTE_PREFIX_TO_SECTION`: no change needed — Calendar is a top-level standalone module (section = null), same as Articles/Media

### 5. Styling
- shadcn/ui: Button, Badge, Separator, Skeleton, Dialog, DropdownMenu
- patterns: StatusBadge, EmptyState
- Event colors: articles = `bg-amber-100 text-amber-800 border-amber-300`, campaigns = `bg-violet-100 text-violet-800 border-violet-300`
- "Schedule Content" button uses amber accent (`bg-amber-500 hover:bg-amber-600`)
- `cn()` for all conditional classes
- `date-fns` v4 used for all date math (already in package.json)
- Natural document scroll (no fixed-height overflow containers)

### 6. Lint
- Ran `bun run lint` — **zero errors in new/modified files** (`calendar-page.tsx`, `index.tsx`, `module-registry.tsx`, `sidebar.tsx`)
- Two lint errors initially found in calendar-page.tsx were fixed:
  1. `react-hooks/static-components`: "Cannot create components during render" — refactored `eventTypeIcon()` helper into a module-level `<EventTypeIcon>` component
  2. `react-hooks/rules-of-hooks`: "useMemo called conditionally" — moved `groups` useMemo before the early-return empty-state check in `AgendaView`
- Remaining 11 lint problems are all pre-existing issues in other files (content-create-page, content-edit-page, seo-broken-links-page, seo-social-preview-page, data-table) — unrelated to this task

## Files touched
- **Created**: `src/modules/calendar/index.tsx`, `src/modules/calendar/calendar-page.tsx`
- **Modified**: `src/lib/module-registry.tsx`, `src/components/layout/sidebar.tsx`

## Notes
- No new scheduling database/API was created — only reads from existing `/api/content` and `/api/campaigns`
- No fake/hardcoded events
- Calendar state (view, referenceDate, filter, selectedEvent) is local React state via `useState`
- Date navigation: ±1 month (month view), ±7 days (week view), ±1 day (day/agenda view)
- "Today" button resets referenceDate to `new Date()`
