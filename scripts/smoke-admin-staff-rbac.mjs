#!/usr/bin/env node

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;

    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = 'true';
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/smoke-admin-staff-rbac.mjs --base-url <api-base-url> --owner-token <jwt>

Options:
  --base-url       API base URL, defaults to env JIFFOO_SMOKE_API_BASE_URL or http://localhost:3001/api
  --owner-token    Owner/admin JWT used to run the smoke flow
  --temp-email     Optional fixed email for the temporary staff account
  --temp-username  Optional fixed username for the temporary staff account

Environment:
  JIFFOO_SMOKE_API_BASE_URL
  JIFFOO_SMOKE_OWNER_TOKEN

Behavior:
  - verifies /auth/me returns staff management access
  - exercises staff list, catalog, create, detail, audit, update, invite, and remove
  - cleans up the temporary staff membership at the end
`);
}

const args = parseArgs(process.argv.slice(2));

if (args.help === 'true') {
  printHelp();
  process.exit(0);
}

const baseUrl = (args['base-url'] || process.env.JIFFOO_SMOKE_API_BASE_URL || 'http://localhost:3001/api').replace(/\/+$/, '');
const ownerToken = args['owner-token'] || process.env.JIFFOO_SMOKE_OWNER_TOKEN;

if (!ownerToken) {
  console.error('Missing owner token. Pass --owner-token or set JIFFOO_SMOKE_OWNER_TOKEN.');
  process.exit(1);
}

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const tempEmail = args['temp-email'] || `staff-smoke-${runId}@test.com`;
const tempUsername = args['temp-username'] || `staff-smoke-${runId}`;

let createdUserId = null;

function ownerHeaders() {
  return {
    authorization: `Bearer ${ownerToken}`,
    'content-type': 'application/json',
  };
}

async function api(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: ownerHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
    throw new Error(`${method} ${path} failed: ${message}`);
  }

  if (!payload?.success) {
    throw new Error(`${method} ${path} returned unsuccessful payload`);
  }

  return payload.data;
}

async function cleanup() {
  if (!createdUserId) return;

  try {
    await api('DELETE', `/admin/staff/${createdUserId}`);
    console.log(`cleanup: removed temporary staff ${createdUserId}`);
  } catch (error) {
    console.warn(`cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  console.log(`smoke: using base URL ${baseUrl}`);

  try {
    const me = await api('GET', '/auth/me');
    if (!Array.isArray(me.permissions) || !me.permissions.includes('staff.write')) {
      throw new Error('Current token does not have staff.write');
    }
    console.log('check: /auth/me returned staff.write');

    const roles = await api('GET', '/admin/staff/roles');
    const permissions = await api('GET', '/admin/staff/permissions');
    const staffListBefore = await api('GET', '/admin/staff?page=1&limit=20');
    console.log(`check: catalogs loaded (${roles.length} roles, ${permissions.length} permission groups)`);
    console.log(`check: current staff list size ${staffListBefore.total}`);

    const created = await api('POST', '/admin/staff', {
      email: tempEmail,
      username: tempUsername,
      role: 'ANALYST',
      status: 'ACTIVE',
      extraPermissions: [],
      revokedPermissions: [],
    });
    createdUserId = created.userId;
    console.log(`check: created temp staff ${created.userId} (${created.email})`);

    const detail = await api('GET', `/admin/staff/${created.userId}`);
    if (detail.adminRole !== 'ANALYST') {
      throw new Error(`Expected ANALYST role, got ${detail.adminRole}`);
    }
    console.log('check: detail endpoint returns ANALYST role');

    const updated = await api('PATCH', `/admin/staff/${created.userId}`, {
      role: 'SUPPORT_AGENT',
      status: 'SUSPENDED',
      isOwner: false,
      extraPermissions: [],
      revokedPermissions: ['orders.write'],
    });
    if (updated.adminRole !== 'SUPPORT_AGENT' || updated.status !== 'SUSPENDED') {
      throw new Error('Update did not apply expected role/status');
    }
    console.log('check: update endpoint changed role/status/overrides');

    const invite = await api('POST', `/admin/staff/${created.userId}/invite`);
    if (!invite.invited) {
      throw new Error('Invite endpoint did not confirm invited=true');
    }
    console.log('check: invite resend endpoint succeeded');

    const audit = await api('GET', `/admin/staff/${created.userId}/audit?page=1&limit=20`);
    const actions = new Set(audit.items.map((entry) => entry.action));
    for (const action of ['STAFF_ACCESS_GRANTED', 'STAFF_ACCESS_UPDATED', 'STAFF_INVITE_RESENT']) {
      if (!actions.has(action)) {
        throw new Error(`Audit log missing expected action ${action}`);
      }
    }
    console.log(`check: audit endpoint returned ${audit.items.length} entries with expected actions`);

    await api('DELETE', `/admin/staff/${created.userId}`);
    console.log('check: remove endpoint succeeded');
    createdUserId = null;

    console.log('smoke: admin staff RBAC flow passed');
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error(`smoke failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
