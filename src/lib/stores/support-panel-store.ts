'use client';

import { create } from 'zustand';

// -------------------- Types --------------------

interface SupportPanelState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

// ------------------ Support panel store ------------------
//
// Global open/close state for the in-dashboard Help / Support
// side panel — the SAME store pattern as the command palette
// (see command-palette-store.ts). Any dashboard surface (the
// account menu's "Help" action, future topbar buttons, …) can
// open the panel without prop-drilling; the <SupportPanel />
// itself is mounted ONCE in AdminShell next to the command
// palette, so there is exactly one instance of the conversation.
export const useSupportPanelStore = create<SupportPanelState>((set) => ({
  isOpen: false,

  open: () => set({ isOpen: true }),

  close: () => set({ isOpen: false }),

  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
