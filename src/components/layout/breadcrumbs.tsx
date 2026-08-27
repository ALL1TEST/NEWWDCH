'use client';

import React, { useMemo } from 'react';
import {
  LayoutDashboard,
  FileText,
  Image,
  Users,
  Tag,
  MessageSquare,
  Mail,
  Search,
  Navigation as NavigationIcon,
  BarChart3,
  Bell,
  Sparkles,
  Webhook,
  Plug,
  Settings,
  Shield,
  Database,
  Zap,
  Activity,
  MailPlus,
  User,
  CreditCard,
  LayoutGrid,
  Calendar,
  Server,
  type LucideIcon,
} from 'lucide-react';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { useSiteStore } from '@/lib/stores/site-store';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

// -------------------- Icon Map ------------------

const ICON_MAP: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  'all-sites': LayoutGrid,
  content: FileText,
  media: Image,
  users: Users,
  categories: Tag,
  tags: Tag,
  comments: MessageSquare,
  newsletters: Mail,
  seo: Search,
  analytics: BarChart3,
  notifications: Bell,
  ai: Sparkles,
  settings: Settings,
  calendar: Calendar,
  security: Shield,
  backups: Database,
  automation: Zap,
  jobs: Activity,
  'email-templates': MailPlus,
  profile: User,
  billing: CreditCard,
};

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  'all-sites': 'Executive Dashboard',
  content: 'Articles',
  media: 'Media',
  users: 'Users',
  categories: 'Categories',
  tags: 'Tags',
  comments: 'Comments',
  newsletters: 'Newsletters',
  seo: 'SEO',
  analytics: 'Analytics',
  notifications: 'Notifications',
  ai: 'AI',
  settings: 'Settings',
  calendar: 'Calendar',
  security: 'Security',
  backups: 'Backups',
  automation: 'Automation',
  jobs: 'Jobs',
  'email-templates': 'Email Templates',
  profile: 'Profile',
  billing: 'Billing & Subscription',
};

const SUBPAGE_LABELS: Record<string, Record<string, string>> = {
  seo: {
    'audit': 'SEO Audit',
    'settings': 'Settings',
    'search-console': 'Search Console',
    'sitemap': 'Settings',
    'robots': 'Settings',
    'redirects': 'Settings',
    'indexing': 'SEO Audit',
    'broken-links': 'SEO Audit',
    'canonicals': 'SEO Audit',
    'internal-links': 'SEO Audit',
    'schema': 'SEO Audit',
    'social-preview': 'Overview',
  },
  ai: {
    'providers': 'Providers',
    'models': 'Models',
    'prompts': 'Prompt Library',
    'settings': 'Settings',
    // Legacy redirects
    'usage': 'Settings',
    'playground': 'Providers',
    'jobs': 'Providers',
    'logs': 'Providers',
    'marketplace': 'Providers',
  },
  settings: {
    'general': 'General',
    'localization': 'Localization',
    'reading': 'Reading',
    'discussion': 'Discussion',
    'seo': 'SEO',
    'media': 'Media',
    'search': 'Search',
    'email': 'Email (SMTP)',
    'security': 'Security',
    'api': 'API',
    'ai': 'AI',
    'cache': 'Cache',
    'performance': 'Performance',
    'analytics': 'Analytics',
    'search-console': 'Search Console',
    'sitemap': 'Sitemap',
    'robots': 'Robots',
    'backups': 'Backups',
    'scheduler': 'Scheduler',
    'notifications': 'Notifications',
    'maintenance': 'Maintenance',
    'multi-site': 'Multi-Site',
    'import-export': 'Import / Export',
    'advanced': 'Advanced',
    'audit-log': 'Audit Log',
  },
};

// -------------------- Component ------------------

export function Breadcrumbs() {
  const currentModule = useNavigationStore((s) => s.currentModule);
  const currentItemId = useNavigationStore((s) => s.currentItemId);
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  const navigate = useNavigationStore((s) => s.navigate);
  const activeSite = useSiteStore((s) => s.getActiveSite());
  const isAllSites = useSiteStore((s) => s.isAllSites());

  const crumbs = useMemo(() => {
    const items: { label: string; href?: string; icon?: LucideIcon; isCurrent?: boolean }[] = [];

    if (currentModule && currentModule !== 'dashboard') {
      const Icon = ICON_MAP[currentModule];
      items.push({
        label: MODULE_LABELS[currentModule] ?? currentModule,
        href: `#${currentModule}`,
        icon: Icon,
      });

      if (currentSubPage && !currentItemId) {
        const subLabels = SUBPAGE_LABELS[currentModule];
        const subLabel = subLabels?.[currentSubPage]
          ?? (currentSubPage === 'new' || currentSubPage === 'create'
            ? 'Create New'
            : currentSubPage.charAt(0).toUpperCase() + currentSubPage.slice(1));
        items.push({
          label: subLabel,
          isCurrent: true,
        });
      }

      if (currentItemId) {
        items.push({
          label: `#${currentItemId.slice(0, 8)}`,
          isCurrent: !currentSubPage,
        });

        if (currentSubPage) {
          const subLabel =
            currentSubPage === 'edit'
              ? 'Edit'
              : currentSubPage.charAt(0).toUpperCase() + currentSubPage.slice(1);
          items.push({
            label: subLabel,
            isCurrent: true,
          });
        }
      }
    } else {
      items.push({
        label: isAllSites ? 'Executive Dashboard' : 'Dashboard',
        icon: isAllSites ? LayoutGrid : LayoutDashboard,
        isCurrent: true,
      });
    }

    return items;
  }, [currentModule, currentItemId, currentSubPage, isAllSites]);

  // SEO Settings pages (Sitemap, Robots.txt, Redirects) manage their own title
  // and tab bar — hide the global breadcrumb to avoid duplicate navigation.
  // Covers both "settings" and compound keys "settings/sitemap",
  // "settings/robots", "settings/redirects".
  if (currentModule === 'seo' && currentSubPage && (currentSubPage === 'settings' || currentSubPage.startsWith('settings/'))) {
    return null;
  }

  // Backups module — DYNAMIC cumulative breadcrumb trail in the topbar
  // (right after the "All Sites" selector). The trail follows the Backups
  // sub-page/tab order (Overview, Backups, Schedules, Restore, Storage,
  // Logs) and shows every tab from Overview THROUGH the current sub-page,
  // joined by ">" separators — text-only, NO icons.
  //
  //   Overview tab  → NO breadcrumb (root of the trail; topbar keeps just
  //                   the "All Sites" selector)
  //   Backups tab   → Overview > Backups
  //   Schedules tab → Overview > Backups > Schedules
  //   Restore tab   → Overview > Backups > Schedules > Restore
  //   Storage tab   → Overview > Backups > Schedules > Restore > Storage
  //   Logs tab      → Overview > Backups > Schedules > Restore > Storage > Logs
  //
  // The breadcrumb is a PATH display — text-only items (no icons), ">"
  // separators, non-clickable parents (muted) + current/last item
  // (foreground via BreadcrumbPage). The Backups internal tab navigation
  // (BackupsSubNav) stays in the PAGE content (src/modules/backups/
  // index.tsx) — it is NOT rendered here and is NOT duplicated inside the
  // breadcrumb. The trail updates automatically when navigating between
  // Backups sub-pages because it reads `currentSubPage` from the
  // navigation store.
  if (currentModule === 'backups') {
    const BACKUPS_TRAIL: { key: string | null; label: string }[] = [
      { key: null, label: 'Overview' },
      { key: 'backups', label: 'Backups' },
      { key: 'schedules', label: 'Schedules' },
      { key: 'restore', label: 'Restore' },
      { key: 'storage', label: 'Storage' },
      { key: 'logs', label: 'Logs' },
    ];
    const currentIndex = BACKUPS_TRAIL.findIndex(
      (t) => (t.key === null ? !currentSubPage : t.key === currentSubPage),
    );
    // Overview tab (index 0) → no breadcrumb. Unknown state → no breadcrumb.
    if (currentIndex <= 0) {
      return null;
    }
    const trail = BACKUPS_TRAIL.slice(0, currentIndex + 1);
    return (
      <Breadcrumb>
        <BreadcrumbList>
          {trail.map((item, idx) => {
            const isLast = idx === trail.length - 1;
            return (
              <React.Fragment key={item.key ?? 'overview'}>
                {idx > 0 && <BreadcrumbSeparator>{'>'}</BreadcrumbSeparator>}
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  ) : (
                    <span>{item.label}</span>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  // SMTP Settings (settings module) — standalone page with NO internal
  // sub-pages. Render a single "SMTP Settings" breadcrumb in the topbar
  // (with the site prefix), mirroring the other standalone pages
  // (Dashboard, Calendar, Users, Comments). Email Templates and
  // Notifications remain sidebar-only (no topbar breadcrumb) — see
  // SETTINGS_CHILDREN below. Backups keeps its own dynamic trail (above).
  if (currentModule === 'settings') {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          {activeSite && !isAllSites && (
            <>
              <BreadcrumbItem>
                <span className="text-xs text-muted-foreground font-medium">{activeSite.name}</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          {isAllSites && (
            <>
              <BreadcrumbItem>
                <span className="text-xs text-muted-foreground font-medium">All Sites</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          <BreadcrumbItem>
            <span className="flex items-center gap-1">
              <Server className="h-3.5 w-3.5" />
              <BreadcrumbPage>SMTP Settings</BreadcrumbPage>
            </span>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  // Email Templates & Notifications — sidebar is the only navigation,
  // hide the topbar breadcrumb. (The settings/SMTP module is handled by
  // the dedicated branch above and renders an "All Sites > SMTP Settings"
  // trail. Backups renders its own dynamic trail above.) Standalone pages
  // without sub-pages (Dashboard, Calendar, Users, Comments, SMTP Settings)
  // keep ONLY the topbar breadcrumb (no internal one).
  const SETTINGS_CHILDREN = new Set(['email-templates', 'notifications']);
  if (SETTINGS_CHILDREN.has(currentModule)) {
    return null;
  }

  if (crumbs.length <= 1 && crumbs[0]?.isCurrent) {
    // Single item, minimal display
    const item = crumbs[0];
    const Icon = item.icon;
    return (
      <Breadcrumb>
        <BreadcrumbList>
          {activeSite && !isAllSites && (
            <>
              <BreadcrumbItem>
                <span className="flex items-center gap-1 text-muted-foreground">
                  {activeSite.name}
                </span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          {isAllSites && (
            <>
              <BreadcrumbItem>
                <span className="flex items-center gap-1 text-muted-foreground">
                  All Sites
                </span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          <BreadcrumbItem>
            {Icon && <Icon className="h-3.5 w-3.5 mr-1" />}
            <BreadcrumbPage>{item.label}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {/* Site context prefix */}
        {activeSite && !isAllSites && (
          <>
            <BreadcrumbItem>
              <span className="text-xs text-muted-foreground font-medium">{activeSite.name}</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}
        {isAllSites && crumbs.length > 0 && (
          <>
            <BreadcrumbItem>
              <span className="text-xs text-muted-foreground font-medium">All Sites</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;
          const Icon = crumb.icon;

          return (
            <React.Fragment key={idx}>
              {idx > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {isLast || crumb.isCurrent ? (
                  <span className="flex items-center gap-1">
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  </span>
                ) : (
                  <BreadcrumbLink
                    href={crumb.href}
                    onClick={(e) => {
                      e.preventDefault();
                      if (crumb.href) {
                        const mod = crumb.href.replace(/^#/, '').split('/')[0];
                        navigate(mod);
                      }
                    }}
                    className="flex items-center gap-1"
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
