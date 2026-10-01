interface WebhookSubscription { id: string; endpoint_url: string; secret: string | null }
type WebhookEnv = Pick<Cloudflare.Env, 'DB'>;

async function signature(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function deliverOne(env: WebhookEnv, eventId: string, eventType: string, payload: unknown, attempt: number, sub: WebhookSubscription): Promise<void> {
  const endpoint = new URL(sub.endpoint_url);
  if (endpoint.protocol !== 'https:') throw new Error(`Webhook ${sub.id} must use HTTPS`);
  const body = JSON.stringify({ id: eventId, type: eventType, payload, timestamp: new Date().toISOString() });
  const headers = new Headers({ 'content-type': 'application/json', 'user-agent': 'JiffooMall-Webhook/1.0', 'x-webhook-event': eventType, 'x-webhook-delivery': eventId, 'x-webhook-attempt': String(attempt) });
  if (sub.secret) headers.set('x-webhook-signature', `sha256=${await signature(sub.secret, body)}`);
  const start = Date.now();
  let status: number | null = null;
  let deliveryError: string | null = null;
  try {
    const response = await fetch(endpoint, { method: 'POST', headers, body, signal: AbortSignal.timeout(10_000) });
    status = response.status;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error: unknown) {
    deliveryError = error instanceof Error ? error.message : String(error);
  }
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO native_webhook_delivery_logs
      (id, subscription_id, event_id, attempt, status, response_code, error_message, latency_ms, delivered_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
  ).bind(crypto.randomUUID(), sub.id, eventId, attempt, deliveryError ? 'failed' : 'success', status, deliveryError?.slice(0, 500) ?? null, Date.now() - start, now).run();
  if (deliveryError) {
    if (attempt >= 10) {
      await env.DB.prepare(
        `INSERT INTO native_webhook_dead_letters
          (id, event_id, subscription_id, event_type, payload, last_error, retry_count, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(event_id, subscription_id) DO UPDATE SET last_error = excluded.last_error,
           retry_count = excluded.retry_count`,
      ).bind(crypto.randomUUID(), eventId, sub.id, eventType, JSON.stringify(payload), deliveryError.slice(0, 1000), attempt, now).run();
      return;
    }
    throw new Error(`Webhook ${sub.id} failed: ${deliveryError}`);
  }
}

export async function deliverNativeWebhooks(env: WebhookEnv, eventId: string, eventType: string, payload: unknown, attempt: number): Promise<void> {
  const subscriptions = await env.DB.prepare(
    'SELECT id, endpoint_url, secret FROM native_webhook_subscriptions WHERE event_type = ?1 AND active = 1 ORDER BY id',
  ).bind(eventType).all<WebhookSubscription>();
  for (const subscription of subscriptions.results) await deliverOne(env, eventId, eventType, payload, attempt, subscription);
}
