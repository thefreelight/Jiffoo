const { createHmac, randomUUID, timingSafeEqual } = require('node:crypto');

function register(ctx) {
  const account = { namespace: 'e2e-psp', merchantAccount: 'store', environment: 'test' };
  ctx.contracts.implement('payment', 2, {
    describe: input => ({ displayName: 'E2E Callback Payment', requiresManualConfirmation: false, unpaidTimeoutMinutes: 120, supportedCurrencies: [input.storeCurrency], account }),
    createSession: async input => {
      const fact = { account, requestKey: input.idempotencyKey, sessionId: `e2e-psp-${randomUUID()}`, amountMinor: input.amountMinor, currency: input.currency,
        observedAt: new Date().toISOString(), status: 'pending', captures: [], canStillBeCharged: true, requestClosed: false, action: { type: 'instructions', text: 'Awaiting the local PSP callback.' } };
      await ctx.database.query('INSERT INTO callback_requests ("requestKey","sessionId",fact) VALUES($1,$2,$3) ON CONFLICT ("requestKey") DO NOTHING', [input.idempotencyKey, fact.sessionId, fact]);
      return (await ctx.database.query('SELECT fact FROM callback_requests WHERE "requestKey"=$1', [input.idempotencyKey])).rows[0].fact;
    },
    queryByRequestKey: async input => {
      const result = await ctx.database.query('SELECT fact FROM callback_requests WHERE "requestKey"=$1', [input.requestKey]);
      if (!result.rows.length) throw new Error('Unknown callback request');
      return result.rows[0].fact;
    },
    handleWebhook: async input => {
      const rawBody = Buffer.from(input.rawBody);
      let event;
      try { event = JSON.parse(rawBody.toString('utf8')); }
      catch { return { verification: 'rejected', reasonCode: 'INVALID_PAYLOAD' }; }
      if (!event || typeof event !== 'object') return { verification: 'rejected', reasonCode: 'INVALID_PAYLOAD' };
      if (!['eventId', 'sessionId'].every(field => typeof event[field] === 'string' && event[field].length > 0)
        || !['succeeded', 'failed'].includes(event.status) || !Number.isSafeInteger(event.amountMinor)
        || event.amountMinor < 0 || !/^[A-Z]{3}$/.test(event.currency)) return { verification: 'rejected', reasonCode: 'INVALID_PAYLOAD' };
      const secret = ctx.config.webhookSecret;
      if (typeof secret !== 'string' || secret.length < 16) throw new Error('WEBHOOK_SECRET_REQUIRED');
      // Protocol: UTF-8 prefix followed by the exact HTTP entity bytes.
      // HMAC-SHA256 is sent as 64 lowercase hexadecimal characters in x-e2e-signature.
      const expected = createHmac('sha256', secret).update('e2e-payment-raw-v1\n', 'utf8').update(rawBody).digest();
      const signatures = input.headers['x-e2e-signature'];
      if (!signatures) return { verification: 'rejected', reasonCode: 'MISSING_SIGNATURE' };
      const signature = signatures.length === 1 ? signatures[0] : undefined;
      if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)
        || !timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return { verification: 'rejected', reasonCode: 'INVALID_SIGNATURE' };
      const result = await ctx.database.query('SELECT fact FROM callback_requests WHERE "sessionId"=$1', [event.sessionId]);
      const previous = result.rows[0]?.fact;
      const observedAt = previous?.providerEventId === event.eventId ? previous.observedAt : new Date().toISOString(), requestKey = previous?.requestKey || event.sessionId;
      const captures = previous?.captures || [];
      if (event.status === 'succeeded' && !captures.some(value => value.providerPaymentId === event.sessionId)) captures.push({
        account, requestKey, sessionId: event.sessionId, providerPaymentId: event.sessionId, amountMinor: event.amountMinor, currency: event.currency, observedAt,
      });
      const fact = { account, requestKey, sessionId: event.sessionId, amountMinor: event.amountMinor, currency: event.currency,
        observedAt, status: event.status, captures, canStillBeCharged: true, requestClosed: false, providerEventId: event.eventId };
      if (previous) await ctx.database.query('UPDATE callback_requests SET fact=$2 WHERE "sessionId"=$1', [event.sessionId, fact]);
      return { verification: 'verified', events: [fact] };
    },
  });
}

module.exports = { register };
