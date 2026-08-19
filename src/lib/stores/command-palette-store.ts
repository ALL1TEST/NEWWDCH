'use client';

import { create } from 'zustand';

// -------------------- Types --------------------

interface CommandPaletteState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

// -------------------- Store --------------------

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  isOpen: false,

  open: () => set({ isOpen: true }),

  close: () => set({ isOpen: false }),

  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
