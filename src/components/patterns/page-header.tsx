'use client';

import React from 'react';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { cn } from '@/lib/utils';

// -------------------- Types --------------------

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  breadcrumbs?: boolean;
  className?: string;
}

// -------------------- Component --------------------

export function PageHeader({
  title,
  description,
  action,
  breadcrumbs = true,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {breadcrumbs && <Breadcrumbs />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
