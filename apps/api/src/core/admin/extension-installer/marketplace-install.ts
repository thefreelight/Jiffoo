import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { env } from '@/config/env';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { acquirePluginOperationLease, releasePluginOperationLease } from '@/core/storage/plugin-operation-lease';
import { PLUGIN_MAX_ZIP_SIZE } from 'shared/plugin-signing';
import { checkPluginApiCompatibility } from './plugin-compatibility';
import { pluginFsInstaller } from './plugin-fs-installer';
import { fetchMarketplaceCatalog, MarketplaceError, marketplaceUrl, type CatalogVersion } from './marketplace-catalog';

export async function downloadPackage(entry: CatalogVersion, base: string): Promise<{ filePath: string; cleanup: () => Promise<void> }> {
  const url = new URL(entry.downloadUrl, base);
  if (url.origin !== new URL(base).origin || url.username || url.password || url.hash) {
    throw new MarketplaceError('MARKETPLACE_DOWNLOAD_ORIGIN_FORBIDDEN', 422);
  }
  const controller = new AbortController();
  let timer: NodeJS.Timeout;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new MarketplaceError('MARKETPLACE_DOWNLOAD_TIMEOUT', 504));
    }, env.EXTENSION_MARKETPLACE_DOWNLOAD_TIMEOUT_MS);
  });
  let directory: string | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await Promise.race([
      fetch(url, { redirect: 'error', signal: controller.signal }),
      deadline,
    ]);
    if (!response.ok || !response.body) throw new MarketplaceError('MARKETPLACE_DOWNLOAD_UNAVAILABLE', 502);
    if (Number(response.headers.get('content-length')) > PLUGIN_MAX_ZIP_SIZE) {
      throw new MarketplaceError('PAYLOAD_TOO_LARGE', 413);
    }
    ({ directory } = await pluginPackageStore.createTemporaryFile('marketplace-download', 'package.zip'));
    const filePath = `${directory}/package.zip`;
    reader = response.body.getReader();
    const hash = createHash('sha256');
    let size = 0;
    const chunks = Readable.from((async function* () {
      for (;;) {
        const { done, value } = await Promise.race([reader!.read(), deadline]);
        if (done) break;
        size += value.byteLength;
        if (size > PLUGIN_MAX_ZIP_SIZE) throw new MarketplaceError('PAYLOAD_TOO_LARGE', 413);
        hash.update(value);
        yield Buffer.from(value);
      }
    })());
    await Promise.race([pipeline(chunks, createWriteStream(filePath), { signal: controller.signal }), deadline]);
    if (size !== entry.size || hash.digest('hex') !== entry.sha256) {
      throw new MarketplaceError('MARKETPLACE_DIGEST_MISMATCH', 422);
    }
    const temporaryDirectory = directory;
    directory = undefined;
    return { filePath, cleanup: () => fs.rm(temporaryDirectory, { recursive: true, force: true }) };
  } catch (error) {
    if (error instanceof MarketplaceError) throw error;
    if (controller.signal.aborted) throw new MarketplaceError('MARKETPLACE_DOWNLOAD_TIMEOUT', 504);
    throw new MarketplaceError('MARKETPLACE_DOWNLOAD_UNAVAILABLE', 502);
  } finally {
    clearTimeout(timer!);
    controller.abort();
    if (reader) void reader.cancel().catch(() => {});
    if (directory) await fs.rm(directory, { recursive: true, force: true });
  }
}

export async function installMarketplacePlugin(pluginId: string, version: string, actorUserId: string) {
  const catalog = await fetchMarketplaceCatalog({ bypassCache: true, forInstall: true });
  const plugin = catalog.plugins.find((candidate) => candidate.id === pluginId);
  const entry = plugin?.versions.find((candidate) => candidate.version === version);
  if (!plugin || !entry) throw new MarketplaceError('MARKETPLACE_PLUGIN_NOT_FOUND', 404);
  if (!checkPluginApiCompatibility({ minApiVersion: entry.minApiVersion } as Parameters<typeof checkPluginApiCompatibility>[0]).compatible) {
    throw new MarketplaceError('MARKETPLACE_INCOMPATIBLE_API_VERSION', 422);
  }
  const base = marketplaceUrl()!;
  const url = new URL(entry.downloadUrl, base);
  if (url.origin !== new URL(base).origin || url.username || url.password || url.hash) {
    throw new MarketplaceError('MARKETPLACE_DOWNLOAD_ORIGIN_FORBIDDEN', 422);
  }
  const lease = { slug: plugin.slug, token: await acquirePluginOperationLease(plugin.slug, 'install') };
  let download: Awaited<ReturnType<typeof downloadPackage>> | undefined;
  try {
    download = await downloadPackage(entry, base);
    return await pluginFsInstaller.install(createReadStream(download.filePath), {
      source: 'marketplace', lease,
      actorUserId,
      expectedMarketplaceIdentity: { version: entry.version, publisherId: plugin.publisherId },
    });
  } finally {
    try {
      if (download) await download.cleanup();
    } finally {
      await releasePluginOperationLease(lease.slug, lease.token);
    }
  }
}
