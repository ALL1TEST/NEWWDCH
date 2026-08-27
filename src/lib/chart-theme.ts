'use client';

import { useMemo } from 'react';
import { useTheme } from 'next-themes';
import type { CSSProperties } from 'react';

/**
 * ==============================
 * SHARED THEME-AWARE CHART THEME
 * ==============================
 *
 * ONE central chart color system for every recharts-based chart in the CMS.
 * Replaces the previous per-page `hsl(var(--token))` wrappers which are
 * INVALID for this design system (the tokens in globals.css hold plain
 * OKLCH values — wrapping them again in hsl() produces an unparsable color,
 * so recharts fell back to its default near-black tick/label colors that
 * became unreadable on dark backgrounds).
 *
 * The palette below MIRRORS the semantic tokens declared in globals.css:
 *
 *   textMuted      ↔ --muted-foreground / --text-muted
 *   textSecondary  ↔ --text-secondary
 *   textPrimary    ↔ --foreground / --text-primary
 *   border         ↔ --border          (axis lines, dividers)
 *   grid           ↔ --border          (grid lines)
 *   popoverBg/Fg   ↔ --popover/--popover-foreground (tooltips)
 *   mutedBg        ↔ --muted           (cursor bands)
 *   primary        ↔ --primary         (data accents)
 *   chart1..5      ↔ --chart-1..5      (series colors)
 *
 * If you ever change a token value in globals.css, update the matching
 * entry here as well — they are intentionally kept identical so charts
 * and the rest of the UI always share one visual language.
 */

export interface ChartPalette {
  /** Axis tick labels & other secondary chart copy */
  textMuted: string;
  /** Legend text, sub-labels, supporting copy */
  textSecondary: string;
  /** Headings inside tooltips, emphasized chart text */
  textPrimary: string;
  /** Disabled/de-emphasized helper text */
  textDisabled: string;
  /** Grid lines */
  grid: string;
  /** Axis lines, separators */
  border: string;
  /** Tooltip background */
  popoverBg: string;
  /** Tooltip body text */
  popoverFg: string;
  /** Cursor band / hover highlight fill */
  mutedBg: string;
  /** Primary data-series accent */
  primary: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
}

const LIGHT_PALETTE: ChartPalette = {
  textPrimary: 'oklch(0.145 0 0)',
  textSecondary: 'oklch(0.371 0 0)',
  textMuted: 'oklch(0.556 0 0)',
  textDisabled: 'oklch(0.65 0 0)',
  grid: 'oklch(0.922 0 0)',
  border: 'oklch(0.922 0 0)',
  popoverBg: 'oklch(1 0 0)',
  popoverFg: 'oklch(0.145 0 0)',
  mutedBg: 'oklch(0.97 0 0)',
  primary: 'oklch(0.205 0 0)',
  chart1: 'oklch(0.646 0.222 41.116)',
  chart2: 'oklch(0.6 0.118 184.704)',
  chart3: 'oklch(0.398 0.07 227.392)',
  chart4: 'oklch(0.828 0.189 84.429)',
  chart5: 'oklch(0.769 0.188 70.08)',
};

const DARK_PALETTE: ChartPalette = {
  textPrimary: 'oklch(0.985 0 0)',
  textSecondary: 'oklch(0.82 0 0)',
  textMuted: 'oklch(0.708 0 0)',
  textDisabled: 'oklch(0.52 0 0)',
  grid: 'oklch(1 0 0 / 10%)',
  border: 'oklch(1 0 0 / 10%)',
  popoverBg: 'oklch(0.205 0 0)',
  popoverFg: 'oklch(0.985 0 0)',
  mutedBg: 'oklch(0.269 0 0)',
  primary: 'oklch(0.922 0 0)',
  chart1: 'oklch(0.488 0.243 264.376)',
  chart2: 'oklch(0.696 0.17 162.48)',
  chart3: 'oklch(0.769 0.188 70.08)',
  chart4: 'oklch(0.627 0.265 303.9)',
  chart5: 'oklch(0.645 0.246 16.439)',
};

/** Pure resolver usable outside React too. */
export function getChartPalette(resolvedTheme?: string | null): ChartPalette {
  return resolvedTheme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
}

export interface ChartTheme extends ChartPalette {
  isDark: boolean;
  /**
   * Ready-made tick style for XAxis/YAxis: merge it with your own props,
   * e.g. `<XAxis tick={{ ...t.axisTick(10), dataKey: 'x' }} />`.
   */
  axisTick: (fontSize?: number) => { fontSize: number; fill: string };
  /** Consistent tooltip chrome shared by all charts. */
  tooltipStyle: {
    borderRadius: string;
    border: string;
    background: string;
    color: string;
    fontSize: string;
  };
  tooltipLabelStyle: CSSProperties;
  tooltipItemStyle: CSSProperties;
}

/**
 * React hook resolving the ACTIVE chart palette from next-themes.
 * All charts must source their colors through this hook (or the global CSS
 * baseline in globals.css) instead of hardcoding colors or using broken
 * `hsl(var(...))` wrappers.
 */
export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme();

  const theme = useMemo<ChartTheme>(() => {
    const palette = getChartPalette(resolvedTheme);
    const isDark = resolvedTheme === 'dark';
    return {
      ...palette,
      isDark,
      axisTick:
        (fontSize = 11) => ({ fontSize, fill: palette.textMuted }),
      tooltipStyle: {
        borderRadius: '8px',
        border: `1px solid ${palette.border}`,
        background: palette.popoverBg,
        color: palette.popoverFg,
        fontSize: '12px',
      },
      tooltipLabelStyle: { color: palette.textSecondary },
      tooltipItemStyle: { color: palette.popoverFg },
    };
  }, [resolvedTheme]);

  return theme;
}
