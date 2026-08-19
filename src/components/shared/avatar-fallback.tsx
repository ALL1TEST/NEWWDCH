'use client';

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn, getInitials } from '@/lib/utils';

// -------------------- Types ----------------

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarWithFallbackProps {
  src?: string;
  name: string;
  size?: AvatarSize;
  className?: string;
}

// -------------------- Size Map ----------------

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

// -------------------- Component ----------------

export function AvatarWithFallback({
  src,
  name,
  size = 'md',
  className,
}: AvatarWithFallbackProps) {
  const initials = getInitials(name);

  return (
    <Avatar className={cn(SIZE_CLASSES[size], className)}>
      {src && <AvatarImage src={src} alt={name} />}
      <AvatarFallback className="font-medium text-muted-foreground">
        {initials || '?'}
      </AvatarFallback>
    </Avatar>
  );
}
