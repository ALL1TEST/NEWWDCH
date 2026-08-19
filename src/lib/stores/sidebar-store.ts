'use client';

import { create } from 'zustand';

// -------------------- Types --------------------

interface SidebarState {
  isCollapsed: boolean;
  isMobileOpen: boolean;

  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleMobile: () => void;
  closeMobile: () => void;
}

// -------------------- Helpers --------------------

const COLLAPSE_BREAKPOINT = 1024;

function getInitialCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < COLLAPSE_BREAKPOINT;
}

// -------------------- Store --------------------

export const useSidebarStore = create<SidebarState>((set) => ({
  isCollapsed: getInitialCollapsed(),
  isMobileOpen: false,

  toggle: () => set((s) => ({ isCollapsed: !s.isCollapsed })),

  setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),

  toggleMobile: () => set((s) => ({ isMobileOpen: !s.isMobileOpen })),

  closeMobile: () => set({ isMobileOpen: false }),
}));

// -------------------- Responsive Listener --------------------

if (typeof window !== 'undefined') {
  const mql = window.matchMedia(`(max-width: ${COLLAPSE_BREAKPOINT - 1}px)`);
  mql.addEventListener('change', (e) => {
    useSidebarStore.setState({ isCollapsed: e.matches });
  });
}
