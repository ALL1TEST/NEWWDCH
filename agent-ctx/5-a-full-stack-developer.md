---
Task ID: 5-a
Agent: full-stack-developer
Task: Redesign platform-notifications.tsx to match the Client Notifications page design system; create /api/platform/admin/notifications endpoint.

Files touched:
- CREATED: /home/z/my-project/src/app/api/platform/admin/notifications/route.ts (GET paginated+filtered, POST mark-as-read no-op, DELETE delete-all no-op; requirePlatformAdmin-guarded; standard { data, meta: { pagination } } envelope)
- MODIFIED (pure-append): /home/z/my-project/src/lib/platform/platform-data.ts — added `PlatformEventType`, `PlatformEvent`, `getPlatformEvents()` + private `isoMinutesAgo`/`alertTimestamp` helpers at the BOTTOM. No existing exports changed.
- REWROTE: /home/z/my-project/src/modules/platform/platform-notifications.tsx (190L stub → ~410L mirror of src/modules/notifications/notifications-page.tsx, using PlatformPageHeader for the PLATFORM badge + Event Types Card).

Files NOT touched (per constraints):
- src/modules/notifications/ (Client notifications module)
- src/app/api/notifications/ (Client notifications API)
- src/modules/platform/shared.tsx
- src/modules/platform/index.tsx
- all other platform-* modules (parallel agents)

Design decisions:
- platform-auth.ts has `requirePlatformAdmin` (= PLATFORM_ADMIN OR OWNER) — that IS the spec's `requirePlatformAdminOrOwner` guard. Used it verbatim (same as other /api/platform/admin/* routes).
- getPlatformEvents() is a PURE function — no new state. Reads from listCustomers / listPayments / listSubscriptions / getAuditLog / getAlerts. All events have isRead:false (derived fresh on each request — documented in the route header). For trial-ending events uses `trialEnd ?? nextBillingAt ?? subscriptionStart`.
- POST/DELETE are documented no-ops (derived feed). Front end keeps a local `readIds` Set as a display-only override so the Mark All Read UX feels real (the server no-op can't actually flip isRead). On 'unread' filter view, locally-marked-read items are hidden from the visible list.
- Lint: ZERO hits on touched files (`bun run lint | grep platform-notifications` returns empty).

Next agents (5-b, 5-c, etc.) can read prior context via worklog tail + /agent-ctx/.
