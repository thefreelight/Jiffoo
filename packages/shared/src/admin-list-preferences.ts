/**
 * Admin list preferences catalogue.
 *
 * The Admin list pages (orders, products, customers) share one column
 * catalogue. The API validates stored column keys against it and the Admin
 * UI renders its picker from the same list, so a column can never be stored
 * that the page cannot render.
 */

export const ADMIN_LIST_KEYS = ['orders', 'products', 'customers'] as const;

export type AdminListKey = (typeof ADMIN_LIST_KEYS)[number];

export interface AdminListColumnDefinition {
  key: string;
  alwaysVisible: boolean;
}

export const ADMIN_LIST_COLUMNS: Record<AdminListKey, AdminListColumnDefinition[]> = {
  orders: [
    { key: 'orderNumber', alwaysVisible: true },
    { key: 'customer', alwaysVisible: false },
    { key: 'status', alwaysVisible: false },
    { key: 'payment', alwaysVisible: false },
    { key: 'totalAmount', alwaysVisible: false },
    { key: 'createdAt', alwaysVisible: false },
  ],
  products: [
    { key: 'name', alwaysVisible: true },
    { key: 'status', alwaysVisible: false },
    { key: 'price', alwaysVisible: false },
    { key: 'stock', alwaysVisible: false },
    { key: 'updatedAt', alwaysVisible: false },
  ],
  customers: [
    { key: 'customer', alwaysVisible: true },
    { key: 'status', alwaysVisible: false },
    { key: 'orderCount', alwaysVisible: false },
    { key: 'paidTotal', alwaysVisible: false },
    { key: 'lastOrderAt', alwaysVisible: false },
    { key: 'createdAt', alwaysVisible: false },
  ],
};

export const ADMIN_LIST_COLUMN_KEYS: Record<AdminListKey, string[]> = {
  orders: ADMIN_LIST_COLUMNS.orders.map(column => column.key),
  products: ADMIN_LIST_COLUMNS.products.map(column => column.key),
  customers: ADMIN_LIST_COLUMNS.customers.map(column => column.key),
};

export function isAdminListKey(value: unknown): value is AdminListKey {
  return typeof value === 'string' && (ADMIN_LIST_KEYS as readonly string[]).includes(value);
}

export function defaultAdminListColumns(listKey: AdminListKey): string[] {
  return [...ADMIN_LIST_COLUMN_KEYS[listKey]];
}
