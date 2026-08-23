'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Settings,
  Shield,
  Database,
  Activity,
  Key,
  Upload,
  Plus,
  Clock,
  RotateCcw,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { useCommandPaletteStore } from '@/lib/stores/command-palette-store';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { cn } from '@/lib/utils';

// -------------------- Types --------------------

interface CommandItemDef {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  module: string;
  subPage?: string;
}

interface CommandGroupDef {
  heading: string;
  items: CommandItemDef[];
}

// -------------------- Navigation Items --------------------

const NAV_ITEMS: CommandItemDef[] = [
  { id: 'nav-dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'G D', module: 'dashboard' },
  { id: 'nav-content', label: 'Content', icon: FileText, shortcut: 'G C', module: 'content' },
  { id: 'nav-media', label: 'Media', icon: Image, shortcut: 'G M', module: 'media' },
  { id: 'nav-users', label: 'Users', icon: Users, shortcut: 'G U', module: 'users' },
  { id: 'nav-categories', label: 'Categories', icon: Tag, module: 'categories' },
  { id: 'nav-tags', label: 'Tags', icon: Tag, module: 'tags' },
  { id: 'nav-comments', label: 'Comments', icon: MessageSquare, module: 'comments' },
  { id: 'nav-newsletters', label: 'Newsletters', icon: Mail, module: 'newsletters' },
  { id: 'nav-seo', label: 'SEO', icon: Search, module: 'seo' },
  { id: 'nav-analytics', label: 'Analytics', icon: BarChart3, module: 'analytics' },
  { id: 'nav-notifications', label: 'Notifications', icon: Bell, module: 'notifications' },
  { id: 'nav-ai', label: 'AI', icon: Sparkles, module: 'ai' },
  { id: 'nav-ai-providers', label: 'AI Providers', icon: Settings, module: 'ai', subPage: 'providers' },
  { id: 'nav-ai-prompts', label: 'Prompt Library', icon: FileText, module: 'ai', subPage: 'prompts' },
  { id: 'nav-ai-playground', label: 'AI Playground', icon: Sparkles, module: 'ai', subPage: 'playground' },
  { id: 'nav-ai-jobs', label: 'AI Jobs', icon: Clock, module: 'ai', subPage: 'jobs' },
  { id: 'nav-backups', label: 'Backups Dashboard', icon: Database, module: 'backups' },
  { id: 'nav-backups-list', label: 'Backups List', icon: Database, module: 'backups', subPage: 'backups' },
  { id: 'nav-backups-schedules', label: 'Backup Schedules', icon: Clock, module: 'backups', subPage: 'schedules' },
  { id: 'nav-backups-restore', label: 'Restore Backup', icon: RotateCcw, module: 'backups', subPage: 'restore' },
  { id: 'nav-backups-storage', label: 'Backup Storage', icon: Database, module: 'backups', subPage: 'storage' },
  { id: 'nav-backups-logs', label: 'Backup Logs', icon: ScrollText, module: 'backups', subPage: 'logs' },
  { id: 'nav-backups-settings', label: 'Backup Settings', icon: Settings, module: 'backups', subPage: 'settings' },
  { id: 'nav-settings', label: 'Settings — General', icon: Settings, module: 'settings', subPage: 'general' },
  { id: 'nav-settings-localization', label: 'Settings — Localization', icon: Settings, module: 'settings', subPage: 'localization' },
  { id: 'nav-settings-reading', label: 'Settings — Reading', icon: Settings, module: 'settings', subPage: 'reading' },
  { id: 'nav-settings-seo', label: 'Settings — SEO', icon: Settings, module: 'settings', subPage: 'seo' },
  { id: 'nav-settings-media', label: 'Settings — Media', icon: Settings, module: 'settings', subPage: 'media' },
  { id: 'nav-settings-email', label: 'Settings — Email (SMTP)', icon: Settings, module: 'settings', subPage: 'email' },
  { id: 'nav-settings-security', label: 'Settings — Security', icon: Settings, module: 'settings', subPage: 'security' },
  { id: 'nav-settings-api', label: 'Settings — API', icon: Settings, module: 'settings', subPage: 'api' },
  { id: 'nav-settings-ai', label: 'Settings — AI', icon: Settings, module: 'settings', subPage: 'ai' },
  { id: 'nav-settings-cache', label: 'Settings — Cache', icon: Settings, module: 'settings', subPage: 'cache' },
  { id: 'nav-settings-performance', label: 'Settings — Performance', icon: Settings, module: 'settings', subPage: 'performance' },
  { id: 'nav-settings-notifications', label: 'Settings — Notifications', icon: Settings, module: 'settings', subPage: 'notifications' },
  { id: 'nav-settings-maintenance', label: 'Settings — Maintenance', icon: Settings, module: 'settings', subPage: 'maintenance' },
  { id: 'nav-settings-advanced', label: 'Settings — Advanced', icon: Settings, module: 'settings', subPage: 'advanced' },
  { id: 'nav-settings-audit', label: 'Settings — Audit Log', icon: Settings, module: 'settings', subPage: 'audit-log' },
  { id: 'nav-settings-import', label: 'Settings — Import/Export', icon: Settings, module: 'settings', subPage: 'import-export' },
  { id: 'nav-security', label: 'Security', icon: Shield, module: 'security' },
  { id: 'nav-jobs', label: 'Jobs', icon: Activity, module: 'jobs' },
];

const ACTION_ITEMS: CommandItemDef[] = [
  { id: 'act-create-content', label: 'Create Content', icon: Plus, shortcut: 'N', module: 'content', subPage: 'create' },
  { id: 'act-upload-media', label: 'Upload Media', icon: Upload, module: 'media' },
  { id: 'act-create-user', label: 'Create User', icon: Plus, module: 'users', subPage: 'create' },
  { id: 'act-create-category', label: 'Create Category', icon: Plus, module: 'categories', subPage: 'create' },
  { id: 'act-create-tag', label: 'Create Tag', icon: Plus, module: 'tags', subPage: 'create' },
];

// -------------------- Recent Items (in-memory) --------------------

let recentItems: CommandItemDef[] = [];
const MAX_RECENT = 5;

function addRecent(item: CommandItemDef) {
  recentItems = [item, ...recentItems.filter((r) => r.id !== item.id)].slice(0, MAX_RECENT);
}

// -------------------- Component --------------------

export function CommandPalette() {
  const isOpen = useCommandPaletteStore((s) => s.isOpen);
  const close = useCommandPaletteStore((s) => s.close);
  const navigate = useNavigationStore((s) => s.navigate);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard listener for Cmd/Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        useCommandPaletteStore.getState().toggle();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelect = useCallback(
    (item: CommandItemDef) => {
      navigate(item.module, null, item.subPage);
      addRecent(item);
      close();
    },
    [navigate, close],
  );

  const groups: CommandGroupDef[] = useMemo(() => {
    const result: CommandGroupDef[] = [];

    if (recentItems.length > 0) {
      result.push({ heading: 'Recent', items: recentItems });
    }

    result.push({ heading: 'Navigation', items: NAV_ITEMS });
    result.push({ heading: 'Actions', items: ACTION_ITEMS });

    return result;
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cmd-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={close}
          />
          {/* Palette */}
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] pointer-events-none">
            <motion.div
              key="cmd-palette"
              initial={{ opacity: 0, scale: 0.96, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="pointer-events-auto w-full max-w-[640px] max-h-[480px] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl"
            >
              <Command className="rounded-lg" shouldFilter={true}>
                <div className="flex items-center border-b px-3">
                  <Search className="h-4 w-4 shrink-0 opacity-50 mr-2" />
                  <CommandInput
                    ref={inputRef}
                    placeholder="Type a command or search..."
                    className="h-12 text-sm"
                    autoFocus
                  />
                </div>
                <CommandList className="max-h-[380px]">
                  <CommandEmpty>No results found.</CommandEmpty>
                  {groups.map((group, groupIdx) => (
                    <React.Fragment key={group.heading}>
                      {groupIdx > 0 && <CommandSeparator />}
                      <CommandGroup heading={group.heading}>
                        {group.items.map((item) => (
                          <CommandItem
                            key={item.id}
                            value={`${item.label} ${item.module}`}
                            onSelect={() => handleSelect(item)}
                            className="cursor-pointer"
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.label}</span>
                            {item.shortcut && (
                              <CommandShortcut>{item.shortcut}</CommandShortcut>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </React.Fragment>
                  ))}
                </CommandList>
              </Command>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
