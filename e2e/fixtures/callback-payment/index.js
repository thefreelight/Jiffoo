const { createHmac, randomUUID, timingSafeEqual } = require('node:crypto');

function register(ctx) {
  ctx.contracts.implement('payment', 1, {
    describe: input => ({ displayName: 'E2E Callback Payment', requiresManualConfirmation: false, unpaidTimeoutMinutes: 120, supportedCurrencies: [input.storeCurrency] }),
    createSession: () => ({ sessionId: `e2e-psp-${randomUUID()}`, action: { type: 'instructions', text: 'Awaiting the local PSP callback.' } }),
    getSessionStatus: () => ({ status: 'pending' }),
    handleWebhook: input => {
      const event = JSON.parse(input.rawBody);
      if (!['eventId', 'sessionId'].every(field => typeof event[field] === 'string' && event[field].length > 0)
        || !['succeeded', 'failed'].includes(event.status) || !Number.isSafeInteger(event.amountMinor)
        || event.amountMinor < 0 || !/^[A-Z]{3}$/.test(event.currency)) throw new Error('INVALID_CALLBACK_FIELDS');
      const secret = ctx.config.webhookSecret;
      if (typeof secret !== 'string' || secret.length < 16) throw new Error('WEBHOOK_SECRET_REQUIRED');
      // Protocol: UTF-8 JSON array, fixed field order, integer minor units, uppercase currency.
      // HMAC-SHA256 is sent as 64 lowercase hexadecimal characters in x-e2e-signature.
      const message = JSON.stringify(['e2e-payment-v1', event.eventId, event.sessionId, event.status, event.amountMinor, event.currency]);
      const expected = createHmac('sha256', secret).update(message, 'utf8').digest();
      const signature = input.headers['x-e2e-signature'];
      if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)
        || !timingSafeEqual(expected, Buffer.from(signature, 'hex'))) throw new Error('INVALID_CALLBACK_SIGNATURE');
      return { events: [{ providerEventId: event.eventId, sessionId: event.sessionId, status: event.status }] };
    },
  });
}

module.exports = { register };
