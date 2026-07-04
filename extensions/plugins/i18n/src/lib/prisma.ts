import { PrismaClient } from '../../node_modules/.prisma/i18n-client';

// ECO-5: Refuse to silently fall back to the core DATABASE_URL.
if (!process.env.I18N_DATABASE_URL) {
  if (process.env.DATABASE_URL) {
    console.error(
      "[i18n] I18N_DATABASE_URL is not set. " +
      "Refusing to fall back to DATABASE_URL to prevent database isolation violation. " +
      "Set I18N_DATABASE_URL to a dedicated database for this plugin.",
    );
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "I18N_DATABASE_URL must be set in production. " +
      "Using the core DATABASE_URL would break plugin database isolation.",
    );
  }
  if (process.env.DATABASE_URL) {
    console.warn(
      "[i18n] WARNING: Falling back to DATABASE_URL for development. " +
      "This MUST NOT happen in production.",
    );
    process.env.I18N_DATABASE_URL = process.env.DATABASE_URL;
  }
}

const globalForPrisma = globalThis as unknown as {
  i18nPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.i18nPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.i18nPrisma = prisma;
}
