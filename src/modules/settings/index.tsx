'use client';

import React from 'react';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { SettingsPage } from './settings-page';
import { SmtpSettingsPage } from './smtp-settings-page';

// -------------------- Settings Module --------------------
// Settings module has two sub-pages:
//   - #settings/discussion → Discussion (default)
//   - #settings/smtp       → SMTP Settings (Communications)

export function SettingsModule() {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);

  if (currentSubPage === 'smtp') {
    return <SmtpSettingsPage />;
  }

  return <SettingsPage />;
}

export { SettingsPage } from './settings-page';
export { SmtpSettingsPage } from './smtp-settings-page';
