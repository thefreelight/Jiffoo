import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import { getPluginManifestIssues, isPluginAssetPath, type PluginManifest } from './extensions/plugin-contract';

export interface PluginUiAsset {
  /** Path relative to the declared assetDirectory. */
  path: string;
  sha256: string;
  mime: string;
  size: number;
}
export class PluginUiValidationError extends Error {
  readonly statusCode: number;
  constructor(readonly code: 'PLUGIN_UI_MANIFEST_INVALID' | 'PLUGIN_UI_ASSET_INVALID' | 'PLUGIN_UI_ASSET_TOO_LARGE'
    | 'PLUGIN_TASK_DECLARATION_INVALID' | 'PLUGIN_SERVICE_DEPENDENCY_INVALID', readonly path: string) {
    super(`${code}: ${path}`);
    this.statusCode = code === 'PLUGIN_UI_ASSET_TOO_LARGE' ? 413 : 422;
  }
}
type PackageFile = { path: string; content: Buffer; mode?: number };
const MiB = 1024 * 1024;
const mimeByExtension: Record<string, string> = {
  html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2',
};
const decoder = new TextDecoder('utf-8', { fatal: true });
function binaryMime(content: Buffer): string | undefined {
  if (content.toString('latin1', 0, 5) === '%PDF-') return 'application/pdf';
  if (content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (content[0] === 255 && content[1] === 216 && content[2] === 255) return 'image/jpeg';
  if (['GIF87a', 'GIF89a'].includes(content.toString('latin1', 0, 6))) return 'image/gif';
  if (content.toString('latin1', 0, 4) === 'RIFF' && content.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  if (content.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]))) return 'image/x-icon';
  if (content.toString('latin1', 0, 4) === 'wOFF') return 'font/woff';
  if (content.toString('latin1', 0, 4) === 'wOF2') return 'font/woff2';
  return undefined;
}
function validateMime(content: Buffer, mime: string, path: string): void {
  const invalid = (): never => { throw new PluginUiValidationError('PLUGIN_UI_ASSET_INVALID', path); };
  const detected = binaryMime(content);
  if (mime.startsWith('image/') || mime.startsWith('font/')) {
    if (detected !== mime) invalid();
    return;
  }
  if (detected || content.includes(0)
    || content.subarray(0, 4).equals(Buffer.from([127, 69, 76, 70]))) invalid();
  let text: string;
  try { text = decoder.decode(content); } catch { return invalid(); }
  const markup = /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[^]*?-->\s*)*(<!doctype\s+html\b|<html\b|<svg\b)/i.exec(text);
  if (markup?.[1].toLowerCase().startsWith('<svg') || (markup && mime !== 'text/html')) invalid();
  if (mime === 'application/json') { try { JSON.parse(text); } catch { invalid(); } }
}

/** One byte-derived index for pack, sign, preview, install, restore and materialization. */
export function buildPluginUiAssetIndex(manifest: PluginManifest, files: readonly PackageFile[]): PluginUiAsset[] {
  const issue = getPluginManifestIssues(manifest).find(item => ['ui', 'tasks', 'services', 'serviceDependencies'].some(field => item.path === field || item.path.startsWith(`${field}.`) || item.path.startsWith(`${field}[`)));
  if (issue) throw new PluginUiValidationError(issue.code as PluginUiValidationError['code'], issue.path);
  if (!manifest.ui) return [];
  const prefix = `${manifest.ui.assetDirectory}/`;
  const assets: PluginUiAsset[] = [];
  const folded = new Set<string>();
  let total = 0, fontTotal = 0;
  for (const file of files) {
    if (file.path.toLowerCase() === manifest.ui.assetDirectory.toLowerCase())
      throw new PluginUiValidationError('PLUGIN_UI_ASSET_INVALID', file.path);
    if (!file.path.toLowerCase().startsWith(prefix.toLowerCase())) continue;
    const path = file.path.slice(prefix.length);
    if (!file.path.startsWith(prefix) || !isPluginAssetPath(path) || folded.has(path.toLowerCase())
      || (file.mode && (file.mode & 0xf000) !== 0x8000)) throw new PluginUiValidationError('PLUGIN_UI_ASSET_INVALID', file.path);
    folded.add(path.toLowerCase());
    const extension = extname(path).slice(1).toLowerCase();
    const mime = Object.prototype.hasOwnProperty.call(mimeByExtension, extension) ? mimeByExtension[extension] : undefined;
    if (!mime) throw new PluginUiValidationError('PLUGIN_UI_ASSET_INVALID', file.path);
    const size = file.content.length;
    total += size;
    if (mime.startsWith('font/')) fontTotal += size;
    if (size > 5 * MiB || (mime === 'text/html' && size > MiB) || (mime.startsWith('font/') && size > 2 * MiB)
      || total > 20 * MiB || fontTotal > 5 * MiB || assets.length >= 512)
      throw new PluginUiValidationError('PLUGIN_UI_ASSET_TOO_LARGE', file.path);
    validateMime(file.content, mime, file.path);
    assets.push({ path, mime, size, sha256: createHash('sha256').update(file.content).digest('hex') });
  }
  // Folded sorting makes shared directories adjacent without building every path prefix.
  const ordered = assets.map(asset => ({ asset, parts: asset.path.split('/') })).sort((a, b) => {
    for (let index = 0; index < Math.min(a.parts.length, b.parts.length); index++) {
      const comparison = Buffer.compare(Buffer.from(a.parts[index].toLowerCase()), Buffer.from(b.parts[index].toLowerCase()));
      if (comparison) return comparison;
    }
    return a.parts.length - b.parts.length;
  });
  for (let index = 1; index < ordered.length; index++) {
    const previous = ordered[index - 1], current = ordered[index];
    let common = 0;
    while (common < Math.min(previous.parts.length, current.parts.length)
      && previous.parts[common].toLowerCase() === current.parts[common].toLowerCase()) {
      if (previous.parts[common] !== current.parts[common]) throw new PluginUiValidationError('PLUGIN_UI_ASSET_INVALID', current.asset.path);
      common++;
    }
    if (common === Math.min(previous.parts.length, current.parts.length))
      throw new PluginUiValidationError('PLUGIN_UI_ASSET_INVALID', current.asset.path);
  }
  for (const page of [...manifest.ui.storefrontPages, ...manifest.ui.adminPages]) {
    if (!assets.some(asset => asset.path === page.entry && asset.mime === 'text/html'))
      throw new PluginUiValidationError('PLUGIN_UI_ASSET_INVALID', `${prefix}${page.entry}`);
  }
  return assets.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
}
