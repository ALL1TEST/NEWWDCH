'use client';

import React from 'react';
import {
  Activity,
  Gauge,
  HeartPulse,
  Cpu,
  Clock,
  ListTodo,
  ScrollText,
  BellRing,
  Brain,
  HardDrive,
  ShieldAlert,
} from 'lucide-react';
import { PageSubNav } from '@/components/patterns';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { OverviewPage } from './overview-page';
import { HealthPage } from './health-page';
import { PerformancePage } from './performance-page';
import { JobsPage } from './jobs-page';
import { QueuesPage } from './queues-page';
import { AuditLogPage } from './audit-log-page';
import { ErrorLogsPage } from './error-logs-page';
import { SchedulerPage } from './scheduler-page';
import { AlertsPage } from './alerts-page';
import { ApiStatusPage } from './api-status-page';
import { AiMonitoringPage } from './ai-monitoring-page';
import { BackupMonitoringPage } from './backup-monitoring-page';
import { SecurityPage } from './security-page';

// ==================== Sub-Navigation Tabs ====================

const MONITORING_TABS = [
  { key: null, label: 'Overview', icon: Gauge },
  { key: 'health', label: 'Health', icon: HeartPulse },
  { key: 'performance', label: 'Performance', icon: Cpu },
  { key: 'jobs', label: 'Jobs', icon: Clock },
  { key: 'queues', label: 'Queues', icon: ListTodo },
  { key: 'audit-log', label: 'Audit Log', icon: ScrollText },
  { key: 'error-logs', label: 'Error Logs', icon: ScrollText },
  { key: 'scheduler', label: 'Scheduler', icon: Clock },
  { key: 'alerts', label: 'Alerts', icon: BellRing },
  { key: 'api-status', label: 'API Status', icon: Activity },
  { key: 'ai-monitoring', label: 'AI Monitoring', icon: Brain },
  { key: 'backup-monitoring', label: 'Backup Monitoring', icon: HardDrive },
  { key: 'security', label: 'Security', icon: ShieldAlert },
];

// -------------------- Module Router --------------------

export function MonitoringModule() {
  const subPage = useNavigationStore((s) => s.currentSubPage);

  return (
    <>
      <PageSubNav module="monitoring" tabs={MONITORING_TABS} />
      {subPage === 'health' && <HealthPage />}
      {subPage === 'performance' && <PerformancePage />}
      {subPage === 'jobs' && <JobsPage />}
      {subPage === 'queues' && <QueuesPage />}
      {subPage === 'audit-log' && <AuditLogPage />}
      {subPage === 'error-logs' && <ErrorLogsPage />}
      {subPage === 'scheduler' && <SchedulerPage />}
      {subPage === 'alerts' && <AlertsPage />}
      {subPage === 'api-status' && <ApiStatusPage />}
      {subPage === 'ai-monitoring' && <AiMonitoringPage />}
      {subPage === 'backup-monitoring' && <BackupMonitoringPage />}
      {subPage === 'security' && <SecurityPage />}
      {subPage === null && <OverviewPage />}
    </>
  );
}

// Re-export sub-pages for external use
export { OverviewPage } from './overview-page';
export { HealthPage } from './health-page';
export { PerformancePage } from './performance-page';
export { JobsPage } from './jobs-page';
export { QueuesPage } from './queues-page';
export { AuditLogPage } from './audit-log-page';
export { ErrorLogsPage } from './error-logs-page';
export { SchedulerPage } from './scheduler-page';
export { AlertsPage } from './alerts-page';
export { ApiStatusPage } from './api-status-page';
export { AiMonitoringPage } from './ai-monitoring-page';
export { BackupMonitoringPage } from './backup-monitoring-page';
export { SecurityPage } from './security-page';
