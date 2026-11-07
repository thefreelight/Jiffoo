import { authenticateNativeUser, type NativeAuthEnv } from './auth';
import { isNativePluginEnabled } from './plugin-enabled';

type Env = NativeAuthEnv & { DB: D1Database };

interface FirePathProfileRow {
  installation_id: string;
  user_id: string;
  display_name: string;
  level: number;
  xp: number;
  energy: number;
  energy_max: number;
  coins: number;
  strategy: string;
  opening_net_worth_minor: number;
  annual_expense_target_minor: number;
  withdrawal_rate_bps: number;
}

interface FirePathTransactionRow {
  id: string;
  amount_minor: number;
  direction: string;
  category: string;
  account_id: string;
  note: string | null;
  occurred_at: string;
}

interface FirePathMissionCompletionRow {
  mission_id: string;
}

const MISSIONS = [
  { id: 'record-expense', title: '记录 1 笔支出', rewardXp: 20, rewardEnergy: 10 },
  { id: 'transfer-freedom', title: '转存 $120 到自由基金', rewardXp: 30, rewardEnergy: 15 },
  { id: 'review-subscription', title: '检查 1 项订阅', rewardXp: 20, rewardEnergy: 10 },
] as const;

const INSTALLATION_ID = 'default';
const STORE_PREFIX = '/api/v1/plugins/firepath-core/store';
const BARE_PREFIX = '/api/v1/firepath/v1';

function response(data: unknown, status = 200): Response {
  return Response.json(status < 400 ? { success: true, data } : { success: false, error: data }, {
    status,
    headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-firepath-core' },
  });
}

function error(code: string, message: string, status: number): Response {
  return response({ code, message }, status);
}

function dayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function monthStart(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function safeNumber(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw { code: 'AMOUNT_OUT_OF_RANGE', message: 'Amount is outside the supported range', status: 422 };
  }
  return value;
}

async function profileFor(env: Env, userId: string): Promise<FirePathProfileRow> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO firepath_profiles
       (installation_id, user_id, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?3)
     ON CONFLICT (installation_id, user_id) DO NOTHING`,
  ).bind(INSTALLATION_ID, userId, now).run();
  const profile = await env.DB.prepare(
    'SELECT * FROM firepath_profiles WHERE installation_id = ?1 AND user_id = ?2',
  ).bind(INSTALLATION_ID, userId).first<FirePathProfileRow>();
  if (!profile) {
    throw { code: 'PROFILE_NOT_FOUND', message: 'FirePath profile was not found', status: 500 };
  }
  return profile;
}

async function snapshotFor(env: Env, userId: string): Promise<Record<string, unknown>> {
  const [profile, transactions, completions, monthTransactions] = await Promise.all([
    profileFor(env, userId),
    env.DB.prepare(
      'SELECT * FROM firepath_transactions WHERE installation_id = ?1 AND user_id = ?2 ORDER BY occurred_at DESC LIMIT 20',
    ).bind(INSTALLATION_ID, userId).all<FirePathTransactionRow>(),
    env.DB.prepare(
      'SELECT mission_id FROM firepath_mission_completions WHERE installation_id = ?1 AND user_id = ?2 AND mission_date = ?3',
    ).bind(INSTALLATION_ID, userId, dayKey()).all<FirePathMissionCompletionRow>(),
    env.DB.prepare(
      'SELECT amount_minor, direction FROM firepath_transactions WHERE installation_id = ?1 AND user_id = ?2 AND occurred_at >= ?3',
    ).bind(INSTALLATION_ID, userId, monthStart()).all<{ amount_minor: number; direction: string }>(),
  ]);

  const netChange = transactions.results.reduce((sum, item) => sum + item.amount_minor, 0);
  const openingNetWorthMinor = profile.opening_net_worth_minor;
  const annualExpenseTargetMinor = profile.annual_expense_target_minor;
  const currentMinor = safeNumber(openingNetWorthMinor + netChange);
  const targetMinor = annualExpenseTargetMinor > 0
    ? safeNumber(Math.floor((annualExpenseTargetMinor * 10000) / profile.withdrawal_rate_bps))
    : 0;
  const remainingMinor = Math.max(0, targetMinor - currentMinor);
  const progressPercent = targetMinor > 0 ? Math.max(0, Math.min(100, Math.round((currentMinor / targetMinor) * 100))) : 0;
  const monthlyIncome = monthTransactions.results
    .filter((item) => item.direction === 'income')
    .reduce((sum, item) => sum + item.amount_minor, 0);
  const monthlyExpenses = monthTransactions.results
    .filter((item) => item.direction === 'expense')
    .reduce((sum, item) => sum - item.amount_minor, 0);
  const monthlySurplus = monthlyIncome - monthlyExpenses;
  const completedIds = new Set(completions.results.map((item) => item.mission_id));

  return {
    profile: {
      displayName: profile.display_name,
      level: profile.level,
      xp: profile.xp,
      energy: profile.energy,
      energyMax: profile.energy_max,
      coins: profile.coins,
    },
    fire: {
      strategy: profile.strategy,
      currentMinor,
      targetMinor,
      remainingMinor,
      progressPercent,
      currentStage: targetMinor === 0 ? '设置 FIRE 计划' : monthlySurplus >= 0 ? '现金流为正' : '生存稳定',
    },
    metrics: {
      monthlySurplusMinor: safeNumber(monthlySurplus),
      savingsRatePercent: monthlyIncome > 0 ? Math.round((monthlySurplus * 100) / monthlyIncome) : 0,
      passiveIncomeCoveragePercent: 0,
    },
    missions: MISSIONS.map((mission) => ({ ...mission, status: completedIds.has(mission.id) ? 'completed' : 'pending' })),
    transactions: transactions.results.map((item) => ({
      id: item.id,
      merchant: item.note || item.category,
      category: item.category,
      amountMinor: safeNumber(item.amount_minor),
      occurredAt: item.occurred_at,
    })),
    suggestion: {
      title: 'AI 建议',
      body: targetMinor === 0
        ? '先设置年度支出和 FIRE 策略，再开始追踪你的自由进度。'
        : monthlySurplus > 0
          ? '本月保持正结余。建议确认账目后，将部分结余转入自由基金。'
          : '本月支出高于收入。先检查可取消的订阅和非必要开支。',
    },
  };
}

async function handleSnapshot(env: Env, userId: string): Promise<Response> {
  return response(await snapshotFor(env, userId));
}

async function handleCreateTransaction(request: Request, env: Env, userId: string): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error('INVALID_REQUEST', 'A JSON body is required', 400);
  }
  const input = body as {
    amountMinor?: unknown;
    direction?: unknown;
    category?: unknown;
    accountId?: unknown;
    note?: unknown;
    occurredAt?: unknown;
  };
  const amountMinor = input.amountMinor;
  const direction = input.direction;
  if (typeof amountMinor !== 'number' || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    return error('INVALID_REQUEST', 'amountMinor must be a positive integer', 400);
  }
  if (direction !== 'income' && direction !== 'expense') {
    return error('INVALID_REQUEST', 'direction must be income or expense', 400);
  }
  if (typeof input.category !== 'string' || !input.category.trim()) {
    return error('INVALID_REQUEST', 'category is required', 400);
  }
  const accountId = typeof input.accountId === 'string' && input.accountId.trim() ? input.accountId : 'personal-default';
  const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim() : null;
  const occurredAt = typeof input.occurredAt === 'string' && !Number.isNaN(Date.parse(input.occurredAt))
    ? new Date(input.occurredAt).toISOString()
    : new Date().toISOString();

  const id = crypto.randomUUID();
  const signedAmount = direction === 'expense' ? -amountMinor : amountMinor;
  await env.DB.prepare(
    `INSERT INTO firepath_transactions
       (id, installation_id, user_id, amount_minor, direction, category, account_id, note, occurred_at, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
  ).bind(id, INSTALLATION_ID, userId, signedAmount, direction, input.category.trim(), accountId, note, occurredAt, new Date().toISOString()).run();

  return response({
    transaction: {
      id,
      merchant: note || String(input.category).trim(),
      category: input.category.trim(),
      amountMinor: signedAmount,
      occurredAt,
    },
    snapshot: await snapshotFor(env, userId),
  }, 201);
}

async function handleCompleteMission(env: Env, userId: string, missionId: string): Promise<Response> {
  const mission = MISSIONS.find((item) => item.id === missionId);
  if (!mission) return error('MISSION_NOT_FOUND', 'Mission was not found', 404);

  await profileFor(env, userId);
  const date = dayKey();
  const existing = await env.DB.prepare(
    'SELECT id FROM firepath_mission_completions WHERE installation_id = ?1 AND user_id = ?2 AND mission_id = ?3 AND mission_date = ?4',
  ).bind(INSTALLATION_ID, userId, missionId, date).first<{ id: string }>();
  if (!existing) {
    await env.DB.prepare(
      `INSERT INTO firepath_mission_completions
         (id, installation_id, user_id, mission_id, mission_date, reward_xp, reward_energy, completed_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    ).bind(crypto.randomUUID(), INSTALLATION_ID, userId, missionId, date, mission.rewardXp, mission.rewardEnergy, new Date().toISOString()).run();
    await env.DB.prepare(
      `UPDATE firepath_profiles
       SET xp = xp + ?3,
           energy = MIN(energy_max, energy + ?4),
           updated_at = ?5
       WHERE installation_id = ?1 AND user_id = ?2`,
    ).bind(INSTALLATION_ID, userId, mission.rewardXp, mission.rewardEnergy, new Date().toISOString()).run();
  }
  return response({
    mission: { ...mission, status: 'completed' },
    snapshot: await snapshotFor(env, userId),
  });
}

function requestPath(pathname: string): string | null {
  if (pathname === STORE_PREFIX || pathname.startsWith(`${STORE_PREFIX}/`)) {
    return pathname.slice(STORE_PREFIX.length) || '/';
  }
  if (pathname === BARE_PREFIX || pathname.startsWith(`${BARE_PREFIX}/`)) {
    return `/api/firepath/v1${pathname.slice(BARE_PREFIX.length)}`;
  }
  return null;
}

export async function tryNativeFirepathCore(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const path = requestPath(url.pathname);
  if (path === null) return null;
  if (!(await isNativePluginEnabled(env, 'firepath-core'))) {
    return error('PLUGIN_NOT_ENABLED', 'FirePath Core plugin is not installed and enabled', 404);
  }
  const user = await authenticateNativeUser(request, env);
  if (!user) return error('UNAUTHORIZED', 'Login required', 401);

  try {
    if (request.method === 'GET' && path === '/api/firepath/v1/snapshot') return await handleSnapshot(env, user.id);
    if (request.method === 'POST' && path === '/api/firepath/v1/transactions') {
      return await handleCreateTransaction(request, env, user.id);
    }
    const mission = path.match(/^\/api\/firepath\/v1\/missions\/([^/]+)\/complete$/);
    if (request.method === 'POST' && mission) {
      return await handleCompleteMission(env, user.id, decodeURIComponent(mission[1]));
    }
    return null;
  } catch (thrown) {
    const failure = thrown as { code?: string; message?: string; status?: number };
    if (failure && typeof failure.code === 'string' && typeof failure.message === 'string') {
      return error(failure.code, failure.message, typeof failure.status === 'number' ? failure.status : 500);
    }
    throw thrown;
  }
}
