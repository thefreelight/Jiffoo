// Ported from the 2026-08-10 imagic GPT Image 2 fix (Jiffoo commit
// 42c0fc496, tag v1.0.70-imagic-image2.1) that produced real images through
// the sub2api gateway but was never merged to mainline. It encodes the exact
// request shape the gateway accepts: the /v1 path prefix, and a multipart
// /images/edits upload when a reference image is present (the storefront
// always sends a style-reference data URL), rather than stuffing a data URL
// into a JSON /images/generations body.

export type InlineImage = { bytes: Uint8Array; contentType: string };

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value.replace(/\s/g, '')), (character) => character.charCodeAt(0));
}

export function parseInlineImage(value: unknown): InlineImage | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) return null;
  try {
    return { bytes: base64ToBytes(match[2]), contentType: match[1].toLowerCase() };
  } catch {
    return null;
  }
}

export function imageApiBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '');
  return normalized.endsWith('/v1') ? normalized : `${normalized}/v1`;
}

export function imageApiRequest(
  baseUrl: string,
  model: string,
  prompt: string,
  source: InlineImage | null,
  size: string,
): { url: string; body: BodyInit; contentType?: string } {
  const apiBase = imageApiBaseUrl(baseUrl);
  if (source) {
    const form = new FormData();
    form.append('model', model);
    form.append('prompt', prompt);
    form.append('image', new Blob([source.bytes], { type: source.contentType }), `reference.${source.contentType.split('/')[1] || 'png'}`);
    // FormData sets its own multipart boundary; content-type must stay unset.
    return { url: `${apiBase}/images/edits`, body: form };
  }
  return {
    url: `${apiBase}/images/generations`,
    body: JSON.stringify({ model, prompt, n: 1, size }),
    contentType: 'application/json',
  };
}
