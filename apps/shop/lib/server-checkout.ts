import 'server-only';
import { cookies } from 'next/headers';
import { ACCESS_COOKIE } from './auth-contract';
import { serverCoreResponse } from './core-transport';
import { withAvailability } from './availability-boundary';
import type { Cart, Order } from './checkout-types';
import type { PageResult } from './catalog';
import { CoreHttpError, coreAuthRejection, coreNotFound } from './core-errors';

export async function customerData<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  return withAvailability(async () => {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const response = await serverCoreResponse(path, signal ? { signal } : undefined);
  if (await coreAuthRejection(response) || await coreNotFound(response)) return null;
  if (!response.ok) throw new CoreHttpError(response.status);
  return ((await response.json()) as { data: T }).data;
  });
}

export const customerCart = () => customerData<Cart>('/cart');
export const customerOrder = (id: string, signal?: AbortSignal) => customerData<Order>(`/orders/${encodeURIComponent(id)}`, signal);
export const customerOrders = (page: number) =>
  customerData<PageResult<Order>>(`/orders?page=${page}&limit=10`);
