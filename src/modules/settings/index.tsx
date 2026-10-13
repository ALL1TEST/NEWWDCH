'use client';

import React from 'react';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { SmtpSettingsPage } from './smtp-settings-page';

// -------------------- Settings Module --------------------
// Client Settings:
//   - SMTP Settings (#settings / #settings/smtp)

export function SettingsModule() {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);
  void currentSubPage;
  return <SmtpSettingsPage />;
}

export { SmtpSettingsPage } from './smtp-settings-page';
