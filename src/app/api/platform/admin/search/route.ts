// ============================================================
// GET /api/platform/admin/search?q=<query>&limit=<n>
//   Returns REAL, DB-backed search results across the platform's
//   entities. Used by the global command palette (Cmd/Ctrl+K).
//
// Search domains:
//   - Customers   → User (EXTERNAL) by name / email / id. Returns the
//                   top N matches. Link: #platform-customer-detail/<id>
//   - Payments     → Payment by invoiceNumber / the 3 Stripe IDs /
//                   the related customer's name + email. Link:
//                   #platform-payments (Payments page already supports
//                   client-side search via its own input — the link
//                   just lands the admin on the page).
//   - Plans        → PlanConfig by name / planId. Link: #platform-plans
//   - Coupons      → Coupon by code. Link: #platform-coupons
//   - Notifications → Notification by title / message. Link:
//                   #platform-notifications
//
// CONTEXTUAL QUERIES:
//   The query may start with a domain prefix to restrict the search to a
//   single entity. The prefix is case-insensitive and uses a colon:
//     /customer:<text>  → Customers only (name / email / id)
//     /payment:<text>   → Payments only (invoice + Stripe IDs + customer)
//     /plan:<text>      → Plans only (name / planId)
//     /coupon:<text>    → Coupons only (code)
//     /notification:<text> → Notifications only (title / message)
//   When a prefix is recognized, the OTHER domains return []. When no
//   prefix is present, ALL domains are searched in parallel.
//
// Each domain is independently capped at `limit` (default 5, max 10)
// so the palette never overwhelms. The response shape is a per-domain
// array of normalized results with the fields the palette needs to
// render a rich row: id, label, sublabel, link, icon (the icon is set
// on the client from the domain), plus domain-specific extras
// (planId, status, amount, currency, type, value, isRead, createdAt).
//
// Auth: requirePlatformAdmin.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platform/platform-auth';
import { db } from '@/lib/db';

function reqId(): string {
  return `req_platsearch_${Math.random().toString(36).slice(2, 10)}`;
}

interface CustomerResult {
  id: string;
  name: string;
  email: string;
  planId: string | null;
  status: string | null;
  link: string;
  kind: 'customer';
}

interface PaymentResult {
  id: string;
  invoiceNumber: string | null;
  stripeInvoiceId: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  customerName: string;
  customerEmail: string;
  amount: number;
  currency: string;
  status: string;
  link: string;
  kind: 'payment';
}

interface PlanResult {
  id: string;
  planId: string;
  name: string;
  priceMonthly: number;
  currency: string;
  isFree: boolean;
  active: boolean;
  link: string;
  kind: 'plan';
}

interface CouponResult {
  id: string;
  code: string;
  type: string;
  value: number;
  currency: string;
  active: boolean;
  link: string;
  kind: 'coupon';
}

interface NotificationResult {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  link: string;
  kind: 'notification';
}

interface SearchResult {
  customers: CustomerResult[];
  payments: PaymentResult[];
  plans: PlanResult[];
  coupons: CouponResult[];
  notifications: NotificationResult[];
}

type Domain = 'customers' | 'payments' | 'plans' | 'coupons' | 'notifications';

// Parse a query like "/customer: John" into { domain: 'customers', q: 'John' }.
// Prefix is case-insensitive; the colon is required. Returns null when the
// query has no recognized prefix (meaning: search ALL domains).
function parseContextual(rawQ: string): { domain: Domain; q: string } | null {
  const m = rawQ.match(/^\/(customer|payment|plan|coupon|notification)s?\s*:\s*(.*)$/i);
  if (!m) return null;
  const map: Record<string, Domain> = {
    customer: 'customers',
    payment: 'payments',
    plan: 'plans',
    coupon: 'coupons',
    notification: 'notifications',
  };
  const domain = map[m[1].toLowerCase()];
  if (!domain) return null;
  return { domain, q: m[2].trim() };
}

export async function GET(request: NextRequest) {
  const id = reqId();
  const auth = await requirePlatformAdmin(request);
  if ('response' in auth) return auth.response;

  try {
    const sp = new URL(request.url).searchParams;
    const rawQ = (sp.get('q') ?? '').trim();
    const limit = Math.min(10, Math.max(1, Number(sp.get('limit')) || 5));

    const empty: SearchResult = {
      customers: [],
      payments: [],
      plans: [],
      coupons: [],
      notifications: [],
    };

    if (!rawQ || rawQ.length < 2) {
      // Too short — return empty result so the palette shows "no results".
      return NextResponse.json({
        data: empty,
        meta: { requestId: id, q: rawQ, limit, contextual: false },
      });
    }

    // ---- Detect contextual prefix ----
    // A prefix forces a single-domain search; the other domains stay [].
    const ctx = parseContextual(rawQ);
    const contextual = !!ctx;
    const q = ctx ? ctx.q : rawQ;
    const domain = ctx?.domain;

    if (contextual && q.length < 1) {
      // "/customer:" with no search text — return empty (still show the
      // palette so the user can finish typing).
      return NextResponse.json({
        data: empty,
        meta: { requestId: id, q: rawQ, limit, contextual: true, domain },
      });
    }

    // Prisma's `contains` is case-insensitive on SQLite by default for
    // ascii text — wrap in a lowercase substring filter for safety.
    // We use the raw query as-is; SQLite's LIKE is case-insensitive for
    // ASCII by default and we don't normalize non-ASCII.
    const searchQ = q;

    // Build the per-domain query list. Each entry is either the real
    // Prisma query or `null` (skip) — resolved via Promise.all so the
    // domains run in parallel.
    const runCustomers = !contextual || domain === 'customers';
    const runPayments = !contextual || domain === 'payments';
    const runPlans = !contextual || domain === 'plans';
    const runCoupons = !contextual || domain === 'coupons';
    const runNotifications = !contextual || domain === 'notifications';

    // ---- Parallel DB queries across the active domains ----
    const [customers, payments, plans, coupons, notifications] = await Promise.all([
      // 1. Customers (EXTERNAL users with name / email / id match)
      runCustomers
        ? db.user.findMany({
            where: {
              billingMode: 'EXTERNAL',
              deletedAt: null,
              OR: [
                { name: { contains: searchQ } },
                { email: { contains: searchQ } },
                { id: { contains: searchQ } },
              ],
            },
            include: { subscription: { select: { planId: true, status: true } } },
            orderBy: { createdAt: 'desc' },
            take: limit,
          })
        : [],

      // 2. Payments — search by invoiceNumber + the 3 Stripe IDs + id,
      // AND by the related customer's name/email (so "/payment: John"
      // matches all of John's payments, and "INV-2026" matches invoices).
      runPayments
        ? db.payment.findMany({
            where: {
              OR: [
                { invoiceNumber: { contains: searchQ } },
                { stripeInvoiceId: { contains: searchQ } },
                { stripePaymentIntentId: { contains: searchQ } },
                { stripeChargeId: { contains: searchQ } },
                { id: { contains: searchQ } },
                { user: { name: { contains: searchQ } } },
                { user: { email: { contains: searchQ } } },
              ],
            },
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
            take: limit,
          })
        : [],

      // 3. Plans — search by name + planId.
      runPlans
        ? db.planConfig.findMany({
            where: {
              OR: [{ name: { contains: searchQ } }, { planId: { contains: searchQ } }],
            },
            orderBy: { sortOrder: 'asc' },
            take: limit,
          })
        : [],

      // 4. Coupons — search by code.
      runCoupons
        ? db.coupon.findMany({
            where: { OR: [{ code: { contains: searchQ } }, { id: { contains: searchQ } }] },
            orderBy: { createdAt: 'desc' },
            take: limit,
          })
        : [],

      // 5. Notifications — search by title + message.
      runNotifications
        ? db.notification.findMany({
            where: {
              OR: [{ title: { contains: searchQ } }, { message: { contains: searchQ } }],
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
          })
        : [],
    ]);

    // ---- Normalize ----
    const customerResults: CustomerResult[] = customers.map((u) => ({
      id: u.id,
      name: u.name ?? u.email,
      email: u.email,
      planId: u.subscription?.planId ?? null,
      status: u.subscription?.status ?? null,
      link: `#platform-customer-detail/${u.id}`,
      kind: 'customer',
    }));

    const paymentResults: PaymentResult[] = payments.map((p) => ({
      id: p.id,
      invoiceNumber: p.invoiceNumber,
      stripeInvoiceId: p.stripeInvoiceId,
      stripePaymentIntentId: p.stripePaymentIntentId,
      stripeChargeId: p.stripeChargeId,
      customerName: p.user?.name ?? p.user?.email ?? '—',
      customerEmail: p.user?.email ?? '—',
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      link: '#platform-payments',
      kind: 'payment',
    }));

    const planResults: PlanResult[] = plans.map((p) => ({
      id: p.id,
      planId: p.planId,
      name: p.name,
      priceMonthly: p.priceMonthly,
      currency: p.currency,
      isFree: p.isFree,
      active: p.active,
      link: '#platform-plans',
      kind: 'plan',
    }));

    const couponResults: CouponResult[] = coupons.map((c) => ({
      id: c.id,
      code: c.code,
      type: c.type,
      value: c.value,
      currency: c.currency,
      active: c.active,
      link: '#platform-coupons',
      kind: 'coupon',
    }));

    const notificationResults: NotificationResult[] = notifications.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
      link: n.link ?? '#platform-notifications',
      kind: 'notification',
    }));

    const result: SearchResult = {
      customers: customerResults,
      payments: paymentResults,
      plans: planResults,
      coupons: couponResults,
      notifications: notificationResults,
    };

    return NextResponse.json({
      data: result,
      meta: { requestId: id, q: rawQ, limit, contextual, domain: domain ?? null },
    });
  } catch (error) {
    console.error(`[PLATFORM:SEARCH] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to execute search' }, meta: { requestId: id } },
      { status: 500 },
    );
  }
}
