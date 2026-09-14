/**
 * Jobs Admin Capability Hook
 *
 * Detects whether this instance's Core Worker exposes the RemoteRadar jobs
 * admin proxy (configured JOBS_SERVICE binding). Drives the conditional
 * `Job Sources` sidebar entry and the remoteradar-jobs workspace fallback so
 * generic Jiffoo instances do not surface RemoteRadar-specific navigation.
 *
 * Results are cached in localStorage for five minutes to avoid probing on
 * every layout render.
 */

'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import {
  probeJobsAdminCapability,
  readCachedJobsAdminCapability,
} from '@/lib/jobs-admin-capability';

export function useJobsAdminCapability(): boolean {
  const [available, setAvailable] = useState<boolean>(() => readCachedJobsAdminCapability() ?? true);

  useEffect(() => {
    if (readCachedJobsAdminCapability() !== null) return;
    let cancelled = false;
    void probeJobsAdminCapability(() => apiClient.get('/admin/plugins/remoteradar-jobs/connectors')).then((result) => {
      if (!cancelled) setAvailable(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return available;
}
