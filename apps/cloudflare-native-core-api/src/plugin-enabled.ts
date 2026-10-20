export interface NativePluginStateEnv {
  DB: D1Database;
}

export async function isNativePluginEnabled(env: NativePluginStateEnv, slug: string): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT enabled FROM native_plugin_instances WHERE plugin_slug = ?1 AND instance_key = 'default'",
  ).bind(slug).first<{ enabled: number }>();
  return row?.enabled === 1;
}
