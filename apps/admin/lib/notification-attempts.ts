import type { AdminNotification } from './api';

export const completedAttempts = (item: Pick<AdminNotification, 'attempts' | 'status'>) =>
  item.attempts + (item.status === 'SENT' ? 1 : 0);
