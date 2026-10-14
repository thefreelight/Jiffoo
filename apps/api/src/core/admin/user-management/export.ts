import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { systemSettingsService } from '../system-settings/service';
import { csvCell, csvTimestamp, csvFilename, csvStream } from '@/utils/csv';
import { getAllMessages } from 'shared/src/i18n';
import type { Locale } from 'shared/src/i18n/config';
import { customerBase, customerConditions, customerSort, customerStatus, type CustomerQuery, type CustomerRow, type CustomerSelection } from './list-query';

export async function createCustomerExport(selection: CustomerSelection, sort: CustomerQuery, locale: Locale) {
  const filters = selection.mode === 'filter' ? selection.filters : {};
  const conditions = await customerConditions(filters);
  const selected = selection.mode === 'ids' ? Prisma.sql`AND id IN (${Prisma.join(selection.ids)})`
    : selection.excludedIds?.length ? Prisma.sql`AND id NOT IN (${Prisma.join(selection.excludedIds)})` : Prisma.empty;
  const timezone = await systemSettingsService.getTimezone(), currency = await systemSettingsService.getShopCurrency();
  const customers = getAllMessages(locale).merchant!.customers as Record<string, unknown>;
  const labels = customers.workspace as Record<string, string>;
  async function* rows() {
    yield '\uFEFF' + labels.csvHeaders.split('|').map(csvCell).join(',') + '\r\n';
    let offset = 0;
    while (true) {
      const batch = await prisma.$queryRaw<CustomerRow[]>(Prisma.sql`WITH customers AS (${customerBase(conditions)}) SELECT * FROM customers WHERE true ${customerStatus(filters)} ${selected} ORDER BY ${customerSort(sort)} LIMIT 500 OFFSET ${offset}`);
      for (const customer of batch) {
        yield [customer.username, customer.email, labels[customer.isActive ? 'active' : 'inactive'], labels[customer.emailVerified ? 'yes' : 'no'],
          Number(customer.orderCount), customer.paidTotal.toFixed(2), currency, csvTimestamp(customer.lastOrderAt, timezone), csvTimestamp(customer.createdAt, timezone),
        ].map(csvCell).join(',') + '\r\n';
      }
      if (batch.length < 500) break;
      offset += batch.length;
    }
  }
  return { stream: csvStream(rows()), filename: csvFilename('customers', timezone) };
}
