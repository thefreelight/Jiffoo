import Ajv from 'ajv';
import { createTypedReadResponses, errorResponseSchema } from '@/types/common-dto';

export const configurationFields = {
  enabled: { type: 'boolean' },
  // The 1-32 bounds are sanity caps, not claims about provider ID formats.
  // The absolute end assertion also rejects the final newline accepted by JavaScript's $.
  ga4MeasurementId: { type: ['string', 'null'], pattern: '^G-[A-Z0-9]{1,32}$(?![\\s\\S])' },
  metaPixelId: { type: ['string', 'null'], pattern: '^[0-9]{1,32}$(?![\\s\\S])' },
  baiduSiteKey: { type: ['string', 'null'], pattern: '^[0-9a-f]{32}$(?![\\s\\S])' },
  headCode: { type: 'string', maxLength: 65536 },
  bodyStartCode: { type: 'string', maxLength: 65536 },
  bodyEndCode: { type: 'string', maxLength: 65536 },
} as const;

export const publicSchema = {
  type: 'object',
  properties: {
    ga4MeasurementId: configurationFields.ga4MeasurementId,
    metaPixelId: configurationFields.metaPixelId,
    baiduSiteKey: configurationFields.baiduSiteKey,
    headCode: configurationFields.headCode,
    bodyStartCode: configurationFields.bodyStartCode,
    bodyEndCode: configurationFields.bodyEndCode,
  },
  required: ['ga4MeasurementId', 'metaPixelId', 'baiduSiteKey', 'headCode', 'bodyStartCode', 'bodyEndCode'],
  additionalProperties: false,
} as const;

export const currentSchema = {
  type: 'object',
  properties: {
    ...configurationFields,
    revision: { type: 'integer' },
    updatedById: { type: ['string', 'null'] },
    updatedAt: { type: ['string', 'null'], format: 'date-time' },
  },
  required: [...Object.keys(configurationFields), 'revision', 'updatedById', 'updatedAt'],
  additionalProperties: false,
} as const;

export const revisionSchema = {
  type: 'object',
  properties: {
    ...currentSchema.properties,
    id: { type: 'string' },
    createdById: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    restoredFromRevision: { type: ['integer', 'null'] },
  },
  required: [...currentSchema.required, 'id', 'createdById', 'createdAt', 'restoredFromRevision'],
  additionalProperties: false,
} as const;

export const expectedRevision = { type: 'integer', minimum: 0, maximum: 2147483646 } as const;
export const saveSchema = {
  type: 'object',
  properties: { ...publicSchema.properties, expectedRevision },
  required: [...publicSchema.required, 'expectedRevision'],
  additionalProperties: false,
} as const;

export const switchSchema = {
  type: 'object', properties: { enabled: configurationFields.enabled },
  required: ['enabled'], additionalProperties: false,
} as const;

export const restoreSchema = {
  type: 'object',
  properties: { revision: expectedRevision, expectedRevision },
  required: ['revision', 'expectedRevision'], additionalProperties: false,
} as const;

export const responses = (schema: object) => ({
  ...createTypedReadResponses(schema), 400: errorResponseSchema, 409: errorResponseSchema,
});

// Body validation must reject coercion and unknown keys rather than changing merchant input.
const strictBodyAjv = new Ajv({ coerceTypes: false, removeAdditional: false, allErrors: true });
export const strictBodyValidator = ({ schema }: { schema: unknown }) =>
  strictBodyAjv.compile(schema as object);
