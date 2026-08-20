'use client';

import React from 'react';
import { SettingsPage } from './settings-page';

// -------------------- Settings Module --------------------
// Simplified: only Discussion settings (no PageSubNav, no multi-tab navigation).
// The sidebar is the only navigation — Settings → Discussion.

export function SettingsModule() {
  return <SettingsPage />;
}

export { SettingsPage } from './settings-page';
