/**
 * Resend Email Provider
 *
 * Resend API adapter implementation
 */

import { Resend } from 'resend';
import crypto from 'crypto';
import {
  BaseEmailProvider,
  EmailProviderConfig,
  SendEmailRequest,
  SendEmailResponse,
  EmailProviderCapabilities,
  EmailStatus
} from './base-provider';

export class ResendProvider extends BaseEmailProvider {
  private client: Resend;

  constructor(config: EmailProviderConfig) {
    super(config);
    this.providerName = 'resend';

    // Prefer config API Key, then platform environment variable
    const apiKey = config.apiKey ? config.apiKey : (() => {
      const envApiKey = process.env.RESEND_API_KEY;
      if (!envApiKey) {
        throw new Error('RESEND_API_KEY environment variable is not set');
      }
      return envApiKey;
    })();

    this.client = new Resend(apiKey);
  }

  /**
   * Send a single email
   */
  async send(request: SendEmailRequest): Promise<SendEmailResponse> {
    try {
      // Build sender address
      const from = request.fromName
        ? `${request.fromName} <${request.from || 'noreply@chentsimo.top'}>`
        : request.from || 'noreply@chentsimo.top';

      // Send email
      const result = await this.client.emails.send({
        from,
        to: Array.isArray(request.to) ? request.to : [request.to],
        subject: request.subject || 'No Subject',
        html: request.html,
        text: request.text,
        replyTo: request.replyTo,
        cc: request.cc,
        bcc: request.bcc,
        attachments: request.attachments?.map(att => ({
          filename: att.filename,
          content: att.content as any
        })),
        tags: request.tags?.map(tag => ({ name: tag, value: 'true' }))
      });

      return {
        success: true,
        messageId: result.data?.id || 'unknown',
        provider: 'resend'
      };
    } catch (error: any) {
      return {
        success: false,
        provider: 'resend',
        error: error.message,
        details: error
      };
    }
  }

  /**
   * Batch send emails
   */
  async sendBatch(requests: SendEmailRequest[]): Promise<SendEmailResponse[]> {
    // Resend supports batch sending, but we use Promise.allSettled for handling
    const results = await Promise.allSettled(
      requests.map(req => this.send(req))
    );

    return results.map(result =>
      result.status === 'fulfilled'
        ? result.value
        : {
          success: false,
          provider: 'resend',
          error: 'Batch send failed',
          details: result.reason
        }
    );
  }

  /**
   * Get email status
   */
  async getStatus(messageId: string): Promise<EmailStatus> {
    try {
      const email = await this.client.emails.get(messageId);

      return {
        messageId: email.data?.id || messageId,
        status: email.data?.last_event || 'sent',
        events: []  // Resend API does not provide detailed event list yet
      };
    } catch (error: any) {
      throw new Error(`Failed to get email status: ${error.message}`);
    }
  }

  /**
   * Verify Webhook signature
   *
   * Resend uses HMAC-SHA256 signature verification (via Svix)
   * Ref: https://resend.com/docs/webhooks
   *
   * @param signature - svix-signature from request headers
   * @param payload - Original request body (string)
   * @param svixId - svix-id from request headers
   * @param svixTimestamp - svix-timestamp from request headers
   */
  verifyWebhook(
    signature: string,
    payload: string | object,
    svixId?: string,
    svixTimestamp?: string
  ): boolean {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn('RESEND_WEBHOOK_SECRET not configured, skipping signature verification');
      return true; // Skip verification in development
    }

    if (!signature || !svixId || !svixTimestamp) {
      console.error('Missing required webhook headers');
      return false;
    }

    try {
      // Verify timestamp (prevent replay attacks, valid for 5 minutes)
      const timestamp = parseInt(svixTimestamp, 10);
      const now = Math.floor(Date.now() / 1000);
      const tolerance = 300; // 5 minutes

      if (Math.abs(now - timestamp) > tolerance) {
        console.error('Webhook timestamp too old or in the future');
        return false;
      }

      // Build signature base string
      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const signedContent = `${svixId}.${svixTimestamp}.${payloadString}`;

      // Parse webhook secret (format: whsec_xxxxx)
      const secretBytes = Buffer.from(
        webhookSecret.startsWith('whsec_')
          ? webhookSecret.slice(6)
          : webhookSecret,
        'base64'
      );

      // Calculate expected signature
      const expectedSignature = crypto
        .createHmac('sha256', secretBytes)
        .update(signedContent)
        .digest('base64');

      // Parse signature header (format: v1,signature1 v1,signature2)
      const signatures = signature.split(' ').map(s => {
        const [version, sig] = s.split(',');
        return { version, sig };
      });

      // Verify if there is a matching signature
      const isValid = signatures.some(({ version, sig }) => {
        if (version !== 'v1') return false;
        try {
          return crypto.timingSafeEqual(
            Buffer.from(sig, 'base64'),
            Buffer.from(expectedSignature, 'base64')
          );
        } catch {
          return false;
        }
      });

      if (!isValid) {
        console.error('Webhook signature verification failed');
      }

      return isValid;
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Get provider capabilities
   */
  getCapabilities(): EmailProviderCapabilities {
    return {
      supportsAttachments: true,
      supportsBatch: true,
      supportsScheduling: false,  // Resend does not support scheduled sending yet
      supportsTracking: true,     // Supports open/click tracking
      supportsWebhooks: true,
      maxAttachmentSize: 40,      // 40MB
      maxBatchSize: 100           // Max 100 per batch
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Attempt to get API Key info (without actually sending email)
      // Resend does not have a dedicated health check endpoint, we verify by trying to list domains
      await this.client.domains.list();
      return true;
    } catch (error) {
      console.error('Resend health check failed:', error);
      return false;
    }
  }
}
