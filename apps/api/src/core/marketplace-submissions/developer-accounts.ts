/**
 * Developer Accounts
 *
 * Identity + API keys for third-party extension developers. Mirrors the
 * api-token storage approach: accounts live in SystemSettings.settings
 * .developerAccounts (JSON array) so no dedicated migration is required.
 *
 * Keys are shown once at creation (`jfdev_<hex>`); only the SHA-256 hash and
 * a display prefix are persisted.
 */

import { createHash, randomBytes } from 'crypto';
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@/config/database';
import { sendError } from '@/utils/response';

export interface DeveloperAccountRecord {
  id: string;
  name: string;
  email: string;
  company?: string;
  keyHash: string;
  keyPrefix: string;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

export interface DeveloperIdentity {
  id: string;
  name: string;
  email: string;
}

const SETTINGS_ID = 'system';
const ACCOUNTS_KEY = 'developerAccounts';

function hashKey(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function readAccounts(): Promise<DeveloperAccountRecord[]> {
  const settings = await prisma.systemSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (!settings?.settings) return [];
  try {
    const raw = typeof settings.settings === 'string' ? JSON.parse(settings.settings) : settings.settings;
    const accounts = raw?.[ACCOUNTS_KEY];
    return Array.isArray(accounts) ? (accounts as DeveloperAccountRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeAccounts(accounts: DeveloperAccountRecord[]): Promise<void> {
  const settings = await prisma.systemSettings.findUnique({ where: { id: SETTINGS_ID } });
  const current =
    settings?.settings && typeof settings.settings === 'object'
      ? (settings.settings as Record<string, unknown>)
      : {};
  await prisma.systemSettings.update({
    where: { id: SETTINGS_ID },
    data: { settings: JSON.stringify({ ...current, [ACCOUNTS_KEY]: accounts }) },
  });
}

export interface CreatedDeveloperAccount {
  account: Omit<DeveloperAccountRecord, 'keyHash'>;
  /** Full API key — shown exactly once. */
  apiKey: string;
}

export async function createDeveloperAccount(input: {
  name: string;
  email: string;
  company?: string;
}): Promise<CreatedDeveloperAccount> {
  const accounts = await readAccounts();
  if (accounts.some((account) => account.email.toLowerCase() === input.email.toLowerCase() && !account.revokedAt)) {
    throw new DeveloperError(409, 'DEVELOPER_EXISTS', `An active developer account for ${input.email} already exists`);
  }

  const apiKey = `jfdev_${randomBytes(24).toString('hex')}`;
  const record: DeveloperAccountRecord = {
    id: `dev_${randomBytes(8).toString('hex')}`,
    name: input.name,
    email: input.email,
    company: input.company,
    keyHash: hashKey(apiKey),
    keyPrefix: apiKey.slice(0, 12),
    createdAt: new Date().toISOString(),
    revokedAt: null,
    lastUsedAt: null,
  };
  await writeAccounts([...accounts, record]);

  const { keyHash: _keyHash, ...account } = record;
  return { account, apiKey };
}

export async function listDeveloperAccounts() {
  return (await readAccounts()).map(({ keyHash: _keyHash, ...account }) => account);
}

export async function revokeDeveloperAccount(id: string) {
  const accounts = await readAccounts();
  const account = accounts.find((candidate) => candidate.id === id);
  if (!account) {
    throw new DeveloperError(404, 'DEVELOPER_NOT_FOUND', `Developer account ${id} not found`);
  }
  account.revokedAt = new Date().toISOString();
  await writeAccounts(accounts);
  const { keyHash: _keyHash, ...safe } = account;
  return safe;
}

export class DeveloperError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DeveloperError';
  }
}

/**
 * Fastify preHandler: resolve `Authorization: Bearer jfdev_...` to an active
 * developer account and attach it as `request.developer`.
 */
export async function developerAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!token.startsWith('jfdev_')) {
    await sendError(reply, 401, 'DEVELOPER_KEY_REQUIRED', 'Provide a developer API key as `Authorization: Bearer jfdev_...`');
    return;
  }

  const keyHash = hashKey(token);
  const accounts = await readAccounts();
  const account = accounts.find((candidate) => candidate.keyHash === keyHash);
  if (!account || account.revokedAt) {
    await sendError(reply, 401, 'DEVELOPER_KEY_INVALID', 'Unknown or revoked developer API key');
    return;
  }

  account.lastUsedAt = new Date().toISOString();
  await writeAccounts(accounts);

  (request as unknown as { developer: DeveloperIdentity }).developer = {
    id: account.id,
    name: account.name,
    email: account.email,
  };
}

export function getDeveloperIdentity(request: FastifyRequest): DeveloperIdentity {
  return (request as unknown as { developer: DeveloperIdentity }).developer;
}
