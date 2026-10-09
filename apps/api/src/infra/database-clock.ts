import { prisma } from '@/config/database';
export async function databaseNowMs(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ milliseconds: number }>>`SELECT extract(epoch FROM clock_timestamp())::double precision * 1000 AS milliseconds`;
  return rows[0].milliseconds;
}
