'use client';

import React from 'react';
import {
  Globe,
  BookOpen,
  MessageSquare,
  Search,
  ImageIcon,
  Mail,
  Shield,
  Key,
  Sparkles,
  Database,
  Gauge,
  AlertTriangle,
  Layers,
  Upload,
  Settings,
} from 'lucide-react';
import { PageSubNav } from '@/components/patterns';
import { SettingsPage } from './settings-page';

// ==================== Sub-Navigation Tabs ====================

const SETTINGS_TABS = [
  { key: 'general', label: 'General', icon: Globe },
  { key: 'localization', label: 'Localization', icon: Globe },
  { key: 'reading', label: 'Reading', icon: BookOpen },
  { key: 'discussion', label: 'Discussion', icon: MessageSquare },
  { key: 'seo', label: 'SEO', icon: Search },
  { key: 'media', label: 'Media', icon: ImageIcon },
  { key: 'search', label: 'Search', icon: Search },
  { key: 'email', label: 'Email (SMTP)', icon: Mail },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'api', label: 'API Configuration', icon: Key },
  { key: 'ai', label: 'AI', icon: Sparkles },
  { key: 'cache', label: 'Cache', icon: Database },
  { key: 'performance', label: 'Performance', icon: Gauge },
  { key: 'maintenance', label: 'Maintenance', icon: AlertTriangle },
  { key: 'multi-site', label: 'Multi-Site', icon: Layers },
  { key: 'import-export', label: 'Import / Export', icon: Upload },
  { key: 'advanced', label: 'Advanced', icon: Settings },
];

export function SettingsModule() {
  return (
    <>
      <PageSubNav module="settings" tabs={SETTINGS_TABS} />
      <SettingsPage />
    </>
  );
}

export { SettingsPage } from './settings-page';
