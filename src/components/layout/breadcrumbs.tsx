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

// -------------------- Text-Only Trail Helper --------------------
// Renders a cumulative text-only breadcrumb trail with ">" separators
// (NO module icons, NO chevron-separator icons). Used by the dynamic
// cumulative-trail modules (Backups, SEO, AI, Automation, Newsletter)
// and the Content (Articles) branch.
//
// items: [{ label, isCurrent }]. The last item (or any marked isCurrent)
// is rendered as BreadcrumbPage (foreground); others as plain spans.
// If withSitePrefix, prepend "All Sites" (or the active site name) + ">"
// before the trail (used by the Content list/detail/edit pages).
function TextOnlyTrail({
  items,
  activeSite,
  isAllSites,
  withSitePrefix = false,
}: {
  items: { label: string; isCurrent?: boolean }[];
  activeSite?: { name: string } | null;
  isAllSites: boolean;
  withSitePrefix?: boolean;
}) {
  const filtered = items.filter((i) => i && i.label);
  if (filtered.length === 0) return null;
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {withSitePrefix && activeSite && !isAllSites && (
          <>
            <BreadcrumbItem>
              <span className="text-xs text-muted-foreground font-medium">{activeSite.name}</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator>{'>'}</BreadcrumbSeparator>
          </>
        )}
        {withSitePrefix && isAllSites && (
          <>
            <BreadcrumbItem>
              <span className="text-xs text-muted-foreground font-medium">All Sites</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator>{'>'}</BreadcrumbSeparator>
          </>
        )}
        {filtered.map((item, idx) => {
          const isLast = idx === filtered.length - 1;
          return (
            <React.Fragment key={idx}>
              {idx > 0 && <BreadcrumbSeparator>{'>'}</BreadcrumbSeparator>}
              <BreadcrumbItem>
                {isLast || item.isCurrent ? (
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

  // SEO module — DYNAMIC cumulative text-only trail (no icons, no "All Sites"):
  //   Overview (root)        → (no breadcrumb)
  //   audit                   → Overview > SEO Audit
  //   search-console          → Overview > SEO Audit > Search Console
  //   settings                → Overview > SEO Audit > Search Console > Settings
  //   settings/sitemap        → … > Settings > Sitemap
  //   settings/robots         → … > Sitemap > Robots
  //   settings/redirects      → … > Robots > Redirects
  // Legacy sub-pages (indexing/canonicals/internal-links/schema → audit,
  // social-preview → overview, sitemap/robots/redirects → settings/X) are
  // canonicalized by the SEO module router; mapped here as a safety net.
  if (currentModule === 'seo') {
    const SEO_TRAIL: { key: string | null; label: string }[] = [
      { key: null, label: 'Overview' },
      { key: 'audit', label: 'SEO Audit' },
      { key: 'search-console', label: 'Search Console' },
      { key: 'settings', label: 'Settings' },
      { key: 'settings/sitemap', label: 'Sitemap' },
      { key: 'settings/robots', label: 'Robots' },
      { key: 'settings/redirects', label: 'Redirects' },
    ];
    const SEO_LEGACY: Record<string, string | null> = {
      indexing: 'audit', canonicals: 'audit', 'internal-links': 'audit',
      schema: 'audit', 'social-preview': null,
      sitemap: 'settings/sitemap', robots: 'settings/robots', redirects: 'settings/redirects',
    };
    const eff = currentSubPage && SEO_LEGACY[currentSubPage] !== undefined
      ? SEO_LEGACY[currentSubPage]
      : currentSubPage;
    const currentIndex = SEO_TRAIL.findIndex(
      (t) => (t.key === null ? !eff : t.key === eff),
    );
    if (currentIndex <= 0) return null; // Overview/root → no breadcrumb
    const trail = SEO_TRAIL.slice(0, currentIndex + 1).map((t, i) => ({
      label: t.label,
      isCurrent: i === currentIndex,
    }));
    return <TextOnlyTrail items={trail} activeSite={activeSite} isAllSites={isAllSites} />;
  }

  // AI module — cumulative text-only trail (no icons, no "All Sites"):
  //   AI (providers/root)     → (no breadcrumb)
  //   models                  → AI > Models
  //   prompts                 → AI > Models > Prompt Library
  //   settings                → AI > Models > Prompt Library > Settings
  // Legacy: playground/jobs/logs/marketplace → providers (root), usage → settings.
  if (currentModule === 'ai') {
    const AI_TRAIL: { key: string | null; label: string }[] = [
      { key: null, label: 'AI' },
      { key: 'models', label: 'Models' },
      { key: 'prompts', label: 'Prompt Library' },
      { key: 'settings', label: 'Settings' },
    ];
    const AI_LEGACY: Record<string, string | null> = {
      providers: null, playground: null, jobs: null, logs: null, marketplace: null,
      usage: 'settings',
    };
    const eff = currentSubPage && AI_LEGACY[currentSubPage] !== undefined
      ? AI_LEGACY[currentSubPage]
      : currentSubPage;
    const currentIndex = AI_TRAIL.findIndex(
      (t) => (t.key === null ? !eff : t.key === eff),
    );
    if (currentIndex <= 0) return null;
    const trail = AI_TRAIL.slice(0, currentIndex + 1).map((t, i) => ({
      label: t.label,
      isCurrent: i === currentIndex,
    }));
    return <TextOnlyTrail items={trail} activeSite={activeSite} isAllSites={isAllSites} />;
  }

  // Automation module — cumulative text-only trail (no icons, no "All Sites"):
  //   Automation (list/root)  → (no breadcrumb)
  //   runs                    → Automation > Runs
  //   create (incl. edit/generate) → Automation > Runs > Create New
  if (currentModule === 'automation') {
    const AUTO_TRAIL: { key: string | null; label: string }[] = [
      { key: null, label: 'Automation' },
      { key: 'runs', label: 'Runs' },
      { key: 'create', label: 'Create New' },
    ];
    const eff = currentSubPage === 'edit' || currentSubPage === 'generate'
      ? 'create'
      : currentSubPage;
    const currentIndex = AUTO_TRAIL.findIndex(
      (t) => (t.key === null ? !eff : t.key === eff),
    );
    if (currentIndex <= 0) return null;
    const trail = AUTO_TRAIL.slice(0, currentIndex + 1).map((t, i) => ({
      label: t.label,
      isCurrent: i === currentIndex,
    }));
    return <TextOnlyTrail items={trail} activeSite={activeSite} isAllSites={isAllSites} />;
  }

  // Newsletter module — cumulative text-only trail (no icons, no "All Sites"):
  //   Newsletter (root)       → (no breadcrumb)
  //   subscribers             → Newsletter > Subscribers
  //   campaigns               → Newsletter > Subscribers > Campaigns
  if (currentModule === 'newsletter') {
    const NEWS_TRAIL: { key: string | null; label: string }[] = [
      { key: null, label: 'Newsletter' },
      { key: 'subscribers', label: 'Subscribers' },
      { key: 'campaigns', label: 'Campaigns' },
    ];
    const currentIndex = NEWS_TRAIL.findIndex(
      (t) => (t.key === null ? !currentSubPage : t.key === currentSubPage),
    );
    if (currentIndex <= 0) return null;
    const trail = NEWS_TRAIL.slice(0, currentIndex + 1).map((t, i) => ({
      label: t.label,
      isCurrent: i === currentIndex,
    }));
    return <TextOnlyTrail items={trail} activeSite={activeSite} isAllSites={isAllSites} />;
  }

  // Content (Articles) module — text-only breadcrumbs (no module icon,
  // ">" separators). List/detail/edit keep the "All Sites" prefix; the
  // Create sub-page drops it per spec ("Articles > Create New").
  if (currentModule === 'content') {
    // Create sub-page: "Articles > Create New" (no All Sites, no icons)
    if (!currentItemId && (currentSubPage === 'new' || currentSubPage === 'create')) {
      return (
        <TextOnlyTrail
          items={[
            { label: 'Articles' },
            { label: 'Create New', isCurrent: true },
          ]}
          activeSite={activeSite}
          isAllSites={isAllSites}
          withSitePrefix={false}
        />
      );
    }
    // List / Detail / Edit — keep "All Sites" prefix, text-only
    const items: { label: string; isCurrent?: boolean }[] = [{ label: 'Articles' }];
    if (currentItemId) {
      items.push({ label: `#${currentItemId.slice(0, 8)}` });
      if (currentSubPage === 'edit') {
        items.push({ label: 'Edit' });
      }
    }
    items[items.length - 1].isCurrent = true;
    return (
      <TextOnlyTrail
        items={items}
        activeSite={activeSite}
        isAllSites={isAllSites}
        withSitePrefix
      />
    );
  }

  // Modules that should NOT render a topbar breadcrumb — the topbar keeps
  // ONLY the "All Sites" selector for these (no breadcrumb path next to it):
  //   - Standalone pages with no sub-pages & no hierarchy to show:
  //     Dashboard, Calendar, Users, Comments, SMTP Settings (settings module),
  //     Media.
  //     (currentModule is null/undefined on initial load → treated as Dashboard.)
  //   - Settings-grouped sidebar-only modules: Email Templates, Notifications
  //     (the sidebar is their only navigation).
  // Backups, SEO, AI, Automation, Newsletter, Content keep their own dynamic
  // trails (the branches above) and are excluded here.
  const NO_BREADCRUMB_MODULES = new Set([
    'dashboard', 'calendar', 'users', 'comments', 'settings', 'media',
    'email-templates', 'notifications',
  ]);
  if (!currentModule || NO_BREADCRUMB_MODULES.has(currentModule)) {
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
