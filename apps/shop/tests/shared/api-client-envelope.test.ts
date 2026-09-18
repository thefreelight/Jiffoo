import { describe, expect, it } from 'vitest';
import { normalizeApiResponse } from 'shared/api/client';

describe('normalizeApiResponse', () => {
  it('wraps a bare JSON payload into the success envelope', () => {
    const body = { slug: 'app-landingpage', version: '0.1.1', source: 'official' };
    expect(normalizeApiResponse(body)).toEqual({
      success: true,
      data: body,
    });
  });

  it('wraps array payloads', () => {
    const body = [{ id: 1 }];
    expect(normalizeApiResponse(body)).toEqual({ success: true, data: body });
  });

  it('copies a string message field onto the envelope', () => {
    const body = { message: 'ok', value: 1 };
    expect(normalizeApiResponse(body)).toEqual({
      success: true,
      data: body,
      message: 'ok',
    });
  });

  it('keeps enveloped responses untouched', () => {
    const body = { success: true, data: { slug: 'x' } };
    expect(normalizeApiResponse(body)).toBe(body);
  });

  it('keeps explicit failure envelopes untouched', () => {
    const body = { success: false, error: { code: 'X', message: 'nope' } };
    expect(normalizeApiResponse(body)).toBe(body);
  });

  it('keeps primitive and null bodies untouched', () => {
    expect(normalizeApiResponse(null)).toBeNull();
    expect(normalizeApiResponse('ok')).toBe('ok');
    expect(normalizeApiResponse(42)).toBe(42);
  });
});
