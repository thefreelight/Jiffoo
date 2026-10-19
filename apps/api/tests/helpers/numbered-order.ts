import { allocateOrderNumber } from '../../src/core/order/number';

export async function createNumberedOrder(client: any, args: any) {
  return client.$transaction(async (tx: any) => tx.order.create({ ...args,
    data: { ...args.data, ...await allocateOrderNumber(tx, args.data.createdAt ? new Date(args.data.createdAt) : undefined) },
  }));
}

export async function createNumberedOrders(client: any, args: any) {
  return client.$transaction(async (tx: any) => {
    for (const data of args.data) await tx.order.create({ data: { ...data, ...await allocateOrderNumber(tx, data.createdAt ? new Date(data.createdAt) : undefined) } });
    return { count: args.data.length };
  }, { maxWait: 30_000, timeout: 60_000 });
}
