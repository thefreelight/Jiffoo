import { promises as fs } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import type { Readable, Writable } from 'node:stream';

const messages: Record<string, string> = {
  CORE_URL_REQUIRED: 'Set JIFFOO_CORE_URL to the Core base URL.',
  INVALID_CORE_URL: 'Core base URL must be an HTTP(S) origin without credentials, query or fragment.',
  ADMIN_TOKEN_REQUIRED: 'Set JIFFOO_ADMIN_TOKEN to an administrator access JWT.',
  API_TOKEN_NOT_SUPPORTED: 'API tokens cannot administer plugins; use an administrator access JWT.',
  UNAUTHORIZED: 'Administrator access token is invalid or expired; authenticate again.',
  SESSION_REVOKED: 'Administrator session was revoked; authenticate again.',
  FORBIDDEN: 'An active administrator account is required.',
  INVALID_TOKEN: 'Administrator access token is invalid or expired; authenticate again.',
  PLUGIN_DOWNGRADE_NOT_SUPPORTED: 'Downgrade is not supported; increase the package version.',
  PLUGIN_VERSION_CONTENT_CHANGED: 'This version has different content; increase the package version.',
  PUBLISHER_CHANGE_FORBIDDEN: 'Publisher identity cannot change during an upgrade.',
  SIGNED_UPGRADE_REQUIRED: 'A signed plugin requires a signed upgrade.',
  PLUGIN_OPERATION_IN_PROGRESS: 'Another plugin operation holds the lease; no overwrite was attempted.',
  PLUGIN_OPERATION_LEASE_LOST: 'The plugin operation lease was lost; no overwrite was attempted.',
  PLUGIN_PREVIEW_REQUIRED: 'Preview expired or the installation changed; upload again.',
  INCOMPATIBLE_API_VERSION: 'The package is incompatible with this Core API.',
  PAYLOAD_TOO_LARGE: 'The plugin ZIP exceeds the upload limit.',
  UNSIGNED_TTY_REQUIRED: 'Unsigned upload requires an interactive terminal and a typed slug; no install was attempted.',
  UNSIGNED_CONFIRMATION_MISMATCH: 'Confirmation slug did not match; no install was attempted.',
  TRANSPORT_FAILURE: 'Core request failed in transport; credentials and URL have been withheld.',
  INVALID_CORE_RESPONSE: 'Core returned an invalid response.',
  ZIP_NOT_FOUND: 'Plugin ZIP could not be read.',
  DEFAULT_INSTANCE_NOT_FOUND: 'The installed plugin has no default instance to enable.',
  DEV_LOOPBACK_REQUIRED: 'Development mode requires a loopback Core URL.',
  DEV_CERTIFICATE_REQUIRED: 'Set JIFFOO_DEV_CERTIFICATE to the test publisher certificate path.',
  DEV_PRIVATE_KEY_REQUIRED: 'Set JIFFOO_DEV_PRIVATE_KEY to the publisher private key path.',
  DEV_CERTIFICATE_NOT_FOUND: 'The development publisher certificate could not be read.',
  DEV_PRIVATE_KEY_NOT_FOUND: 'The development private key could not be read.',
  DEV_TEST_SIGNING_REQUIRED: 'Core preview must classify the package as test-signed; no install was attempted.',
  DEV_SLUG_INVALID: 'The source slug plus -dev does not satisfy the canonical slug rule.',
  DEV_VERSION_INVALID: 'Development versions must use three safe nonnegative integers.',
  PROJECT_MANIFEST_INVALID: 'The project manifest is invalid.',
  PROJECT_SLUG_CHANGED: 'Source slug changed during development; restart development mode.',
  BUILD_FAILED: 'Build failed; fix the project and save again. The last good installation was kept.',
  PACK_FAILED: 'Packaging failed; no upload was attempted.',
  SIGN_FAILED: 'Signing failed; check the publisher key, certificate and existing SDK test-root signing configuration.',
  WATCH_FAILED: 'The source watcher failed; development mode stopped.',
};

export class SdkError extends Error {
  constructor(public readonly code: string, public readonly status = 0) {
    super(messages[code] ?? 'Core rejected the operation; no overwrite was attempted.');
  }
}

export type ConsoleStreams = { input: Readable & { isTTY?: boolean }; output: Writable };
export type Preview = {
  package: { slug: string; version: string; trust: 'signed' | 'unsigned'; publisher: { signingRoot: 'official' | 'test' } | null; declaredCapabilities: string[] };
  current: { version: string | null; state: 'installed' | 'uninstalled' | 'not-installed' };
  operation: 'install' | 'upgrade' | 'unchanged'; compatibility: { compatible: boolean };
  previewToken: string; requiresUnsignedConfirmation: boolean;
};

export function redact(text: string, environment: NodeJS.ProcessEnv = process.env): string {
  for (const secret of [environment.JIFFOO_ADMIN_TOKEN, environment.JIFFOO_CORE_URL]) {
    if (secret) text = text.replaceAll(secret, '[redacted]');
  }
  return text;
}

export function formatSdkError(error: unknown): string {
  return redact(error instanceof SdkError ? `${error.code}: ${error.message}` : 'SDK_OPERATION_FAILED: operation failed; diagnostic values have been withheld.');
}

export class CoreClient {
  readonly origin: URL;
  private readonly token: string;
  constructor(private readonly environment: NodeJS.ProcessEnv = process.env) {
    if (!environment.JIFFOO_CORE_URL) throw new SdkError('CORE_URL_REQUIRED');
    try {
      this.origin = new URL(environment.JIFFOO_CORE_URL);
      if (!['http:', 'https:'].includes(this.origin.protocol) || this.origin.username || this.origin.password || this.origin.search || this.origin.hash || this.origin.pathname !== '/') throw new Error();
    } catch { throw new SdkError('INVALID_CORE_URL'); }
    if (!environment.JIFFOO_ADMIN_TOKEN?.trim()) throw new SdkError('ADMIN_TOKEN_REQUIRED');
    if (environment.JIFFOO_ADMIN_TOKEN.startsWith('jiffoo_')) throw new SdkError('API_TOKEN_NOT_SUPPORTED');
    this.token = environment.JIFFOO_ADMIN_TOKEN;
  }
  write(output: Writable, text: string): void { output.write(redact(text, this.environment)); }
  async request<T>(route: string, options: RequestInit = {}, allowMissing = false): Promise<T | null> {
    let response: Response;
    try {
      response = await fetch(new URL(`/api/v1/extensions/${route}`, this.origin), {
        ...options, headers: { ...options.headers, authorization: `Bearer ${this.token}` },
        redirect: 'error', signal: AbortSignal.timeout(15_000),
      });
    } catch { throw new SdkError('TRANSPORT_FAILURE'); }
    if (allowMissing && response.status === 404) return null;
    let body: { data?: T; error?: { code?: string } };
    try { body = await response.json() as typeof body; }
    catch (error) { throw new SdkError(error instanceof SyntaxError ? 'INVALID_CORE_RESPONSE' : 'TRANSPORT_FAILURE', response.status); }
    if (!response.ok) {
      const code = body.error?.code;
      const fallback = response.status === 401 ? 'UNAUTHORIZED' : response.status === 403 ? 'FORBIDDEN' : response.status === 422 ? 'INCOMPATIBLE_API_VERSION' : `CORE_HTTP_${response.status}`;
      throw new SdkError(code && Object.hasOwn(messages, code) ? code : fallback, response.status);
    }
    if (!body.data) throw new SdkError('INVALID_CORE_RESPONSE');
    return body.data;
  }
  async preview(bytes: Buffer): Promise<Preview> {
    const form = new FormData();
    form.set('file', new Blob([new Uint8Array(bytes)], { type: 'application/zip' }), 'plugin.zip');
    const preview = await this.request<Preview>('plugin/preview', { method: 'POST', body: form });
    if (!preview?.package || !preview.current || !preview.compatibility || typeof preview.previewToken !== 'string') throw new SdkError('INVALID_CORE_RESPONSE');
    return preview;
  }
  async currentVersion(slug: string): Promise<string | null> {
    const detail = await this.request<{ version: string }>(`plugin/${encodeURIComponent(slug)}`, {}, true);
    return detail?.version ?? null;
  }
  async enable(slug: string): Promise<void> {
    const instances = await this.request<{ items: Array<{ installationId: string; instanceKey: string }> }>(`plugin/${encodeURIComponent(slug)}/instances`);
    const instance = instances?.items.find(item => item.instanceKey === 'default');
    if (!instance) throw new SdkError('DEFAULT_INSTANCE_NOT_FOUND');
    await this.request(`plugin/${encodeURIComponent(slug)}/instances/${encodeURIComponent(instance.installationId)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true }) });
  }
}

export async function confirmUnsigned(slug: string, streams: ConsoleStreams): Promise<void> {
  if (!streams.input.isTTY) throw new SdkError('UNSIGNED_TTY_REQUIRED');
  streams.output.write(redact('Warning: this unsigned plugin runs in the Core process, can access the database, and is not sandboxed.\n'));
  const reader = createInterface({ input: streams.input, output: streams.output, terminal: false });
  try {
    const answer = await reader.question(redact(`Type the exact plugin slug (${slug}) to confirm installation: `));
    if (answer !== slug) throw new SdkError('UNSIGNED_CONFIRMATION_MISMATCH');
  } finally { reader.close(); }
}

export async function uploadBytes(client: CoreClient, bytes: Buffer, options: {
  enable?: boolean; requireTestSigning?: boolean; retryTransport?: boolean; streams?: ConsoleStreams;
} = {}): Promise<Preview> {
  const streams = options.streams ?? { input: process.stdin, output: process.stdout };
  let firstInstall: boolean | undefined;
  for (let attempt = 0; ; attempt++) {
    try {
      const preview = await client.preview(bytes);
      firstInstall ??= preview.operation === 'install' && preview.current.state === 'not-installed';
      if (options.requireTestSigning && (preview.package.trust !== 'signed' || preview.package.publisher?.signingRoot !== 'test')) throw new SdkError('DEV_TEST_SIGNING_REQUIRED');
      if (!options.requireTestSigning) client.write(streams.output, `${JSON.stringify({ slug: preview.package.slug, version: preview.package.version, operation: preview.operation, trust: preview.package.trust, signingRoot: preview.package.publisher?.signingRoot ?? null, compatibility: preview.compatibility.compatible, declaredCapabilities: preview.package.declaredCapabilities })}\n`);
      if (!preview.compatibility.compatible) throw new SdkError('INCOMPATIBLE_API_VERSION', 422);
      if (preview.requiresUnsignedConfirmation) await confirmUnsigned(preview.package.slug, streams);
      const form = new FormData();
      form.set('previewToken', preview.previewToken);
      if (preview.requiresUnsignedConfirmation) { form.set('confirmUnsigned', 'true'); form.set('confirmationSlug', preview.package.slug); }
      form.set('file', new Blob([new Uint8Array(bytes)], { type: 'application/zip' }), 'plugin.zip');
      await client.request('plugin/install', { method: 'POST', body: form });
      if (options.enable && firstInstall) await client.enable(preview.package.slug);
      return preview;
    } catch (error) {
      if (!(options.retryTransport && attempt === 0 && error instanceof SdkError && error.code === 'TRANSPORT_FAILURE')) throw error;
      // A fresh preview binds a retry to the same immutable archive bytes.
    }
  }
}

export async function uploadZip(filename: string, enable: boolean, streams?: ConsoleStreams): Promise<Preview> {
  const client = new CoreClient();
  let bytes: Buffer;
  try { bytes = await fs.readFile(filename); } catch { throw new SdkError('ZIP_NOT_FOUND'); }
  return uploadBytes(client, bytes, { enable, streams });
}
