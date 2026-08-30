// ============================================================
// SEED PAYMENTS — idempotent dev seed for the real-DB Payments UI.
// ============================================================
// Creates REAL Payment + Subscription rows tied to REAL Users (the
// EXTERNAL-billing users already in the DB), with realistic Stripe IDs
// (pi_…, ch_…, in_…) and payment-method metadata (brand / last4 / exp /
// funding / country). This is genuine relational DB seed data — NOT
// in-memory mock — so the admin Payments page, the Dashboard recent-
// payments widget, search, filters, and the paid summary all work with
// real records in dev (where Stripe isn't configured, so no real
// webhooks fire).
//
// Idempotent: if any Payment row already exists, the script exits
// without writing. Re-run safe.
//
// Run: bun run scripts/seed-payments.ts
// ============================================================

import { db } from '@/lib/db';

// Deterministic card/payment-method fixtures (no Math.random) so the
// seeded numbers are stable across runs.
const CARDS = [
  { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2028, funding: 'credit', country: 'US' },
  { brand: 'mastercard', last4: '5555', expMonth: 3, expYear: 2029, funding: 'credit', country: 'GB' },
  { brand: 'amex', last4: '3782', expMonth: 8, expYear: 2027, funding: 'credit', country: 'US' },
  { brand: 'discover', last4: '6011', expMonth: 5, expYear: 2030, funding: 'credit', country: 'US' },
  { brand: 'visa', last4: '1881', expMonth: 11, expYear: 2026, funding: 'debit', country: 'CH' },
];

// Stripe-style ID minters (deterministic, padded counters). Look real,
// are NOT real Stripe objects — they're dev-only fixtures so the
// relational fields are populated exactly as a real webhook would.
let _pi = 1000, _ch = 2000, _in = 3000, _sub = 4000, _cus = 5000;
const pi = () => `pi_3O${String(_pi++).padStart(6, '0')}${Math.floor(Date.now() / 1000) % 10000}fake`;
const ch = () => `ch_3O${String(_ch++).padStart(6, '0')}${Math.floor(Date.now() / 1000) % 10000}fake`;
const inv = () => `in_1O${String(_in++).padStart(6, '0')}${Math.floor(Date.now() / 1000) % 10000}fake`;
const subId = () => `sub_1O${String(_sub++).padStart(6, '0')}${Math.floor(Date.now() / 1000) % 10000}fake`;
const cusId = () => `cus_${String(_cus++).padStart(14, '0')}fake`;

// Days-ago helper (calendar, not ms-since-epoch, so dates are readable).
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 30, 0, 0); // normalize to a stable time-of-day
  return d;
}
function monthsAhead(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d;
}

interface PlanInfo { planId: string; priceMonthly: number; priceYearly: number; currency: string; }

async function main() {
  const existing = await db.payment.count();
  if (existing > 0) {
    console.log(`✓ ${existing} payment(s) already exist — seed is idempotent, exiting without writing.`);
    return;
  }

  // Load the real paid plan configs to use real prices + currency.
  const plans = await db.planConfig.findMany({ where: { isFree: false, active: true } });
  const byId = new Map(plans.map((p) => [p.planId, p] as const));
  const paidPlanIds = ['plus', 'pro', 'max'] as const;
  for (const id of paidPlanIds) {
    if (!byId.get(id)) throw new Error(`Plan "${id}" not found in PlanConfig — run plan seed first.`);
  }
  const planInfo = (planId: string): PlanInfo => {
    const p = byId.get(planId)!;
    return { planId, priceMonthly: p.priceMonthly, priceYearly: p.priceYearly, currency: p.currency };
  };

  // Pick 6 real EXTERNAL users (oldest first, for stable ordering).
  const users = await db.user.findMany({
    where: { billingMode: 'EXTERNAL' },
    orderBy: { createdAt: 'asc' },
    take: 6,
    select: { id: true, email: true, name: true },
  });
  if (users.length < 6) {
    console.log(`⚠ Only ${users.length} EXTERNAL users found — seeding for those available.`);
  }

  // Per-user fixture: plan, interval, sub status, and a list of payments.
  // Rotating assignment so all 3 paid plans + both intervals appear.
  type Fixture = {
    planId: string;
    interval: 'monthly' | 'yearly';
    subStatus: 'active' | 'trial' | 'past_due' | 'cancelled';
    payments: { daysAgo: number; status: 'paid' | 'pending' | 'failed' | 'refunded' }[];
  };
  const fixtures: Fixture[] = [
    // Sarah Mitchell — Plus monthly, active, 4 paid + 1 refunded
    { planId: 'plus', interval: 'monthly', subStatus: 'active', payments: [{ daysAgo: 1, status: 'paid' }, { daysAgo: 31, status: 'paid' }, { daysAgo: 61, status: 'paid' }, { daysAgo: 91, status: 'paid' }, { daysAgo: 121, status: 'refunded' }] },
    // David Chen — Pro yearly, active, 2 paid (yearly)
    { planId: 'pro', interval: 'yearly', subStatus: 'active', payments: [{ daysAgo: 5, status: 'paid' }, { daysAgo: 370, status: 'paid' }] },
    // Maria Rodriguez — Max monthly, active, 4 paid
    { planId: 'max', interval: 'monthly', subStatus: 'active', payments: [{ daysAgo: 2, status: 'paid' }, { daysAgo: 32, status: 'paid' }, { daysAgo: 62, status: 'paid' }, { daysAgo: 92, status: 'paid' }] },
    // Lisa Anderson — Pro monthly, past_due, 2 paid + 1 failed
    { planId: 'pro', interval: 'monthly', subStatus: 'past_due', payments: [{ daysAgo: 3, status: 'failed' }, { daysAgo: 33, status: 'paid' }, { daysAgo: 63, status: 'paid' }] },
    // James Thompson — Plus yearly, trial, 1 paid (initial)
    { planId: 'plus', interval: 'yearly', subStatus: 'trial', payments: [{ daysAgo: 7, status: 'paid' }] },
    // Emily Davis — Max monthly, active, 3 paid + 1 pending
    { planId: 'max', interval: 'monthly', subStatus: 'active', payments: [{ daysAgo: 1, status: 'pending' }, { daysAgo: 4, status: 'paid' }, { daysAgo: 34, status: 'paid' }, { daysAgo: 64, status: 'paid' }] },
  ];

  let invoiceCounter = 1042; // INV-2026-1042, 1043, ...
  let totalPayments = 0;

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const fx = fixtures[i % fixtures.length];
    const info = planInfo(fx.planId);
    const amount = fx.interval === 'yearly' ? info.priceYearly : info.priceMonthly;
    const stripeCustomer = cusId();
    const stripeSub = subId();
    // Subscription period: future end (active), or past (past_due).
    const periodEnd =
      fx.subStatus === 'past_due' ? daysAgo(2)
      : fx.subStatus === 'cancelled' ? null
      : fx.subStatus === 'trial' ? monthsAhead(1)
      : monthsAhead(fx.interval === 'yearly' ? 12 : 1);

    // Upsert the Subscription row (one per user — userId is unique).
    const existingSub = await db.subscription.findUnique({ where: { userId: u.id } });
    const subscription = existingSub
      ? await db.subscription.update({
          where: { userId: u.id },
          data: {
            planId: fx.planId,
            billingInterval: fx.interval,
            status: fx.subStatus,
            startDate: daysAgo(fx.payments[fx.payments.length - 1]?.daysAgo ?? 90),
            currentPeriodEnd: periodEnd,
            trialEnd: fx.subStatus === 'trial' ? monthsAhead(1) : null,
            cancelAt: null,
            freePlanDurationDays: null,
            stripeCustomerId: stripeCustomer,
            stripeSubscriptionId: fx.subStatus === 'cancelled' ? null : stripeSub,
          },
        })
      : await db.subscription.create({
          data: {
            userId: u.id,
            planId: fx.planId,
            billingInterval: fx.interval,
            status: fx.subStatus,
            startDate: daysAgo(fx.payments[fx.payments.length - 1]?.daysAgo ?? 90),
            currentPeriodEnd: periodEnd,
            trialEnd: fx.subStatus === 'trial' ? monthsAhead(1) : null,
            freePlanDurationDays: null,
            stripeCustomerId: stripeCustomer,
            stripeSubscriptionId: fx.subStatus === 'cancelled' ? null : stripeSub,
          },
        });

    // Create the payment rows.
    for (let j = 0; j < fx.payments.length; j++) {
      const pmt = fx.payments[j];
      const card = CARDS[(i + j) % CARDS.length];
      const methodLabel = `${card.brand[0].toUpperCase()}${card.brand.slice(1)} ••${card.last4}`;
      const paymentIntent = pi();
      const charge = ch();
      const invoiceId = inv();
      const invoiceNumber = `INV-2026-${invoiceCounter++}`;
      const isPaid = pmt.status === 'paid';
      const isRefunded = pmt.status === 'refunded';
      const isFailed = pmt.status === 'failed';
      const eventDate = daysAgo(pmt.daysAgo);

      await db.payment.create({
        data: {
          userId: u.id,
          subscriptionId: subscription.id,
          planId: fx.planId,
          amount,
          currency: info.currency,
          status: pmt.status,
          method: methodLabel,
          invoiceNumber,
          stripeInvoiceId: invoiceId,
          stripePaymentIntentId: paymentIntent,
          stripeChargeId: charge,
          paymentMethodType: 'card',
          paymentMethodDetails: JSON.stringify({
            brand: card.brand,
            last4: card.last4,
            expMonth: card.expMonth,
            expYear: card.expYear,
            funding: card.funding,
            country: card.country,
          }),
          description: isFailed ? 'Your card was declined.' : isRefunded ? 'Refunded per customer request.' : null,
          // createdAt = the event date; paidAt set only for paid/refunded.
          // listPayments uses `paidAt ?? createdAt` for the display date,
          // so pending/failed rows show their event date, not today.
          createdAt: eventDate,
          paidAt: isPaid || isRefunded ? eventDate : null,
        },
      });
      totalPayments++;
    }
  }

  console.log(`✓ Seeded ${totalPayments} payment(s) across ${users.length} user(s).`);
  console.log('  Plans used: plus (Sarah, James), pro (David, Lisa), max (Maria, Emily).');
  console.log('  Statuses: paid, pending, failed, refunded.');
  console.log('  All rows are relational: tied to real Users + Subscriptions, with realistic Stripe IDs + card metadata.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
