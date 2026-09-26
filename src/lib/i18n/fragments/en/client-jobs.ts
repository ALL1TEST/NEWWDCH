// ============================================================
// i18n — FRAGMENT: Jobs module page (English)
// ============================================================
// Deep page-level strings for the jobs area. Keys follow the
// '<prefix>.<camelCaseName>' convention used by every other
// fragment. Wired by the t() call sites in the module pages.
// en = source of truth; other locales are generated from this
// file (machine-assisted translations with the same fallback
// chain as every other fragment).
// ============================================================

export const clientJobsEn: Record<string, string> = {
  // ---- Page header ----
  'jobs.title': 'Background Jobs',
  'jobs.pageDescription': 'Monitor and manage queued background jobs',

  // ---- Status tabs ----
  'jobs.tabAll': 'All',
  'jobs.tabWaiting': 'Waiting',
  'jobs.tabActive': 'Active',
  'jobs.tabCompleted': 'Completed',
  'jobs.tabFailed': 'Failed',
  'jobs.tabRetrying': 'Retrying',

  // ---- Summary cards ----
  'jobs.total': 'Total',

  // ---- Table columns ----
  'jobs.type': 'Type',
  'jobs.priority': 'Priority',
  'jobs.attempts': 'Attempts',
  'jobs.created': 'Created',
  'jobs.started': 'Started',
  'jobs.completed': 'Completed',
  'jobs.error': 'Error',

  // ---- Table toolbar / empty state ----
  'jobs.searchPlaceholder': 'Search jobs...',
  'jobs.noJobsFound': 'No jobs found.',
};
