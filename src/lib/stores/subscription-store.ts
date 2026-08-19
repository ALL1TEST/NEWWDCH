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
  badgeVariant: 'beta' | 'pro' | 'max';
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

const PLANS: Plan[] = [
  {
    id: 'beta',
    name: 'Beta',
    price: 0,
    currency: 'CHF',
    interval: 'month',
    features: [
      'Up to 3 sites',
      'Basic analytics',
      'Email support',
      '1 GB storage',
    ],
    badgeVariant: 'beta',
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
  const initialPlanId = stored?.currentPlanId ?? 'beta';

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

export function getPlanBadgeClasses(variant: Plan['badgeVariant']): string {
  switch (variant) {
    case 'beta':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'pro':
      return 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border-violet-200 dark:border-violet-800';
    case 'max':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    default:
      return '';
  }
}

export function getPlanCardBorderClasses(variant: Plan['badgeVariant']): string {
  switch (variant) {
    case 'beta':
      return 'border-amber-200 dark:border-amber-800';
    case 'pro':
      return 'border-violet-200 dark:border-violet-800';
    case 'max':
      return 'border-emerald-200 dark:border-emerald-800';
    default:
      return '';
  }
}

export function getPlanLabel(variant: Plan['badgeVariant']): string {
  switch (variant) {
    case 'beta': return 'Beta';
    case 'pro': return 'Pro';
    case 'max': return 'Max';
    default: return variant;
  }
}
