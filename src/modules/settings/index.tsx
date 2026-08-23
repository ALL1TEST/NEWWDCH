'use client';

import React from 'react';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { SmtpSettingsPage } from './smtp-settings-page';

// -------------------- Settings Module --------------------
// Discussion settings have been removed.
// Its settings have been distributed:
//   - Enable Comments, Auto Spam Detection, Spam Provider → Comments module (inline card)
//   - Comment Notifications → Notifications module (header toggle)
//
// SMTP Settings is the only remaining settings sub-page.

export function SettingsModule() {
  const currentSubPage = useNavigationStore((s) => s.currentSubPage);

  // Render SMTP Settings for both #settings and #settings/smtp.
  void currentSubPage;
  return <SmtpSettingsPage />;
}

export { SmtpSettingsPage } from './smtp-settings-page';
