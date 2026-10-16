'use client';

import { create } from 'zustand';

type CartUI = {
  open: boolean;
  lastAdded: string | null;
  count: number | null;
  setOpen: (open: boolean) => void;
  added: (name: string, count: number) => void;
  setCount: (count: number) => void;
};

export const useCartUI = create<CartUI>((set) => ({
  open: false, lastAdded: null, count: null,
  setOpen: (open) => set({ open, ...(!open ? { lastAdded: null } : {}) }),
  added: (lastAdded, count) => set({ open: true, lastAdded, count }),
  setCount: (count) => set({ count }),
}));
