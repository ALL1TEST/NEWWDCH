'use client';

import { useNavigationStore } from '@/lib/stores/navigation-store';
import { Database, Clock, RotateCcw, HardDrive, ScrollText, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

// -------------------- Backups Internal Navigation --------------------
// Rendered in the topbar (next to the "All Sites" selector) when
// currentModule === 'backups' — see src/components/layout/topbar.tsx.
// The Backups section is the only module whose internal sub-pages/tabs
// (Overview, Backups, Schedules, Restore, Storage, Logs) live in the
// topbar; other modules use the sidebar + topbar breadcrumb pattern.
//
// The tab buttons (labels, icons, active/inactive styling, click handlers)
// are IDENTICAL to the previous in-page BackupsSubNav — only the position
// changed (moved from above the page content into the top header). The
// outer wrapper classes were trimmed (`mb-6 -mx-1 px-1 pb-1` removed —
// those were in-page layout offsets; the topbar provides vertical centering
// via its `flex items-center` and the parent's `flex-1 overflow-hidden`).

const BACKUPS_TABS = [
  { key: null, label: 'Overview', icon: LayoutDashboard },
  { key: 'backups', label: 'Backups', icon: Database },
  { key: 'schedules', label: 'Schedules', icon: Clock },
  { key: 'restore', label: 'Restore', icon: RotateCcw },
  { key: 'storage', label: 'Storage', icon: HardDrive },
  { key: 'logs', label: 'Logs', icon: ScrollText },
] as const;

export function BackupsSubNav() {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const navigate = useNavigationStore((s) => s.navigate);

  return (
    <nav aria-label="Backups sections" className="overflow-x-auto min-w-0 h-full flex items-center">
      <div className="flex items-center gap-1 min-w-max">
        {BACKUPS_TABS.map((tab) => {
          const isActive = tab.key === null
            ? !currentSubPage
            : currentSubPage === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key ?? 'overview'}
              onClick={() => navigate('backups', null, tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
