import { env } from '@/config/env';
import { ApiError } from '@/utils/api-errors';

export function pluginSigningError(plugin: { trustLevel: string; signingRoot: string | null }): Error & {
  code: string; statusCode: number;
} | null {
  if (plugin.trustLevel !== 'signed') return null;
  const code = plugin.signingRoot === null
    ? 'PLUGIN_REINSTALL_REQUIRED'
    : plugin.signingRoot === 'test' && !env.EXTENSION_TEST_SIGNING_MODE
      ? 'PLUGIN_TEST_SIGNING_DISABLED'
      : null;
  return code ? Object.assign(new Error(code), { code, statusCode: 503 }) : null;
}

export function assertPluginSigningAllowed(plugin: { trustLevel: string; signingRoot: string | null }): void {
  const error = pluginSigningError(plugin);
  if (error) throw new ApiError(error.code === 'PLUGIN_REINSTALL_REQUIRED' ? 'PLUGIN_REINSTALL_CONFLICT' : 'PLUGIN_TEST_SIGNING_CONFLICT');
}
