import { afterAll, beforeAll, expect, it } from 'vitest';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { request as httpRequest, type OutgoingHttpHeaders } from 'node:http';
import { createWriteStream, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import archiver from 'archiver';
import Redis from 'ioredis';
import { errorHttpFixture } from '../helpers/error-http-fixture';
import { createTestUser, signJwt } from '../helpers/auth';
import { createTestOrder } from '../helpers/fixtures';
import { getTestPrisma } from '../helpers/db';
import { uploadPluginZip } from '../helpers/plugin-upload';
import { pluginProtectionScope } from '@/infra/shared-protection';

const prisma = getTestPrisma();
const secret = 'b3-test-provider-secret';
const prefix = 'b3-webhook-raw-v1\n';
const slug = `b3-${randomUUID().slice(0, 12)}`;
const proof = ['first value', 'second value'];
const query = { tag: ['one', 'two'], space: 'a b' };
let fixture: Awaited<ReturnType<typeof errorHttpFixture>>;
let admin: Awaited<ReturnType<typeof createTestUser>>;
let installationId: string;
let generation: bigint;
const orderIds: string[] = [];
const paymentIds: string[] = [];

const source = `const {createHash,createHmac,timingSafeEqual}=require('node:crypto');
module.exports={register(ctx){
  ctx.contracts.implement('payment',1,{
    describe:input=>({displayName:'Raw byte PSP',requiresManualConfirmation:false,unpaidTimeoutMinutes:30,supportedCurrencies:[input.storeCurrency]}),
    createSession:input=>({sessionId:'raw-'+input.orderId,action:{type:'instructions',text:'Await callback'}}),
    getSessionStatus:()=>({status:'pending'}),
    handleWebhook:input=>{
      const mode=input.headers['x-mode']?.[0];
      if(mode==='throw')throw new Error('PRIVATE_WEBHOOK_EXCEPTION');
      if(mode==='invalid')return {verification:'untrusted',events:[]};
      if(mode==='invalid-response')return {verification:'verified',events:[],response:{contentType:'text/plain',body:'界'.repeat(5500)}};
      const raw=Buffer.from(input.rawBody);
      const metadata={contentType:input.contentType,proof:input.headers['x-proof'],query:input.query};
      if(Object.keys(input.headers).some(name=>name!==name.toLowerCase())||input.contentType!==input.headers['content-type'][0])throw new Error('Metadata was altered');
      const form=mode==='form'?[...new URLSearchParams(raw.toString('utf8')).entries()]:undefined;
      const canonical=form?JSON.stringify(form.filter(([key])=>key!=='sign').sort(([a],[b])=>a.localeCompare(b))):raw;
      const expected=createHmac('sha256',${JSON.stringify(secret)}).update(${JSON.stringify(prefix)}).update(JSON.stringify(metadata)).update(canonical).digest();
      const signatures=form?form.filter(([key])=>key==='sign').map(([,value])=>value):input.headers['x-signature'];
      const rejection=reasonCode=>({verification:'rejected',reasonCode,...(mode==='custom-reject'?{response:{contentType:'text/plain',body:'failure'}}:{})});
      if(!signatures)return rejection('MISSING_SIGNATURE');
      if(signatures.length!==1||!/^[a-f0-9]{64}$/.test(signatures[0])||!timingSafeEqual(expected,Buffer.from(signatures[0],'hex')))return rejection('INVALID_SIGNATURE');
      if(!raw.length)return rejection('INVALID_PAYLOAD');
      const sessionId=input.headers['x-session']?.[0];
      const events=sessionId?[{providerEventId:input.headers['x-event'][0],sessionId,status:'succeeded'}]:[];
      if(mode==='default')return {verification:'verified',events};
      if(mode==='text-ack')return {verification:'verified',events,response:{contentType:'text/plain',body:'success'}};
      return {verification:'verified',events,response:{contentType:'application/json',body:JSON.stringify({...metadata,hash:createHash('sha256').update(raw).digest('hex'),...(form?{form:form.filter(([key])=>key!=='sign')}:{})})}};
    }
  });
}};`;

beforeAll(async () => {
  admin = await createTestUser({ role: 'ADMIN' });
  fixture = await errorHttpFixture(); fixture.users.add(admin.id);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'b3-webhook-'));
  try {
    await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ schemaVersion: 1, slug, name: slug, version: '1.0.0', description: 'Raw byte webhook fixture', category: 'payment', runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'index.js', permissions: [], contracts: [{ name: 'payment', version: 1 }] }));
    await fs.writeFile(path.join(directory, 'index.js'), source);
    const zip = path.join(directory, 'plugin.zip');
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(zip), archive = archiver('zip');
      output.on('close', resolve); output.on('error', reject); archive.on('error', reject); archive.pipe(output);
      for (const name of ['manifest.json', 'index.js']) archive.file(path.join(directory, name), { name });
      void archive.finalize();
    });
    const uploaded = await uploadPluginZip(fixture.base, signJwt(admin), await fs.readFile(zip));
    expect(uploaded.status, await uploaded.text()).toBe(200);
    const installation = await prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: slug } }); installationId = installation.id;
    const enabled = await fixture.request(`/api/v1/extensions/plugin/${slug}/instances/${installationId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${signJwt(admin)}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true }) });
    expect(enabled.status, await enabled.text()).toBe(200);
    generation = (await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: installationId } })).protectionGeneration;
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
}, 90000);

afterAll(async () => {
  await fixture?.close();
  const events = await prisma.eventRecord.findMany({ where: { aggregateId: { in: [...orderIds, ...paymentIds] } }, select: { id: true } });
  await prisma.eventDelivery.deleteMany({ where: { eventId: { in: events.map(event => event.id) } } });
  await prisma.eventRecord.deleteMany({ where: { id: { in: events.map(event => event.id) } } });
  await prisma.notification.deleteMany({ where: { relatedId: { in: orderIds } } });
  await prisma.paymentLedger.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.pluginInstall.deleteMany({ where: { slug } });
  if (admin) await prisma.user.deleteMany({ where: { id: admin.id } });
  const redis = new Redis(process.env.REDIS_URL!);
  try { if (installationId) { const keys = await redis.keys(`${pluginProtectionScope(installationId, generation)}:*`); if (keys.length) await redis.del(...keys); } }
  finally { redis.disconnect(); }
}, 60000);

type Response = { status: number; headers: import('node:http').IncomingHttpHeaders; body: Buffer };
function send(body: Buffer, options: { contentType?: string | string[] | null; mode?: string; signature?: string | string[] | null; chunks?: Buffer[]; headers?: OutgoingHttpHeaders } = {}): Promise<Response> {
  const contentType = options.contentType === undefined ? 'application/json' : options.contentType;
  const signedType = Array.isArray(contentType) ? contentType[0] : contentType ?? '';
  const signed = createHmac('sha256', secret).update(prefix).update(JSON.stringify({ contentType: signedType, proof, query })).update(body).digest('hex');
  const headers: OutgoingHttpHeaders = { 'x-forwarded-for': fixture.ip, 'X-Proof': proof, 'x-mode': options.mode ?? 'raw', ...(contentType === null ? {} : { 'Content-Type': contentType }), ...(options.signature === null ? {} : { 'X-Signature': options.signature ?? signed }), ...(options.chunks ? {} : { 'Content-Length': body.length }), ...options.headers };
  return new Promise((resolve, reject) => {
    const request = httpRequest(new URL(`/api/v1/payments/webhook/${slug}?tag=one&tag=two&space=a%20b`, fixture.base), { method: 'POST', headers }, response => {
      const chunks: Buffer[] = []; response.on('data', chunk => chunks.push(chunk)); response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode!, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    request.on('error', reject);
    if (options.chunks) { for (const chunk of options.chunks) request.write(chunk); request.end(); }
    else request.end(body);
  });
}
function error(response: Response, status: number, code: string) {
  expect(response.status).toBe(status); expect(response.headers['cache-control']).toBe('no-store');
  expect(JSON.parse(response.body.toString())).toMatchObject({ success: false, error: { code } });
}
async function unchangedWork<T>(work: (payment: Awaited<ReturnType<typeof pendingPayment>>) => Promise<T>) {
  const payment = await pendingPayment(); const before = await evidence(payment);
  const result = await work(payment); expect(await evidence(payment)).toEqual(before); return result;
}
async function pendingPayment(provider = slug) {
  const order = await createTestOrder({ userId: admin.id, total: 12.50 }); orderIds.push(order.id);
  const payment = await prisma.payment.create({ data: { orderId: order.id, paymentMethod: provider, sessionId: randomUUID(), amount: 12.50, currency: 'USD' } }); paymentIds.push(payment.id);
  return payment;
}
async function evidence(payment: Awaited<ReturnType<typeof pendingPayment>>) {
  return {
    order: await prisma.order.findUniqueOrThrow({ where: { id: payment.orderId } }),
    payment: await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }),
    ledger: await prisma.paymentLedger.findMany({ where: { orderId: payment.orderId }, orderBy: { id: 'asc' } }),
    history: await prisma.orderStatusHistory.findMany({ where: { orderId: payment.orderId }, orderBy: { id: 'asc' } }),
    notifications: await prisma.notification.findMany({ where: { relatedId: payment.orderId }, orderBy: { id: 'asc' } }),
    events: await prisma.eventRecord.findMany({ where: { aggregateId: { in: [payment.orderId, payment.id] } }, orderBy: { id: 'asc' } }),
  };
}
async function rawProof(body: Buffer, contentType = 'application/json', chunks?: Buffer[]) {
  const response = await send(body, { contentType, chunks });
  expect(response.status).toBe(200); expect(response.headers['cache-control']).toBe('no-store');
  const expected = { contentType, proof, query, hash: createHash('sha256').update(body).digest('hex') };
  expect(response.body.equals(Buffer.from(JSON.stringify(expected)))).toBe(true);
}

it('A preserves JSON whitespace bytes and ordered duplicate lowercase headers', async () => rawProof(Buffer.from('{  "a" : 1 }\r\n')));
it('A preserves JSON key order bytes', async () => rawProof(Buffer.from('{"z":1,"a":2}')));
it('A preserves literal Unicode and escaped Unicode bytes', async () => rawProof(Buffer.from('{"literal":"界","escaped":"\\u754c"}')));
it('A preserves a multibyte character split across chunked HTTP writes', async () => {
  const body = Buffer.from('{"value":"界"}'), split = body.indexOf(Buffer.from('界')) + 1;
  await rawProof(body, 'application/json', [body.subarray(0, split), body.subarray(split)]);
});
it('A delivers an empty body as zero bytes and rejects without state changes', async () => unchangedWork(async payment => {
  error(await send(Buffer.alloc(0), { headers: { 'x-session': payment.sessionId!, 'x-event': randomUUID() } }), 401, 'PAYMENT_WEBHOOK_AUTHENTICATION_FAILED');
}));
it('A preserves the full content type including an opaque charset parameter', async () => rawProof(Buffer.from('{"value":1}'), 'application/json; charset="opaque-charset"; profile="one,two"'));
it('A verifies exact text/xml bytes with a charset', async () => rawProof(Buffer.from('<?xml version="1.0"?><pay>界 &amp; value</pay>\r\n'), 'text/xml; charset=UTF-8'));
it('A verifies exact application/xml bytes with a charset', async () => rawProof(Buffer.from('<pay id="1">\n  signed\n</pay>'), 'application/xml; charset=iso-8859-1'));

it.each([
  ['B verifies form parameters encoded with plus', 'value=a+b', [['value', 'a b']]],
  ['B verifies form parameters encoded with percent20', 'value=a%20b', [['value', 'a b']]],
  ['B preserves Unicode and ordered repeated form parameters', 'tag=%E7%95%8C&tag=two&value=a%2Bb', [['tag', '界'], ['tag', 'two'], ['value', 'a+b']]],
] as const)('%s', async (_title, encoded, expectedForm) => {
  const contentType = 'application/x-www-form-urlencoded; charset=UTF-8';
  const entries = [...new URLSearchParams(encoded).entries()];
  const signature = createHmac('sha256', secret).update(prefix).update(JSON.stringify({ contentType, proof, query })).update(JSON.stringify(entries.sort(([a], [b]) => a.localeCompare(b)))).digest('hex');
  const body = Buffer.from(`${encoded}&sign=${signature}`);
  const response = await send(body, { contentType, mode: 'form', signature: null });
  expect(response.status).toBe(200);
  expect(JSON.parse(response.body.toString())).toEqual({ contentType, proof, query, hash: createHash('sha256').update(body).digest('hex'), form: expectedForm });
});

it('C accepts exactly one MiB through the larger internal base64 envelope', async () => rawProof(Buffer.alloc(1024 * 1024, 120), 'text/plain; charset=UTF-8'));
it('C rejects a Content-Length above one MiB', async () => error(await send(Buffer.alloc(1024 * 1024 + 1, 120)), 413, 'PAYLOAD_TOO_LARGE'));
it('C rejects chunked streamed bytes above one MiB', async () => {
  const body = Buffer.alloc(1024 * 1024 + 1, 120);
  error(await send(body, { chunks: [body.subarray(0, 1024 * 1024), body.subarray(1024 * 1024)] }), 413, 'PAYLOAD_TOO_LARGE');
});
it('C rejects an unsupported media type', async () => error(await send(Buffer.from('data'), { contentType: 'application/octet-stream' }), 415, 'UNSUPPORTED_MEDIA_TYPE'));
it('C rejects a missing content type', async () => error(await send(Buffer.from('data'), { contentType: null }), 415, 'UNSUPPORTED_MEDIA_TYPE'));
it('C rejects duplicate and comma-ambiguous content types', async () => {
  for (const contentType of [['application/json', 'text/plain'], 'application/json, text/plain']) error(await send(Buffer.from('{}'), { contentType }), 400, 'BAD_REQUEST');
});
it('C rejects non-identity content encoding', async () => error(await send(Buffer.from('{}'), { headers: { 'Content-Encoding': 'gzip' } }), 415, 'UNSUPPORTED_MEDIA_TYPE'));
it('C rejects multipart without invoking the inherited multipart parser', async () => error(await send(Buffer.from('--boundary--\r\n'), { contentType: 'multipart/form-data; boundary=boundary' }), 415, 'UNSUPPORTED_MEDIA_TYPE'));

it.each([
  ['D missing signature returns 401 without state changes or plugin failure', null],
  ['D malformed signature returns 401 without state changes or plugin failure', 'invalid'],
  ['D wrong signature returns 401 without state changes or plugin failure', '0'.repeat(64)],
  ['D tampered bytes return 401 without state changes or plugin failure', 'tampered'],
] as const)('%s', async (_title, signature) => unchangedWork(async payment => {
  const body = Buffer.from('{"amount":1250}');
  const before = await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: installationId } });
  const redis = new Redis(process.env.REDIS_URL!); const scope = pluginProtectionScope(installationId, generation);
  try {
    const failures = await redis.zcard(`${scope}:failures`);
    const signed = signature === 'tampered' ? createHmac('sha256', secret).update(prefix).update(JSON.stringify({ contentType: 'application/json', proof, query })).update(Buffer.from('{"amount":1251}')).digest('hex') : signature;
    error(await send(body, { signature: signed, headers: { 'x-session': payment.sessionId!, 'x-event': randomUUID() } }), 401, 'PAYMENT_WEBHOOK_AUTHENTICATION_FAILED');
    const after = await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: installationId } });
    expect(after.lastFailureAt).toEqual(before.lastFailureAt); expect(after.lastFailureMessage).toBe(before.lastFailureMessage);
    expect(await redis.zcard(`${scope}:failures`)).toBe(failures);
    expect((await send(body)).status).toBe(200);
  } finally { redis.disconnect(); }
}));

it.each([
  ['E plugin exception returns sanitized 502 and records a failure', 'throw'],
  ['E invalid outcome returns sanitized 502 and records a failure', 'invalid'],
  ['E invalid multibyte response description returns sanitized 502 and records a failure', 'invalid-response'],
] as const)('%s', async (_title, mode) => unchangedWork(async payment => {
  // Reconfiguration resets the runtime without disabling the last payment provider.
  const configured = await fixture.request(`/api/v1/extensions/plugin/${slug}/instances/${installationId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${signJwt(admin)}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ config: {} }) });
  expect(configured.status, await configured.text()).toBe(200);
  generation = (await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: installationId } })).protectionGeneration;
  const redis = new Redis(process.env.REDIS_URL!); const scope = pluginProtectionScope(installationId, generation);
  try {
    const failures = await redis.zcard(`${scope}:failures`);
    const response = await send(Buffer.from('{}'), { mode, headers: { 'x-session': payment.sessionId!, 'x-event': randomUUID() } });
    error(response, 502, 'PLUGIN_ERROR'); expect(response.body.toString()).not.toContain('PRIVATE_WEBHOOK_EXCEPTION');
    expect((await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: installationId } })).lastFailureAt).not.toBeNull();
    expect(await redis.zcard(`${scope}:failures`)).toBe(failures + 1);
  } finally {
    const keys = await redis.keys(`${scope}:*`); if (keys.length) await redis.del(...keys); redis.disconnect();
  }
}));

it('F sends success ACK only after the real payment transaction commits and bounds PSP responses', async () => {
  const payment = await pendingPayment(), before = await evidence(payment);
  let release!: () => void, entered!: (pid: number) => void;
  const unlocked = new Promise<void>(resolve => { release = resolve; });
  const locked = new Promise<number>(resolve => { entered = resolve; });
  const blocker = prisma.$transaction(async tx => {
    const [{ pid }] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
    await tx.$queryRaw`SELECT id FROM payments WHERE id = ${payment.id} FOR UPDATE`;
    entered(pid); await unlocked;
  }, { timeout: 20000 });
  const pid = await locked; let finished = false;
  const pending = send(Buffer.from('{}'), { mode: 'text-ack', headers: { 'x-session': payment.sessionId!, 'x-event': randomUUID() } }).then(response => { finished = true; return response; });
  try {
    const deadline = Date.now() + 10000;
    let blocked = false;
    while (!blocked && !finished && Date.now() < deadline) {
      const rows = await prisma.$queryRaw<Array<{ pid: number }>>`SELECT pid FROM pg_stat_activity WHERE ${pid} = ANY(pg_blocking_pids(pid))`;
      blocked = rows.length > 0;
    }
    expect(blocked).toBe(true); expect(finished).toBe(false); expect(await evidence(payment)).toEqual(before);
  } finally { release(); await blocker; }
  const response = await pending; expect(response.status).toBe(200); expect(response.body.toString()).toBe('success'); expect(response.headers['cache-control']).toBe('no-store');
  const state = await evidence(payment); expect(state.order.paymentStatus).toBe('PAID'); expect(state.payment.status).toBe('SUCCEEDED');
  const rejection = await unchangedWork(async other => send(Buffer.from('{}'), { mode: 'custom-reject', signature: '0'.repeat(64), headers: { 'x-session': other.sessionId!, 'x-event': randomUUID() } }));
  expect(rejection.status).toBe(401); expect(rejection.body.toString()).toBe('failure'); expect(rejection.headers['x-jiffoo-error-code']).toBe('PAYMENT_WEBHOOK_AUTHENTICATION_FAILED'); expect(rejection.headers['cache-control']).toBe('no-store');
});
it('F replay creates no additional ledger event history or notification rows', async () => {
  const payment = await pendingPayment(), headers = { 'x-session': payment.sessionId!, 'x-event': randomUUID() };
  const response = await send(Buffer.from('{}'), { mode: 'default', headers }); expect(response.status).toBe(200); expect(JSON.parse(response.body.toString())).toEqual({ success: true, data: { received: true } });
  const before = await evidence(payment); expect(before.ledger).toHaveLength(1); expect(before.history).toHaveLength(1); expect(before.events).toHaveLength(2); expect(before.notifications).toHaveLength(1);
  expect((await send(Buffer.from('{}'), { mode: 'default', headers })).status).toBe(200); expect(await evidence(payment)).toEqual(before);
});
it('F a verified callback for another provider session changes no payment or order', async () => {
  const payment = await pendingPayment('manual-payment'), before = await evidence(payment);
  expect((await send(Buffer.from('{}'), { headers: { 'x-session': payment.sessionId!, 'x-event': randomUUID() } })).status).toBe(200);
  expect(await evidence(payment)).toEqual(before);
});
