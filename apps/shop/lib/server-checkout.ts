import 'server-only';
import { cookies } from 'next/headers';
import { ACCESS_COOKIE } from './auth-contract';
import { shopApi } from './server-account';
import type { Cart, Order } from './checkout-types';
import type { PageResult } from './catalog';

export async function customerData<T>(path: string): Promise<T | null> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const response = await shopApi(path, token);
  if (!response.ok) return null;
  return ((await response.json()) as { data: T }).data;
}

export const customerCart = () => customerData<Cart>('/cart');
export const customerOrder = (id: string) => customerData<Order>(`/orders/${encodeURIComponent(id)}`);
export const customerOrders = (page: number) =>
  customerData<PageResult<Order>>(`/orders?page=${page}&limit=10`);
