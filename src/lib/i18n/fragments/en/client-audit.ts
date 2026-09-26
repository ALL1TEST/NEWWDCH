// ============================================================
// i18n — FRAGMENT: Audit module page (English)
// ============================================================
// Deep page-level strings for the audit area. Keys follow the
// '<prefix>.<camelCaseName>' convention used by every other
// fragment. Wired by the t() call sites in the module pages.
// en = source of truth; other locales are generated from this
// file (machine-assisted translations with the same fallback
// chain as every other fragment).
// ============================================================

export const clientAuditEn: Record<string, string> = {
  // ---- Page header ----
  'audit.title': 'Audit Logs',
  'audit.pageDescription': 'Track all actions and changes across the system',
  'audit.export': 'Export',

  // ---- Table columns ----
  'audit.timestamp': 'Timestamp',
  'audit.user': 'User',
  'audit.action': 'Action',
  'audit.resourceType': 'Resource Type',
  'audit.resourceId': 'Resource ID',
  'audit.ipAddress': 'IP Address',
  'audit.details': 'Details',
  'audit.viewJson': 'View JSON',
  'audit.systemUser': 'System',

  // ---- Filters ----
  'audit.filterByAction': 'Filter by action...',
  'audit.allUsers': 'All Users',
  'audit.allResources': 'All Resources',
  'audit.fromDate': 'From date',
  'audit.toDate': 'To date',

  // ---- Table toolbar / empty state ----
  'audit.searchPlaceholder': 'Search audit logs...',
  'audit.noLogsFound': 'No audit logs found.',
};
