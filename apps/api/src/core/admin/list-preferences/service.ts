import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';
import {
  ADMIN_LIST_COLUMN_KEYS,
  defaultAdminListColumns,
  isAdminListKey,
  type AdminListKey,
} from 'shared';

const MAX_NAME_LENGTH = 64;
const MAX_QUERY_KEYS = 40;
const MAX_QUERY_VALUE_LENGTH = 200;

export interface AdminListViewRecord {
  id: string;
  listKey: string;
  name: string;
  query: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

const viewFields = { id: true, listKey: true, name: true, query: true, createdAt: true, updatedAt: true } as const;

function invalid(path: string, message: string, code: string): ApiError {
  return new ApiError('VALIDATION_ERROR', { issues: [{ path, message, code }] });
}

function storedQuery(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const query: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string') query[key] = raw;
  }
  return query;
}

function storedColumns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function toRecord(view: { id: string; listKey: string; name: string; query: unknown; createdAt: Date; updatedAt: Date }): AdminListViewRecord {
  return {
    id: view.id,
    listKey: view.listKey,
    name: view.name,
    query: storedQuery(view.query),
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}

/**
 * Per-user saved views and custom columns for the Admin list pages.
 *
 * Every read and write is scoped to the authenticated administrator, so a
 * user can never observe or modify another user's list preferences.
 */
export class AdminListPreferencesService {
  static assertListKey(value: unknown): AdminListKey {
    if (!isAdminListKey(value)) throw invalid('list', 'Unsupported list key', 'INVALID_LIST');
    return value;
  }

  static assertName(value: unknown): string {
    const name = typeof value === 'string' ? value.trim() : '';
    if (!name || name.length > MAX_NAME_LENGTH) throw invalid('name', 'Name must be between 1 and 64 characters', 'INVALID_NAME');
    return name;
  }

  static assertQuery(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid('query', 'Query must be an object of string values', 'INVALID_QUERY');
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > MAX_QUERY_KEYS) throw invalid('query', 'Query has too many keys', 'QUERY_TOO_LARGE');
    const query: Record<string, string> = {};
    for (const [key, raw] of entries) {
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(key) || typeof raw !== 'string' || raw.length > MAX_QUERY_VALUE_LENGTH) {
        throw invalid('query', 'Query must be an object of string values', 'INVALID_QUERY');
      }
      query[key] = raw;
    }
    return query;
  }

  static assertColumns(listKey: AdminListKey, value: unknown): string[] {
    if (!Array.isArray(value) || value.length === 0) throw invalid('columns', 'Select at least one column', 'INVALID_COLUMNS');
    const allowed = ADMIN_LIST_COLUMN_KEYS[listKey];
    const columns: string[] = [];
    for (const entry of value) {
      if (typeof entry !== 'string' || !allowed.includes(entry)) throw invalid('columns', 'Unknown column key', 'INVALID_COLUMN');
      if (columns.includes(entry)) throw invalid('columns', 'Duplicate column key', 'DUPLICATE_COLUMN');
      columns.push(entry);
    }
    return columns;
  }

  static async listViews(userId: string, listKey: AdminListKey): Promise<AdminListViewRecord[]> {
    const views = await prisma.adminListView.findMany({
      where: { userId, listKey },
      select: viewFields,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return views.map(toRecord);
  }

  static async createView(userId: string, listKey: AdminListKey, name: string, query: Record<string, string>): Promise<AdminListViewRecord> {
    const existing = await prisma.adminListView.findFirst({ where: { userId, listKey, name }, select: { id: true } });
    if (existing) throw new ApiError('LIST_VIEW_NAME_TAKEN');
    try {
      const view = await prisma.adminListView.create({
        data: { userId, listKey, name, query: query as Prisma.InputJsonValue },
        select: viewFields,
      });
      return toRecord(view);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ApiError('LIST_VIEW_NAME_TAKEN');
      throw error;
    }
  }

  static async updateView(userId: string, id: string, patch: { name?: string; query?: Record<string, string> }): Promise<AdminListViewRecord> {
    const existing = await prisma.adminListView.findUnique({ where: { id }, select: { id: true, userId: true, listKey: true, name: true } });
    if (!existing || existing.userId !== userId) throw new ApiError('NOT_FOUND');
    if (patch.name !== undefined && patch.name !== existing.name) {
      const duplicate = await prisma.adminListView.findFirst({
        where: { userId, listKey: existing.listKey, name: patch.name, id: { not: id } },
        select: { id: true },
      });
      if (duplicate) throw new ApiError('LIST_VIEW_NAME_TAKEN');
    }
    try {
      const view = await prisma.adminListView.update({
        where: { id },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.query !== undefined ? { query: patch.query as Prisma.InputJsonValue } : {}),
        },
        select: viewFields,
      });
      return toRecord(view);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ApiError('LIST_VIEW_NAME_TAKEN');
      throw error;
    }
  }

  static async deleteView(userId: string, id: string): Promise<void> {
    const existing = await prisma.adminListView.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!existing || existing.userId !== userId) throw new ApiError('NOT_FOUND');
    await prisma.adminListView.delete({ where: { id } });
  }

  static async getColumns(userId: string, listKey: AdminListKey): Promise<string[]> {
    const preference = await prisma.adminListColumnPreference.findUnique({
      where: { userId_listKey: { userId, listKey } },
      select: { columns: true },
    });
    if (!preference) return defaultAdminListColumns(listKey);
    const allowed = ADMIN_LIST_COLUMN_KEYS[listKey];
    const columns = storedColumns(preference.columns).filter(column => allowed.includes(column));
    return columns.length ? columns : defaultAdminListColumns(listKey);
  }

  static async setColumns(userId: string, listKey: AdminListKey, columns: string[]): Promise<string[]> {
    await prisma.adminListColumnPreference.upsert({
      where: { userId_listKey: { userId, listKey } },
      create: { userId, listKey, columns: columns as Prisma.InputJsonValue },
      update: { columns: columns as Prisma.InputJsonValue },
    });
    return columns;
  }
}
