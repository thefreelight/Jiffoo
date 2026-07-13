'use client';

import { ReactNode, createContext, useContext, useMemo } from 'react';
import type { CommercialPackageProjection, CommercialPackageReadiness, ManagedPackageStatusResponse } from 'shared';
import { useActivateManagedPackage, useManagedPackageStatus } from '@/lib/hooks/use-api';

export type ManagedPackageDefinition = CommercialPackageProjection;

interface ManagedModeContextValue {
  status: ManagedPackageStatusResponse | null;
  record: ManagedPackageDefinition | null;
  readiness: CommercialPackageReadiness | null;
  isManaged: boolean;
  isSuspended: boolean;
  isLoading: boolean;
  activatePackage: (code: string) => Promise<ManagedPackageStatusResponse>;
}

const ManagedModeContext = createContext<ManagedModeContextValue | null>(null);

export function ManagedModeProvider({ children }: { children: ReactNode }) {
  const statusQuery = useManagedPackageStatus();
  const activateMutation = useActivateManagedPackage();

  const value = useMemo<ManagedModeContextValue>(() => ({
    status: statusQuery.data ?? null,
    record: statusQuery.data?.package ?? null,
    readiness: statusQuery.data?.readiness ?? null,
    isManaged: statusQuery.data?.mode === 'managed' && Boolean(statusQuery.data.package),
    isSuspended: statusQuery.data?.package?.status === 'SUSPENDED',
    isLoading: statusQuery.isLoading || activateMutation.isPending,
    activatePackage: async (code: string) => activateMutation.mutateAsync(code),
  }), [activateMutation, statusQuery.data, statusQuery.isLoading]);

  return <ManagedModeContext.Provider value={value}>{children}</ManagedModeContext.Provider>;
}

export function useManagedMode() {
  const context = useContext(ManagedModeContext);
  if (!context) {
    throw new Error('useManagedMode must be used within ManagedModeProvider');
  }
  return context;
}
