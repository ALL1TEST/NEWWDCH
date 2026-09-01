'use client';

import { cn } from '@/lib/utils';
import { useSubscriptionStore, getPlanBadgeStyle } from '@/lib/stores/subscription-store';

/**
 * PlanBadge — the single source of truth for the user's active-plan pill.
 *
 * Renders a small amber (plan-colored) rounded pill showing the active
 * plan's name (e.g. "Beta", "Pro", "Max"). Used by BOTH the top-right
 * topbar avatar trigger AND the profile dropdown header so the two
 * locations can never visually drift apart — they share the exact same
 * markup, classes, colors, font size, weight, padding, and radius.
 *
 * The base classes are ALWAYS applied (they define the badge's visual
 * appearance). Callers may pass a `className` for positioning-only
 * overrides (e.g. `absolute -bottom-1.5 left-1/2 -translate-x-1/2` to
 * anchor it to the bottom of an avatar, or `shrink-0` to keep it from
 * being compressed inside a flex row). Positioning classes never
 * change the badge's own look — only where/how it sits in its parent.
 */
export function PlanBadge({ className }: { className?: string }) {
  const { currentPlan, serverSynced } = useSubscriptionStore();
  // Never render a default/stale plan: the active plan is only shown
  // once it has been synced from the server (the same
  // /api/platform/billing/me source Billing & Subscription uses) —
  // until then the badge stays hidden instead of showing a hardcoded
  // or default value.
  if (!serverSynced) return null;
  return (
    <span
      className={cn(
        // Base — the visual identity of the badge. Identical everywhere
        // it is rendered, so the topbar avatar trigger and the dropdown
        // header always show the exact same pill.
        'flex items-center rounded-md px-1.5 py-0.5 text-[8px] font-bold leading-none whitespace-nowrap ring-2 ring-background',
        // Plan-derived colors (e.g. bg-amber-500 text-white for Beta).
        getPlanBadgeStyle(currentPlan).avatar,
        // Caller-supplied positioning-only classes (absolute anchor for
        // the avatar trigger, shrink-0 for the inline dropdown row, etc.).
        className,
      )}
    >
      {currentPlan.name}
    </span>
  );
}
