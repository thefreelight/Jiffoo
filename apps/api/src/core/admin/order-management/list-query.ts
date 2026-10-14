import type { OrderStatus, Prisma } from '@prisma/client';
import { ApiError } from '@/utils/api-errors';

export interface OrderFilter {
  customerId?: string;
  status?: string;
  search?: string;
  paymentStatus?: 'PAID' | 'UNPAID' | 'REFUNDED';
  paymentReview?: 'required';
  createdFrom?: string;
  createdTo?: string;
}
export interface OrderSort {
  sortBy?: 'createdAt' | 'totalAmount';
  sortOrder?: 'asc' | 'desc';
}
export type OrderExportSelection = { mode: 'ids'; ids: string[] }
  | { mode: 'filter'; filter: OrderFilter; excludeIds?: string[] };

export function orderWhere(filter: OrderFilter): Prisma.OrderWhereInput {
  if (filter.createdFrom && filter.createdTo && new Date(filter.createdFrom) > new Date(filter.createdTo)) {
    throw new ApiError('INVALID_TIME_RANGE');
  }
  const search = filter.search?.trim();
  return {
    ...(filter.customerId ? { userId: filter.customerId } : {}),
    ...(filter.status ? { status: filter.status as OrderStatus } : {}),
    ...(filter.paymentStatus ? { paymentStatus: filter.paymentStatus === 'UNPAID' ? { in: ['PENDING', 'FAILED'] } : filter.paymentStatus } : {}),
    ...(filter.paymentReview ? { payments: { some: { status: 'REQUIRES_REVIEW', reviewResolution: null } } } : {}),
    ...(filter.createdFrom || filter.createdTo ? { createdAt: {
      ...(filter.createdFrom ? { gte: new Date(filter.createdFrom) } : {}),
      ...(filter.createdTo ? { lt: new Date(filter.createdTo) } : {}),
    } } : {}),
    ...(search ? { OR: [
      { id: { contains: search, mode: 'insensitive' } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
      { user: { username: { contains: search, mode: 'insensitive' } } },
    ] } : {}),
  };
}

export function orderSort({ sortBy = 'createdAt', sortOrder = 'desc' }: OrderSort): Prisma.OrderOrderByWithRelationInput[] {
  return [{ [sortBy]: sortOrder }, { id: sortOrder }];
}
