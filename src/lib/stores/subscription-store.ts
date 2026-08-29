'use client';

import { create } from 'zustand';

// -------------------- Plan Types --------------------

export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  /** Open key — new plans just set their own id; no union to extend. */
  badgeVariant: string;
  /** Per-plan badge styling — the SINGLE source of truth for every badge
      render site (topbar avatar, profile dropdown, billing, profile).
      Adding a plan = adding an entry with its own colors; zero component
      changes. Plans without explicit styling get the neutral fallback. */
  badgeStyle: PlanBadgeStyle;
}

export interface PlanBadgeStyle {
  /** Solid pill rendered on the avatar (topbar) — bold, own text color. */
  avatar: string;
  /** Soft/tinted badge (profile dropdown header, billing card, profile page). */
  soft: string;
  /** Avatar ring accent (topbar avatar). */
  ring: string;
  /** Billing plan-card border accent. */
  cardBorder: string;
}

export interface SubscriptionState {
  currentPlanId: string;
 status: 'active' | 'trialing' | 'canceled' | 'past_due';
  trialEnd: string | null;
  subscriptionStart: string | null;
  paymentMethod: string | null;

  // Derived
  allPlans: Plan[];
  currentPlan: Plan;
  otherPlans: Plan[];

  // Actions
  changePlan: (planId: string) => void;
  setSubscription: (data: Partial<SubscriptionState>) => void;
}

// -------------------- Plan Definitions --------------------

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'CHF',
    interval: 'month',
    features: [
      'Up to 3 sites',
      'Basic analytics',
      'Community support',
      '1 GB storage',
    ],
    badgeVariant: 'free',
    badgeStyle: {
      avatar: 'bg-emerald-500 text-white',
      soft: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      ring: 'ring-emerald-500',
      cardBorder: 'border-emerald-200 dark:border-emerald-800',
    },
  },
  {
    id: 'plus',
    name: 'Plus',
    price: 9,
    currency: 'CHF',
    interval: 'month',
    features: [
      'Up to 5 sites',
      'Advanced analytics',
      'Email support',
      '5 GB storage',
      'AI content tools',
    ],
    badgeVariant: 'plus',
    badgeStyle: {
      avatar: 'bg-amber-500 text-white',
      soft: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      ring: 'ring-amber-500',
      cardBorder: 'border-amber-200 dark:border-amber-800',
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 49,
    currency: 'CHF',
    interval: 'month',
    features: [
      'Up to 10 sites',
      'Advanced analytics',
      'Priority support',
      '10 GB storage',
      'AI content tools',
      'Custom domains',
    ],
    badgeVariant: 'pro',
    badgeStyle: {
      avatar: 'bg-violet-500 text-white',
      soft: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border-violet-200 dark:border-violet-800',
      ring: 'ring-violet-500',
      cardBorder: 'border-violet-200 dark:border-violet-800',
    },
  },
  {
    id: 'max',
    name: 'Max',
    price: 99,
    currency: 'CHF',
    interval: 'month',
    features: [
      'Unlimited sites',
      'Full analytics suite',
      '24/7 dedicated support',
      '100 GB storage',
      'AI content tools',
      'Custom domains',
      'API access',
      'White-label',
      'Audit log',
    ],
    badgeVariant: 'max',
    badgeStyle: {
      avatar: 'bg-pink-500 text-white',
      soft: 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300 border-pink-200 dark:border-pink-800',
      ring: 'ring-pink-500',
      cardBorder: 'border-pink-200 dark:border-pink-800',
    },
  },
];

const SUBSCRIPTION_STORAGE_KEY = 'cms_subscription';

// -------------------- Helper --------------------

interface StoredSubscription {
  currentPlanId: string;
  status: string;
  trialEnd: string | null;
  subscriptionStart: string | null;
}

function loadFromStorage(): Partial<SubscriptionState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StoredSubscription;
  } catch {
    // ignore
  }
  return null;
}

function saveToStorage(data: StoredSubscription) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(data));
}

// -------------------- Store --------------------

export const useSubscriptionStore = create<SubscriptionState>((set, get) => {
  const stored = loadFromStorage();
  const initialPlanId = stored?.currentPlanId ?? 'free';

  const currentPlan = PLANS.find((p) => p.id === initialPlanId) ?? PLANS[0];
  const otherPlans = PLANS.filter((p) => p.id !== initialPlanId);

  return {
    currentPlanId: initialPlanId,
    status: (stored?.status as SubscriptionState['status']) ?? 'active',
    trialEnd: stored?.trialEnd ?? null,
    subscriptionStart: stored?.subscriptionStart ?? null,
    paymentMethod: null,

    allPlans: PLANS,
    currentPlan,
    otherPlans,

    changePlan: (planId: string) => {
      const plan = PLANS.find((p) => p.id === planId);
      if (!plan || planId === get().currentPlanId) return;

      const now = new Date().toISOString();
      const newOtherPlans = PLANS.filter((p) => p.id !== planId);

      set({
        currentPlanId: planId,
        currentPlan: plan,
        otherPlans: newOtherPlans,
        status: 'active',
        subscriptionStart: now,
      });

      saveToStorage({
        currentPlanId: planId,
        status: 'active',
        trialEnd: null,
        subscriptionStart: now,
      });
    },

    setSubscription: (data) => {
      const updated = { ...get(), ...data };
      // Re-derive computed fields
      const plan = PLANS.find((p) => p.id === updated.currentPlanId) ?? PLANS[0];
      updated.currentPlan = plan;
      updated.otherPlans = PLANS.filter((p) => p.id !== updated.currentPlanId);

      set(updated);

      saveToStorage({
        currentPlanId: updated.currentPlanId,
        status: updated.status,
        trialEnd: updated.trialEnd,
        subscriptionStart: updated.subscriptionStart,
      });
    },
  };
});

// -------------------- Badge Styles --------------------

/** Fallback for any plan that ships without explicit badge styling —
    guarantees a future plan still renders a sensible, theme-aware badge
    instead of an invisible/unstyled one. */
const NEUTRAL_PLAN_BADGE: PlanBadgeStyle = {
  avatar: 'bg-primary text-primary-foreground',
  soft: 'bg-muted text-muted-foreground border border-border',
  ring: 'ring-border',
  cardBorder: 'border-border',
};

/** Resolve the badge style for a plan object (never returns undefined). */
export function getPlanBadgeStyle(plan: Plan | null | undefined): PlanBadgeStyle {
  return plan?.badgeStyle ?? NEUTRAL_PLAN_BADGE;
}

/** Soft badge classes by plan id/variant — config-driven, no switch.
    Used by the billing and profile pages. Unknown variants get the
    neutral fallback so future plans render correctly by default. */
export function getPlanBadgeClasses(variant: Plan['badgeVariant']): string {
  const plan = PLANS.find((p) => p.id === variant || p.badgeVariant === variant);
  return getPlanBadgeStyle(plan).soft;
}

/** Billing plan-card border accent by plan id/variant. */
export function getPlanCardBorderClasses(variant: Plan['badgeVariant']): string {
  const plan = PLANS.find((p) => p.id === variant || p.badgeVariant === variant);
  return getPlanBadgeStyle(plan).cardBorder;
}

/** Display label by plan id/variant — always resolves to the plan's own
    configured name (falls back to the raw variant string). */
export function getPlanLabel(variant: Plan['badgeVariant']): string {
  const plan = PLANS.find((p) => p.id === variant || p.badgeVariant === variant);
  return plan?.name ?? variant;
}
