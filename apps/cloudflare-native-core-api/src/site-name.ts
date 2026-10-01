export interface NativeSiteNameEnv {
  DB: D1Database;
  SITE_NAME?: string;
}

export async function nativeSiteName(env: NativeSiteNameEnv): Promise<string> {
  const stored = await env.DB.prepare(
    "SELECT value FROM runtime_metadata WHERE key = 'site_name'",
  ).first<{ value: string }>();
  return stored?.value?.trim() || env.SITE_NAME?.trim() || 'Jiffoo';
}
