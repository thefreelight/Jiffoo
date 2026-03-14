import { Prisma } from '@prisma/client';

const MISSING_DATABASE_OBJECT_CODES = new Set(['P2021', 'P2022']);

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.toLowerCase();
  }

  return String(error).toLowerCase();
}

export function isPrismaKnownRequestError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

export function isMissingDatabaseObjectError(
  error: unknown,
  objectNames: string[] = []
): boolean {
  const message = normalizeErrorMessage(error);
  const matchesNamedObject =
    objectNames.length === 0 ||
    objectNames.some((objectName) => message.includes(objectName.toLowerCase()));

  if (isPrismaKnownRequestError(error) && MISSING_DATABASE_OBJECT_CODES.has(error.code)) {
    return matchesNamedObject;
  }

  return matchesNamedObject && message.includes('does not exist');
}
