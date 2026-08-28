# Task 37-e — Refactor Client Billing page to use the shared /api/platform/billing/* backend

## Agent: full-stack-developer

## Task
Refactor `src/modules/billing/billing-page.tsx` so the Client Billing page reads its current subscription + payment history from the SAME backend the Platform Admin uses (`/api/platform/billing/*`), instead of the client-only `subscription-store`. KEEP the existing visual style 100%. Only swap the DATA SOURCE.

## Context (read before starting)
- `worklog.md` (Task 37-a foundation): platform-data.ts singleton, 3 client billing API routes (`/api/platform/billing/me` GET, `/api/platform/billing/change-plan` POST, `/api/platform/billing/cancel` POST) — all `requireAuth`, all read/write the SAME singleton the admin reads.
- `src/modules/billing/billing-page.tsx` (current): uses `useSubscriptionStore` for currentPlan/otherPlans/status/trialEnd/changePlan; Cancel button was hardcoded `disabled`; Payment History was a permanent empty state.
- `src/lib/stores/subscription-store.ts`: keeps `PLANS` (with `badgeVariant`/`badgeStyle`), `getPlanBadgeClasses(variant)`, `getPlanCardBorderClasses(variant)`. Backend `Plan` does NOT carry `badgeVariant` → must map by id.
- `src/lib/platform/platform-data.ts`: `ClientBillingState = { customer, plan, allPlans, status, trialEnd, nextBillingAt, paymentHistory }`. Backend `Plan` interval is `'monthly'` (store `Plan` interval was `'month'`).
- `src/modules/platform/shared.tsx` exports `PaymentStatusBadge`, `formatCurrency`, `formatDate`, `ErrorState` — reuse to avoid duplication.

## Work Log
1. Read worklog tail + 4 source files to understand the foundation, the current page, the store, and the shared dataset.
2. Mapped API contract: `getApi<ClientBillingState>` unwraps `{data,meta}` server envelope → returns `T` directly. `postApi<T>(url, body)` likewise.
3. Wrote `src/modules/billing/billing-page.tsx` (replaced the file, ~330 lines):
   - `'use client'` retained.
   - Imports: `useQuery, useMutation, useQueryClient` from `@tanstack/react-query`; `getApi, postApi` from `@/lib/api-client`; `toast` from sonner; `useT`; shadcn `Card/Badge/Button/Separator/Skeleton`; lucide icons (`CreditCard, Check, Receipt, Clock, Loader2, AlertCircle`); `PLANS as STORE_PLANS, getPlanBadgeClasses, getPlanCardBorderClasses, type Plan as StorePlan` from subscription-store (for badge metadata ONLY); `type ClientBillingState, Payment, PlanId` from platform-data; `PaymentStatusBadge, formatCurrency, formatDate, ErrorState` from `@/modules/platform/shared`.
   - Two pure helpers at module top: `getStorePlan(planId)` (find in STORE_PLANS, fallback to STORE_PLANS[0]) and `normalizeInterval(interval)` (strips trailing `ly` so backend `'monthly'` displays as `'month'` — preserves the previous visual exactly).
   - `billingQuery = useQuery<ClientBillingState>({ queryKey: ['platform-billing-me'], queryFn: () => getApi<ClientBillingState>('/api/platform/billing/me') })`.
   - `changePlanMutation` — `mutationFn: ({planId}) => postApi<ClientBillingState>('/api/platform/billing/change-plan', { planId })`; `onSuccess`: `invalidateQueries(['platform-billing-me'])` AND `invalidateQueries(['platform-overview'])` so the admin dashboard reflects the change too (same backend, same data); `toast.success` "Upgraded to X" or "Changed to X" based on `isUpgrade` var; `onError`: `toast.error`.
   - `cancelMutation` — `mutationFn: () => postApi<ClientBillingState>('/api/platform/billing/cancel')`; same invalidation; `toast.success('Subscription cancelled')`; `onError` toast.
   - Loading state: Card with `Skeleton` rows (header, current-plan block, 2 plan cards w/ features, payment-history rows). NO flash of store values.
   - Error state: page header + Card with `ErrorState` (retry → `billingQuery.refetch()`). NO zero values.
   - Loaded state: derives `currentPlan = billingState.plan`, `otherPlans = billingState.allPlans.filter(p => p.id !== currentPlan.id)`, `status`, `trialEnd`, `isCancelled = status === 'cancelled'`. Uses `getStorePlan(currentPlan.id).badgeVariant` for the current plan badge border/text, and per-other-plan `getStorePlan(plan.id).badgeVariant` for each card's border accent (preserves the EXACT same color scheme: beta=amber, pro=violet, max=emerald).
   - Current Subscription card: identical structure (CreditCard icon, plan.name, soft plan badge, price/"Free", status badge, trial notice with Clock icon + formatDate, Separator, button row). Cancel button is now ENABLED when `!isCancelled` — calls `handleCancel()` which `window.confirm`s then triggers `cancelMutation`. Shows a `Loader2` spinner while pending. If `isCancelled`, the button row is replaced with a muted "Your subscription is cancelled" notice.
   - Other Plans grid: each Card keeps `relative ${getPlanCardBorderClasses(storePlan.badgeVariant)}` border accent, plan name + soft badge, big price + small `currency/interval` (normalized), Separator, features list with Check icons, full-width action button with `Loader2` spinner when `changePlanMutation.isPending && variables?.planId === plan.id`. Action label via `isHigherPlan(plan.price > currentPlan.price)` → upgrade/downgrade/changePlan i18n keys.
   - Payment History card: NEW populated table when `paymentHistory.length > 0`. Mirrors platform-overview Recent Payments style: `divide-y` rows, `hover:bg-accent/30 transition-colors`, `text-xs text-muted-foreground` headers, `text-sm` cells. Columns: Invoice (mono invoiceNumber), Plan (soft plan badge resolved via `getStorePlan(p.planId).badgeVariant`), Amount (formatCurrency right-aligned), Status (`PaymentStatusBadge` from shared — paid=emerald, pending=sky, failed=rose, refunded=zinc), Method (text-xs muted), Date (formatDate right-aligned). Empty state (`Receipt` icon + `t('billing.noPayments')`) shown ONLY when `paymentHistory.length === 0`.
4. Ran `bun run lint`: ZERO errors/warnings in `src/modules/billing/billing-page.tsx` (grep `billing` in output → empty). The 4 errors + 3 warnings reported by lint are all pre-existing in `src/lib/module-registry.tsx`, `src/modules/content/content-create-page.tsx`, `src/modules/content/content-edit-page.tsx`, `src/modules/seo/seo-broken-links-page.tsx` — untouched by this task.
5. Checked `dev.log` tail: clean compile (`✓ Compiled in 6s`), GET `/api/platform/billing/me` 200, no errors.

## Constraints honored
- Only `src/modules/billing/billing-page.tsx` modified. subscription-store.ts, platform-data.ts, API routes, all other files untouched.
- No indigo/blue. No tests. No new routes.
- Visual style identical (cards, badges, plan-card border accents via `getPlanCardBorderClasses`, features lists, button labels via `useT` i18n, layout `max-w-4xl mx-auto space-y-6`, same Tailwind classes per element). Only the data source changed: client-only zustand store → server backend shared with Platform Admin.

## Stage Summary
- Data source swap: `useSubscriptionStore` → `useQuery(['platform-billing-me'])` + `useMutation` for change-plan & cancel, all hitting `/api/platform/billing/*` — the SAME backend the Platform Admin reads/writes.
- Cancel button now ENABLED + working (was hardcoded `disabled`); guarded by `window.confirm`; hidden when `status === 'cancelled'` (replaced by a muted "Your subscription is cancelled" notice).
- Payment History now populated from `billingState.paymentHistory` (was a permanent empty state) — table mirrors platform-overview Recent Payments styling, with per-row PaymentStatusBadge.
- Cross-panel invalidation: both mutations invalidate `['platform-billing-me']` AND `['platform-overview']` so a plan change/cancel on the client side immediately re-renders the Platform Admin overview (same singleton dataset).
- Lint clean for this file (4 pre-existing errors in other files are unrelated).
