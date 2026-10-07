const { createHmac, randomUUID, timingSafeEqual } = require('node:crypto');

function register(ctx) {
  ctx.contracts.implement('payment', 1, {
    describe: input => ({ displayName: 'E2E Callback Payment', requiresManualConfirmation: false, unpaidTimeoutMinutes: 120, supportedCurrencies: [input.storeCurrency] }),
    createSession: () => ({ sessionId: `e2e-psp-${randomUUID()}`, action: { type: 'instructions', text: 'Awaiting the local PSP callback.' } }),
    getSessionStatus: () => ({ status: 'pending' }),
    handleWebhook: input => {
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
      return { verification: 'verified', events: [{ providerEventId: event.eventId, sessionId: event.sessionId, status: event.status }] };
    },
  });
}

module.exports = { register };
