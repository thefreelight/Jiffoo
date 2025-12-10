/**
 * Webhook Verifier - Webhook 签名验证
 */

import { createHmac, timingSafeEqual } from 'crypto';

export interface WebhookVerifierConfig {
  /** 签名算法 */
  algorithm?: 'sha256' | 'sha512';
  /** 时间戳容差（秒） */
  timestampTolerance?: number;
  /** 签名头名称 */
  signatureHeader?: string;
  /** 时间戳头名称 */
  timestampHeader?: string;
}

export interface VerificationResult {
  valid: boolean;
  error?: string;
  timestamp?: number;
}

/**
 * 通用 HMAC 签名验证器
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
   * 生成签名
   */
  sign(payload: string | Buffer, timestamp?: number): string {
    const ts = timestamp ?? Math.floor(Date.now() / 1000);
    const data = `${ts}.${typeof payload === 'string' ? payload : payload.toString('utf8')}`;
    const hmac = createHmac(this.config.algorithm, this.secret);
    hmac.update(data);
    return `t=${ts},v1=${hmac.digest('hex')}`;
  }

  /**
   * 验证签名
   */
  verify(payload: string | Buffer, signature: string, timestamp?: number | string): VerificationResult {
    try {
      // 解析签名
      const parts = this.parseSignature(signature);
      if (!parts) {
        return { valid: false, error: 'Invalid signature format' };
      }

      const { ts, sig } = parts;

      // 验证时间戳
      const tsNumber = typeof timestamp === 'string' ? parseInt(timestamp, 10) : (timestamp ?? ts);
      if (isNaN(tsNumber)) {
        return { valid: false, error: 'Invalid timestamp' };
      }

      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - tsNumber) > this.config.timestampTolerance) {
        return { valid: false, error: 'Timestamp outside tolerance window', timestamp: tsNumber };
      }

      // 生成预期签名
      const data = `${tsNumber}.${typeof payload === 'string' ? payload : payload.toString('utf8')}`;
      const hmac = createHmac(this.config.algorithm, this.secret);
      hmac.update(data);
      const expectedSig = hmac.digest('hex');

      // 时间安全比较
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

/**
 * Stripe Webhook 签名验证器
 */
export class StripeWebhookVerifier {
  private secret: string;
  private toleranceSeconds: number;

  constructor(secret: string, toleranceSeconds = 300) {
    this.secret = secret;
    this.toleranceSeconds = toleranceSeconds;
  }

  verify(payload: string | Buffer, signature: string): VerificationResult {
    try {
      const elements = signature.split(',');
      const tsElement = elements.find((e) => e.startsWith('t='));
      const sigElement = elements.find((e) => e.startsWith('v1='));

      if (!tsElement || !sigElement) {
        return { valid: false, error: 'Missing signature elements' };
      }

      const timestamp = parseInt(tsElement.slice(2), 10);
      const expectedSig = sigElement.slice(3);

      // 检查时间戳
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > this.toleranceSeconds) {
        return { valid: false, error: 'Timestamp too old', timestamp };
      }

      // 计算签名
      const signedPayload = `${timestamp}.${typeof payload === 'string' ? payload : payload.toString('utf8')}`;
      const hmac = createHmac('sha256', this.secret);
      hmac.update(signedPayload);
      const computedSig = hmac.digest('hex');

      // 安全比较
      const valid = timingSafeEqual(Buffer.from(computedSig), Buffer.from(expectedSig));
      return { valid, error: valid ? undefined : 'Signature mismatch', timestamp };
    } catch (error) {
      return { valid: false, error: `Verification failed: ${(error as Error).message}` };
    }
  }
}

