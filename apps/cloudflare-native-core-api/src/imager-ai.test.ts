import { describe, expect, it } from 'vitest';
import { imageApiBaseUrl, imageApiRequest, parseInlineImage } from './imager-ai-provider';

describe('Cloudflare-native Imager AI provider requests', () => {
  it('normalizes provider roots to the OpenAI v1 API', () => {
    expect(imageApiBaseUrl('https://api.example.com')).toBe('https://api.example.com/v1');
    expect(imageApiBaseUrl('https://api.example.com/v1/')).toBe('https://api.example.com/v1');
  });

  it('uses image generations when no reference image is provided', () => {
    const request = imageApiRequest('https://api.example.com', 'gpt-image-2', 'Create an image', null);
    expect(request.url).toBe('https://api.example.com/v1/images/generations');
    expect(request.contentType).toBe('application/json');
    expect(JSON.parse(request.body as string)).toEqual({ model: 'gpt-image-2', prompt: 'Create an image' });
  });

  it('uses multipart image edits for a style reference', async () => {
    const source = parseInlineImage('data:image/png;base64,aGVsbG8=');
    expect(source?.contentType).toBe('image/png');
    const request = imageApiRequest('https://api.example.com/v1', 'gpt-image-2', 'Keep this style', source);
    expect(request.url).toBe('https://api.example.com/v1/images/edits');
    expect(request.contentType).toBeUndefined();
    expect(request.body).toBeInstanceOf(FormData);
    const form = request.body as FormData;
    expect(form.get('model')).toBe('gpt-image-2');
    expect(form.get('prompt')).toBe('Keep this style');
    expect(await (form.get('image') as File).text()).toBe('hello');
  });

  it('rejects malformed inline images', () => {
    expect(parseInlineImage('https://example.com/image.png')).toBeNull();
    expect(parseInlineImage('data:text/plain;base64,aGVsbG8=')).toBeNull();
  });
});
