'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

// -------------------- Types --------------------

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  isLoading?: boolean;
  /**
   * Layering overrides. By default the AlertDialog overlay + content use the
   * shadcn-standard `z-50` (modal layer). This works for modals opened from
   * the page background, but NOT for modals opened from inside an open
   * popover/dropdown whose content sits at a higher z-index (e.g. the
   * notification bell dropdown uses `z-[60]`). In that combo the modal
   * would render BEHIND the dropdown and visually overlap it.
   *
   * Pass `overlayClassName="z-[70]"` + `contentClassName="z-[70]"` to
   * place this modal ABOVE a z-[60] popover. Establishes a clear
   * hierarchy: popover (z-[60]) < modal (z-[70]).
   */
  overlayClassName?: string;
  contentClassName?: string;
}

// -------------------- Component --------------------

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  onConfirm,
  isLoading = false,
  overlayClassName,
  contentClassName,
}: ConfirmDialogProps) {
  // Default the button labels through t() so a confirm dialog whose
  // caller did not pass explicit labels still renders in the active
  // language (common.confirm / common.cancel exist in every locale's
  // core dictionary). Callers that pass their own t('...') value
  // override these defaults as before.
  const { t } = useT();
  const resolvedConfirm = confirmLabel ?? t('common.confirm');
  const resolvedCancel = cancelLabel ?? t('common.cancel');
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        overlayClassName={overlayClassName}
        contentClassName={contentClassName}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            {resolvedCancel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isLoading}
            className={cn(
              variant === 'destructive' &&
                buttonVariants({ variant: 'destructive' }),
            )}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {resolvedConfirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
