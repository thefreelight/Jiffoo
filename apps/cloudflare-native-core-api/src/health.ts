const EXPECTED_D1_SCHEMA = '0027';

type HealthEnv = Pick<Cloudflare.Env, 'DB' | 'RUNTIME_VERSION'>;

export async function nativeHealth(
  env: HealthEnv,
  runtimeHeaders: (runtime: string, headers?: HeadersInit) => Headers,
): Promise<Response> {
  const row = await env.DB.prepare("SELECT value FROM runtime_metadata WHERE key = 'core_schema_version'")
    .first<{ value: string }>();
  const healthy = row?.value === EXPECTED_D1_SCHEMA;
  return Response.json({
    status: healthy ? 'ok' : 'degraded',
    service: 'jiffoo-native-core-api',
    runtime: 'cloudflare-workers-free',
    version: env.RUNTIME_VERSION,
    d1Schema: row?.value ?? null,
  }, { status: healthy ? 200 : 503, headers: runtimeHeaders('cloudflare-native') });
}
