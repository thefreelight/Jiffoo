import { createHash } from 'node:crypto';

// Reconciliation restarts legitimately change these lease/scheduling fields.
// Resetting attempts also advances Prisma's updatedAt. Creation, closure and
// review timestamps, amounts, status and identity remain in the comparison.
export const paymentRuntimeFields = ['claimToken', 'claimedBy', 'leaseUntil', 'nextReconcileAt', 'attempts', 'updatedAt'];
export function businessRowsHash(model, rows) {
  const content = rows.map(row => JSON.stringify(model === 'payment'
    ? Object.fromEntries(Object.entries(row).filter(([key]) => !paymentRuntimeFields.includes(key))) : row)).sort();
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}
