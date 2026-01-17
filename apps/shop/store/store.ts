/**
 * Store Context Store
 * 
 * Manages the global store context state.
 */

import { create } from 'zustand';
import type { StoreContext } from '@/lib/store-context';

interface StoreState {
  /** Full store context from backend */
  context: StoreContext | null;
  /** Whether context has been initialized */
  isInitialized: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error message if initialization failed */
  error: string | null;
}

interface StoreActions {
  /** Set store context */
  setContext: (context: StoreContext | null) => void;
  /** Set initialized state */
  setInitialized: (initialized: boolean) => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Set error */
  setError: (error: string | null) => void;
  /** Clear context */
  clearContext: () => void;
}

/**
 * Store context store - Controls the lifecycle of the store session
 */
export const useStoreStore = create<StoreState & StoreActions>((set) => ({
  // State
  context: null,
  isInitialized: false,
  isLoading: false,
  error: null,

  // Actions
  setContext: (context) => set({ context, isInitialized: true }),
  setInitialized: (initialized) => set({ isInitialized: initialized }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  clearContext: () => set({ context: null, isInitialized: false, error: null }),
}));

// Selector helpers
export const useStoreContext = () => useStoreStore((state) => state.context);
export const useStoreId = () => useStoreStore((state) => state.context?.storeId);
export const useStoreName = () => useStoreStore((state) => state.context?.storeName);

