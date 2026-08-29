// ============================================================
// PLATFORM DATA SERVICE — Centralized SaaS platform dataset
// ============================================================
// This is the SINGLE source of truth for the entire SaaS platform.
// Both the Client Billing experience AND the Platform Admin
// Dashboard read from and mutate this same in-memory dataset, so
// a plan change, cancellation, or payment made on the client side
// is immediately reflected on the admin side, and vice-versa.
//
// Consistency rules (enforced by derivation, never hardcoded):
//  - totalCustomers  = customers.length (non-deleted)
//  - activeSubscriptions = subscriptions where status === 'active'
//  - mrr = sum of normalized monthly price over active PAID subs
//  - totalSites = sites.length
//  - planDistribution = subscriptions grouped by plan (all statuses)
//  - statusCounts = subscriptions grouped by status
//  - recentCustomers = customers sorted by createdAt desc
//  - recentPayments = payments sorted by date desc
//  - usage = aggregated from sites/content/media/AI records
//  - alerts = derived from failed payments + past-due + storage
//
// Mock data is deterministic (no Math.random) so numbers are stable
// across renders and never contradict each other.
// ============================================================

// -------------------- Types --------------------

export type PlanId = 'free' | 'plus' | 'pro' | 'max';
export type SubscriptionStatus = 'active' | 'trial' | 'past_due' | 'cancelled' | 'expired';
export type BillingInterval = 'monthly' | 'yearly';
export type CustomerStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
export type PaymentStatus = 'paid' | 'pending' | 'failed' | 'refunded';

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price in the plan's currency (legacy field, == priceMonthly). */
  price: number;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  interval: BillingInterval;
  isFree: boolean;
  active: boolean;
  features: string[];
  /** Authoritative feature keys granted by this plan (checked by hasFeature). */
  entitlements: string[];
  /** Plan usage limits. -1 = unlimited. */
  limits: {
    maxSites: number;
    storageBytes: number;
    aiWords: number;
    aiArticles: number;
    automationRuns: number;
  };
}

export interface PlatformSite {
  id: string;
  customerId: string;
  name: string;
  slug: string;
  domain: string | null;
  status: 'ACTIVE' | 'MAINTENANCE' | 'SUSPENDED' | 'ARCHIVED';
  articles: number;
  media: number;
  storageBytes: number;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  status: CustomerStatus;
  planId: PlanId;
  subscriptionStatus: SubscriptionStatus;
  billingInterval: BillingInterval;
  createdAt: string;
  subscriptionStart: string;
  nextBillingAt: string | null;
  trialEnd: string | null;
  company: string | null;
  country: string;
  storageLimitBytes: number;
}

export interface Payment {
  id: string;
  customerId: string;
  planId: PlanId;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: string;
  date: string;
  invoiceNumber: string;
  // ---- Stripe transaction details (source of truth when Stripe is
  // configured). The admin Payments page surfaces these so every row is
  // verifiably tied to a real Stripe PaymentIntent / Charge / Invoice.
  // All optional — null when Stripe is not configured (dev seed / free
  // plan charges that don't go through Stripe).
  stripeInvoiceId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface SystemHealthItem {
  key: string;
  label: string;
  // 'unknown' = service exists but is not configured / not yet checked.
  status: 'operational' | 'degraded' | 'down' | 'unknown';
  latencyMs: number;
  note: string;
}

export interface RevenuePoint {
  month: string;
  revenue: number;
}

export interface PlatformUsage {
  totalSites: number;
  totalArticles: number;
  aiArticlesGenerated: number;
  aiWordsGenerated: number;
  mediaStorageBytes: number;
  automationRuns: number;
}

export interface PlatformAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  action: { label: string; module: string };
  time: string;
}

// -------------------- Plans (delegated to DB-backed plan-config) --------------------
// The editable plan definitions live in the PlanConfig table and are cached
// by ./plan-config — the SINGLE source of truth. The owner edits there via
// the Platform Admin; this module (admin overview + client billing) and the
// client billing API both read the same cached values, so an owner price
// change propagates to the client billing page and to MRR on the next read.
// The PLANS array below is a live view re-spliced whenever the config changes.

import { getPlanConfigsSync, subscribe as subscribePlanConfig, type PlanConfigData } from './plan-config';

function toPlan(d: PlanConfigData): Plan {
  return {
    id: d.planId as PlanId,
    name: d.name,
    price: d.priceMonthly,
    priceMonthly: d.priceMonthly,
    priceYearly: d.priceYearly,
    currency: d.currency,
    interval: d.interval,
    isFree: d.isFree,
    active: d.active,
    features: d.features,
    entitlements: d.entitlements,
    limits: d.limits,
  };
}

/** Live view of the DB-backed plan configs. Mutated in place on every
 *  config refresh so existing references stay valid. */
export const PLANS: Plan[] = [];

function refreshPLANS(): void {
  const data = getPlanConfigsSync();
  PLANS.length = 0;
  for (const d of data) PLANS.push(toPlan(d));
}
refreshPLANS();
subscribePlanConfig(refreshPLANS);

export function getPlan(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

/** Normalized monthly price. Yearly subscriptions contribute priceYearly/12
 *  so MRR is a true monthly run-rate. */
export function monthlyPrice(plan: Plan, interval: BillingInterval): number {
  if (interval === 'yearly') return Math.round(plan.priceYearly / 12);
  return plan.priceMonthly;
}

// -------------------- Helpers --------------------

const GB = 1024 * 1024 * 1024;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(9, 15, 0, 0);
  return d.toISOString();
}
function isoDaysAhead(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 15, 0, 0);
  return d.toISOString();
}

// -------------------- Customers --------------------

const CUSTOMER_SEED: Omit<Customer, 'id'>[] = [
  { name: 'Admin User', email: 'admin@example.com', status: 'ACTIVE', planId: 'pro', subscriptionStatus: 'active', billingInterval: 'monthly', createdAt: isoDaysAgo(120), subscriptionStart: isoDaysAgo(90), nextBillingAt: isoDaysAhead(2), trialEnd: null, company: 'Acme Studios', country: 'Switzerland', storageLimitBytes: 10 * GB },
  { name: 'Editor User', email: 'editor@example.com', status: 'ACTIVE', planId: 'plus', subscriptionStatus: 'active', billingInterval: 'monthly', createdAt: isoDaysAgo(64), subscriptionStart: isoDaysAgo(64), nextBillingAt: isoDaysAhead(5), trialEnd: null, company: 'Maple Media', country: 'Germany', storageLimitBytes: 1 * GB },
  { name: 'Author User', email: 'author@example.com', status: 'ACTIVE', planId: 'plus', subscriptionStatus: 'active', billingInterval: 'monthly', createdAt: isoDaysAgo(40), subscriptionStart: isoDaysAgo(40), nextBillingAt: isoDaysAhead(8), trialEnd: null, company: null, country: 'France', storageLimitBytes: 1 * GB },
  { name: 'John Smith', email: 'john@example.com', status: 'ACTIVE', planId: 'pro', subscriptionStatus: 'active', billingInterval: 'monthly', createdAt: isoDaysAgo(58), subscriptionStart: isoDaysAgo(58), nextBillingAt: isoDaysAhead(3), trialEnd: null, company: 'Smith Digital', country: 'United Kingdom', storageLimitBytes: 10 * GB },
  { name: 'Sarah Wilson', email: 'sarah@example.com', status: 'ACTIVE', planId: 'max', subscriptionStatus: 'active', billingInterval: 'monthly', createdAt: isoDaysAgo(95), subscriptionStart: isoDaysAgo(95), nextBillingAt: isoDaysAhead(1), trialEnd: null, company: 'Wilson Group', country: 'United States', storageLimitBytes: 100 * GB },
  { name: 'Michael Chen', email: 'michael@example.com', status: 'ACTIVE', planId: 'pro', subscriptionStatus: 'active', billingInterval: 'yearly', createdAt: isoDaysAgo(210), subscriptionStart: isoDaysAgo(210), nextBillingAt: isoDaysAhead(155), trialEnd: null, company: 'Chen Analytics', country: 'Singapore', storageLimitBytes: 10 * GB },
  { name: 'Emma Rodriguez', email: 'emma@example.com', status: 'ACTIVE', planId: 'plus', subscriptionStatus: 'active', billingInterval: 'monthly', createdAt: isoDaysAgo(28), subscriptionStart: isoDaysAgo(28), nextBillingAt: isoDaysAhead(4), trialEnd: null, company: null, country: 'Spain', storageLimitBytes: 1 * GB },
  { name: 'David Kim', email: 'david@example.com', status: 'ACTIVE', planId: 'pro', subscriptionStatus: 'active', billingInterval: 'monthly', createdAt: isoDaysAgo(72), subscriptionStart: isoDaysAgo(72), nextBillingAt: isoDaysAhead(6), trialEnd: null, company: 'Kim Labs', country: 'South Korea', storageLimitBytes: 10 * GB },
  { name: 'Lisa Anderson', email: 'lisa@example.com', status: 'ACTIVE', planId: 'max', subscriptionStatus: 'active', billingInterval: 'monthly', createdAt: isoDaysAgo(140), subscriptionStart: isoDaysAgo(140), nextBillingAt: isoDaysAhead(7), trialEnd: null, company: 'Anderson Co', country: 'Canada', storageLimitBytes: 100 * GB },
  { name: 'James Brown', email: 'james@example.com', status: 'ACTIVE', planId: 'plus', subscriptionStatus: 'active', billingInterval: 'monthly', createdAt: isoDaysAgo(15), subscriptionStart: isoDaysAgo(15), nextBillingAt: isoDaysAhead(16), trialEnd: null, company: null, country: 'Australia', storageLimitBytes: 1 * GB },
  { name: 'Olivia Martinez', email: 'olivia@example.com', status: 'ACTIVE', planId: 'pro', subscriptionStatus: 'trial', billingInterval: 'monthly', createdAt: isoDaysAgo(6), subscriptionStart: isoDaysAgo(6), nextBillingAt: isoDaysAhead(8), trialEnd: isoDaysAhead(8), company: 'Martinez LLC', country: 'Mexico', storageLimitBytes: 10 * GB },
  { name: 'William Davis', email: 'william@example.com', status: 'ACTIVE', planId: 'plus', subscriptionStatus: 'trial', billingInterval: 'monthly', createdAt: isoDaysAgo(3), subscriptionStart: isoDaysAgo(3), nextBillingAt: isoDaysAhead(11), trialEnd: isoDaysAhead(11), company: null, country: 'Ireland', storageLimitBytes: 1 * GB },
  { name: 'Sophia Garcia', email: 'sophia@example.com', status: 'ACTIVE', planId: 'pro', subscriptionStatus: 'past_due', billingInterval: 'monthly', createdAt: isoDaysAgo(80), subscriptionStart: isoDaysAgo(80), nextBillingAt: isoDaysAhead(-2), trialEnd: null, company: 'Garcia Media', country: 'Argentina', storageLimitBytes: 10 * GB },
  { name: 'Daniel Lee', email: 'daniel@example.com', status: 'ACTIVE', planId: 'plus', subscriptionStatus: 'active', billingInterval: 'monthly', createdAt: isoDaysAgo(48), subscriptionStart: isoDaysAgo(48), nextBillingAt: isoDaysAhead(12), trialEnd: null, company: null, country: 'Norway', storageLimitBytes: 1 * GB },
  { name: 'Charlotte Taylor', email: 'charlotte@example.com', status: 'ACTIVE', planId: 'pro', subscriptionStatus: 'active', billingInterval: 'yearly', createdAt: isoDaysAgo(300), subscriptionStart: isoDaysAgo(300), nextBillingAt: isoDaysAhead(65), trialEnd: null, company: 'Taylor Press', country: 'United Kingdom', storageLimitBytes: 10 * GB },
  { name: 'Ethan Moore', email: 'ethan@example.com', status: 'ACTIVE', planId: 'max', subscriptionStatus: 'active', billingInterval: 'monthly', createdAt: isoDaysAgo(160), subscriptionStart: isoDaysAgo(160), nextBillingAt: isoDaysAhead(9), trialEnd: null, company: 'Moore Ventures', country: 'United States', storageLimitBytes: 100 * GB },
  { name: 'Ava Thomas', email: 'ava@example.com', status: 'ACTIVE', planId: 'pro', subscriptionStatus: 'cancelled', billingInterval: 'monthly', createdAt: isoDaysAgo(200), subscriptionStart: isoDaysAgo(200), nextBillingAt: null, trialEnd: null, company: null, country: 'New Zealand', storageLimitBytes: 10 * GB },
  { name: 'Mason Clark', email: 'mason@example.com', status: 'ACTIVE', planId: 'pro', subscriptionStatus: 'active', billingInterval: 'monthly', createdAt: isoDaysAgo(33), subscriptionStart: isoDaysAgo(33), nextBillingAt: isoDaysAhead(13), trialEnd: null, company: 'Clark Co', country: 'South Africa', storageLimitBytes: 10 * GB },
  { name: 'Isabella Lewis', email: 'isabella@example.com', status: 'ACTIVE', planId: 'max', subscriptionStatus: 'active', billingInterval: 'monthly', createdAt: isoDaysAgo(110), subscriptionStart: isoDaysAgo(110), nextBillingAt: isoDaysAhead(14), trialEnd: null, company: 'Lewis Holdings', country: 'Belgium', storageLimitBytes: 100 * GB },
];

// -------------------- Sites --------------------

interface SiteSeed {
  customerIdIdx: number;
  name: string;
  slug: string;
  domain: string | null;
  status: PlatformSite['status'];
  articles: number;
  media: number;
  storageBytes: number;
  daysAgo: number;
}
const SITE_SEED: SiteSeed[] = [
  { customerIdIdx: 0, name: 'Tech Insights', slug: 'tech-insights', domain: 'tech.example.com', status: 'ACTIVE', articles: 12, media: 18, storageBytes: Math.round(2.1 * GB), daysAgo: 90 },
  { customerIdIdx: 0, name: 'Finance Weekly', slug: 'finance-weekly', domain: 'finance.example.com', status: 'ACTIVE', articles: 9, media: 7, storageBytes: Math.round(1.4 * GB), daysAgo: 88 },
  { customerIdIdx: 0, name: 'Travel Notes', slug: 'travel-notes', domain: 'travel.example.com', status: 'ACTIVE', articles: 8, media: 14, storageBytes: Math.round(3.2 * GB), daysAgo: 85 },
  { customerIdIdx: 3, name: 'Gadget Lab', slug: 'gadget-lab', domain: 'gadgetlab.io', status: 'ACTIVE', articles: 14, media: 9, storageBytes: Math.round(1.8 * GB), daysAgo: 55 },
  { customerIdIdx: 3, name: 'Mobile Review', slug: 'mobile-review', domain: 'mobilereview.io', status: 'ACTIVE', articles: 6, media: 4, storageBytes: Math.round(0.9 * GB), daysAgo: 50 },
  { customerIdIdx: 3, name: 'Wearable Tech', slug: 'wearable-tech', domain: null, status: 'MAINTENANCE', articles: 3, media: 2, storageBytes: Math.round(0.4 * GB), daysAgo: 20 },
  { customerIdIdx: 4, name: 'Fashion Daily', slug: 'fashion-daily', domain: 'fashiondaily.com', status: 'ACTIVE', articles: 22, media: 41, storageBytes: Math.round(8.1 * GB), daysAgo: 92 },
  { customerIdIdx: 4, name: 'Style Guide', slug: 'style-guide', domain: 'styleguide.com', status: 'ACTIVE', articles: 11, media: 18, storageBytes: Math.round(4.2 * GB), daysAgo: 90 },
  { customerIdIdx: 4, name: 'Runway Report', slug: 'runway-report', domain: 'runwayreport.com', status: 'ACTIVE', articles: 9, media: 27, storageBytes: Math.round(6.8 * GB), daysAgo: 88 },
  { customerIdIdx: 4, name: 'Beauty Blog', slug: 'beauty-blog', domain: 'beautyblog.com', status: 'ACTIVE', articles: 7, media: 15, storageBytes: Math.round(3.5 * GB), daysAgo: 70 },
  { customerIdIdx: 4, name: 'Trends Weekly', slug: 'trends-weekly', domain: 'trendsweekly.com', status: 'ACTIVE', articles: 5, media: 12, storageBytes: Math.round(2.8 * GB), daysAgo: 45 },
  { customerIdIdx: 4, name: 'Couture Corner', slug: 'couture-corner', domain: 'couturecorner.com', status: 'ACTIVE', articles: 4, media: 9, storageBytes: Math.round(2.1 * GB), daysAgo: 30 },
  { customerIdIdx: 4, name: 'Accessories Hub', slug: 'accessories-hub', domain: 'accessorieshub.com', status: 'ACTIVE', articles: 3, media: 6, storageBytes: Math.round(1.4 * GB), daysAgo: 18 },
  { customerIdIdx: 4, name: 'Lookbook', slug: 'lookbook', domain: null, status: 'ACTIVE', articles: 2, media: 21, storageBytes: Math.round(5.0 * GB), daysAgo: 10 },
  { customerIdIdx: 5, name: 'Data Dive', slug: 'data-dive', domain: 'datadive.ai', status: 'ACTIVE', articles: 16, media: 5, storageBytes: Math.round(1.2 * GB), daysAgo: 205 },
  { customerIdIdx: 5, name: 'AI Insights', slug: 'ai-insights', domain: 'aiinsights.ai', status: 'ACTIVE', articles: 12, media: 3, storageBytes: Math.round(0.8 * GB), daysAgo: 150 },
  { customerIdIdx: 5, name: 'ML Weekly', slug: 'ml-weekly', domain: 'mlweekly.ai', status: 'ACTIVE', articles: 8, media: 2, storageBytes: Math.round(0.6 * GB), daysAgo: 100 },
  { customerIdIdx: 5, name: 'Stats Hub', slug: 'stats-hub', domain: 'statshub.ai', status: 'ACTIVE', articles: 5, media: 1, storageBytes: Math.round(0.3 * GB), daysAgo: 60 },
  { customerIdIdx: 5, name: 'Quant Notes', slug: 'quant-notes', domain: null, status: 'ACTIVE', articles: 3, media: 1, storageBytes: Math.round(0.2 * GB), daysAgo: 20 },
  { customerIdIdx: 6, name: 'Recipe Box', slug: 'recipe-box', domain: 'recipebox.es', status: 'ACTIVE', articles: 8, media: 12, storageBytes: Math.round(0.8 * GB), daysAgo: 26 },
  { customerIdIdx: 6, name: 'Foodie Travel', slug: 'foodie-travel', domain: null, status: 'ACTIVE', articles: 4, media: 7, storageBytes: Math.round(0.5 * GB), daysAgo: 12 },
  { customerIdIdx: 7, name: 'Dev Journal', slug: 'dev-journal', domain: 'devjournal.kr', status: 'ACTIVE', articles: 15, media: 4, storageBytes: Math.round(1.1 * GB), daysAgo: 70 },
  { customerIdIdx: 7, name: 'Code Craft', slug: 'code-craft', domain: 'codecraft.kr', status: 'ACTIVE', articles: 9, media: 2, storageBytes: Math.round(0.7 * GB), daysAgo: 60 },
  { customerIdIdx: 7, name: 'Ship Log', slug: 'ship-log', domain: 'shiplog.kr', status: 'ACTIVE', articles: 5, media: 1, storageBytes: Math.round(0.4 * GB), daysAgo: 40 },
  { customerIdIdx: 7, name: 'Build Notes', slug: 'build-notes', domain: null, status: 'ACTIVE', articles: 3, media: 1, storageBytes: Math.round(0.2 * GB), daysAgo: 15 },
  { customerIdIdx: 8, name: 'Wellness Daily', slug: 'wellness-daily', domain: 'wellnessdaily.ca', status: 'ACTIVE', articles: 18, media: 22, storageBytes: Math.round(5.5 * GB), daysAgo: 138 },
  { customerIdIdx: 8, name: 'Mindful Living', slug: 'mindful-living', domain: 'mindfulliving.ca', status: 'ACTIVE', articles: 11, media: 14, storageBytes: Math.round(3.4 * GB), daysAgo: 100 },
  { customerIdIdx: 8, name: 'Fitness Hub', slug: 'fitness-hub', domain: 'fitnesshub.ca', status: 'ACTIVE', articles: 8, media: 19, storageBytes: Math.round(4.6 * GB), daysAgo: 80 },
  { customerIdIdx: 8, name: 'Nutrition Notes', slug: 'nutrition-notes', domain: 'nutritionnotes.ca', status: 'ACTIVE', articles: 6, media: 8, storageBytes: Math.round(1.9 * GB), daysAgo: 50 },
  { customerIdIdx: 8, name: 'Yoga Studio', slug: 'yoga-studio', domain: 'yogastudio.ca', status: 'ACTIVE', articles: 4, media: 11, storageBytes: Math.round(2.7 * GB), daysAgo: 25 },
  { customerIdIdx: 8, name: 'Meditation', slug: 'meditation', domain: null, status: 'ACTIVE', articles: 2, media: 5, storageBytes: Math.round(1.2 * GB), daysAgo: 10 },
  { customerIdIdx: 9, name: 'Indie Games', slug: 'indie-games', domain: 'indiegames.au', status: 'ACTIVE', articles: 5, media: 3, storageBytes: Math.round(0.6 * GB), daysAgo: 14 },
  { customerIdIdx: 10, name: 'Marketing Pro', slug: 'marketing-pro', domain: 'marketingpro.mx', status: 'ACTIVE', articles: 4, media: 2, storageBytes: Math.round(0.4 * GB), daysAgo: 5 },
  { customerIdIdx: 10, name: 'Growth Lab', slug: 'growth-lab', domain: null, status: 'ACTIVE', articles: 2, media: 1, storageBytes: Math.round(0.2 * GB), daysAgo: 2 },
  { customerIdIdx: 11, name: 'Photo Blog', slug: 'photo-blog', domain: null, status: 'ACTIVE', articles: 1, media: 4, storageBytes: Math.round(0.3 * GB), daysAgo: 2 },
  { customerIdIdx: 12, name: 'Local News', slug: 'local-news', domain: 'localnews.ar', status: 'ACTIVE', articles: 10, media: 6, storageBytes: Math.round(1.5 * GB), daysAgo: 78 },
  { customerIdIdx: 12, name: 'City Guide', slug: 'city-guide', domain: 'cityguide.ar', status: 'ACTIVE', articles: 6, media: 9, storageBytes: Math.round(2.1 * GB), daysAgo: 60 },
  { customerIdIdx: 12, name: 'Events Hub', slug: 'events-hub', domain: null, status: 'ACTIVE', articles: 3, media: 4, storageBytes: Math.round(0.8 * GB), daysAgo: 30 },
  { customerIdIdx: 13, name: 'Outdoor Life', slug: 'outdoor-life', domain: 'outdoorlife.no', status: 'ACTIVE', articles: 7, media: 11, storageBytes: Math.round(2.3 * GB), daysAgo: 47 },
  { customerIdIdx: 13, name: 'Hiking Norway', slug: 'hiking-norway', domain: null, status: 'ACTIVE', articles: 3, media: 6, storageBytes: Math.round(1.4 * GB), daysAgo: 20 },
  { customerIdIdx: 14, name: 'History Today', slug: 'history-today', domain: 'historytoday.uk', status: 'ACTIVE', articles: 20, media: 8, storageBytes: Math.round(2.0 * GB), daysAgo: 295 },
  { customerIdIdx: 14, name: 'Archaeology', slug: 'archaeology', domain: 'archaeology.uk', status: 'ACTIVE', articles: 12, media: 5, storageBytes: Math.round(1.3 * GB), daysAgo: 200 },
  { customerIdIdx: 14, name: 'Medieval', slug: 'medieval', domain: 'medieval.uk', status: 'ACTIVE', articles: 8, media: 3, storageBytes: Math.round(0.9 * GB), daysAgo: 120 },
  { customerIdIdx: 14, name: 'Ancient World', slug: 'ancient-world', domain: 'ancientworld.uk', status: 'ACTIVE', articles: 5, media: 2, storageBytes: Math.round(0.6 * GB), daysAgo: 60 },
  { customerIdIdx: 14, name: 'Art History', slug: 'art-history', domain: null, status: 'ACTIVE', articles: 3, media: 1, storageBytes: Math.round(0.3 * GB), daysAgo: 20 },
  { customerIdIdx: 15, name: 'Venture Wire', slug: 'venture-wire', domain: 'venturewire.us', status: 'ACTIVE', articles: 24, media: 18, storageBytes: Math.round(4.5 * GB), daysAgo: 158 },
  { customerIdIdx: 15, name: 'Startup News', slug: 'startup-news', domain: 'startupnews.us', status: 'ACTIVE', articles: 16, media: 12, storageBytes: Math.round(3.1 * GB), daysAgo: 120 },
  { customerIdIdx: 15, name: 'Founders Forum', slug: 'founders-forum', domain: 'foundersforum.us', status: 'ACTIVE', articles: 11, media: 8, storageBytes: Math.round(2.0 * GB), daysAgo: 90 },
  { customerIdIdx: 15, name: 'Pitch Deck', slug: 'pitch-deck', domain: 'pitchdeck.us', status: 'ACTIVE', articles: 7, media: 15, storageBytes: Math.round(3.6 * GB), daysAgo: 60 },
  { customerIdIdx: 15, name: 'Cap Table', slug: 'cap-table', domain: 'captable.us', status: 'ACTIVE', articles: 4, media: 3, storageBytes: Math.round(0.9 * GB), daysAgo: 30 },
  { customerIdIdx: 15, name: 'Term Sheet', slug: 'term-sheet', domain: 'termsheet.us', status: 'ACTIVE', articles: 3, media: 2, storageBytes: Math.round(0.6 * GB), daysAgo: 15 },
  { customerIdIdx: 15, name: 'Unicorn Watch', slug: 'unicorn-watch', domain: null, status: 'ACTIVE', articles: 2, media: 1, storageBytes: Math.round(0.3 * GB), daysAgo: 5 },
  { customerIdIdx: 17, name: 'Legal Briefs', slug: 'legal-briefs', domain: 'legalbriefs.za', status: 'ACTIVE', articles: 9, media: 3, storageBytes: Math.round(0.8 * GB), daysAgo: 32 },
  { customerIdIdx: 17, name: 'Case Law', slug: 'case-law', domain: 'caselaw.za', status: 'ACTIVE', articles: 6, media: 2, storageBytes: Math.round(0.5 * GB), daysAgo: 20 },
  { customerIdIdx: 17, name: 'Contracts', slug: 'contracts', domain: null, status: 'ACTIVE', articles: 3, media: 1, storageBytes: Math.round(0.3 * GB), daysAgo: 8 },
  { customerIdIdx: 18, name: 'EU Policy', slug: 'eu-policy', domain: 'eupolicy.be', status: 'ACTIVE', articles: 18, media: 7, storageBytes: Math.round(1.8 * GB), daysAgo: 108 },
  { customerIdIdx: 18, name: 'Brussels Wire', slug: 'brussels-wire', domain: 'brusselswire.be', status: 'ACTIVE', articles: 14, media: 5, storageBytes: Math.round(1.3 * GB), daysAgo: 95 },
  { customerIdIdx: 18, name: 'Regulation', slug: 'regulation', domain: 'regulation.be', status: 'ACTIVE', articles: 11, media: 4, storageBytes: Math.round(1.0 * GB), daysAgo: 80 },
  { customerIdIdx: 18, name: 'Trade Desk', slug: 'trade-desk', domain: 'tradedesk.be', status: 'ACTIVE', articles: 8, media: 3, storageBytes: Math.round(0.7 * GB), daysAgo: 60 },
  { customerIdIdx: 18, name: 'Euro Brief', slug: 'euro-brief', domain: 'eurobrief.be', status: 'ACTIVE', articles: 6, media: 2, storageBytes: Math.round(0.5 * GB), daysAgo: 45 },
  { customerIdIdx: 18, name: 'Diplomat', slug: 'diplomat', domain: 'diplomat.be', status: 'ACTIVE', articles: 5, media: 2, storageBytes: Math.round(0.4 * GB), daysAgo: 30 },
  { customerIdIdx: 18, name: 'Council Notes', slug: 'council-notes', domain: 'councilnotes.be', status: 'ACTIVE', articles: 4, media: 1, storageBytes: Math.round(0.3 * GB), daysAgo: 20 },
  { customerIdIdx: 18, name: 'Parliament', slug: 'parliament', domain: 'parliament.be', status: 'ACTIVE', articles: 3, media: 1, storageBytes: Math.round(0.2 * GB), daysAgo: 10 },
  { customerIdIdx: 18, name: 'Commission', slug: 'commission', domain: null, status: 'ACTIVE', articles: 2, media: 1, storageBytes: Math.round(0.2 * GB), daysAgo: 3 },
];

// -------------------- Payments --------------------

interface PaymentSeed {
  customerIdx: number;
  planId: PlanId;
  amount: number;
  status: PaymentStatus;
  method: string;
  daysAgo: number;
}
const PAYMENT_SEED: PaymentSeed[] = [
  { customerIdx: 0, planId: 'pro', amount: 49, status: 'paid', method: 'Visa ••4242', daysAgo: 2 },
  { customerIdx: 0, planId: 'pro', amount: 49, status: 'paid', method: 'Visa ••4242', daysAgo: 32 },
  { customerIdx: 0, planId: 'pro', amount: 49, status: 'paid', method: 'Visa ••4242', daysAgo: 62 },
  { customerIdx: 3, planId: 'pro', amount: 49, status: 'paid', method: 'Mastercard ••8810', daysAgo: 3 },
  { customerIdx: 3, planId: 'pro', amount: 49, status: 'paid', method: 'Mastercard ••8810', daysAgo: 33 },
  { customerIdx: 4, planId: 'max', amount: 99, status: 'paid', method: 'Amex ••1005', daysAgo: 1 },
  { customerIdx: 4, planId: 'max', amount: 99, status: 'paid', method: 'Amex ••1005', daysAgo: 31 },
  { customerIdx: 4, planId: 'max', amount: 99, status: 'paid', method: 'Amex ••1005', daysAgo: 61 },
  { customerIdx: 5, planId: 'pro', amount: 588, status: 'paid', method: 'Visa ••7733', daysAgo: 55 },
  { customerIdx: 7, planId: 'pro', amount: 49, status: 'paid', method: 'Visa ••2099', daysAgo: 6 },
  { customerIdx: 7, planId: 'pro', amount: 49, status: 'paid', method: 'Visa ••2099', daysAgo: 36 },
  { customerIdx: 8, planId: 'max', amount: 99, status: 'paid', method: 'Mastercard ••5514', daysAgo: 7 },
  { customerIdx: 8, planId: 'max', amount: 99, status: 'paid', method: 'Mastercard ••5514', daysAgo: 37 },
  { customerIdx: 10, planId: 'pro', amount: 49, status: 'pending', method: 'Visa ••0011', daysAgo: 0 },
  { customerIdx: 12, planId: 'pro', amount: 49, status: 'failed', method: 'Visa ••6634', daysAgo: 2 },
  { customerIdx: 12, planId: 'pro', amount: 49, status: 'failed', method: 'Visa ••6634', daysAgo: 5 },
  { customerIdx: 12, planId: 'pro', amount: 49, status: 'paid', method: 'Visa ••6634', daysAgo: 33 },
  { customerIdx: 14, planId: 'pro', amount: 588, status: 'paid', method: 'Visa ••4488', daysAgo: 65 },
  { customerIdx: 15, planId: 'max', amount: 99, status: 'paid', method: 'Amex ••3006', daysAgo: 9 },
  { customerIdx: 15, planId: 'max', amount: 99, status: 'paid', method: 'Amex ••3006', daysAgo: 39 },
  { customerIdx: 15, planId: 'max', amount: 99, status: 'paid', method: 'Amex ••3006', daysAgo: 69 },
  { customerIdx: 16, planId: 'pro', amount: 49, status: 'refunded', method: 'Visa ••9900', daysAgo: 12 },
  { customerIdx: 16, planId: 'pro', amount: 49, status: 'paid', method: 'Visa ••9900', daysAgo: 42 },
  { customerIdx: 17, planId: 'pro', amount: 49, status: 'paid', method: 'Mastercard ••2271', daysAgo: 13 },
  { customerIdx: 17, planId: 'pro', amount: 49, status: 'paid', method: 'Mastercard ••2271', daysAgo: 43 },
  { customerIdx: 18, planId: 'max', amount: 99, status: 'paid', method: 'Visa ••1188', daysAgo: 14 },
  { customerIdx: 18, planId: 'max', amount: 99, status: 'paid', method: 'Visa ••1188', daysAgo: 44 },
  { customerIdx: 4, planId: 'max', amount: 99, status: 'failed', method: 'Amex ••1005', daysAgo: 1 },
  { customerIdx: 8, planId: 'max', amount: 99, status: 'failed', method: 'Mastercard ••5514', daysAgo: 4 },
];

// -------------------- Audit log (initial entries) --------------------

const INITIAL_AUDIT: Omit<AuditEntry, 'id'>[] = [
  { timestamp: isoDaysAgo(2), actor: 'platform@example.com', action: 'viewed', target: 'Customer: Sarah Wilson', detail: 'Opened customer detail', severity: 'info' },
  { timestamp: isoDaysAgo(3), actor: 'platform@example.com', action: 'viewed', target: 'Payments', detail: 'Reviewed recent payments', severity: 'info' },
  { timestamp: isoDaysAgo(5), actor: 'platform@example.com', action: 'reactivated', target: 'Customer: Ava Thomas', detail: 'Reactivated account', severity: 'warning' },
  { timestamp: isoDaysAgo(8), actor: 'platform@example.com', action: 'viewed', target: 'System Health', detail: 'Checked platform dependencies', severity: 'info' },
  { timestamp: isoDaysAgo(12), actor: 'platform@example.com', action: 'viewed', target: 'Subscriptions', detail: 'Reviewed subscription status', severity: 'info' },
];

// -------------------- Revenue series --------------------

function buildRevenueSeries(currentMrr: number): RevenuePoint[] {
  const trend = [0.41, 0.47, 0.54, 0.62, 0.71, 0.80, 0.89, 1.0];
  const out: RevenuePoint[] = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const factor = trend[7 - i];
    out.push({ month: MONTHS[d.getMonth()], revenue: Math.round(currentMrr * factor) });
  }
  return out;
}

// ============================================================
// RUNTIME STORE (module-level singleton — the live dataset)
// ============================================================

interface PlatformStore {
  customers: Customer[];
  sites: PlatformSite[];
  payments: Payment[];
  audit: AuditEntry[];
}

let _store: PlatformStore | null = null;
let _auditCounter = 0;
let _paymentCounter = 0;

function createStore(): PlatformStore {
  const customers: Customer[] = CUSTOMER_SEED.map((c, i) => ({
    ...c,
    id: `cus_${String(i + 1).padStart(3, '0')}`,
  }));

  const sites: PlatformSite[] = SITE_SEED.map((s, i) => ({
    id: `site_p${String(i + 1).padStart(3, '0')}`,
    customerId: customers[s.customerIdIdx].id,
    name: s.name,
    slug: s.slug,
    domain: s.domain,
    status: s.status,
    articles: s.articles,
    media: s.media,
    storageBytes: s.storageBytes,
    createdAt: isoDaysAgo(s.daysAgo),
  }));

  const payments: Payment[] = PAYMENT_SEED.map((p, i) => {
    const c = customers[p.customerIdx];
    return {
      id: `pay_${String(i + 1).padStart(3, '0')}`,
      customerId: c.id,
      planId: p.planId,
      amount: p.amount,
      currency: 'CHF',
      status: p.status,
      method: p.method,
      date: isoDaysAgo(p.daysAgo),
      invoiceNumber: `INV-2026-${String(1000 + i)}`,
    };
  });

  const audit: AuditEntry[] = INITIAL_AUDIT.map((a, i) => ({
    ...a,
    id: `aud_${String(i + 1).padStart(3, '0')}`,
  }));

  _auditCounter = audit.length;
  _paymentCounter = payments.length;

  return { customers, sites, payments, audit };
}

function store(): PlatformStore {
  if (!_store) _store = createStore();
  return _store;
}

export function _resetPlatformStore() {
  _store = null;
}

// -------------------- Derivation helpers --------------------

function nextAuditId(): string {
  _auditCounter += 1;
  return `aud_${String(_auditCounter).padStart(3, '0')}`;
}
function nextPaymentId(): string {
  _paymentCounter += 1;
  return `pay_${String(_paymentCounter).padStart(3, '0')}`;
}

function appendAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>): void {
  store().audit.unshift({
    ...entry,
    id: nextAuditId(),
    timestamp: new Date().toISOString(),
  });
}

// -------------------- Public read API --------------------

export interface PlatformOverview {
  totalCustomers: number;
  activeSubscriptions: number;
  mrr: number;
  currency: string;
  totalSites: number;
  planDistribution: { planId: PlanId; planName: string; count: number; color: string }[];
  statusCounts: { status: SubscriptionStatus; count: number }[];
  revenueSeries: RevenuePoint[];
  recentCustomers: (Customer & { siteCount: number })[];
  recentPayments: (Payment & { customerName: string })[];
  usage: PlatformUsage;
  alerts: PlatformAlert[];
  systemHealth: SystemHealthItem[];
}

export function getOverview(): PlatformOverview {
  const s = store();
  const customers = s.customers;

  const totalCustomers = customers.length;
  const activeSubscriptions = customers.filter((c) => c.subscriptionStatus === 'active').length;

  let mrr = 0;
  for (const c of customers) {
    if (c.subscriptionStatus === 'active' && c.planId !== 'free') {
      mrr += monthlyPrice(getPlan(c.planId), c.billingInterval);
    }
  }

  const totalSites = s.sites.length;

  const planDistribution = PLANS.map((p) => ({
    planId: p.id,
    planName: p.name,
    count: customers.filter((c) => c.planId === p.id).length,
    color: p.id === 'free' ? '#10b981' : p.id === 'plus' ? '#f59e0b' : p.id === 'pro' ? '#8b5cf6' : '#ec4899',
  }));

  const statuses: SubscriptionStatus[] = ['active', 'trial', 'past_due', 'cancelled', 'expired'];
  const statusCounts = statuses
    .map((status) => ({ status, count: customers.filter((c) => c.subscriptionStatus === status).length }))
    .filter((x) => x.count > 0);

  const recentCustomers = [...customers]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6)
    .map((c) => ({ ...c, siteCount: s.sites.filter((si) => si.customerId === c.id).length }));

  const recentPayments = [...s.payments]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6)
    .map((p) => ({ ...p, customerName: customers.find((c) => c.id === p.customerId)?.name ?? '—' }));

  const usage: PlatformUsage = {
    totalSites,
    totalArticles: s.sites.reduce((a, si) => a + si.articles, 0),
    aiArticlesGenerated: Math.round(s.sites.reduce((a, si) => a + si.articles, 0) * 0.28),
    aiWordsGenerated: Math.round(s.sites.reduce((a, si) => a + si.articles, 0) * 0.28 * 1850),
    mediaStorageBytes: s.sites.reduce((a, si) => a + si.storageBytes, 0),
    automationRuns: 1284,
  };

  return {
    totalCustomers,
    activeSubscriptions,
    mrr,
    currency: 'CHF',
    totalSites,
    planDistribution,
    statusCounts,
    revenueSeries: buildRevenueSeries(mrr),
    recentCustomers,
    recentPayments,
    usage,
    alerts: getAlerts(),
    // Placeholder — the overview API route overlays the real
    // (live) health summary here before returning, so that this
    // module does not pull server-only deps (fs, db) into the
    // client bundle via platform-settings.tsx.
    systemHealth: [],
  };
}

export function listCustomers(opts?: { search?: string; planId?: PlanId | 'all'; status?: SubscriptionStatus | 'all' }): (Customer & { siteCount: number })[] {
  const s = store();
  let list = [...s.customers];
  if (opts?.search) {
    const q = opts.search.toLowerCase();
    list = list.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.company ?? '').toLowerCase().includes(q));
  }
  if (opts?.planId && opts.planId !== 'all') {
    list = list.filter((c) => c.planId === opts.planId);
  }
  if (opts?.status && opts.status !== 'all') {
    list = list.filter((c) => c.subscriptionStatus === opts.status);
  }
  return list
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((c) => ({ ...c, siteCount: s.sites.filter((si) => si.customerId === c.id).length }));
}

export interface CustomerDetail extends Customer {
  siteCount: number;
  sites: PlatformSite[];
  payments: Payment[];
  recentActivity: AuditEntry[];
}

export function getCustomer(id: string): CustomerDetail | null {
  const s = store();
  const customer = s.customers.find((c) => c.id === id);
  if (!customer) return null;
  const sites = s.sites.filter((si) => si.customerId === id);
  const payments = s.payments
    .filter((p) => p.customerId === id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const recentActivity = s.audit.filter((a) => a.target.includes(customer.name)).slice(0, 6);
  return { ...customer, siteCount: sites.length, sites, payments, recentActivity };
}

export function listSubscriptions(opts?: { status?: SubscriptionStatus | 'all'; planId?: PlanId | 'all' }): (Customer & { planName: string; monthlyPrice: number })[] {
  const s = store();
  let list = [...s.customers];
  if (opts?.status && opts.status !== 'all') {
    list = list.filter((c) => c.subscriptionStatus === opts.status);
  }
  if (opts?.planId && opts.planId !== 'all') {
    list = list.filter((c) => c.planId === opts.planId);
  }
  return list
    .sort((a, b) => new Date(b.subscriptionStart).getTime() - new Date(a.subscriptionStart).getTime())
    .map((c) => ({ ...c, planName: getPlan(c.planId).name, monthlyPrice: monthlyPrice(getPlan(c.planId), c.billingInterval) }));
}

export async function listPayments(opts?: { status?: PaymentStatus | 'all'; search?: string }): Promise<(Payment & { customerName: string; customerEmail: string })[]> {
  // REAL DB-backed (replaces the in-memory PAYMENT_SEED mock). The admin
  // Payments table now reads the live Payment table, joined to the User
  // (customer) + Subscription. Stripe webhooks (invoice.paid /
  // checkout.session.completed / payment_intent.*) and the dev seed
  // script write these rows, so this is the actual relational state.
  //
  // Server-side filtering:
  //   - status: exact match on Payment.status
  //   - search: case-insensitive substring over payment id, invoice
  //     number, Stripe invoice/payment-intent/charge IDs, and the
  //     customer's name + email (via the User join).
  //
  // Returns the SAME shape the UI has always consumed
  // (Payment & { customerName, customerEmail }) so the Payments page is
  // unchanged — only the data source switched from mock to real DB. The
  // summary values (total payments, paid count, paid total) are derived
  // client-side from this array by the Payments page (already dynamic).
  const { db } = await import('@/lib/db');

  const where: { status?: string; OR?: unknown[] } = {};
  if (opts?.status && opts.status !== 'all') {
    where.status = opts.status;
  }
  if (opts?.search) {
    const q = opts.search;
    where.OR = [
      { id: { contains: q } },
      { invoiceNumber: { contains: q } },
      { stripeInvoiceId: { contains: q } },
      { stripePaymentIntentId: { contains: q } },
      { stripeChargeId: { contains: q } },
      { user: { OR: [{ name: { contains: q } }, { email: { contains: q } }] } },
    ];
  }

  const rows = await db.payment.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true } }, subscription: true },
    orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
    take: 500,
  });

  const mapped = rows.map((r) => mapPaymentRow(r));
  // Precise effective-date sort (paidAt ?? createdAt desc) so pending /
  // failed rows (paidAt null) interleave by their createdAt.
  mapped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return mapped;
}

/** Normalize a Prisma Payment row (with user included) to the public
 *  Payment interface the admin UI consumes. The shape is identical to
 *  the legacy mock Payment so the UI is unchanged; only the data source
 *  switched to the real DB. */
function mapPaymentRow(r: {
  id: string;
  userId: string;
  planId: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  invoiceNumber: string | null;
  stripeInvoiceId: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  paymentMethodType: string | null;
  paymentMethodDetails: string | null;
  paidAt: Date | null;
  createdAt: Date;
  user: { id: string; name: string | null; email: string } | null;
}): Payment & { customerName: string; customerEmail: string } {
  const planId = (['free', 'plus', 'pro', 'max'].includes(r.planId) ? r.planId : 'free') as PlanId;
  const status = (['paid', 'pending', 'failed', 'refunded'].includes(r.status)
    ? r.status
    : 'pending') as PaymentStatus;
  return {
    id: r.id,
    customerId: r.userId,
    planId,
    amount: r.amount,
    currency: r.currency,
    status,
    method: r.method ?? deriveMethodLabel(r.paymentMethodType, r.paymentMethodDetails) ?? '—',
    date: (r.paidAt ?? r.createdAt).toISOString(),
    invoiceNumber: r.invoiceNumber ?? r.stripeInvoiceId ?? '—',
    // Stripe transaction details — surfaced in the admin Payments table
    // so every row is verifiably tied to a real Stripe PaymentIntent /
    // Charge / Invoice. Null/undefined when Stripe isn't configured.
    stripeInvoiceId: r.stripeInvoiceId,
    stripePaymentIntentId: r.stripePaymentIntentId,
    stripeChargeId: r.stripeChargeId,
    customerName: r.user?.name ?? r.user?.email ?? '—',
    customerEmail: r.user?.email ?? '—',
  };
}

/** Build a human-readable payment-method label from the stored metadata,
 *  e.g. "Visa ••4242". Falls back to the capitalized type. */
function deriveMethodLabel(type: string | null, detailsJson: string | null): string | null {
  if (!type) return null;
  if (type === 'card' && detailsJson) {
    try {
      const d = JSON.parse(detailsJson) as { brand?: string; last4?: string };
      if (d.brand && d.last4) return `${capitalize(d.brand)} ••${d.last4}`;
      if (d.brand) return capitalize(d.brand);
    } catch {
      // ignore malformed JSON
    }
  }
  return capitalize(type);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Real-DB recent payments for the Dashboard overview widget — mirrors
 *  listPayments but capped at `limit` (default 6) to match the overview
 *  "recent payments" panel. The overview route overlays this over the
 *  (still-mock) getOverview() result so the Dashboard's payment widget
 *  always agrees with the Payments page — same rows, same customer
 *  names, same amounts, same dates. */
export async function getRecentPaymentsReal(limit = 6): Promise<(Payment & { customerName: string; customerEmail: string })[]> {
  const { db } = await import('@/lib/db');
  const rows = await db.payment.findMany({
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  });
  const mapped = rows.map((r) => mapPaymentRow(r));
  mapped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return mapped;
}

export function listSites(): (PlatformSite & { customerName: string })[] {
  const s = store();
  return s.sites
    .map((si) => ({ ...si, customerName: s.customers.find((c) => c.id === si.customerId)?.name ?? '—' }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getUsage(): PlatformUsage {
  const s = store();
  const totalArticles = s.sites.reduce((a, si) => a + si.articles, 0);
  return {
    totalSites: s.sites.length,
    totalArticles,
    aiArticlesGenerated: Math.round(totalArticles * 0.28),
    aiWordsGenerated: Math.round(totalArticles * 0.28 * 1850),
    mediaStorageBytes: s.sites.reduce((a, si) => a + si.storageBytes, 0),
    automationRuns: 1284,
  };
}

// Note: the previous mock implementation was removed. The real,
// live health-check service lives in ./system-health.ts (server-only,
// imports fs + db). It is called directly by the Overview API route
// and the System Health API route, NOT from here, so this in-memory
// data module stays client-bundle-safe.

export function getAlerts(): PlatformAlert[] {
  const s = store();
  const alerts: PlatformAlert[] = [];

  const failed = s.payments.filter((p) => p.status === 'failed');
  if (failed.length > 0) {
    alerts.push({
      id: 'alert-failed-payments',
      severity: 'critical',
      title: 'Failed payments',
      message: `${failed.length} payment${failed.length === 1 ? '' : 's'} failed and need attention`,
      action: { label: 'View Payments', module: 'platform-payments' },
      time: 'recent',
    });
  }

  const pastDue = s.customers.filter((c) => c.subscriptionStatus === 'past_due');
  if (pastDue.length > 0) {
    alerts.push({
      id: 'alert-past-due',
      severity: 'warning',
      title: 'Past-due subscriptions',
      message: `${pastDue.length} subscription${pastDue.length === 1 ? '' : 's'} past due`,
      // The standalone Subscriptions page was removed (redundant with the
      // Customers page, which now is the customer-level subscription view —
      // it shows Plan + Sub. Status + Account + Sites for every customer).
      // Repoint this alert to the Customers page so the action stays useful.
      action: { label: 'View Customers', module: 'platform-customers' },
      time: 'recent',
    });
  }

  const nearLimit = s.customers.filter((c) => {
    const used = s.sites
      .filter((si) => si.customerId === c.id)
      .reduce((a, si) => a + si.storageBytes, 0);
    return c.storageLimitBytes > 0 && used / c.storageLimitBytes > 0.8;
  });
  if (nearLimit.length > 0) {
    alerts.push({
      id: 'alert-storage',
      severity: 'warning',
      title: 'Storage limit',
      message: `${nearLimit.length} customer${nearLimit.length === 1 ? '' : 's'} approaching storage limit`,
      action: { label: 'View Customers', module: 'platform-customers' },
      time: 'recent',
    });
  }

  const weekAgo = Date.now() - 7 * 24 * 3600_000;
  const newCustomers = s.customers.filter((c) => new Date(c.createdAt).getTime() > weekAgo);
  if (newCustomers.length > 0) {
    alerts.push({
      id: 'alert-new-customers',
      severity: 'info',
      title: 'New customers',
      message: `${newCustomers.length} new customer${newCustomers.length === 1 ? '' : 's'} registered this week`,
      action: { label: 'View Customers', module: 'platform-customers' },
      time: 'recent',
    });
  }

  return alerts;
}

export function getAuditLog(limit = 50): AuditEntry[] {
  return store().audit.slice(0, limit);
}

// -------------------- Public mutation API --------------------

export function changeCustomerPlan(customerId: string, newPlanId: PlanId, actor: string): Customer | null {
  const s = store();
  const c = s.customers.find((cu) => cu.id === customerId);
  if (!c) return null;
  const oldPlan = getPlan(c.planId).name;
  c.planId = newPlanId;
  c.subscriptionStatus = 'active';
  c.trialEnd = null;
  c.subscriptionStart = new Date().toISOString();
  const plan = getPlan(newPlanId);
  c.nextBillingAt = isoDaysAhead(30);

  if (!plan.isFree) {
    const amount = c.billingInterval === 'yearly' ? plan.price * 12 : plan.price;
    s.payments.unshift({
      id: nextPaymentId(),
      customerId: c.id,
      planId: newPlanId,
      amount,
      currency: 'CHF',
      status: 'paid',
      method: c.email.includes('example') ? 'Visa ••4242' : 'Invoice',
      date: new Date().toISOString(),
      invoiceNumber: `INV-2026-${String(1000 + _paymentCounter)}`,
    });
  }

  appendAudit({
    actor,
    action: 'changed plan',
    target: `Customer: ${c.name}`,
    detail: `${oldPlan} → ${plan.name}`,
    severity: 'info',
  });
  return c;
}

export function cancelSubscription(customerId: string, actor: string): Customer | null {
  const s = store();
  const c = s.customers.find((cu) => cu.id === customerId);
  if (!c) return null;
  c.subscriptionStatus = 'cancelled';
  c.nextBillingAt = null;
  appendAudit({
    actor,
    action: 'cancelled subscription',
    target: `Customer: ${c.name}`,
    detail: `Plan: ${getPlan(c.planId).name}`,
    severity: 'warning',
  });
  return c;
}

export function suspendCustomer(customerId: string, actor: string): Customer | null {
  const s = store();
  const c = s.customers.find((cu) => cu.id === customerId);
  if (!c) return null;
  c.status = 'SUSPENDED';
  appendAudit({
    actor,
    action: 'suspended',
    target: `Customer: ${c.name}`,
    detail: 'Account suspended by admin',
    severity: 'critical',
  });
  return c;
}

export function reactivateCustomer(customerId: string, actor: string): Customer | null {
  const s = store();
  const c = s.customers.find((cu) => cu.id === customerId);
  if (!c) return null;
  c.status = 'ACTIVE';
  if (c.subscriptionStatus === 'cancelled') c.subscriptionStatus = 'active';
  appendAudit({
    actor,
    action: 'reactivated',
    target: `Customer: ${c.name}`,
    detail: 'Account reactivated by admin',
    severity: 'info',
  });
  return c;
}

// -------------------- Sync helpers (used by entitlements + usage-limits) --------------------

/** Resolve a customer record by email (sync). Returns null when the user is
 *  not a platform customer (e.g. owner / billing-bypass users). */
export function getCustomerByEmailSync(email: string): Customer | null {
  const s = store();
  return s.customers.find((c) => c.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export interface CustomerUsage {
  sites: number;
  storageBytes: number;
  aiWords: number;
  aiArticles: number;
  automationRuns: number;
}

/** Current resource usage for a customer (sync). Derived from the same
 *  centralized dataset as the admin overview — never an independent number. */
export function getCustomerUsageSync(email: string): CustomerUsage {
  const s = store();
  const customer = s.customers.find((c) => c.email.toLowerCase() === email.toLowerCase());
  if (!customer) {
    return { sites: 0, storageBytes: 0, aiWords: 0, aiArticles: 0, automationRuns: 0 };
  }
  const sites = s.sites.filter((si) => si.customerId === customer.id);
  const totalArticles = sites.reduce((a, si) => a + si.articles, 0);
  const storageBytes = sites.reduce((a, si) => a + si.storageBytes, 0);
  const aiArticles = Math.round(totalArticles * 0.28);
  return {
    sites: sites.length,
    storageBytes,
    aiWords: aiArticles * 1850,
    aiArticles,
    automationRuns: 0, // not tracked per-customer in the demo dataset
  };
}

// -------------------- Client billing helpers --------------------

export interface ClientBillingState {
  customer: Customer | null;
  plan: Plan;
  allPlans: Plan[];
  status: SubscriptionStatus | 'none';
  trialEnd: string | null;
  nextBillingAt: string | null;
  paymentHistory: Payment[];
  /** Billing mode of the authenticated user. INTERNAL/EXEMPT users have a
   *  billing bypass (full access, not a paying customer). */
  billingMode: 'EXTERNAL' | 'INTERNAL' | 'EXEMPT';
  isInternal: boolean;
  // ---- NEW (Task 64): real DB Subscription fields ----
  /** The billing interval chosen for THIS subscription (monthly | yearly). */
  billingInterval?: 'monthly' | 'yearly';
  /** Calendar-based next billing/expiration date (DB Subscription.currentPeriodEnd). */
  currentPeriodEnd?: string | null;
  /** For free plans with a limited duration: the ISO date when the trial expires. */
  freeTrialExpiresAt?: string | null;
  /** True when the user's free-trial has expired and gated features are blocked. */
  freeTrialExpired?: boolean;
  /** Stripe IDs (when the subscription was created via Stripe Checkout). */
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  /** True when the user must take action (expired trial / past_due). */
  requiresPlanAction?: boolean;
  /** True when the source of truth is the DB Subscription row (vs the legacy in-memory seed). */
  hasRealSubscription?: boolean;
}

/** Synthetic "Internal" plan for owner / billing-bypass users. Carries every
 *  entitlement and a zero price; the user is not a paying customer. */
const INTERNAL_PLAN: Plan = {
  id: 'free',
  name: 'Internal',
  price: 0,
  priceMonthly: 0,
  priceYearly: 0,
  currency: 'CHF',
  interval: 'monthly',
  isFree: true,
  active: true,
  features: ['Full platform access', 'All features enabled', 'Billing bypass', 'Not counted in MRR'],
  entitlements: ['automation', 'ai_content', 'advanced_analytics', 'custom_domains', 'api_access', 'white_label', 'audit_log', 'advanced_seo', 'newsletter'],
  limits: { maxSites: -1, storageBytes: -1, aiWords: -1, aiArticles: -1, automationRuns: -1 },
};

interface BillingUser {
  /** User row id — required for the DB Subscription lookup. */
  id?: string;
  email: string;
  role?: string;
  billingMode?: string;
}

function isBillingBypass(user: BillingUser): boolean {
  return user.role === 'OWNER' || user.billingMode === 'INTERNAL' || user.billingMode === 'EXEMPT';
}

export function getClientBilling(user: BillingUser): ClientBillingState {
  const s = store();
  const customer = s.customers.find((c) => c.email.toLowerCase() === user.email.toLowerCase()) ?? null;
  const bypass = isBillingBypass(user);
  const billingMode = (user.billingMode as 'EXTERNAL' | 'INTERNAL' | 'EXEMPT') ?? 'EXTERNAL';

  if (bypass) {
    return {
      customer: null,
      plan: INTERNAL_PLAN,
      allPlans: PLANS.filter((p) => p.active),
      status: 'active',
      trialEnd: null,
      nextBillingAt: null,
      paymentHistory: [],
      billingMode,
      isInternal: true,
      billingInterval: 'monthly',
      currentPeriodEnd: null,
      freeTrialExpiresAt: null,
      freeTrialExpired: false,
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      requiresPlanAction: false,
      hasRealSubscription: false,
    };
  }

  const plan = customer ? getPlan(customer.planId) : getPlan('free');
  const paymentHistory = customer
    ? s.payments
        .filter((p) => p.customerId === customer.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];
  return {
    customer,
    plan,
    allPlans: PLANS.filter((p) => p.active),
    status: customer?.subscriptionStatus ?? 'trial',
    trialEnd: customer?.trialEnd ?? null,
    nextBillingAt: customer?.nextBillingAt ?? null,
    paymentHistory,
    billingMode,
    isInternal: false,
    billingInterval: customer?.billingInterval ?? 'monthly',
    currentPeriodEnd: customer?.nextBillingAt ?? null,
    freeTrialExpiresAt: null,
    freeTrialExpired: false,
    stripeSubscriptionId: null,
    stripeCustomerId: null,
    requiresPlanAction: customer?.subscriptionStatus === 'past_due' || customer?.subscriptionStatus === 'expired',
    hasRealSubscription: false,
  };
}

/**
 * Async variant that prefers the DB Subscription row over the legacy
 * in-memory customer. This is the version called by /api/platform/billing/me.
 *
 * The legacy in-memory customer (CUSTOMER_SEED) is still consulted for
 * the Platform Admin Customers/Payments pages and for demo users who
 * don't yet have a DB Subscription row.
 *
 * For users WITH a DB Subscription row:
 *   - status, billingInterval, currentPeriodEnd, trialEnd come from the DB.
 *   - freeTrialExpired is computed from trialEnd + plan.isFree + status.
 *   - paymentHistory comes from the DB Payment table (real Stripe invoices
 *     when Stripe is configured; empty for free plans).
 *
 * For users WITHOUT a DB Subscription row (legacy or fresh):
 *   - Falls back to getClientBilling() (in-memory customer or Free plan).
 */
export async function getClientBillingAsync(user: BillingUser): Promise<ClientBillingState> {
  // Bypass users: return the synthetic Internal plan (no DB lookup).
  if (isBillingBypass(user)) return getClientBilling(user);

  // No user id → can't look up DB Subscription. Fall back to legacy.
  if (!user.id) return getClientBilling(user);

  // Try the DB Subscription first.
  const subState = await getClientSubscriptionState({
    id: user.id,
    email: user.email,
    role: user.role ?? '',
    billingMode: user.billingMode,
  });

  // No DB subscription row → fall back to the in-memory legacy state.
  if (!subState.subscription) {
    return getClientBilling(user);
  }

  // We have a real DB subscription. Build the ClientBillingState from it
  // (NOT from the in-memory customer — the DB is the source of truth).
  const plan = toPlan(subState.plan);

  // Load real payment history from the DB Payment table.
  const dbPayments = await getUserPayments(user.id);

  return {
    customer: null, // no in-memory customer when DB subscription is the source
    plan,
    allPlans: PLANS.filter((p) => p.active),
    status: subState.status,
    trialEnd: subState.trialEnd,
    nextBillingAt: subState.currentPeriodEnd,
    paymentHistory: dbPayments.map((p) => ({
      id: p.id,
      customerId: user.id as string,
      planId: p.planId as PlanId,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      method: p.method ?? '—',
      date: p.createdAt.toISOString(),
      invoiceNumber: p.invoiceNumber ?? '—',
    })),
    billingMode: (user.billingMode as 'EXTERNAL' | 'INTERNAL' | 'EXEMPT') ?? 'EXTERNAL',
    isInternal: false,
    billingInterval: subState.billingInterval,
    currentPeriodEnd: subState.currentPeriodEnd,
    freeTrialExpiresAt: subState.freeTrialExpiresAt,
    freeTrialExpired: subState.freeTrialExpired,
    stripeSubscriptionId: subState.subscription.stripeSubscriptionId,
    stripeCustomerId: subState.subscription.stripeCustomerId,
    requiresPlanAction: subState.requiresPlanAction,
    hasRealSubscription: true,
  };
}

// DB Subscription lookup helper — imported here (statically) so the
// async client-billing path can resolve real subscription state. The
// subscription-data module imports nothing from this file, so there is
// no circular dependency.
import { getClientSubscriptionState, getUserPayments, subscribeToFreePlan, cancelSubscription as cancelDbSubscription } from './subscription-data';

/** Backwards-compatible email-only overload (treats caller as EXTERNAL). */
export function getClientBillingByEmail(email: string): ClientBillingState {
  return getClientBilling({ email, role: undefined, billingMode: 'EXTERNAL' });
}

/**
 * Change plan — for FREE plans this writes a real DB Subscription row
 * (with the configured free-trial duration if any). For PAID plans
 * this function REFUSES and the caller must redirect the user to
 * /api/billing/checkout (Stripe). This is the only way to change plan
 * without going through Stripe — and it ONLY works for free plans.
 *
 * For backwards compatibility with the legacy in-memory demo customers,
 * if the user matches a CUSTOMER_SEED entry we ALSO mutate that entry
 * (so the Platform Admin Customers page stays consistent). The DB
 * Subscription row is the source of truth for the Client Billing page.
 */
export async function clientChangePlan(
  user: BillingUser,
  newPlanId: PlanId,
): Promise<ClientBillingState | null> {
  if (isBillingBypass(user)) return getClientBilling(user); // bypass: no plan change
  if (!user.id) return null; // no user id → can't write DB Subscription

  // Look up the target plan from the live cache.
  const target = getPlan(newPlanId);
  if (!target.active) return null;

  // For FREE plans: write a DB Subscription row via subscribeToFreePlan.
  if (target.isFree) {
    const result = await subscribeToFreePlan(user.id, newPlanId);
    if (!result.ok) return null;
  } else {
    // PAID plan: REFUSE. The user must use /api/billing/checkout (Stripe).
    // Returning null here signals "must use checkout". The Client Billing
    // UI detects this and shows the Upgrade button → /api/billing/checkout.
    return null;
  }

  // Also mutate the in-memory demo customer (if one exists for this email)
  // so the Platform Admin Customers page stays consistent with the new state.
  const s = store();
  const c = s.customers.find((cu) => cu.email.toLowerCase() === user.email.toLowerCase());
  if (c) changeCustomerPlan(c.id, newPlanId, user.email);

  return getClientBillingAsync(user);
}

/**
 * Cancel subscription — writes to the DB Subscription row (the source
 * of truth) and also mutates the legacy in-memory demo customer if one
 * exists. Returns the updated ClientBillingState.
 */
export async function clientCancelSubscription(user: BillingUser): Promise<ClientBillingState | null> {
  if (isBillingBypass(user)) return getClientBilling(user); // bypass: nothing to cancel
  if (!user.id) return null;

  // Cancel the DB Subscription (the authoritative record).
  await cancelDbSubscription(user.id);

  // Also mutate the in-memory demo customer if one exists.
  const s = store();
  const c = s.customers.find((cu) => cu.email.toLowerCase() === user.email.toLowerCase());
  if (c) cancelSubscription(c.id, user.email);

  return getClientBillingAsync(user);
}

// ============================================================
// PLATFORM EVENTS — derived, unified platform-level feed
// ============================================================
// Aggregates platform-level events from the SAME centralized
// dataset that powers Platform Overview / Customers / Payments /
// Subscriptions / Audit / Alerts. PURE read-only function — no new
// state, no persistence. The /api/platform/admin/notifications
// endpoint paginates and filters this list; mark-as-read / delete
// are documented no-ops on the API side because the feed is derived
// fresh on every request (read-state would live in a separate
// table in a real implementation).
//
// Event types follow the same NotificationType shape the Client
// Notifications page uses: INFO | SUCCESS | WARNING | ERROR |
// ACTION_REQUIRED. This lets the Platform Notifications UI reuse
// the client page's NotificationCard / NOTIFICATION_TYPE_CONFIG
// verbatim.
// ============================================================

export type PlatformEventType = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'ACTION_REQUIRED';

export interface PlatformEvent {
  id: string;
  type: PlatformEventType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

function isoMinutesAgo(mins: number): string {
  return new Date(Date.now() - mins * 60_000).toISOString();
}

/** Map alert id → a deterministic "recent" timestamp (no Math.random,
 *  stable across renders for a given wall-clock minute). */
function alertTimestamp(alertId: string): string {
  switch (alertId) {
    case 'alert-failed-payments': return isoMinutesAgo(30);
    case 'alert-past-due': return isoMinutesAgo(120);
    case 'alert-storage': return isoMinutesAgo(360);
    case 'alert-new-customers': return isoMinutesAgo(60 * 24);
    default: return isoMinutesAgo(60);
  }
}

/** Derive the unified platform events feed. Reads from listCustomers,
 *  listPayments, listSubscriptions, getAuditLog, getAlerts — all of
 *  which already exist and power the rest of the Platform Admin. */
export function getPlatformEvents(): PlatformEvent[] {
  const events: PlatformEvent[] = [];

  // 1. Customer registrations — INFO "New customer registered"
  for (const c of listCustomers()) {
    events.push({
      id: `evt-cust-${c.id}`,
      type: 'INFO',
      title: 'New customer registered',
      message: `${c.name} (${c.email}) signed up from ${c.country} on the ${c.planId.toUpperCase()} plan.`,
      isRead: false,
      createdAt: c.createdAt,
    });
  }

  // 2. Payments — SUCCESS / ERROR / WARNING / INFO by status
  for (const p of listPayments()) {
    let type: PlatformEventType = 'INFO';
    let title = 'Payment update';
    if (p.status === 'paid') {
      type = 'SUCCESS';
      title = 'Successful payment';
    } else if (p.status === 'failed') {
      type = 'ERROR';
      title = 'Failed payment';
    } else if (p.status === 'refunded') {
      type = 'WARNING';
      title = 'Payment refunded';
    } else if (p.status === 'pending') {
      type = 'INFO';
      title = 'Payment pending';
    }
    events.push({
      id: `evt-pay-${p.id}`,
      type,
      title,
      message: `${p.customerName} — ${p.currency} ${p.amount} via ${p.method}. Invoice ${p.invoiceNumber}. Status: ${p.status}.`,
      isRead: false,
      createdAt: p.date,
    });
  }

  // 3. Subscriptions — INFO created, WARNING cancelled, ACTION_REQUIRED trial ending
  for (const s of listSubscriptions()) {
    const plan = getPlan(s.planId);
    events.push({
      id: `evt-sub-${s.id}`,
      type: 'INFO',
      title: 'Subscription created',
      message: `${s.name} subscribed to the ${s.planName} plan (${s.billingInterval} billing, ${plan.currency} ${s.monthlyPrice}/mo).`,
      isRead: false,
      createdAt: s.subscriptionStart,
    });

    if (s.subscriptionStatus === 'cancelled') {
      // Cancellation happened at some point after creation — there is no
      // dedicated timestamp in the dataset, so use subscriptionStart as a
      // stable proxy (still sorts in the past, like a historical event).
      events.push({
        id: `evt-sub-cancel-${s.id}`,
        type: 'WARNING',
        title: 'Subscription cancelled',
        message: `${s.name} cancelled the ${s.planName} plan subscription. Access has been revoked at the end of the current period.`,
        isRead: false,
        createdAt: s.subscriptionStart,
      });
    }

    if (s.subscriptionStatus === 'trial') {
      const trialEnd = s.trialEnd ?? s.nextBillingAt ?? s.subscriptionStart;
      events.push({
        id: `evt-sub-trial-${s.id}`,
        type: 'ACTION_REQUIRED',
        title: 'Trial ending soon',
        message: `${s.name}'s ${s.planName} plan trial ends on ${trialEnd}. Convert to a paid subscription before then to retain access.`,
        isRead: false,
        createdAt: trialEnd,
      });
    }
  }

  // 4. Audit log entries — INFO with action as title, detail as message
  for (const a of getAuditLog(50)) {
    events.push({
      id: `evt-aud-${a.id}`,
      type: 'INFO',
      title: a.action,
      message: a.detail && a.detail.length > 0 ? `${a.detail} — target: ${a.target}` : a.target,
      isRead: false,
      createdAt: a.timestamp,
    });
  }

  // 5. Alerts — ERROR / WARNING / INFO by severity
  for (const alert of getAlerts()) {
    let type: PlatformEventType = 'INFO';
    if (alert.severity === 'critical') type = 'ERROR';
    else if (alert.severity === 'warning') type = 'WARNING';
    events.push({
      id: `evt-alert-${alert.id}`,
      type,
      title: alert.title,
      message: alert.message,
      isRead: false,
      createdAt: alertTimestamp(alert.id),
    });
  }

  // Newest first — consistent with the Client Notifications feed.
  return events.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
