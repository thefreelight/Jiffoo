import { afterEach, describe, expect, it, vi } from 'vitest';

// The storefront's request monitor read every request body as JSON. A form upload is not JSON: the request went
// out and reached the server, and the monitor then threw — so the page was told the upload had failed (found on
// the live store, 2026-11-27, with a screenshot sent with an application to open an organization).
const logger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));
vi.mock('../lib/logger', () => ({ logger }));

import { createApiInterceptor, describeRequestBody } from '../lib/api-logger';

const original = window.fetch;
afterEach(() => { window.fetch = original; vi.clearAllMocks(); });

describe('the request monitor', () => {
  it('lets a form upload through, and returns the server’s answer to the page', async () => {
    const answer = { status: 200, ok: true } as unknown as Response;
    const sent = vi.fn(async () => answer);
    window.fetch = sent;
    createApiInterceptor();
    const form = new FormData();
    form.append('file', new File([new Uint8Array([1, 2, 3])], 'followers.png', { type: 'image/png' }));
    form.append('name', 'Crew');
    await expect(window.fetch('/api/v1/upload', { method: 'POST', body: form })).resolves.toBe(answer);
    expect(sent).toHaveBeenCalledTimes(1);
    // what it logged is the shape of the form, never its contents
    expect(logger.info).toHaveBeenCalledWith('API Call', expect.objectContaining({
      type: 'api_call', url: '/api/v1/upload', method: 'POST', status: 200,
      requestSize: JSON.stringify({ form: [{ name: 'file', file: 'followers.png', size: 3, type: 'image/png' }, { name: 'name' }] }).length,
    }));
  });

  it('still parses a JSON body for the log', async () => {
    window.fetch = vi.fn(async () => ({ status: 201 } as unknown as Response));
    createApiInterceptor();
    await window.fetch('/api/v1/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"a":1}' });
    expect(logger.info).toHaveBeenCalledWith('API Call', expect.objectContaining({ requestSize: 7 }));
  });

  it('passes a failed request on as a failure, and logs it', async () => {
    window.fetch = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    createApiInterceptor();
    const form = new FormData();
    form.append('file', new File(['abc'], 'a.png', { type: 'image/png' }));
    await expect(window.fetch('/api/v1/upload', { method: 'POST', body: form })).rejects.toThrow('Failed to fetch');
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('sends a page-view beacon on without logging it', async () => {
    const answer = { status: 204 } as unknown as Response;
    const sent = vi.fn(async () => answer);
    window.fetch = sent;
    createApiInterceptor();
    await expect(
      window.fetch('/api/v1/traffic/collect', { method: 'POST', body: '{"v":1,"p":"/en"}', keepalive: true }),
    ).resolves.toBe(answer);
    expect(sent).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('what a request carried, for the log', () => {
  it('a JSON body as it was parsed; anything else only described', () => {
    expect(describeRequestBody(undefined)).toBeUndefined();
    expect(describeRequestBody(null)).toBeUndefined();
    expect(describeRequestBody('{"a":1}')).toEqual({ a: 1 });
    expect(describeRequestBody('not json')).toBe('not json');
    const form = new FormData();
    form.append('file', new File([new Uint8Array(4)], 'x.png', { type: 'image/png' }));
    form.append('kind', 'followers');
    expect(describeRequestBody(form)).toEqual({ form: [{ name: 'file', file: 'x.png', size: 4, type: 'image/png' }, { name: 'kind' }] });
    expect(describeRequestBody(new URLSearchParams('a=1&b=2'))).toEqual({ a: '1', b: '2' });
    expect(describeRequestBody(new Blob(['abcdef'], { type: 'text/plain' }))).toEqual({ blob: { size: 6, type: 'text/plain' } });
    expect(describeRequestBody(new Uint8Array(5))).toEqual({ bytes: 5 });
    expect(describeRequestBody(new ArrayBuffer(3))).toEqual({ bytes: 3 });
  });
});
