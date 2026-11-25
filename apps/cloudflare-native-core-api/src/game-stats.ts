/**
 * Native Game Stats plugin: anonymous play counts for game portals.
 *
 * A portal page opens a play session for the game it shows and keeps it alive
 * with heartbeats while the tab is visible. The plugin answers two questions
 * from that: who is playing right now, and how much has each game been played.
 *
 * Nothing personal is stored. A player is a random id the browser generates;
 * the database keeps only a SHA-256 hash of that id salted with the day, so one
 * browser counts once per day and cannot be followed from one day to the next.
 * No IP address, account or user agent is written. Tables live in migration
 * 0084: the raw sessions and per-day player sets are pruned after the retention
 * period, the daily rollups are written once when a day is over and are kept.
 *
 * Route shapes follow the other native adapters (wallet, affiliate, support-hub):
 *   - storefront:  /api/v1/plugins/game-stats/store/{sessions,live}
 *   - admin:       /api/v1/extensions/plugin/game-stats/api/admin/{overview,timeseries,games}
 */

import type { NativeAuthEnv } from './auth';
import { requireAdminPermission } from './admin-access';
import { ADMIN_PERMISSIONS } from './native-rbac';
import { requestIp } from './auth-rate-limit';

type GameStatsEnv = NativeAuthEnv & { DB: D1Database };

const RUNTIME = 'cloudflare-native-game-stats';
const MOUNT = '/api/v1/plugins/game-stats';
const GATEWAY_PREFIX = /^\/api\/v1\/extensions\/plugin\/game-stats\/api(?=\/|$)/;

export const GAME_STATS_PLUGIN_VERSION = '0.0.1';

const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GAME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const PLAYER_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const MAX_BODY_BYTES = 4096;
// Storefront writes are anonymous, so the only abuse worth limiting is volume:
// one address cannot keep more than this many sessions alive on its own.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const RANGE_DAYS = [7, 30] as const;
const MAX_GAME_ROWS = 1000;

export interface GameStatsSettings {
  /** A session counts as playing while its last heartbeat is younger than this. */
  heartbeatWindowSeconds: number;
  /** Raw sessions and player keys are kept this long; the daily rollups are kept. */
  retentionDays: number;
  /** Day boundary for "today" and the rollups, in minutes east of UTC. */
  timezoneOffsetMinutes: number;
  /** Browser origins allowed to call the storefront endpoints cross-origin. */
  allowedOrigins: string[];
}

export const GAME_STATS_DEFAULT_SETTINGS: GameStatsSettings = {
  heartbeatWindowSeconds: 90,
  retentionDays: 90,
  timezoneOffsetMinutes: 0,
  allowedOrigins: [],
};

export const GAME_STATS_LIMITS = {
  heartbeatWindowSeconds: { min: 30, max: 600 },
  retentionDays: { min: 7, max: 3650 },
  timezoneOffsetMinutes: { min: -840, max: 840 },
} as const;

function readInt(value: unknown, fallback: number, range: { min: number; max: number }): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= range.min && value <= range.max
    ? Math.round(value)
    : fallback;
}

/** Accepts the comma-separated form the settings form stores or an already split list. */
function readOrigins(value: unknown): string[] {
  const entries = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const origins = new Set<string>();
  for (const entry of entries) {
    if (typeof entry !== 'string') continue;
    const origin = entry.trim().replace(/\/+$/, '').toLowerCase();
    if (/^https?:\/\/[^\s/]+$/.test(origin)) origins.add(origin);
  }
  return [...origins];
}

export function normalizeGameStatsSettings(input: Record<string, unknown>): GameStatsSettings {
  return {
    heartbeatWindowSeconds: readInt(
      input.heartbeatWindowSeconds,
      GAME_STATS_DEFAULT_SETTINGS.heartbeatWindowSeconds,
      GAME_STATS_LIMITS.heartbeatWindowSeconds,
    ),
    retentionDays: readInt(
      input.retentionDays,
      GAME_STATS_DEFAULT_SETTINGS.retentionDays,
      GAME_STATS_LIMITS.retentionDays,
    ),
    timezoneOffsetMinutes: readInt(
      input.timezoneOffsetMinutes,
      GAME_STATS_DEFAULT_SETTINGS.timezoneOffsetMinutes,
      GAME_STATS_LIMITS.timezoneOffsetMinutes,
    ),
    allowedOrigins: readOrigins(input.allowedOrigins),
  };
}

interface PluginInstanceRow {
  enabled: number;
  config_json: string;
}

/** Enabled flag and settings come from the same plugin instance row, in one read. */
async function loadPluginState(env: GameStatsEnv): Promise<{ enabled: boolean; settings: GameStatsSettings }> {
  const row = await env.DB.prepare(
    "SELECT enabled, config_json FROM native_plugin_instances WHERE plugin_slug = 'game-stats' AND instance_key = 'default'",
  ).first<PluginInstanceRow>();
  if (!row) return { enabled: false, settings: GAME_STATS_DEFAULT_SETTINGS };
  let raw: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(row.config_json);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) raw = parsed as Record<string, unknown>;
  } catch {
    // An unreadable config falls back to the defaults rather than taking the counters down.
  }
  return { enabled: row.enabled === 1, settings: normalizeGameStatsSettings(raw) };
}

// ── time and identity ────────────────────────────────────────────────────────

/** The calendar day of an instant in the plugin's configured timezone, as YYYY-MM-DD. */
export function gameStatsDay(epochMs: number, timezoneOffsetMinutes: number): string {
  return new Date(epochMs + timezoneOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

export function shiftDay(day: string, deltaDays: number): string {
  return new Date(Date.UTC(
    Number(day.slice(0, 4)),
    Number(day.slice(5, 7)) - 1,
    Number(day.slice(8, 10)) + deltaDays,
  )).toISOString().slice(0, 10);
}

async function playerKey(playerId: string, day: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${day}:${playerId}`)));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Play time credited to a session that stopped without an explicit end: halfway through the window. */
function graceMs(settings: GameStatsSettings): number {
  return (settings.heartbeatWindowSeconds * 1000) / 2;
}

/** The heartbeat cadence the client should follow: two beats per window, so one lost beat is survivable. */
function heartbeatIntervalSeconds(settings: GameStatsSettings): number {
  return Math.max(10, Math.floor(settings.heartbeatWindowSeconds / 2));
}

// ── rate limit (per isolate; a cheap volume guard, not a security boundary) ──

const rateBuckets = new Map<string, { startedAt: number; count: number }>();

export function resetGameStatsRateLimiter(): void {
  rateBuckets.clear();
}

function takeRateLimitBudget(ip: string, now: number): boolean {
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.startedAt >= RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(ip, { startedAt: now, count: 1 });
    if (rateBuckets.size > 5000) {
      for (const [key, entry] of rateBuckets) {
        if (now - entry.startedAt >= RATE_LIMIT_WINDOW_MS) rateBuckets.delete(key);
      }
    }
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT_MAX_REQUESTS;
}

// ── responses ────────────────────────────────────────────────────────────────

function failure(status: number, code: string, message: string): Response {
  return Response.json({ success: false, error: { code, message } }, {
    status,
    headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': RUNTIME },
  });
}

function success(data: unknown, headers: Record<string, string> = {}): Response {
  return Response.json({ success: true, data }, {
    headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': RUNTIME, ...headers },
  });
}

type OriginDecision = { allowed: boolean; origin: string | null; crossOrigin: boolean };

/**
 * Same-origin requests and requests without an Origin header (server probes,
 * curl) pass. A browser on another origin passes only when the plugin lists it;
 * that keeps an unrelated site from writing counters through its visitors.
 */
function decideOrigin(request: Request, settings: GameStatsSettings): OriginDecision {
  const origin = request.headers.get('origin');
  if (!origin) return { allowed: true, origin: null, crossOrigin: false };
  let sameHost = false;
  try {
    sameHost = new URL(origin).host === new URL(request.url).host;
  } catch {
    sameHost = false;
  }
  if (sameHost) return { allowed: true, origin, crossOrigin: false };
  const allowed = settings.allowedOrigins.includes(origin.toLowerCase());
  return { allowed, origin, crossOrigin: true };
}

function withCors(decision: OriginDecision, response: Response): Response {
  if (!decision.crossOrigin || !decision.origin) return response;
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', decision.origin);
  headers.append('vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
}

function preflight(decision: OriginDecision): Response {
  if (!decision.allowed) return failure(403, 'FORBIDDEN_ORIGIN', 'Origin not allowed');
  // Content-Type is the only header a browser adds; a beacon sends its body as text/plain.
  const headers = new Headers({
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
    'access-control-max-age': '86400',
  });
  if (decision.crossOrigin && decision.origin) {
    headers.set('access-control-allow-origin', decision.origin);
    headers.append('vary', 'Origin');
  }
  return new Response(null, { status: 204, headers });
}

// ── storefront: sessions and live counts ─────────────────────────────────────

async function recordSession(request: Request, env: GameStatsEnv, settings: GameStatsSettings, now: number): Promise<Response> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return failure(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    // Reported as a validation error below.
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return failure(400, 'VALIDATION_ERROR', 'Request body must be an object');
  }
  const input = body as Record<string, unknown>;
  const { action, gameId, playerId, sessionId } = input;
  if (action !== 'start' && action !== 'heartbeat' && action !== 'end') {
    return failure(400, 'VALIDATION_ERROR', 'action must be start, heartbeat or end');
  }
  if (typeof gameId !== 'string' || !GAME_ID_PATTERN.test(gameId)) {
    return failure(400, 'VALIDATION_ERROR', 'gameId must match [a-z0-9][a-z0-9-]{0,63}');
  }
  if (typeof playerId !== 'string' || !PLAYER_ID_PATTERN.test(playerId)) {
    return failure(400, 'VALIDATION_ERROR', 'playerId must be a random string of 16-128 characters');
  }
  if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) {
    return failure(400, 'VALIDATION_ERROR', 'sessionId must be a UUID');
  }
  if (!takeRateLimitBudget(requestIp(request), now)) {
    return failure(429, 'RATE_LIMITED', 'Too many requests, please slow down');
  }

  const day = gameStatsDay(now, settings.timezoneOffsetMinutes);
  const key = await playerKey(playerId, day);
  const windowMs = settings.heartbeatWindowSeconds * 1000;
  // D1 binds JavaScript numbers as REAL, so every stored instant and every
  // computed duration below is cast: the columns hold integers, never fractions.

  if (action === 'start') {
    // A retried start only refreshes the heartbeat of a session that is still
    // open; a closed id is left closed and the next heartbeat reports it gone.
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO native_game_stats_sessions (id, game_id, player_key, day, started_at, last_heartbeat_at)
         VALUES (?1, ?2, ?3, ?4, CAST(?5 AS INTEGER), CAST(?5 AS INTEGER))
         ON CONFLICT(id) DO UPDATE SET last_heartbeat_at = excluded.last_heartbeat_at
         WHERE native_game_stats_sessions.ended_at IS NULL`,
      ).bind(sessionId, gameId, key, day, now),
      env.DB.prepare(
        'INSERT OR IGNORE INTO native_game_stats_players (day, game_id, player_key) VALUES (?1, ?2, ?3)',
      ).bind(day, gameId, key),
    ]);
    return success({ active: true, heartbeatIntervalSeconds: heartbeatIntervalSeconds(settings) });
  }

  // A beat that arrives after the window does not revive the session: the tab
  // was away (hidden, asleep) and that gap is not play time. The client then
  // opens a new session.
  if (action === 'heartbeat') {
    const result = await env.DB.prepare(
      `UPDATE native_game_stats_sessions SET last_heartbeat_at = ?1
       WHERE id = ?2 AND player_key = ?3 AND ended_at IS NULL AND last_heartbeat_at + CAST(?4 AS INTEGER) >= ?1`,
    ).bind(now, sessionId, key, windowMs).run();
    return success({ active: Number(result.meta.changes) > 0, heartbeatIntervalSeconds: heartbeatIntervalSeconds(settings) });
  }

  // An end that arrives late (the tab was hidden for a while before closing) is
  // credited only up to one grace period past the last heartbeat.
  await env.DB.prepare(
    `UPDATE native_game_stats_sessions
     SET ended_at = CAST(MIN(?1, last_heartbeat_at + CAST(?2 AS INTEGER)) AS INTEGER),
         play_seconds = CAST(MAX(0, (MIN(?1, last_heartbeat_at + CAST(?2 AS INTEGER)) - started_at) / 1000) AS INTEGER)
     WHERE id = ?3 AND player_key = ?4 AND ended_at IS NULL`,
  ).bind(now, graceMs(settings), sessionId, key).run();
  return success({ active: false });
}

async function liveOnlineByGame(env: GameStatsEnv, cutoff: number): Promise<{ total: number; byGame: Record<string, number> }> {
  const result = await env.DB.prepare(
    `SELECT game_id, COUNT(*) AS count FROM native_game_stats_sessions
     WHERE ended_at IS NULL AND last_heartbeat_at >= ?1 GROUP BY game_id`,
  ).bind(cutoff).all<{ game_id: string; count: number }>();
  const byGame: Record<string, number> = {};
  let total = 0;
  for (const row of result.results ?? []) {
    byGame[row.game_id] = Number(row.count);
    total += Number(row.count);
  }
  return { total, byGame };
}

interface LiveGame {
  sessions: number;
  players: number;
  playSeconds: number;
}

/** One day's numbers straight from the raw tables: used for today and for days not rolled up yet. */
async function liveDayBreakdown(
  env: GameStatsEnv,
  day: string,
  now: number,
  settings: GameStatsSettings,
): Promise<{ sessions: number; players: number; playSeconds: number; byGame: Map<string, LiveGame> }> {
  const [sessionRows, playerRows, playerTotal] = await Promise.all([
    env.DB.prepare(
      // A session still open has no play_seconds yet: credit the time up to now, capped one grace period past its last beat.
      `SELECT game_id, COUNT(*) AS sessions,
              COALESCE(SUM(COALESCE(play_seconds,
                CAST(MAX(0, (MIN(CAST(?2 AS INTEGER), last_heartbeat_at + CAST(?3 AS INTEGER)) - started_at) / 1000) AS INTEGER))), 0) AS play_seconds
       FROM native_game_stats_sessions WHERE day = ?1 GROUP BY game_id`,
    ).bind(day, now, graceMs(settings)).all<{ game_id: string; sessions: number; play_seconds: number }>(),
    env.DB.prepare(
      'SELECT game_id, COUNT(*) AS players FROM native_game_stats_players WHERE day = ?1 GROUP BY game_id',
    ).bind(day).all<{ game_id: string; players: number }>(),
    // The set is per game, so a player with two games has two rows: count distinct keys for the site-wide figure.
    env.DB.prepare('SELECT COUNT(DISTINCT player_key) AS players FROM native_game_stats_players WHERE day = ?1').bind(day).first<{ players: number }>(),
  ]);
  const byGame = new Map<string, LiveGame>();
  let sessions = 0;
  let playSeconds = 0;
  for (const row of sessionRows.results ?? []) {
    const entry: LiveGame = { sessions: Number(row.sessions), players: 0, playSeconds: Number(row.play_seconds) };
    byGame.set(row.game_id, entry);
    sessions += entry.sessions;
    playSeconds += entry.playSeconds;
  }
  // A player row can only exist together with a session, so every key below is already in the map.
  for (const row of playerRows.results ?? []) {
    const entry = byGame.get(row.game_id);
    if (entry) entry.players = Number(row.players);
  }
  return { sessions, players: Number(playerTotal?.players ?? 0), playSeconds, byGame };
}

// ── admin: rollups and reports ───────────────────────────────────────────────

interface DayTotals {
  day: string;
  sessions: number;
  players: number;
  playSeconds: number;
}

interface GameTotals {
  gameId: string;
  sessions: number;
  /** Sum of each day's unique players. Player keys are salted per day, so a range has no exact distinct count. */
  playerDays: number;
  playSeconds: number;
}

async function rollupTotalsFrom(env: GameStatsEnv, fromDay: string): Promise<Map<string, DayTotals>> {
  const result = await env.DB.prepare(
    'SELECT day, sessions, players, play_seconds FROM native_game_stats_daily_totals WHERE day >= ?1',
  ).bind(fromDay).all<{ day: string; sessions: number; players: number; play_seconds: number }>();
  return new Map((result.results ?? []).map((row) => [row.day, {
    day: row.day,
    sessions: Number(row.sessions),
    players: Number(row.players),
    playSeconds: Number(row.play_seconds),
  }]));
}

interface GameDayRow {
  day: string;
  game_id: string;
  sessions: number;
  players: number;
  play_seconds: number;
}

async function rollupGamesFrom(env: GameStatsEnv, fromDay: string): Promise<GameDayRow[]> {
  const result = await env.DB.prepare(
    'SELECT day, game_id, sessions, players, play_seconds FROM native_game_stats_daily WHERE day >= ?1',
  ).bind(fromDay).all<GameDayRow>();
  return result.results ?? [];
}

/** The last `days` days per day and per game. Finished days come from the rollups; the rest is read live. */
async function collectRange(
  env: GameStatsEnv,
  settings: GameStatsSettings,
  now: number,
  days: number,
): Promise<{ fromDay: string; today: string; series: DayTotals[]; games: Map<string, GameTotals> }> {
  const today = gameStatsDay(now, settings.timezoneOffsetMinutes);
  const fromDay = shiftDay(today, -(days - 1));
  const [totals, gameRows] = await Promise.all([rollupTotalsFrom(env, fromDay), rollupGamesFrom(env, fromDay)]);
  const games = new Map<string, GameTotals>();
  const addGame = (gameId: string, sessions: number, playerDays: number, playSeconds: number) => {
    const entry = games.get(gameId) ?? { gameId, sessions: 0, playerDays: 0, playSeconds: 0 };
    entry.sessions += sessions;
    entry.playerDays += playerDays;
    entry.playSeconds += playSeconds;
    games.set(gameId, entry);
  };
  for (const row of gameRows) addGame(row.game_id, Number(row.sessions), Number(row.players), Number(row.play_seconds));

  const series: DayTotals[] = [];
  for (let day = fromDay; ; day = shiftDay(day, 1)) {
    const rolled = totals.get(day);
    if (rolled) {
      series.push(rolled);
    } else {
      const live = await liveDayBreakdown(env, day, now, settings);
      series.push({ day, sessions: live.sessions, players: live.players, playSeconds: live.playSeconds });
      for (const [gameId, entry] of live.byGame) addGame(gameId, entry.sessions, entry.players, entry.playSeconds);
    }
    if (day === today) break;
  }
  return { fromDay, today, series, games };
}

function readDays(url: URL): number | null {
  const raw = url.searchParams.get('days');
  if (raw === null) return RANGE_DAYS[0];
  const days = Number(raw);
  return (RANGE_DAYS as readonly number[]).includes(days) ? days : null;
}

async function adminOverview(env: GameStatsEnv, settings: GameStatsSettings, now: number) {
  const today = gameStatsDay(now, settings.timezoneOffsetMinutes);
  const [live, online, allTime] = await Promise.all([
    liveDayBreakdown(env, today, now, settings),
    liveOnlineByGame(env, now - settings.heartbeatWindowSeconds * 1000),
    env.DB.prepare(
      `SELECT COALESCE(SUM(sessions), 0) AS sessions, COALESCE(SUM(play_seconds), 0) AS play_seconds, COUNT(*) AS days
       FROM native_game_stats_daily_totals`,
    ).first<{ sessions: number; play_seconds: number; days: number }>(),
  ]);
  return {
    day: today,
    online,
    today: { sessions: live.sessions, players: live.players, playSeconds: live.playSeconds },
    totals: {
      sessions: Number(allTime?.sessions ?? 0) + live.sessions,
      playSeconds: Number(allTime?.play_seconds ?? 0) + live.playSeconds,
      // Today is not rolled up yet, so it is not among the counted rows.
      days: Number(allTime?.days ?? 0) + 1,
    },
  };
}

async function adminTimeseries(env: GameStatsEnv, settings: GameStatsSettings, now: number, days: number) {
  const { series } = await collectRange(env, settings, now, days);
  return { days, items: series };
}

async function adminGames(env: GameStatsEnv, settings: GameStatsSettings, now: number, days: number) {
  const [range, online] = await Promise.all([
    collectRange(env, settings, now, days),
    liveOnlineByGame(env, now - settings.heartbeatWindowSeconds * 1000),
  ]);
  const items = [...range.games.values()]
    .map((game) => ({ ...game, online: online.byGame[game.gameId] ?? 0 }))
    .sort((a, b) => b.sessions - a.sessions || a.gameId.localeCompare(b.gameId))
    .slice(0, MAX_GAME_ROWS);
  return { days, today: range.today, fromDay: range.fromDay, items };
}

// ── entry points ─────────────────────────────────────────────────────────────

export async function tryNativeGameStats(request: Request, env: GameStatsEnv): Promise<Response | null> {
  const url = new URL(request.url);
  // The admin gateway prefixes plugin API routes; normalize to the bare namespace.
  const path = url.pathname.replace(GATEWAY_PREFIX, MOUNT);
  if (!path.startsWith(`${MOUNT}/`)) return null;
  const method = request.method;
  const isStore = path.startsWith(`${MOUNT}/store/`) || path === `${MOUNT}/store`;
  const isAdmin = path.startsWith(`${MOUNT}/admin/`) || path === `${MOUNT}/admin`;
  if (!isStore && !isAdmin) return null;
  // Kept for the error path: a browser on a listed origin must be able to read
  // the failure too, otherwise a 500 reaches the page as an opaque CORS error.
  let cors: OriginDecision | null = null;

  try {
    const state = await loadPluginState(env);
    if (!state.enabled) return failure(404, 'PLUGIN_NOT_ENABLED', 'Game Stats is not installed and enabled');
    const now = Date.now();

    if (isStore) {
      const decision = decideOrigin(request, state.settings);
      cors = decision;
      if (method === 'OPTIONS') return preflight(decision);
      if (!decision.allowed) return failure(403, 'FORBIDDEN_ORIGIN', 'Origin not allowed');
      if (method === 'POST' && path === `${MOUNT}/store/sessions`) {
        return withCors(decision, await recordSession(request, env, state.settings, now));
      }
      if (method === 'GET' && path === `${MOUNT}/store/live`) {
        // Ten seconds of browser caching keeps a polling crowd from every page turning into a database read.
        const playing = await liveOnlineByGame(env, now - state.settings.heartbeatWindowSeconds * 1000);
        return withCors(decision, success(
          { online: playing.total, byGame: playing.byGame },
          { 'cache-control': 'public, max-age=10' },
        ));
      }
      return withCors(decision, failure(404, 'NOT_FOUND', 'Unknown Game Stats storefront route'));
    }

    if (method !== 'GET') return failure(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
    const gate = await requireAdminPermission(request, env, ADMIN_PERMISSIONS.DASHBOARD_READ);
    if (!gate.ok) return gate.response;
    const route = path.slice(`${MOUNT}/admin/`.length);
    if (route === 'overview') return success(await adminOverview(env, state.settings, now));
    const days = readDays(url);
    if (days === null) return failure(400, 'VALIDATION_ERROR', 'days must be 7 or 30');
    if (route === 'timeseries') return success(await adminTimeseries(env, state.settings, now, days));
    if (route === 'games') return success(await adminGames(env, state.settings, now, days));
    return failure(404, 'NOT_FOUND', 'Unknown Game Stats admin route');
  } catch (error) {
    const failed = failure(500, 'GAME_STATS_OPERATION_FAILED', error instanceof Error ? error.message : 'Game Stats operation failed');
    return cors?.allowed ? withCors(cors, failed) : failed;
  }
}

export interface GameStatsMaintenance {
  closedSessions: number;
  rolledUpDays: string[];
  prunedSessions: number;
  prunedPlayers: number;
}

/**
 * Scheduled maintenance, run every minute: close sessions whose window has
 * passed, write finished days into the rollups, and prune raw rows past the
 * retention period. Every step is idempotent, so a skipped or repeated run is
 * harmless.
 *
 * Rollups advance one day at a time behind the newest day already rolled up
 * (the newest raw day when nothing is rolled up yet), and stop at a day that
 * still has an open session. A session that began just before midnight can
 * still be open just after it; its day is final only once the sweeper has
 * closed it. Pruning therefore only ever removes days that are rolled up.
 */
export async function processNativeGameStats(env: GameStatsEnv, now = Date.now()): Promise<GameStatsMaintenance> {
  const outcome: GameStatsMaintenance = { closedSessions: 0, rolledUpDays: [], prunedSessions: 0, prunedPlayers: 0 };
  const state = await loadPluginState(env);
  if (!state.enabled) return outcome;
  const { heartbeatWindowSeconds, retentionDays, timezoneOffsetMinutes } = state.settings;
  const windowMs = heartbeatWindowSeconds * 1000;

  const closed = await env.DB.prepare(
    `UPDATE native_game_stats_sessions
     SET ended_at = CAST(last_heartbeat_at + CAST(?2 AS INTEGER) AS INTEGER),
         play_seconds = CAST(MAX(0, (last_heartbeat_at + CAST(?2 AS INTEGER) - started_at) / 1000) AS INTEGER)
     WHERE ended_at IS NULL AND last_heartbeat_at + CAST(?1 AS INTEGER) <= ?3`,
  ).bind(windowMs, windowMs / 2, now).run();
  outcome.closedSessions = Number(closed.meta.changes);

  const today = gameStatsDay(now, timezoneOffsetMinutes);
  const yesterday = shiftDay(today, -1);
  const [newestRollup, oldestRaw] = await Promise.all([
    env.DB.prepare('SELECT MAX(day) AS day FROM native_game_stats_daily_totals').first<{ day: string | null }>(),
    env.DB.prepare('SELECT MIN(day) AS day FROM native_game_stats_sessions').first<{ day: string | null }>(),
  ]);
  for (
    let day = newestRollup?.day ? shiftDay(newestRollup.day, 1) : (oldestRaw?.day ?? today);
    day <= yesterday;
    day = shiftDay(day, 1)
  ) {
    const open = await env.DB.prepare(
      'SELECT 1 AS open FROM native_game_stats_sessions WHERE day = ?1 AND ended_at IS NULL LIMIT 1',
    ).bind(day).first();
    if (open) break;
    await env.DB.batch([
      env.DB.prepare(
        `INSERT OR REPLACE INTO native_game_stats_daily_totals (day, sessions, players, play_seconds)
         SELECT ?1, COUNT(*), (SELECT COUNT(DISTINCT player_key) FROM native_game_stats_players WHERE day = ?1), COALESCE(SUM(play_seconds), 0)
         FROM native_game_stats_sessions WHERE day = ?1`,
      ).bind(day),
      env.DB.prepare(
        `INSERT OR REPLACE INTO native_game_stats_daily (day, game_id, sessions, players, play_seconds)
         SELECT ?1, s.game_id, COUNT(*),
                (SELECT COUNT(*) FROM native_game_stats_players p WHERE p.day = ?1 AND p.game_id = s.game_id),
                COALESCE(SUM(s.play_seconds), 0)
         FROM native_game_stats_sessions s WHERE s.day = ?1 GROUP BY s.game_id`,
      ).bind(day),
    ]);
    outcome.rolledUpDays.push(day);
  }

  const cutoffDay = shiftDay(today, -retentionDays);
  const [prunedSessions, prunedPlayers] = await env.DB.batch([
    env.DB.prepare('DELETE FROM native_game_stats_sessions WHERE day < ?1').bind(cutoffDay),
    env.DB.prepare('DELETE FROM native_game_stats_players WHERE day < ?1').bind(cutoffDay),
  ]);
  outcome.prunedSessions = Number(prunedSessions.meta.changes);
  outcome.prunedPlayers = Number(prunedPlayers.meta.changes);
  return outcome;
}
