/**
 * Webhook Verifier - Webhook Signature Verification
 */

import { createHmac, timingSafeEqual } from 'crypto';

export interface WebhookVerifierConfig {
  /** Signature algorithm */
  algorithm?: string;
  /** Timestamp tolerance (seconds) */
  timestampTolerance?: number;
  /** Signature header name */
  signatureHeader?: string;
  /** Timestamp header name */
  timestampHeader?: string;
}
export interface VerificationResult {
  valid: boolean;
  error?: string;
  timestamp?: number;
}

/**
 * Generic HMAC Signature Verifier
 */
export class WebhookVerifier {
  private secret: string;
  private config: Required<WebhookVerifierConfig>;

  constructor(secret: string, config: WebhookVerifierConfig = {}) {
    this.secret = secret;
    this.config = {
      algorithm: config.algorithm ?? 'sha256',
      timestampTolerance: config.timestampTolerance ?? 300, // 5 minutes
      signatureHeader: config.signatureHeader ?? 'x-webhook-signature',
      timestampHeader: config.timestampHeader ?? 'x-webhook-timestamp',
    };
  }

  /**
   * Generate Signature
   */
  sign(payload: string | Buffer, timestamp?: number): string {
    const ts = timestamp ?? Math.floor(Date.now() / 1000);
    const data = `${ts}.${typeof payload === 'string' ? payload : payload.toString('utf8')}`;
    const hmac = createHmac(this.config.algorithm, this.secret);
    hmac.update(data);
    return `t=${ts},v1=${hmac.digest('hex')}`;
  }

  /**
   * Verify Signature
   */
  verify(payload: string | Buffer, signature: string, timestamp?: number | string): VerificationResult {
    try {
      // Parse signature
      const parts = this.parseSignature(signature);
      if (!parts) {
        return { valid: false, error: 'Invalid signature format' };
      }

      const { ts, sig } = parts;

      // Verify timestamp
      const tsNumber = typeof timestamp === 'string' ? parseInt(timestamp, 10) : (timestamp ?? ts);
      if (isNaN(tsNumber)) {
        return { valid: false, error: 'Invalid timestamp' };
      }

      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - tsNumber) > this.config.timestampTolerance) {
        return { valid: false, error: 'Timestamp outside tolerance window', timestamp: tsNumber };
      }

      // Generate expected signature
      const data = `${tsNumber}.${typeof payload === 'string' ? payload : payload.toString('utf8')}`;
      const hmac = createHmac(this.config.algorithm, this.secret);
      hmac.update(data);
      const expectedSig = hmac.digest('hex');

      // Safe comparison
      const sigBuffer = Buffer.from(sig, 'hex');
      const expectedBuffer = Buffer.from(expectedSig, 'hex');

      if (sigBuffer.length !== expectedBuffer.length) {
        return { valid: false, error: 'Signature length mismatch', timestamp: tsNumber };
      }

      const valid = timingSafeEqual(sigBuffer, expectedBuffer);
      return { valid, error: valid ? undefined : 'Signature mismatch', timestamp: tsNumber };
    } catch (error) {
      return { valid: false, error: `Verification error: ${(error as Error).message}` };
    }
  }

  private parseSignature(signature: string): { ts: number; sig: string } | null {
    const parts = signature.split(',');
    let ts: number | undefined;
    let sig: string | undefined;

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key === 't') ts = parseInt(value, 10);
      if (key === 'v1') sig = value;
    }

    if (ts === undefined || sig === undefined || isNaN(ts)) return null;
    return { ts, sig };
  }
}
