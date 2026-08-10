export const MAX_UNPACKED_THEME_BYTES = 24 * 1024 * 1024;

function safePath(path: string): boolean {
  return Boolean(path) && !path.startsWith('/') && !path.includes('\\')
    && !path.split('/').some((part) => !part || part === '.' || part === '..');
}

export async function inflateThemeZip(bytes: ArrayBuffer): Promise<Array<{ path: string; data: ArrayBuffer }>> {
  const view = new DataView(bytes);
  const source = new Uint8Array(bytes);
  let eocd = -1;
  for (let index = Math.max(0, source.length - 65_557); index <= source.length - 22; index += 1) {
    if (view.getUint32(index, true) === 0x06054b50) eocd = index;
  }
  if (eocd < 0) throw new Error('Theme artifact is not a valid ZIP package');
  const entries = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const files: Array<{ path: string; data: ArrayBuffer }> = [];
  let offset = centralOffset;
  let total = 0;
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > source.length || view.getUint32(offset, true) !== 0x02014b50) throw new Error('Theme artifact central directory is invalid');
    const compression = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const path = decoder.decode(source.slice(offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
    if (path.endsWith('/')) continue;
    if (!safePath(path) || uncompressedSize > MAX_UNPACKED_THEME_BYTES) throw new Error(`Theme artifact contains an unsafe file path: ${path}`);
    if (localOffset + 30 > source.length || view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('Theme artifact local file header is invalid');
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    if (start + compressedSize > source.length) throw new Error(`Theme artifact data is truncated for ${path}`);
    const raw = source.slice(start, start + compressedSize);
    let data: ArrayBuffer;
    if (compression === 0) data = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
    else if (compression === 8) data = await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
    else throw new Error(`Theme artifact uses unsupported compression method ${compression}`);
    if (data.byteLength !== uncompressedSize) throw new Error(`Theme artifact size check failed for ${path}`);
    total += data.byteLength;
    if (total > MAX_UNPACKED_THEME_BYTES) throw new Error('Theme artifact exceeds the unpacked size limit');
    files.push({ path, data });
  }
  return files;
}
