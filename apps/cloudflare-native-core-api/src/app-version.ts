// App release channel: the mobile apps poll this public endpoint on launch
// (throttled client-side) to learn whether a newer build exists. Release
// state lives in runtime_metadata as JSON under `app_release_ios` /
// `app_release_android`, editable via wrangler without a migration:
//   {"latestVersion":"0.0.11","latestBuild":65,"minBuild":60,
//    "storeUrl":"https://apps.apple.com/app/idXXXX","releaseNotes":"..."}
// No config row means "channel not configured" — old clients keep silent.

export interface AppReleaseConfig {
  latestVersion?: string;
  latestBuild?: number;
  minBuild?: number;
  storeUrl?: string;
  // Direct APK download URL for sideload users (Android channel only):
  // Play policy forbids Play-distributed apps from self-updating, but the
  // website-distributed APK may offer an in-place download.
  apkUrl?: string;
  releaseNotes?: string;
}

export interface AppVersionEnv {
  DB: D1Database;
}

export interface AppVersionResult {
  platform: string;
  configured: boolean;
  currentBuild: number | null;
  latestVersion: string | null;
  latestBuild: number | null;
  updateAvailable: boolean;
  forceUpdate: boolean;
  releaseNotes: string | null;
  storeUrl: string | null;
  apkUrl: string | null;
}

function parseBuild(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseConfig(raw: string | null): AppReleaseConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AppReleaseConfig;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export async function handleAppVersionLatest(request: Request, env: AppVersionEnv): Promise<Response> {
  const url = new URL(request.url);
  const platform = (url.searchParams.get('platform') ?? '').trim().toLowerCase();
  if (platform !== 'ios' && platform !== 'android') {
    return Response.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'platform must be ios or android' } },
      { status: 400, headers: { 'x-jiffoo-runtime': 'cloudflare-native-app-version' } },
    );
  }
  const currentBuild = parseBuild(url.searchParams.get('build'));

  let config: AppReleaseConfig | null = null;
  try {
    const row = await env.DB.prepare(
      "SELECT value FROM runtime_metadata WHERE key = ?1",
    ).bind(`app_release_${platform}`).first<{ value: string }>();
    config = parseConfig(row?.value ?? null);
  } catch {
    config = null;
  }

  const latestBuild = typeof config?.latestBuild === 'number' && config.latestBuild > 0
    ? Math.floor(config.latestBuild)
    : null;
  const minBuild = typeof config?.minBuild === 'number' && config.minBuild > 0
    ? Math.floor(config.minBuild)
    : null;
  const updateAvailable = config !== null
    && currentBuild !== null
    && latestBuild !== null
    && latestBuild > currentBuild;
  const forceUpdate = config !== null
    && currentBuild !== null
    && minBuild !== null
    && currentBuild < minBuild;

  const body = {
    success: true,
    data: {
      platform,
      configured: config !== null,
      currentBuild,
      latestVersion: config?.latestVersion ?? null,
      latestBuild,
      updateAvailable,
      forceUpdate,
      releaseNotes: config?.releaseNotes ?? null,
      storeUrl: config?.storeUrl ?? null,
      apkUrl: config?.apkUrl ?? null,
    } satisfies AppVersionResult,
  };
  // Clients launch-throttle, but a short edge cache keeps the poll cheap.
  return Response.json(body, {
    headers: {
      'x-jiffoo-runtime': 'cloudflare-native-app-version',
      'cache-control': 'public, max-age=300',
    },
  });
}
