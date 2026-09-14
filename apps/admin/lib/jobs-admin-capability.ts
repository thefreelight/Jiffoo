/**
 * Capability detection for the RemoteRadar jobs administration surface.
 *
 * The `jobSources` navigation entry and the remoteradar-jobs workspace are only
 * meaningful on instances whose Core Worker is wired to the RemoteRadar jobs
 * service through the dedicated admin proxy. Cloudflare-native instances that
 * have no `JOBS_SERVICE` binding answer the proxy with HTTP 503 and the
 * `JOBS_PLUGIN_UNAVAILABLE` envelope; the shared API client surfaces that as
 * `{ success: false, error: { code: 'JOBS_PLUGIN_UNAVAILABLE' } }`. Other 503
 * codes (e.g. a missing admin token) still count as configured: the instance
 * intended to offer the panel, and the panel itself can explain the gap.
 */

const JOBS_ADMIN_CAPABILITY_CACHE_KEY = 'jiffoo_admin_jobs_capability';
const JOBS_ADMIN_UNAVAILABLE_CODE = 'JOBS_PLUGIN_UNAVAILABLE';
const CAPABILITY_CACHE_TTL_MS = 5 * 60 * 1000;

export interface JobsAdminEnvelope {
  success?: boolean;
  error?: { code?: string } | string;
  message?: string;
}

interface CachedCapability {
  timestamp: number;
  available: boolean;
}

export function readCachedJobsAdminCapability(): boolean | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(JOBS_ADMIN_CAPABILITY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCapability;
    if (typeof parsed?.available !== 'boolean' || typeof parsed?.timestamp !== 'number') return null;
    if (Date.now() - parsed.timestamp > CAPABILITY_CACHE_TTL_MS) return null;
    return parsed.available;
  } catch {
    // Ignore storage access or parsing failures.
    return null;
  }
}

export function writeCachedJobsAdminCapability(available: boolean): void {
  if (typeof window === 'undefined') return;

  try {
    const payload: CachedCapability = { timestamp: Date.now(), available };
    window.localStorage.setItem(JOBS_ADMIN_CAPABILITY_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage access failures.
  }
}

export function clearJobsAdminCapabilityCache(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(JOBS_ADMIN_CAPABILITY_CACHE_KEY);
  } catch {
    // Ignore storage access failures.
  }
}

export function isJobsAdminUnavailable(envelope: JobsAdminEnvelope | null | undefined): boolean {
  const code = typeof envelope?.error === 'object' ? envelope?.error?.code : undefined;
  return envelope?.success === false && code === JOBS_ADMIN_UNAVAILABLE_CODE;
}

export async function probeJobsAdminCapability(
  getCapability: () => Promise<JobsAdminEnvelope>,
): Promise<boolean> {
  try {
    const response = await getCapability();
    if (isJobsAdminUnavailable(response)) {
      writeCachedJobsAdminCapability(false);
      return false;
    }
    writeCachedJobsAdminCapability(true);
    return true;
  } catch {
    // A failed probe (network, auth, upstream outage) must not hide the entry
    // from instances that do configure the panel; assume available and let the
    // workspace render the real error surface.
    return true;
  }
}

export function shouldShowJobSourcesNavigation(jobsAdminAvailable: boolean, canAccessPlugins: boolean): boolean {
  return jobsAdminAvailable && canAccessPlugins;
}
