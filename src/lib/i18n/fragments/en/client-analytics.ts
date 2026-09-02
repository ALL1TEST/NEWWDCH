// ============================================================
// i18n — FRAGMENT: Analytics module page (English)
// ============================================================
// Deep page-level strings for the analytics area. Keys follow the
// '<prefix>.<camelCaseName>' convention used by every other
// fragment. Wired by the t() call sites in the module pages.
// en = source of truth; other locales are generated from this
// file (machine-assisted translations with the same fallback
// chain as every other fragment).
// ============================================================

export const clientAnalyticsEn: Record<string, string> = {
  // ---- Page header ----
  'analytics.title': 'Analytics',
  'analytics.pageDescription': 'Track content performance and visitor engagement',

  // ---- Date range presets ----
  'analytics.presetToday': 'Today',
  'analytics.preset7d': 'Last 7 Days',
  'analytics.preset30d': 'Last 30 Days',
  'analytics.preset90d': 'Last 90 Days',
  'analytics.presetCustom': 'Custom',

  // ---- Summary stat cards ----
  'analytics.totalPageViews': 'Total Page Views',
  'analytics.uniqueVisitors': 'Unique Visitors',
  'analytics.avgTimeOnPage': 'Avg Time on Page',
  'analytics.bounceRate': 'Bounce Rate',

  // ---- Charts ----
  'analytics.contentPerformance': 'Content Performance',
  'analytics.noContentData': 'No content data available.',
  'analytics.contentStatus': 'Content Status',
  'analytics.noDataAvailable': 'No data available.',

  // ---- Traffic sources placeholder ----
  'analytics.trafficSources': 'Traffic Sources',
  'analytics.trafficSourcesDescription':
    'Traffic source data requires integration with an external analytics service.',
  'analytics.trafficSourcesHint':
    'Connect Google Analytics or Plausible for detailed traffic data.',

  // ---- Recent activity timeline ----
  'analytics.recentActivity': 'Recent Activity',
  'analytics.noRecentActivity': 'No recent activity.',
  'analytics.byPrefix': 'by ',
  'analytics.systemUser': 'System',
};
