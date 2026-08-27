'use client';

import React from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * SINGLE-SOURCE theme toggle (next-themes — the existing theme state).
 *
 * • Topbar usage   → <ThemeToggle />            (no tooltip, as before)
 * • Collapsed rail → <ThemeToggle withTooltip /> (tooltip to the right)
 *
 * No second theme state is introduced; clicking only flips the global
 * theme exactly like the original inline topbar button did.
 */
export function ThemeToggle({ withTooltip = false }: { withTooltip?: boolean }) {
  const { theme, setTheme } = useTheme();

  const button = (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );

  if (!withTooltip) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">Toggle theme</TooltipContent>
    </Tooltip>
  );
}
