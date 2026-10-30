import { describe, expect, it } from 'vitest';
import {
  failNotification,
  notificationRetryDelayMinutes,
  NOTIFICATION_MAX_ATTEMPTS,
  NOTIFICATION_RETRY_MINUTES,
  reclaimNotificationLeases,
  type NotificationLeaseClient,
} from '@/core/notifications/lease';

/** A client that records the statements instead of running them. */
function recordingClient(): { client: NotificationLeaseClient; statements: string[] } {
  const statements: string[] = [];
  return {
    statements,
    client: {
      query: async (text: string) => { statements.push(text); return { rows: [] }; },
    },
  };
}

describe('the reclaim of a notification lease', () => {
  it('A schedules the next attempt with the delivery ladder instead of the current time', async () => {
    const { client, statements } = recordingClient();
    await reclaimNotificationLeases(client);
    expect(statements).toHaveLength(1);
    const statement = statements[0];
    // The ladder of the reclaim path is the ladder of the failure path.
    expect(statement).toContain(
      `CASE n.attempts WHEN 0 THEN 1 WHEN 1 THEN 5 WHEN 2 THEN 15 WHEN 3 THEN 60 WHEN 4 THEN 360 ELSE 360 END`,
    );
    // The rung is chosen by the attempts the row already carries, so a reclaim
    // consumes exactly one attempt and waits for the rung of that attempt.
    expect(statement).toContain('attempts = n.attempts + 1');
    expect(statement).not.toContain('CASE n.attempts + 1');
    // The retry time is the current time plus the ladder, never the current time.
    expect(statement).toContain(`"nextAttemptAt" = date_trunc('milliseconds', (clock_timestamp() AT TIME ZONE 'UTC') + (CASE n.attempts`);
    expect(statement).not.toContain(`"nextAttemptAt" = date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC')`);
    // The budget of the row is still spent one attempt at a time.
    expect(statement).toContain(`status = CASE WHEN n.attempts + 1 >= $1 THEN 'FAILED' ELSE 'PENDING' END`);
  });

  it('B uses the same ladder as the delivery failure path', async () => {
    const reclaim = recordingClient();
    await reclaimNotificationLeases(reclaim.client);
    const failure = recordingClient();
    await failNotification(failure.client, { id: 'notification-id', claimToken: 'token' }, 'provider refused');
    // The ladder of a statement is the case expression that reads the
    // attempts of the row.
    const ladderOf = (statement: string) => statement.match(/CASE (?:n\.)?attempts WHEN 0 THEN [^)]*END/)?.[0];
    const reclaimLadder = ladderOf(reclaim.statements[0]);
    const failureLadder = ladderOf(failure.statements[0]);
    expect(reclaimLadder).toBe('CASE n.attempts WHEN 0 THEN 1 WHEN 1 THEN 5 WHEN 2 THEN 15 WHEN 3 THEN 60 WHEN 4 THEN 360 ELSE 360 END');
    expect(failureLadder).toBe('CASE attempts WHEN 0 THEN 1 WHEN 1 THEN 5 WHEN 2 THEN 15 WHEN 3 THEN 60 WHEN 4 THEN 360 ELSE 360 END');
    // The two paths differ only in the column that carries the attempts.
    expect(reclaimLadder!.replace('n.attempts', 'attempts')).toBe(failureLadder);
  });

  it('C cannot burn the whole attempt budget of a row within seconds', () => {
    expect([...NOTIFICATION_RETRY_MINUTES]).toEqual([1, 5, 15, 60, 360]);
    expect(NOTIFICATION_MAX_ATTEMPTS).toBe(5);
    // Every attempt of the row waits for the rung of the attempts it carries.
    const delays = [0, 1, 2, 3, 4].map(attempts => notificationRetryDelayMinutes(attempts));
    expect(delays).toEqual([1, 5, 15, 60, 360]);
    // The last rung is the longest one, a row that carries more attempts than
    // the ladder has rungs still waits for the last rung.
    expect(notificationRetryDelayMinutes(5)).toBe(360);
    expect(notificationRetryDelayMinutes(50)).toBe(360);
    // No rung is zero: a reclaimed notification is never retried immediately.
    expect(Math.min(...delays)).toBeGreaterThan(0);
  });
});
