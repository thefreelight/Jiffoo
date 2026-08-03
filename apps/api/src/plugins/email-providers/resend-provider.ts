// @ts-nocheck
/**
 * Resend Email Provider
 *
 * Lightweight wrapper around Resend.
 *
 * Missing credentials are an explicit delivery failure. Returning a successful
 * no-op here makes registration appear complete while no verification message
 * was accepted by a transport.
 */

import { Resend } from 'resend';
import { env } from '@/config/env';

type SendEmailInput = {
  to: string;
  from: string;
  fromName?: string;
  subject: string;
  html?: string;
  text?: string;
  tags?: string[];
  metadata?: Record<string, string>;
};

type SendEmailResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  details?: unknown;
};

export class ResendProvider {
  private client: Resend | null = null;

  constructor(_options: Record<string, unknown> = {}) {
    if (env.RESEND_API_KEY) {
      this.client = new Resend(env.RESEND_API_KEY);
    }
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (!this.client) {
      return {
        success: false,
        error: 'Email provider is not configured',
      };
    }

    try {
      const fromName = input.fromName ? `${input.fromName} <${input.from}>` : input.from;
      const result = await this.client.emails.send({
        from: fromName,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        // Resend supports tags as { name } objects.
        tags: input.tags?.map((tag) => ({ name: tag })),
        // Map metadata to headers to preserve context if needed.
        headers: input.metadata ? { 'x-metadata': JSON.stringify(input.metadata) } : undefined,
      });

      if (!result.data) {
        return {
          success: false,
          error: result.error?.message || 'Failed to send email',
          details: result.error,
        };
      }

      return {
        success: true,
        messageId: result.data.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send email',
        details: error,
      };
    }
  }
}
