import { createTypedCreateResponses, createTypedDeleteResponses, createTypedReadResponses, createTypedUpdateResponses, errorResponseSchema } from '@/types/common-dto';

export const listQuerySchema = {
  type: 'object',
  properties: { list: { type: 'string' } },
} as const;

export const createViewBodySchema = {
  type: 'object',
  required: ['list', 'name', 'query'],
  properties: {
    list: { type: 'string' },
    name: { type: 'string' },
    query: { type: 'object' },
  },
  additionalProperties: false,
} as const;

export const updateViewBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    query: { type: 'object' },
  },
  additionalProperties: false,
} as const;

export const preferenceBodySchema = {
  type: 'object',
  required: ['list', 'columns'],
  properties: {
    list: { type: 'string' },
    columns: { type: 'array', items: { type: 'string' } },
  },
  additionalProperties: false,
} as const;

export const viewSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    listKey: { type: 'string' },
    name: { type: 'string' },
    query: { type: 'object', additionalProperties: { type: 'string' } },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'listKey', 'name', 'query', 'createdAt', 'updatedAt'],
  additionalProperties: false,
} as const;

export const viewsDataSchema = {
  type: 'object',
  properties: { views: { type: 'array', items: viewSchema } },
  required: ['views'],
  additionalProperties: false,
} as const;

export const preferenceDataSchema = {
  type: 'object',
  properties: {
    listKey: { type: 'string' },
    columns: { type: 'array', items: { type: 'string' } },
  },
  required: ['listKey', 'columns'],
  additionalProperties: false,
} as const;

export const listViewResponses = { ...createTypedReadResponses(viewsDataSchema), 400: errorResponseSchema };
export const createViewResponses = { ...createTypedCreateResponses(viewSchema), 400: errorResponseSchema };
export const updateViewResponses = { ...createTypedUpdateResponses(viewSchema), 400: errorResponseSchema };
export const deleteViewResponses = { ...createTypedDeleteResponses({ type: 'null' }), 400: errorResponseSchema };
export const listPreferenceResponses = { ...createTypedReadResponses(preferenceDataSchema), 400: errorResponseSchema };
export const updatePreferenceResponses = { ...createTypedUpdateResponses(preferenceDataSchema), 400: errorResponseSchema };
