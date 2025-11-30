/**
 * Mall Context Store
 * 
 * Manages mall context state including tenant and agent information.
 * Used for Agent Mall scenarios where API calls need agentId.
 */

import { create } from 'zustand';
import type { MallContext } from '@/lib/mall-context';

interface MallState {
  /** Full mall context from backend */
  context: MallContext | null;
  /** Whether context has been initialized */
  isInitialized: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error message if initialization failed */
  error: string | null;
}

interface MallActions {
  /** Set mall context */
  setContext: (context: MallContext | null) => void;
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
 * Mall context store - NOT persisted to avoid cross-tenant/agent data leakage
 */
export const useMallStore = create<MallState & MallActions>((set) => ({
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

// Selector helpers for common use cases
export const useMallContext = () => useMallStore((state) => state.context);
export const useAgentId = () => useMallStore((state) => state.context?.agentId);
export const useIsAgentMall = () => useMallStore((state) => state.context?.isAgentMall ?? false);
export const useTenantId = () => useMallStore((state) => state.context?.tenantId);

