import { Prisma } from '@prisma/client';

export function orderNumberDay(createdAt: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, calendar: 'gregory', numberingSystem: 'latn',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(createdAt);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('');
}

export function formatOrderNumber(prefix: string, day: string, value: number): string {
  return `${prefix}-${day}-${String(value).padStart(4, '0')}`;
}

export async function allocateOrderNumber(tx: Pick<Prisma.TransactionClient, '$queryRaw'>, createdAt = new Date()) {
  const [system] = await tx.$queryRaw<Array<{ settings: Prisma.JsonValue }>>`
    SELECT settings FROM public.system_settings WHERE id = 'system'
  `;
  const settings = system?.settings as Record<string, unknown> | null;
  const timezone = typeof settings?.['localization.timezone'] === 'string' ? settings['localization.timezone'] : 'UTC';
  const prefix = typeof settings?.['orders.number_prefix'] === 'string' ? settings['orders.number_prefix'] : 'JF';
  const day = orderNumberDay(createdAt, timezone);
  const [counter] = await tx.$queryRaw<Array<{ last_value: number }>>`
    INSERT INTO public.order_number_counters (day, last_value) VALUES (${day}, 1)
    ON CONFLICT (day) DO UPDATE SET last_value = public.order_number_counters.last_value + 1
    RETURNING last_value
  `;
  return { orderNumber: formatOrderNumber(prefix, day, counter.last_value), createdAt };
}
