/**
 * Unit tests for the refined success-envelope helpers.
 *
 * These cases use synthetic operation objects: they prove that the envelope
 * rule is scoped by the declared media type of the success response, and that
 * the exclusion never swallows a real violation.
 */

import { describe, expect, it } from 'vitest';
import {
  getSuccessMediaTypes,
  hasNonJsonSuccessResponse,
  successEnvelopeViolations,
} from '../helpers/success-envelope';
import type { Operation } from '../helpers/openapi';

function operation(responses: Record<string, unknown>): Operation {
  return { responses } as unknown as Operation;
}

const compliantEnvelope = {
  type: 'object',
  required: ['success', 'data'],
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
};

describe('success envelope rule scope', () => {
  it('excludes a success response that declares only text/csv', () => {
    const csv = operation({ 200: { description: 'CSV', content: { 'text/csv': { schema: { type: 'string' } } } } });

    expect(getSuccessMediaTypes(csv)).toEqual(['text/csv']);
    expect(hasNonJsonSuccessResponse(csv)).toBe(true);
    expect(successEnvelopeViolations('/api/v1/admin/users/export', 'GET', csv)).toEqual([]);
  });

  it('excludes a success response that declares only application/octet-stream', () => {
    const binary = operation({
      200: { description: 'Binary', content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } },
    });

    expect(getSuccessMediaTypes(binary)).toEqual(['application/octet-stream']);
    expect(hasNonJsonSuccessResponse(binary)).toBe(true);
    expect(successEnvelopeViolations('/api/v1/plugin-files/{id}', 'GET', binary)).toEqual([]);
  });

  it('excludes a success response that declares application/json with a binary string schema', () => {
    const download = operation({
      200: { description: 'File', content: { 'application/json': { schema: { type: 'string', format: 'binary' } } } },
    });

    expect(getSuccessMediaTypes(download)).toEqual(['application/json']);
    expect(hasNonJsonSuccessResponse(download)).toBe(true);
    expect(successEnvelopeViolations('/api/v1/plugin-assets/{installationId}/{zipHash}/{*}', 'GET', download)).toEqual([]);
  });

  it('keeps a success response without any declared content a violation', () => {
    const noContent = operation({ 200: { description: 'Empty' } });

    expect(getSuccessMediaTypes(noContent)).toEqual([]);
    expect(hasNonJsonSuccessResponse(noContent)).toBe(false);
    expect(successEnvelopeViolations('/api/v1/missing/content', 'GET', noContent)).toEqual([
      'GET /api/v1/missing/content: missing application/json success schema',
    ]);
  });

  it('keeps a JSON success response that does not require success and data a violation', () => {
    const wrongEnvelope = operation({
      200: {
        description: 'Envelope',
        content: {
          'application/json': {
            schema: { type: 'object', properties: { success: { type: 'boolean', enum: [true] } } },
          },
        },
      },
    });

    expect(hasNonJsonSuccessResponse(wrongEnvelope)).toBe(false);
    const violations = successEnvelopeViolations('/api/v1/wrong/envelope', 'GET', wrongEnvelope);
    expect(violations).toContain('GET /api/v1/wrong/envelope: success response must require success and data');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('keeps a JSON success response with an untyped data schema a violation', () => {
    const untypedData = operation({
      200: {
        description: 'Envelope',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['success', 'data'],
              properties: { success: { type: 'boolean', enum: [true] }, data: {} },
            },
          },
        },
      },
    });

    expect(hasNonJsonSuccessResponse(untypedData)).toBe(false);
    expect(successEnvelopeViolations('/api/v1/untyped/data', 'GET', untypedData)).toEqual([
      'GET /api/v1/untyped/data: data schema is untyped',
    ]);
  });

  it('reports no violation for a compliant JSON envelope', () => {
    const compliant = operation({
      200: { description: 'Envelope', content: { 'application/json': { schema: compliantEnvelope } } },
    });

    expect(hasNonJsonSuccessResponse(compliant)).toBe(false);
    expect(successEnvelopeViolations('/api/v1/compliant', 'GET', compliant)).toEqual([]);
  });

  it('keeps an operation without any declared success response a violation', () => {
    const noSuccess = operation({ 404: { description: 'Not found' } });

    expect(successEnvelopeViolations('/api/v1/no/success', 'GET', noSuccess)).toEqual([
      'GET /api/v1/no/success: missing success response',
    ]);
  });
});
