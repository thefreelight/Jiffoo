import { config } from 'dotenv';
import { resolve } from 'path';
import { defineConfig } from 'prisma/config';

// Load .env from the current app directory
config({ path: resolve(__dirname, '.env') });

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
  },
  seed: {
    command: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});

