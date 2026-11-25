import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Game Stats plugin (migration 0084) on a real SQLite engine: the session
// lifecycle and the play time it credits, the per-day player hash, the origin
// policy and input rules, rate limiting, admin gating, and the rollups the
// scheduled maintenance writes.
const { authenticateNativeAdmin } = vi.hoisted(() => ({ authenticateNativeAdmin: vi.fn() }));
vi.mock('./auth', () => ({ authenticateNativeAdmin }));

import {
  gameStatsDay,
  normalizeGameStatsSettings,
  processNativeGameStats,
  resetGameStatsRateLimiter,
  shiftDay,
  tryNativeGameStats,
} from './game-stats';

const migrations = resolve(import.meta.dirname, '../migrations');
// The schema marker, the admin permission tables, plugin instances, then the plugin's own tables.
const SCHEMA = [
  '0001_native_platform.sql',
  '0002_native_core.sql',
  '0003_native_auth.sql',
  '0020_native_plugin_settings.sql',
  '0058_native_admin_staff.sql',
  '0084_native_game_stats.sql',
];

interface Statement { sql: string; args: unknown[] }

// Minimal faithful D1 surface over node:sqlite. A batch is one transaction,
// like on D1, and reports per-statement changes.
function d1(sqlite: DatabaseSync) {
  const changes = (sql: string, args: unknown[]) => Number(sqlite.prepare(sql).run(...args).changes);
  const execute = (bound: Statement) => ({
    sql: bound.sql, args: bound.args,
    first: async <T,>() => (sqlite.prepare(bound.sql).get(...bound.args) ?? null) as T | null,
    all: async <T,>() => ({ results: sqlite.prepare(bound.sql).all(...bound.args) as T[] }),
    run: async () => ({ success: true, results: [], meta: { changes: changes(bound.sql, bound.args) } }),
  });
  const prepare = (sql: string) => {
    const base = execute({ sql, args: [] });
    return { ...base, bind: (...args: unknown[]) => execute({ sql, args }) };
  };
  return {
    prepare,
    batch: async (statements: Statement[]) => {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map((statement) => ({ success: true, results: [], meta: { changes: changes(statement.sql, statement.args) } }));
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

type Harness = { sqlite: DatabaseSync; DB: ReturnType<typeof d1>; env: { DB: unknown } };

function openPlugin(config: Record<string, unknown> = {}, enabled = 1): Harness {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  for (const file of SCHEMA) sqlite.exec(readFileSync(resolve(migrations, file), 'utf8'));
  sqlite.prepare(`INSERT INTO native_plugin_instances
    (id, plugin_slug, instance_key, enabled, config_json, encrypted_secrets_json, created_at, updated_at)
    VALUES ('pi-1', 'game-stats', 'default', ?1, ?2, '{}', '2026-11-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z')`)
    .run(enabled, JSON.stringify(config));
  const DB = d1(sqlite);
  return { sqlite, DB, env: { DB } };
}

type Reply = { success: boolean; data?: Record<string, unknown>; error?: { code: string } };
const reply = async (response: Response | null): Promise<Reply> => {
  if (!response) throw new Error('expected a response');
  return (await response.json()) as Reply;
};

const API = 'https://game-api.example';
const MOUNT = '/api/v1/plugins/game-stats';
const GATEWAY = '/api/v1/extensions/plugin/game-stats/api';
const store = (path: string, init?: RequestInit) => new Request(`${API}${MOUNT}/store${path}`, init);
const gateway = (path: string, init?: RequestInit) => new Request(`${API}${GATEWAY}${path}`, init);
const write = (path: string, body: unknown, headers: Record<string, string> = {}) => store(path, {
  method: 'POST',
  body: typeof body === 'string' ? body : JSON.stringify(body),
  headers: { 'content-type': 'application/json', ...headers },
});
const live = (h: Harness) => tryNativeGameStats(store('/live'), h.env as never);
const admin = (h: Harness, path: string) => tryNativeGameStats(gateway(path, { headers: { authorization: 'Bearer admin' } }), h.env as never);

const PLAYER_A = 'player-A-7f3e9c1a5b2d4e6f';
const PLAYER_B = 'player-B-0c9d8e7f6a5b4c3d';
const PLAYER_C = 'player-C-1a2b3c4d5e6f7081';
const session = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const T0 = Date.UTC(2026, 10, 25, 4, 0, 0); // 2026-11-25 04:00 UTC
const SECOND = 1000;
const HOUR = 60 * 60 * SECOND;
const at = (offsetMs: number) => vi.setSystemTime(T0 + offsetMs);

const beat = (h: Harness, action: 'start' | 'heartbeat' | 'end', playerId: string, sessionId: string, gameId = 'pelican-bike') =>
  tryNativeGameStats(write('/sessions', { action, gameId, playerId, sessionId }), h.env as never);

/** Opens a session at the current fake time and, when a duration is given, ends it that much later. */
async function play(h: Harness, playerId: string, gameId: string, sessionId: string, durationMs?: number) {
  expect((await beat(h, 'start', playerId, sessionId, gameId))?.status).toBe(200);
  if (durationMs === undefined) return;
  vi.setSystemTime(Date.now() + durationMs);
  expect((await beat(h, 'end', playerId, sessionId, gameId))?.status).toBe(200);
}

const sessionRow = (h: Harness, id: string) => h.sqlite.prepare(
  'SELECT game_id, day, started_at, last_heartbeat_at, ended_at, play_seconds FROM native_game_stats_sessions WHERE id = ?1',
).get(id) as Record<string, unknown>;

function addAdmin(h: Harness) {
  h.sqlite.prepare(`INSERT INTO native_users (id, email, username, role, password_salt, password_hash, updated_at)
    VALUES ('u-admin', 'admin@example.com', 'admin', 'ADMIN', 'salt', 'hash', '2026-11-24T00:00:00Z')`).run();
  h.sqlite.prepare(`INSERT INTO native_admin_memberships (id, user_id, role, status, revoked_permissions, created_at, updated_at)
    VALUES ('m-1', 'u-admin', 'ADMIN', 'ACTIVE', '[]', '2026-11-24T00:00:00Z', '2026-11-24T00:00:00Z')`).run();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  at(0);
  resetGameStatsRateLimiter();
  authenticateNativeAdmin.mockReset();
  authenticateNativeAdmin.mockResolvedValue(null);
});

afterEach(() => vi.useRealTimers());

describe('native game stats: schema and plugin state', () => {
  it('applies migration 0084: four tables and the schema marker', () => {
    const h = openPlugin();
    const tables = (h.sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'native_game_stats_%' ORDER BY name").all() as Array<{ name: string }>).map((row) => row.name);
    expect(tables).toEqual([
      'native_game_stats_daily',
      'native_game_stats_daily_totals',
      'native_game_stats_players',
      'native_game_stats_sessions',
    ]);
    expect(h.sqlite.prepare("SELECT value FROM runtime_metadata WHERE key = 'core_schema_version'").get()?.value).toBe('0084');
  });

  it('ignores unrelated paths and answers 404 while the plugin is not enabled', async () => {
    const h = openPlugin();
    expect(await tryNativeGameStats(new Request(`${API}/api/v1/plugins/wallet/store/balance`), h.env as never)).toBeNull();
    expect(await tryNativeGameStats(new Request(`${API}/api/v1/plugins/game-stats/other`), h.env as never)).toBeNull();

    const disabled = (await reply(await beat(openPlugin({}, 0), 'start', PLAYER_A, session(1))))?.error?.code;
    expect(disabled).toBe('PLUGIN_NOT_ENABLED');
    authenticateNativeAdmin.mockResolvedValue({ id: 'u-admin', role: 'ADMIN' });
    expect((await admin(openPlugin({}, 0), '/admin/overview'))?.status).toBe(404);
    // Not installed at all.
    const bare = openPlugin();
    bare.sqlite.prepare('DELETE FROM native_plugin_instances').run();
    expect((await live(bare))?.status).toBe(404);
  });

  it('clamps settings to their bounds and falls back on an unreadable config', async () => {
    expect(normalizeGameStatsSettings({
      heartbeatWindowSeconds: 5,
      retentionDays: 10_000,
      timezoneOffsetMinutes: 480,
      allowedOrigins: ' HTTPS://Games.Example.com/ , https://games.example.com, notaorigin',
    })).toEqual({
      heartbeatWindowSeconds: 90,
      retentionDays: 90,
      timezoneOffsetMinutes: 480,
      allowedOrigins: ['https://games.example.com'],
    });
    const h = openPlugin();
    h.sqlite.prepare("UPDATE native_plugin_instances SET config_json = '{not json'").run();
    // The counters keep working on the defaults; the beat cadence is the default 45 seconds.
    expect(await reply(await beat(h, 'start', PLAYER_A, session(1)))).toMatchObject({ success: true, data: { heartbeatIntervalSeconds: 45 } });
  });

  it('computes calendar days and day arithmetic', () => {
    expect(gameStatsDay(T0, 0)).toBe('2026-11-25');
    expect(gameStatsDay(Date.UTC(2026, 10, 25, 20), 480)).toBe('2026-11-26');
    expect(gameStatsDay(Date.UTC(2026, 11, 1, 2), -300)).toBe('2026-11-30');
    expect(shiftDay('2026-11-25', -7)).toBe('2026-11-18');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('native game stats: sessions', () => {
  it('counts a player as playing between the heartbeat window and drops them after it', async () => {
    const h = openPlugin();
    expect(await reply(await beat(h, 'start', PLAYER_A, session(1)))).toEqual({
      success: true,
      data: { active: true, heartbeatIntervalSeconds: 45 },
    });
    expect(await reply(await live(h))).toEqual({ success: true, data: { online: 1, byGame: { 'pelican-bike': 1 } } });

    at(60 * SECOND);
    expect(await reply(await beat(h, 'heartbeat', PLAYER_A, session(1)))).toMatchObject({ data: { active: true } });
    // Right after the beat the player still counts.
    expect((await reply(await live(h))).data).toEqual({ online: 1, byGame: { 'pelican-bike': 1 } });

    at(60 * SECOND + 91 * SECOND);
    expect((await reply(await live(h))).data).toEqual({ online: 0, byGame: {} });
    // A beat after the window does not revive the session; the client must open a new one.
    expect(await reply(await beat(h, 'heartbeat', PLAYER_A, session(1)))).toMatchObject({ data: { active: false } });
    expect(sessionRow(h, session(1)).last_heartbeat_at).toBe(T0 + 60 * SECOND);
  });

  it('scales the window and beat cadence with the configured setting', async () => {
    const h = openPlugin({ heartbeatWindowSeconds: 300 });
    expect(await reply(await beat(h, 'start', PLAYER_A, session(1)))).toMatchObject({ data: { heartbeatIntervalSeconds: 150 } });
    at(200 * SECOND);
    expect(await reply(await beat(h, 'heartbeat', PLAYER_A, session(1)))).toMatchObject({ data: { active: true } });
    expect((await reply(await live(h))).data?.online).toBe(1);
  });

  it('credits an explicit end with the time actually played', async () => {
    const h = openPlugin();
    await play(h, PLAYER_A, '2048', session(1), 10 * SECOND);
    await play(h, PLAYER_B, '2048', session(2), 5 * SECOND);
    expect(sessionRow(h, session(1))).toMatchObject({ game_id: '2048', day: '2026-11-25', ended_at: T0 + 10 * SECOND, play_seconds: 10 });
    expect(sessionRow(h, session(2))).toMatchObject({ ended_at: T0 + 15 * SECOND, play_seconds: 5 });
    expect((await reply(await live(h))).data?.online).toBe(0);
  });

  it('stores whole seconds even when a round is not a round number of seconds', async () => {
    // Both node:sqlite and D1 bind JavaScript numbers as REAL, so an uncast
    // division in the statements would leave fractions such as 10.45 behind.
    const h = openPlugin();
    await play(h, PLAYER_A, '2048', session(1), 10 * SECOND + 450);
    expect(sessionRow(h, session(1))).toMatchObject({ play_seconds: 10 });
    expect(h.sqlite.prepare('SELECT typeof(play_seconds) AS type FROM native_game_stats_sessions').get()?.type).toBe('integer');
  });

  it('caps an end that arrives long after the last heartbeat', async () => {
    const h = openPlugin();
    await play(h, PLAYER_A, '2048', session(1));
    at(45 * SECOND);
    await beat(h, 'heartbeat', PLAYER_A, session(1));
    // The tab went away at 45 seconds and is closed at 400; only one grace period past the last beat counts.
    at(400 * SECOND);
    await beat(h, 'end', PLAYER_A, session(1));
    expect(sessionRow(h, session(1))).toMatchObject({ ended_at: T0 + 90 * SECOND, play_seconds: 90 });
  });

  it('ends and heartbeats only for the player who opened the session', async () => {
    const h = openPlugin();
    await play(h, PLAYER_A, '2048', session(1));
    expect(await reply(await beat(h, 'heartbeat', PLAYER_B, session(1)))).toMatchObject({ data: { active: false } });
    await beat(h, 'end', PLAYER_B, session(1));
    expect(sessionRow(h, session(1))).toMatchObject({ ended_at: null });
    expect((await reply(await live(h))).data?.online).toBe(1);
  });

  it('lets a retried start refresh an open session but never reopens a closed one', async () => {
    const h = openPlugin();
    await play(h, PLAYER_A, '2048', session(1), 10 * SECOND);
    at(30 * SECOND);
    await beat(h, 'start', PLAYER_A, session(1));
    expect(sessionRow(h, session(1))).toMatchObject({ ended_at: T0 + 10 * SECOND, play_seconds: 10 });
    await play(h, PLAYER_A, '2048', session(2));
    at(50 * SECOND);
    await beat(h, 'start', PLAYER_A, session(2));
    expect(sessionRow(h, session(2))).toMatchObject({ started_at: T0 + 30 * SECOND, last_heartbeat_at: T0 + 50 * SECOND, ended_at: null });
  });

  it('closes stale sessions in scheduled maintenance and credits one grace period', async () => {
    const h = openPlugin();
    await play(h, PLAYER_A, '2048', session(1));
    await play(h, PLAYER_B, 'snake', session(2), 8 * SECOND);
    at(45 * SECOND);
    await beat(h, 'heartbeat', PLAYER_A, session(1));

    at(45 * SECOND + 90 * SECOND);
    // The window has passed exactly: 45 + 90 = 135 seconds after start, last beat 90 seconds ago.
    expect(await processNativeGameStats(h.env as never, Date.now())).toMatchObject({ closedSessions: 1, rolledUpDays: [], prunedSessions: 0, prunedPlayers: 0 });
    expect(sessionRow(h, session(1))).toMatchObject({ ended_at: T0 + 90 * SECOND, play_seconds: 90 });
    expect((await reply(await live(h))).data?.online).toBe(0);
    // Repeating the run changes nothing.
    expect(await processNativeGameStats(h.env as never, Date.now())).toMatchObject({ closedSessions: 0, rolledUpDays: [] });
  });

  it('counts a browser once per day per game and never stores its raw id', async () => {
    const h = openPlugin();
    await play(h, PLAYER_A, '2048', session(1), 10 * SECOND);
    await play(h, PLAYER_A, '2048', session(2), 10 * SECOND);
    await play(h, PLAYER_A, 'snake', session(3), 10 * SECOND);
    await play(h, PLAYER_B, '2048', session(4), 10 * SECOND);
    const keys = h.sqlite.prepare('SELECT game_id, player_key FROM native_game_stats_players ORDER BY game_id, player_key').all() as Array<{ game_id: string; player_key: string }>;
    expect(keys).toHaveLength(3);
    expect(keys.find((row) => row.game_id === 'snake')?.player_key).toBe(keys.filter((row) => row.game_id === '2048')[0]?.player_key);
    expect(keys.filter((row) => row.game_id === '2048').map((row) => row.player_key)).toEqual([
      expect.stringMatching(/^[0-9a-f]{64}$/),
      expect.stringMatching(/^[0-9a-f]{64}$/),
    ]);

    const tables = h.sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'native_game_stats_%'").all() as Array<{ name: string }>;
    const dump = tables.map((table) => JSON.stringify(h.sqlite.prepare(`SELECT * FROM ${table.name}`).all())).join('\n');
    expect(dump).not.toContain(PLAYER_A);
    expect(dump).not.toContain(PLAYER_B);

    // The next day the same browser gets a different key, so days cannot be linked.
    at(24 * HOUR);
    await play(h, PLAYER_A, '2048', session(5), 10 * SECOND);
    // Only A played snake, so that row is A's key on day one.
    const dayOneKey = keys.find((row) => row.game_id === 'snake')?.player_key;
    const dayTwoKey = (h.sqlite.prepare("SELECT player_key FROM native_game_stats_players WHERE day = '2026-11-26'").get() as { player_key: string }).player_key;
    expect(dayTwoKey).not.toBe(dayOneKey);
  });
});

describe('native game stats: storefront access rules', () => {
  it('lets same-origin and listed origins through and refuses everyone else', async () => {
    const h = openPlugin({ allowedOrigins: 'https://game.jiffoo.com, https://game-staging.jiffoo.com' });
    const allowed = await tryNativeGameStats(write('/sessions', { action: 'start', gameId: '2048', playerId: PLAYER_A, sessionId: session(1) }, { origin: 'https://game.jiffoo.com' }), h.env as never);
    expect(allowed?.status).toBe(200);
    expect(allowed?.headers.get('access-control-allow-origin')).toBe('https://game.jiffoo.com');
    expect(allowed?.headers.get('vary')).toBe('Origin');

    const refused = await tryNativeGameStats(write('/sessions', { action: 'start', gameId: '2048', playerId: PLAYER_A, sessionId: session(2) }, { origin: 'https://elsewhere.example' }), h.env as never);
    expect(refused?.status).toBe(403);
    expect(await reply(refused)).toMatchObject({ error: { code: 'FORBIDDEN_ORIGIN' } });

    // No Origin header (curl, a server probe) and the API's own host pass without CORS headers.
    expect((await beat(h, 'start', PLAYER_A, session(3), 'snake'))?.headers.has('access-control-allow-origin')).toBe(false);
    const sameHost = await tryNativeGameStats(write('/sessions', { action: 'start', gameId: '2048', playerId: PLAYER_A, sessionId: session(4) }, { origin: API }), h.env as never);
    expect(sameHost?.status).toBe(200);
    expect(sameHost?.headers.has('access-control-allow-origin')).toBe(false);
  });

  it('answers preflights for listed origins only', async () => {
    const h = openPlugin({ allowedOrigins: ['https://game.jiffoo.com'] });
    const preflight = await tryNativeGameStats(store('/sessions', { method: 'OPTIONS', headers: { origin: 'https://game.jiffoo.com', 'access-control-request-method': 'POST' } }), h.env as never);
    expect(preflight?.status).toBe(204);
    expect(preflight?.headers.get('access-control-allow-origin')).toBe('https://game.jiffoo.com');
    expect(preflight?.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS');
    expect(preflight?.headers.get('access-control-allow-headers')).toBe('Content-Type');
    expect((await tryNativeGameStats(store('/sessions', { method: 'OPTIONS', headers: { origin: 'https://elsewhere.example' } }), h.env as never))?.status).toBe(403);
  });

  it('serves live counts with CORS and a short cache lifetime, and accepts text/plain beacons', async () => {
    const h = openPlugin({ allowedOrigins: 'https://game.jiffoo.com' });
    const counts = await tryNativeGameStats(store('/live', { headers: { origin: 'https://game.jiffoo.com' } }), h.env as never);
    expect(counts?.status).toBe(200);
    expect(counts?.headers.get('access-control-allow-origin')).toBe('https://game.jiffoo.com');
    expect(counts?.headers.get('cache-control')).toBe('public, max-age=10');
    expect(counts?.headers.get('x-jiffoo-runtime')).toBe('cloudflare-native-game-stats');

    // navigator.sendBeacon posts text/plain without a preflight.
    const beacon = await tryNativeGameStats(store('/sessions', {
      method: 'POST',
      headers: { 'content-type': 'text/plain', origin: 'https://game.jiffoo.com' },
      body: JSON.stringify({ action: 'start', gameId: '2048', playerId: PLAYER_A, sessionId: session(1) }),
    }), h.env as never);
    expect(beacon?.status).toBe(200);
    expect((await reply(await live(h))).data?.online).toBe(1);
  });

  it('rejects malformed and oversized writes', async () => {
    const h = openPlugin();
    const valid = { action: 'start', gameId: '2048', playerId: PLAYER_A, sessionId: session(1) };
    const cases: Array<[string, unknown, number]> = [
      ['not json', '{nope', 400],
      ['array body', [], 400],
      ['bad action', { ...valid, action: 'boost' }, 400],
      ['missing action', { gameId: '2048', playerId: PLAYER_A, sessionId: session(1) }, 400],
      ['path in game id', { ...valid, gameId: '../admin' }, 400],
      ['upper-case game id', { ...valid, gameId: '2048 ' }, 400],
      ['short player id', { ...valid, playerId: 'short' }, 400],
      ['numeric player id', { ...valid, playerId: 12345678901234567890 }, 400],
      ['non-uuid session id', { ...valid, sessionId: 'session-1' }, 400],
      ['oversized body', JSON.stringify({ ...valid, junk: 'x'.repeat(5000) }), 413],
    ];
    for (const [label, body, status] of cases) {
      const response = await tryNativeGameStats(write('/sessions', body), h.env as never);
      expect(response?.status, label).toBe(status);
      expect((await reply(response)).success, label).toBe(false);
    }
    expect(h.sqlite.prepare('SELECT COUNT(*) AS count FROM native_game_stats_sessions').get()?.count).toBe(0);
    expect((await tryNativeGameStats(store('/sessions', { method: 'GET' }), h.env as never))?.status).toBe(404);
    expect((await tryNativeGameStats(store('/unknown'), h.env as never))?.status).toBe(404);
  });

  it('limits the write rate per address', async () => {
    const h = openPlugin();
    await play(h, PLAYER_A, '2048', session(1));
    const ip = { 'cf-connecting-ip': '203.0.113.7' };
    for (let attempt = 0; attempt < 60; attempt += 1) {
      expect((await tryNativeGameStats(write('/sessions', { action: 'heartbeat', gameId: '2048', playerId: PLAYER_A, sessionId: session(1) }, ip), h.env as never))?.status).toBe(200);
    }
    const limited = await tryNativeGameStats(write('/sessions', { action: 'heartbeat', gameId: '2048', playerId: PLAYER_A, sessionId: session(1) }, ip), h.env as never);
    expect(limited?.status).toBe(429);
    expect(await reply(limited)).toMatchObject({ error: { code: 'RATE_LIMITED' } });
    // Another address is unaffected, and the window clears after a minute.
    expect((await tryNativeGameStats(write('/sessions', { action: 'heartbeat', gameId: '2048', playerId: PLAYER_A, sessionId: session(1) }, { 'cf-connecting-ip': '203.0.113.8' }), h.env as never))?.status).toBe(200);
    at(61 * SECOND);
    const renewed = await tryNativeGameStats(write('/sessions', { action: 'heartbeat', gameId: '2048', playerId: PLAYER_A, sessionId: session(1) }, ip), h.env as never);
    expect(renewed?.status).toBe(200);
    expect(await reply(renewed)).toMatchObject({ data: { active: true } });
  });
});

describe('native game stats: admin reports', () => {
  it('requires an administrator with dashboard access for every admin route', async () => {
    const h = openPlugin();
    await play(h, PLAYER_A, '2048', session(1), 10 * SECOND);
    expect((await admin(h, '/admin/overview'))?.status).toBe(401);
    expect((await admin(h, '/admin/timeseries'))?.status).toBe(401);
    expect((await admin(h, '/admin/games?days=7'))?.status).toBe(401);

    // A suspended membership is refused; a role with dashboard access is let through.
    addAdmin(h);
    h.sqlite.prepare("UPDATE native_admin_memberships SET status = 'SUSPENDED'").run();
    authenticateNativeAdmin.mockResolvedValue({ id: 'u-admin', role: 'ADMIN' });
    expect((await admin(h, '/admin/overview'))?.status).toBe(403);
    h.sqlite.prepare("UPDATE native_admin_memberships SET status = 'ACTIVE'").run();
    expect((await admin(h, '/admin/overview'))?.status).toBe(200);

    // The legacy role alone is enough when no membership row exists.
    authenticateNativeAdmin.mockResolvedValue({ id: 'u-legacy', role: 'ANALYST' });
    expect((await admin(h, '/admin/overview'))?.status).toBe(200);
  });

  it('rejects writes, unknown routes and unsupported ranges', async () => {
    const h = openPlugin();
    authenticateNativeAdmin.mockResolvedValue({ id: 'u-admin', role: 'ADMIN' });
    expect((await tryNativeGameStats(gateway('/admin/overview', { method: 'POST' }), h.env as never))?.status).toBe(405);
    expect((await admin(h, '/admin/unknown'))?.status).toBe(404);
    for (const days of ['1', '31', 'abc', '7.5']) {
      const response = await admin(h, `/admin/timeseries?days=${days}`);
      expect(response?.status, days).toBe(400);
    }
    expect((await admin(h, '/admin/games?days=30'))?.status).toBe(200);
    // The bare plugin mount answers the same admin routes.
    expect((await tryNativeGameStats(new Request(`${API}${MOUNT}/admin/overview`, { headers: { authorization: 'Bearer admin' } }), h.env as never))?.status).toBe(200);
  });

  it('reports who is playing now, today, all-time totals, the trend and per-game numbers', async () => {
    const h = openPlugin();
    authenticateNativeAdmin.mockResolvedValue({ id: 'u-admin', role: 'ADMIN' });

    // Yesterday: A played 2048 twice, B played 2048 once and snake once.
    at(-5 * HOUR);
    await play(h, PLAYER_A, '2048', session(1), 10 * SECOND);
    at(-5 * HOUR + 60 * SECOND);
    await play(h, PLAYER_A, '2048', session(2), 20 * SECOND);
    at(-5 * HOUR + 120 * SECOND);
    await play(h, PLAYER_B, '2048', session(3), 5 * SECOND);
    await play(h, PLAYER_B, 'snake', session(4), 7 * SECOND);
    // Today: A has 2048 open (started 30 seconds ago, beat 10 seconds ago); C finished a 15 second round of snake.
    at(-30 * SECOND);
    await play(h, PLAYER_A, '2048', session(5));
    at(-10 * SECOND);
    await beat(h, 'heartbeat', PLAYER_A, session(5), '2048');
    at(0);
    await play(h, PLAYER_C, 'snake', session(6), 15 * SECOND);

    at(0);
    expect(await processNativeGameStats(h.env as never, Date.now())).toMatchObject({ closedSessions: 0, rolledUpDays: ['2026-11-24'] });

    expect((await reply(await admin(h, '/admin/overview'))).data).toEqual({
      day: '2026-11-25',
      online: { total: 1, byGame: { '2048': 1 } },
      today: { sessions: 2, players: 2, playSeconds: 45 },
      totals: { sessions: 6, playSeconds: 87, days: 2 },
    });

    const trend = (await reply(await admin(h, '/admin/timeseries?days=7'))).data as { days: number; items: Array<Record<string, unknown>> };
    expect(trend.days).toBe(7);
    expect(trend.items.map((item) => item.day)).toEqual(['2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25']);
    expect(trend.items[5]).toEqual({ day: '2026-11-24', sessions: 4, players: 2, playSeconds: 42 });
    expect(trend.items[6]).toEqual({ day: '2026-11-25', sessions: 2, players: 2, playSeconds: 45 });
    expect(trend.items[0]).toEqual({ day: '2026-11-19', sessions: 0, players: 0, playSeconds: 0 });
    expect(((await reply(await admin(h, '/admin/timeseries'))).data as { items: unknown[] }).items).toHaveLength(7);
    expect(((await reply(await admin(h, '/admin/timeseries?days=30'))).data as { items: unknown[] }).items).toHaveLength(30);

    const games = (await reply(await admin(h, '/admin/games?days=7'))).data as { today: string; fromDay: string; items: Array<Record<string, unknown>> };
    expect(games).toMatchObject({ today: '2026-11-25', fromDay: '2026-11-19' });
    expect(games.items).toEqual([
      // A played 2048 on both days: two player-days for one browser, by design.
      // 35 seconds yesterday (10 + 20 + 5) plus the 30 seconds of the open round so far.
      { gameId: '2048', sessions: 4, playerDays: 3, playSeconds: 65, online: 1 },
      { gameId: 'snake', sessions: 2, playerDays: 2, playSeconds: 22, online: 0 },
    ]);
  });

  it('keeps reporting a finished day from the raw rows until it is rolled up', async () => {
    const h = openPlugin();
    authenticateNativeAdmin.mockResolvedValue({ id: 'u-admin', role: 'ADMIN' });
    at(-5 * HOUR);
    await play(h, PLAYER_A, '2048', session(1), 12 * SECOND);
    at(0);
    const before = (await reply(await admin(h, '/admin/timeseries'))).data as { items: Array<Record<string, number>> };
    expect(before.items.at(-2)).toEqual({ day: '2026-11-24', sessions: 1, players: 1, playSeconds: 12 });
    await processNativeGameStats(h.env as never, Date.now());
    const after = (await reply(await admin(h, '/admin/timeseries'))).data as { items: Array<Record<string, number>> };
    expect(after).toEqual(before);
  });

  it('does not roll up a day that still has an open session', async () => {
    const h = openPlugin();
    // Opened at 23:59 on the 24th; the last beat lands at 23:59:45.
    vi.setSystemTime(Date.UTC(2026, 10, 24, 23, 59, 0));
    await play(h, PLAYER_A, '2048', session(1));
    vi.setSystemTime(Date.UTC(2026, 10, 24, 23, 59, 45));
    await beat(h, 'heartbeat', PLAYER_A, session(1), '2048');

    vi.setSystemTime(Date.UTC(2026, 10, 25, 0, 1, 0));
    expect(await processNativeGameStats(h.env as never, Date.now())).toMatchObject({ closedSessions: 0, rolledUpDays: [] });
    // Two minutes later the window has passed: the session closes and its day is final.
    vi.setSystemTime(Date.UTC(2026, 10, 25, 0, 2, 0));
    expect(await processNativeGameStats(h.env as never, Date.now())).toMatchObject({ closedSessions: 1, rolledUpDays: ['2026-11-24'] });
    expect(sessionRow(h, session(1))).toMatchObject({ day: '2026-11-24', ended_at: Date.UTC(2026, 10, 25, 0, 0, 30), play_seconds: 90 });
    expect(h.sqlite.prepare('SELECT sessions, players, play_seconds FROM native_game_stats_daily_totals').all()).toEqual([
      { sessions: 1, players: 1, play_seconds: 90 },
    ]);
  });

  it('catches up after missed runs, then prunes old raw rows but keeps their rollup', async () => {
    const h = openPlugin({ retentionDays: 7 });
    const insert = (id: string, gameId: string, day: string, seconds: number) => {
      h.sqlite.prepare(`INSERT INTO native_game_stats_sessions (id, game_id, player_key, day, started_at, last_heartbeat_at, ended_at, play_seconds)
        VALUES (?1, ?2, 'key-' || ?3, ?3, 0, 0, 1, ?4)`).run(id, gameId, day, seconds);
      h.sqlite.prepare('INSERT OR IGNORE INTO native_game_stats_players (day, game_id, player_key) VALUES (?1, ?2, ?3)').run(day, gameId, `key-${day}`);
    };
    // Raw rows from before any rollup existed, with a gap: no plays on the 11th.
    insert('old-1', '2048', '2026-11-10', 10);
    insert('old-2', '2048', '2026-11-10', 20);
    insert('old-3', 'snake', '2026-11-12', 7);

    at(0);
    expect(await processNativeGameStats(h.env as never, Date.now())).toMatchObject({
      rolledUpDays: ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24'],
      prunedSessions: 3,
      prunedPlayers: 2,
    });
    // Both planted days are older than the cutoff (the 18th); the raw rows are gone and the rollups remain.
    expect(h.sqlite.prepare('SELECT COUNT(*) AS count FROM native_game_stats_sessions').get()?.count).toBe(0);
    expect(h.sqlite.prepare('SELECT COUNT(*) AS count FROM native_game_stats_players').get()?.count).toBe(0);
    expect(h.sqlite.prepare("SELECT day, game_id, sessions, play_seconds FROM native_game_stats_daily ORDER BY day, game_id").all()).toEqual([
      { day: '2026-11-10', game_id: '2048', sessions: 2, play_seconds: 30 },
      { day: '2026-11-12', game_id: 'snake', sessions: 1, play_seconds: 7 },
    ]);
    // The watermark is at yesterday: the next run only checks that one day again.
    vi.setSystemTime(T0 + 60 * SECOND);
    expect(await processNativeGameStats(h.env as never, Date.now())).toMatchObject({ rolledUpDays: [], prunedSessions: 0, prunedPlayers: 0 });
  });

  it('uses the configured day boundary', async () => {
    const h = openPlugin({ timezoneOffsetMinutes: 480 });
    authenticateNativeAdmin.mockResolvedValue({ id: 'u-admin', role: 'ADMIN' });
    // 15:00 UTC on the 25th is 23:00 on the 25th in UTC+8; 20:00 UTC is already the 26th there.
    vi.setSystemTime(Date.UTC(2026, 10, 25, 15, 0, 0));
    await play(h, PLAYER_A, '2048', session(1), 10 * SECOND);
    vi.setSystemTime(Date.UTC(2026, 10, 25, 20, 0, 0));
    await play(h, PLAYER_B, '2048', session(2), 10 * SECOND);
    expect((await reply(await admin(h, '/admin/overview'))).data).toMatchObject({
      day: '2026-11-26',
      today: { sessions: 1, players: 1, playSeconds: 10 },
      // The 25th is still raw at this point, so it is not part of the all-time rollup sum.
      totals: { sessions: 1, playSeconds: 10, days: 1 },
    });
    expect(await processNativeGameStats(h.env as never, Date.now())).toMatchObject({ rolledUpDays: ['2026-11-25'] });
    expect((await reply(await admin(h, '/admin/overview'))).data).toMatchObject({
      totals: { sessions: 2, playSeconds: 20, days: 2 },
    });
    expect(h.sqlite.prepare('SELECT MAX(day) AS day FROM native_game_stats_daily_totals').get()?.day).toBe('2026-11-25');
    expect(sessionRow(h, session(1))).toMatchObject({ day: '2026-11-25' });
    expect(sessionRow(h, session(2))).toMatchObject({ day: '2026-11-26' });
  });

  it('does nothing in maintenance while the plugin is disabled', async () => {
    const h = openPlugin({}, 0);
    expect(await processNativeGameStats(h.env as never, Date.now())).toEqual({ closedSessions: 0, rolledUpDays: [], prunedSessions: 0, prunedPlayers: 0 });
    expect(h.sqlite.prepare('SELECT COUNT(*) AS count FROM native_game_stats_daily_totals').get()?.count).toBe(0);
  });
});
