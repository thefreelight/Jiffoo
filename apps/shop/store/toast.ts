/**
 * Toast Store
 * 
 * Global toast notification management using Zustand
 */

import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastState {
  toasts: ToastItem[];
}

interface ToastActions {
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  // Convenience methods
  success: (message: string, title?: string) => string;
  error: (message: string, title?: string) => string;
  info: (message: string, title?: string) => string;
  warning: (message: string, title?: string) => string;
}

let toastId = 0;

export const useToastStore = create<ToastState & ToastActions>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${++toastId}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearToasts: () => {
    set({ toasts: [] });
  },

  success: (message, title) => {
    return get().addToast({ type: 'success', message, title, duration: 4000 });
  },

  error: (message, title) => {
    return get().addToast({ type: 'error', message, title, duration: 6000 });
  },

  info: (message, title) => {
    return get().addToast({ type: 'info', message, title, duration: 4000 });
  },

  warning: (message, title) => {
    return get().addToast({ type: 'warning', message, title, duration: 5000 });
  },
}));

// Helper function to use toast outside of React components
export const toast = {
  success: (message: string, title?: string) => useToastStore.getState().success(message, title),
  error: (message: string, title?: string) => useToastStore.getState().error(message, title),
  info: (message: string, title?: string) => useToastStore.getState().info(message, title),
  warning: (message: string, title?: string) => useToastStore.getState().warning(message, title),
};

