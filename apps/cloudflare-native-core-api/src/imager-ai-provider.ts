export type InlineImage = { bytes: Uint8Array; contentType: string };

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

export function parseInlineImage(value: unknown): InlineImage | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) return null;
  try {
    return { bytes: base64ToBytes(match[2].replace(/\s/g, '')), contentType: match[1].toLowerCase() };
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
): { url: string; body: BodyInit; contentType?: string } {
  const apiBase = imageApiBaseUrl(baseUrl);
  if (source) {
    const form = new FormData();
    form.append('model', model);
    form.append('prompt', prompt);
    form.append('image', new Blob([source.bytes], { type: source.contentType }), `reference.${source.contentType.split('/')[1] || 'png'}`);
    return { url: `${apiBase}/images/edits`, body: form };
  }
  return {
    url: `${apiBase}/images/generations`,
    body: JSON.stringify({ model, prompt }),
    contentType: 'application/json',
  };
}
