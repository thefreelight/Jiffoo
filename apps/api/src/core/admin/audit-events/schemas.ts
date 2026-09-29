import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { createTypedReadResponses, errorResponseSchema } from '@/types/common-dto';

export const actorSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' }, email: { type: 'string' },
    username: { type: 'string' }, isActive: { type: 'boolean' },
  },
  required: ['id', 'email', 'username', 'isActive'],
  additionalProperties: false,
} as const;

export const eventSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' },
    action: { type: 'string' }, targetType: { type: 'string' }, targetId: { type: 'string' },
    summary: {},
    actor: { anyOf: [actorSchema, { type: 'null' }] },
  },
  required: ['id', 'createdAt', 'action', 'targetType', 'targetId', 'summary', 'actor'],
  additionalProperties: false,
} as const;

export const querySchema = {
  type: 'object',
  properties: {
    actorId: { type: 'string', minLength: 1 },
    action: { type: 'string', minLength: 1 },
    targetType: { type: 'string', minLength: 1 },
    from: { type: 'string', format: 'date-time' },
    to: { type: 'string', format: 'date-time' },
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
  additionalProperties: false,
} as const;

export const pageSchema = {
  type: 'object',
  properties: {
    items: { type: 'array', items: eventSchema },
    page: { type: 'integer' }, limit: { type: 'integer' },
    total: { type: 'integer' }, totalPages: { type: 'integer' },
  },
  required: ['items', 'page', 'limit', 'total', 'totalPages'],
  additionalProperties: false,
} as const;

export const filtersSchema = {
  type: 'object',
  properties: {
    actions: { type: 'array', items: { type: 'string' } },
    targetTypes: { type: 'array', items: { type: 'string' } },
    actors: { type: 'array', items: actorSchema },
  },
  required: ['actions', 'targetTypes', 'actors'],
  additionalProperties: false,
} as const;

const queryAjv = new Ajv({ coerceTypes: true, useDefaults: true, removeAdditional: false, allErrors: true });
addFormats(queryAjv, { mode: 'full' });
export const strictQueryValidator = ({ schema }: { schema: unknown }) => queryAjv.compile(schema as object);
export const responses = (schema: object) => ({ ...createTypedReadResponses(schema), 400: errorResponseSchema });
