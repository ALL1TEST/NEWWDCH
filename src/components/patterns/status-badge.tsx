'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { STATUS_COLORS } from '@/shared/constants';
import { cn, labelize } from '@/lib/utils';

// -------------------- Types --------------------

type StatusBadgeSize = 'sm' | 'md' | 'lg';

interface StatusBadgeProps {
  status: string;
  size?: StatusBadgeSize;
  className?: string;
}

// -------------------- Size Classes --------------------

const SIZE_CLASSES: Record<StatusBadgeSize, string> = {
  sm: 'px-1.5 py-0 text-[10px] leading-4',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-2.5 py-1 text-sm',
};

// -------------------- Ambiguous Status Resolution --------------------

/**
 * Some status strings collide across enums (e.g. PENDING appears in
 * ReviewStatus, CommentStatus, SubscriberStatus, WebhookDeliveryStatus, MediaScanStatus).
 * We add suffix-prefixed keys to STATUS_COLORS to disambiguate when needed.
 * This map handles fallback lookup for collisions that don't have a unique key.
 */
const AMBIGUOUS_DEFAULTS: Record<string, string> = {
  // If there's no context, PENDING defaults to amber (pending action)
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  // CANCELLED appears in JobStatus and AiGenerationStatus
  CANCELLED: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  // COMPLETED appears in multiple (green by default)
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  // FAILED appears in multiple
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  // APPROVED appears in PostStatus, ReviewStatus, CommentStatus
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  // PUBLISHED appears in PostStatus
  PUBLISHED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  // DRAFT appears in PostStatus, FormStatus, CampaignStatus
  DRAFT: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  // ARCHIVED appears in PostStatus, FormStatus
  ARCHIVED: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  // ERROR appears in MediaProcessingStatus
  ERROR: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  // PROCESSING appears in SubmissionStatus, MediaProcessingStatus
  PROCESSING: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  // SPAM appears in SubmissionStatus, CommentStatus
  SPAM: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  // ACTIVE appears in JobStatus, UserStatus
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  // SUCCESS appears in WebhookDeliveryStatus
  SUCCESS: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

// -------------------- Component --------------------

export function StatusBadge({ status, size = 'sm', className }: StatusBadgeProps) {
  const colorClass = STATUS_COLORS[status] ?? AMBIGUOUS_DEFAULTS[status] ?? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';

  const label = labelize(status);

  return (
    <Badge
      variant="outline"
      className={cn(
        'border-transparent font-medium shrink-0',
        SIZE_CLASSES[size],
        colorClass,
        className,
      )}
    >
      {label}
    </Badge>
  );
}
