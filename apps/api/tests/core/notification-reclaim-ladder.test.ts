import { describe, expect, it } from 'vitest';
import {
  failNotification,
  notificationRetryDelayMinutes,
  NOTIFICATION_MAX_ATTEMPTS,
  NOTIFICATION_RETRY_JITTER_RATIO,
  NOTIFICATION_RETRY_MINUTES,
  reclaimNotificationLeases,
  type NotificationLeaseClient,
} from '@/core/notifications/lease';

/** A client that records the statements instead of running them. */
function recordingClient(): { client: NotificationLeaseClient; statements: string[]; values: unknown[][] } {
  const statements: string[] = [];
  const values: unknown[][] = [];
  return {
    statements,
    values,
    client: {
      query: async (text: string, parameters: unknown[] = []) => { statements.push(text); values.push(parameters); return { rows: [] }; },
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
    expect(statement).toContain(`"nextAttemptAt" = date_trunc('milliseconds', (clock_timestamp() AT TIME ZONE 'UTC') + (`);
    expect(statement).not.toContain(`"nextAttemptAt" = date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC')`);
    // The ladder carries a bounded jitter that only delays the retry: the
    // multiplier of the rung is one plus a share that lies between zero and one.
    expect(statement).toContain(`* (1 + random() * ${NOTIFICATION_RETRY_JITTER_RATIO})`);
    expect(NOTIFICATION_RETRY_JITTER_RATIO).toBeGreaterThan(0);
    expect(NOTIFICATION_RETRY_JITTER_RATIO).toBeLessThan(1);
    expect(statement).not.toContain('(1 - random()');
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

  it('D spreads the retries of a fleet over the window of the rung', async () => {
    expect(NOTIFICATION_RETRY_JITTER_RATIO).toBe(0.2);
    const reclaim = recordingClient();
    await reclaimNotificationLeases(reclaim.client);
    const failure = recordingClient();
    await failNotification(failure.client, { id: 'notification-id', claimToken: 'token' }, 'provider refused');
    for (const statement of [reclaim.statements[0], failure.statements[0]]) {
      // The jitter is bounded by a fifth of the rung.
      expect(statement).toContain(`* interval '1 minute' * (1 + random() * ${NOTIFICATION_RETRY_JITTER_RATIO})`);
      // The multiplier is at least one, so the jitter only delays the retry
      // and never brings it forward.
      expect(statement).not.toContain('(1 - random()');
    }
  });

  it('E lands a deterministic failure in the terminal state at once', async () => {
    const deterministic = recordingClient();
    await failNotification(deterministic.client, { id: 'notification-id', claimToken: 'token' }, 'No enabled notification provider', undefined, { deterministic: true });
    const transient = recordingClient();
    await failNotification(transient.client, { id: 'notification-id', claimToken: 'token' }, 'transport unavailable', 'fixture');
    for (const recorded of [deterministic, transient]) {
      const statement = recorded.statements[0];
      // A deterministic failure is terminal without spending the ladder.
      expect(statement).toContain(`status = CASE WHEN $5 OR attempts + 1 >= $6 THEN 'FAILED' ELSE 'PENDING' END`);
      expect(statement).toContain(`"secretJson" = CASE WHEN $5 OR attempts + 1 >= $6 THEN NULL ELSE "secretJson" END`);
      // The reason of the failure is always recorded.
      expect(statement).toContain('"lastError" = $3');
      expect(statement).toContain('attempts = attempts + 1');
    }
    // The flag of the round decides, not the statement.
    expect(deterministic.values[0][4]).toBe(true);
    expect(transient.values[0][4]).toBe(false);
  });
});
