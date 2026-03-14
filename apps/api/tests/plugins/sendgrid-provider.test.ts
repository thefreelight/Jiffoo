/**
 * SendGrid Email Provider Tests
 *
 * Coverage:
 * - Constructor and initialization
 * - send() - single email sending
 * - sendBatch() - batch email sending
 * - getStatus() - email status retrieval
 * - verifyWebhook() - webhook signature verification
 * - getCapabilities() - provider capabilities
 * - healthCheck() - health check endpoint
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SendGridProvider } from '../../src/plugins/email-providers/sendgrid-provider';
import type { SendEmailRequest, EmailProviderConfig } from '../../src/plugins/email-providers/base-provider';
import crypto from 'crypto';

// Mock @sendgrid/mail
vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: vi.fn(),
    send: vi.fn(),
  },
}));

// Mock fetch for healthCheck
global.fetch = vi.fn() as any;

describe('SendGridProvider', () => {
  let provider: SendGridProvider;
  let mockSgMail: any;
  const testApiKey = 'SG.test-api-key-12345';
  const testWebhookSecret = 'test-webhook-secret';

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset environment variables
    process.env.SENDGRID_API_KEY = testApiKey;
    process.env.SENDGRID_WEBHOOK_SECRET = testWebhookSecret;

    // Get the mocked sgMail
    mockSgMail = require('@sendgrid/mail').default;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with API key from config', () => {
      const config: EmailProviderConfig = {
        apiKey: 'custom-api-key',
        mode: 'byok',
      };

      provider = new SendGridProvider(config);

      expect(mockSgMail.setApiKey).toHaveBeenCalledWith('custom-api-key');
      expect(provider.getProviderName()).toBe('sendgrid');
      expect(provider.getMode()).toBe('byok');
    });

    it('should initialize with API key from environment', () => {
      const config: EmailProviderConfig = {};

      provider = new SendGridProvider(config);

      expect(mockSgMail.setApiKey).toHaveBeenCalledWith(testApiKey);
      expect(provider.getProviderName()).toBe('sendgrid');
    });

    it('should throw error when API key is missing', () => {
      delete process.env.SENDGRID_API_KEY;
      const config: EmailProviderConfig = {};

      expect(() => new SendGridProvider(config)).toThrow(
        'SENDGRID_API_KEY environment variable is not set'
      );
    });

    it('should prefer config API key over environment variable', () => {
      process.env.SENDGRID_API_KEY = 'env-api-key';
      const config: EmailProviderConfig = {
        apiKey: 'config-api-key',
      };

      provider = new SendGridProvider(config);

      expect(mockSgMail.setApiKey).toHaveBeenCalledWith('config-api-key');
    });
  });

  describe('send()', () => {
    beforeEach(() => {
      provider = new SendGridProvider({ apiKey: testApiKey });
    });

    it('should send a single email successfully', async () => {
      const mockResponse = {
        headers: {
          'x-message-id': 'msg-12345',
        },
      };

      mockSgMail.send.mockResolvedValueOnce([mockResponse]);

      const request: SendEmailRequest = {
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        text: 'Test content',
      };

      const result = await provider.send(request);

      expect(result).toEqual({
        success: true,
        messageId: 'msg-12345',
        provider: 'sendgrid',
      });

      expect(mockSgMail.send).toHaveBeenCalledWith({
        to: ['recipient@example.com'],
        from: 'sender@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        text: 'Test content',
        replyTo: undefined,
        cc: undefined,
        bcc: undefined,
      });
    });

    it('should send email with fromName', async () => {
      const mockResponse = {
        headers: {
          'x-message-id': 'msg-67890',
        },
      };

      mockSgMail.send.mockResolvedValueOnce([mockResponse]);

      const request: SendEmailRequest = {
        to: 'recipient@example.com',
        from: 'sender@example.com',
        fromName: 'Test Sender',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      await provider.send(request);

      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: {
            email: 'sender@example.com',
            name: 'Test Sender',
          },
        })
      );
    });

    it('should use default sender when from is not provided', async () => {
      const mockResponse = {
        headers: {
          'x-message-id': 'msg-default',
        },
      };

      mockSgMail.send.mockResolvedValueOnce([mockResponse]);

      const request: SendEmailRequest = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      await provider.send(request);

      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@chentsimo.top',
        })
      );
    });

    it('should handle multiple recipients', async () => {
      const mockResponse = {
        headers: {
          'x-message-id': 'msg-multi',
        },
      };

      mockSgMail.send.mockResolvedValueOnce([mockResponse]);

      const request: SendEmailRequest = {
        to: ['recipient1@example.com', 'recipient2@example.com'],
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      await provider.send(request);

      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['recipient1@example.com', 'recipient2@example.com'],
        })
      );
    });

    it('should handle CC and BCC recipients', async () => {
      const mockResponse = {
        headers: {
          'x-message-id': 'msg-cc-bcc',
        },
      };

      mockSgMail.send.mockResolvedValueOnce([mockResponse]);

      const request: SendEmailRequest = {
        to: 'recipient@example.com',
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      await provider.send(request);

      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          cc: ['cc@example.com'],
          bcc: ['bcc@example.com'],
        })
      );
    });

    it('should handle attachments with Buffer content', async () => {
      const mockResponse = {
        headers: {
          'x-message-id': 'msg-attach',
        },
      };

      mockSgMail.send.mockResolvedValueOnce([mockResponse]);

      const attachmentContent = Buffer.from('test content');
      const request: SendEmailRequest = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        attachments: [
          {
            filename: 'test.txt',
            content: attachmentContent,
            contentType: 'text/plain',
          },
        ],
      };

      await provider.send(request);

      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [
            {
              filename: 'test.txt',
              content: attachmentContent.toString('base64'),
              type: 'text/plain',
              disposition: 'attachment',
            },
          ],
        })
      );
    });

    it('should handle attachments with string content', async () => {
      const mockResponse = {
        headers: {
          'x-message-id': 'msg-attach-str',
        },
      };

      mockSgMail.send.mockResolvedValueOnce([mockResponse]);

      const request: SendEmailRequest = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        attachments: [
          {
            filename: 'test.txt',
            content: 'base64-encoded-content',
            contentType: 'text/plain',
          },
        ],
      };

      await provider.send(request);

      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [
            {
              filename: 'test.txt',
              content: 'base64-encoded-content',
              type: 'text/plain',
              disposition: 'attachment',
            },
          ],
        })
      );
    });

    it('should handle tags and metadata', async () => {
      const mockResponse = {
        headers: {
          'x-message-id': 'msg-tags',
        },
      };

      mockSgMail.send.mockResolvedValueOnce([mockResponse]);

      const request: SendEmailRequest = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        tags: ['welcome', 'user-onboarding'],
        metadata: {
          userId: '123',
          campaign: 'welcome-series',
        },
      };

      await provider.send(request);

      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          customArgs: {
            tags: 'welcome,user-onboarding',
            userId: '123',
            campaign: 'welcome-series',
          },
        })
      );
    });

    it('should use default subject when not provided', async () => {
      const mockResponse = {
        headers: {
          'x-message-id': 'msg-no-subject',
        },
      };

      mockSgMail.send.mockResolvedValueOnce([mockResponse]);

      const request: SendEmailRequest = {
        to: 'recipient@example.com',
        html: '<p>Test content</p>',
      } as SendEmailRequest;

      await provider.send(request);

      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'No Subject',
        })
      );
    });

    it('should handle send errors gracefully', async () => {
      const error = new Error('SendGrid API error');
      mockSgMail.send.mockRejectedValueOnce(error);

      const request: SendEmailRequest = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      const result = await provider.send(request);

      expect(result).toEqual({
        success: false,
        provider: 'sendgrid',
        error: 'SendGrid API error',
        details: error,
      });
    });

    it('should return unknown messageId when header is missing', async () => {
      const mockResponse = {
        headers: {},
      };

      mockSgMail.send.mockResolvedValueOnce([mockResponse]);

      const request: SendEmailRequest = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      const result = await provider.send(request);

      expect(result.messageId).toBe('unknown');
    });
  });

  describe('sendBatch()', () => {
    beforeEach(() => {
      provider = new SendGridProvider({ apiKey: testApiKey });
    });

    it('should send multiple emails successfully', async () => {
      const mockResponse1 = {
        headers: {
          'x-message-id': 'msg-batch-1',
        },
      };

      const mockResponse2 = {
        headers: {
          'x-message-id': 'msg-batch-2',
        },
      };

      mockSgMail.send
        .mockResolvedValueOnce([mockResponse1])
        .mockResolvedValueOnce([mockResponse2]);

      const requests: SendEmailRequest[] = [
        {
          to: 'recipient1@example.com',
          subject: 'Test Email 1',
          html: '<p>Test content 1</p>',
        },
        {
          to: 'recipient2@example.com',
          subject: 'Test Email 2',
          html: '<p>Test content 2</p>',
        },
      ];

      const results = await provider.sendBatch(requests);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        success: true,
        messageId: 'msg-batch-1',
        provider: 'sendgrid',
      });
      expect(results[1]).toEqual({
        success: true,
        messageId: 'msg-batch-2',
        provider: 'sendgrid',
      });
    });

    it('should handle partial failures in batch', async () => {
      const mockResponse = {
        headers: {
          'x-message-id': 'msg-batch-success',
        },
      };

      const error = new Error('SendGrid API error');

      mockSgMail.send
        .mockResolvedValueOnce([mockResponse])
        .mockRejectedValueOnce(error);

      const requests: SendEmailRequest[] = [
        {
          to: 'recipient1@example.com',
          subject: 'Test Email 1',
          html: '<p>Test content 1</p>',
        },
        {
          to: 'recipient2@example.com',
          subject: 'Test Email 2',
          html: '<p>Test content 2</p>',
        },
      ];

      const results = await provider.sendBatch(requests);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('SendGrid API error');
    });

    it('should handle empty batch', async () => {
      const results = await provider.sendBatch([]);

      expect(results).toEqual([]);
    });
  });

  describe('getStatus()', () => {
    beforeEach(() => {
      provider = new SendGridProvider({ apiKey: testApiKey });
    });

    it('should return basic status for a message', async () => {
      const messageId = 'msg-status-test';
      const result = await provider.getStatus(messageId);

      expect(result).toEqual({
        messageId: 'msg-status-test',
        status: 'sent',
        events: [],
      });
    });

    it('should handle different message IDs', async () => {
      const messageId = 'different-msg-id';
      const result = await provider.getStatus(messageId);

      expect(result.messageId).toBe('different-msg-id');
      expect(result.status).toBe('sent');
    });
  });

  describe('verifyWebhook()', () => {
    beforeEach(() => {
      provider = new SendGridProvider({ apiKey: testApiKey });
    });

    it('should verify valid webhook signature', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = JSON.stringify({ event: 'delivered' });
      const signedContent = `${timestamp}${payload}`;

      const expectedSignature = crypto
        .createHmac('sha256', testWebhookSecret)
        .update(signedContent)
        .digest('base64');

      const isValid = provider.verifyWebhook(expectedSignature, payload, timestamp);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = JSON.stringify({ event: 'delivered' });
      const invalidSignature = 'invalid-signature-base64';

      const isValid = provider.verifyWebhook(invalidSignature, payload, timestamp);

      expect(isValid).toBe(false);
    });

    it('should reject timestamp outside tolerance window', () => {
      const oldTimestamp = Math.floor(Date.now() / 1000 - 700).toString(); // 11+ minutes ago
      const payload = JSON.stringify({ event: 'delivered' });
      const signedContent = `${oldTimestamp}${payload}`;

      const signature = crypto
        .createHmac('sha256', testWebhookSecret)
        .update(signedContent)
        .digest('base64');

      const isValid = provider.verifyWebhook(signature, payload, oldTimestamp);

      expect(isValid).toBe(false);
    });

    it('should reject future timestamp outside tolerance', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000 + 700).toString(); // 11+ minutes in future
      const payload = JSON.stringify({ event: 'delivered' });
      const signedContent = `${futureTimestamp}${payload}`;

      const signature = crypto
        .createHmac('sha256', testWebhookSecret)
        .update(signedContent)
        .digest('base64');

      const isValid = provider.verifyWebhook(signature, payload, futureTimestamp);

      expect(isValid).toBe(false);
    });

    it('should accept timestamp within tolerance window', () => {
      const recentTimestamp = Math.floor(Date.now() / 1000 - 300).toString(); // 5 minutes ago
      const payload = JSON.stringify({ event: 'delivered' });
      const signedContent = `${recentTimestamp}${payload}`;

      const signature = crypto
        .createHmac('sha256', testWebhookSecret)
        .update(signedContent)
        .digest('base64');

      const isValid = provider.verifyWebhook(signature, payload, recentTimestamp);

      expect(isValid).toBe(true);
    });

    it('should handle object payload', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = { event: 'delivered', email: 'test@example.com' };
      const payloadString = JSON.stringify(payload);
      const signedContent = `${timestamp}${payloadString}`;

      const signature = crypto
        .createHmac('sha256', testWebhookSecret)
        .update(signedContent)
        .digest('base64');

      const isValid = provider.verifyWebhook(signature, payload, timestamp);

      expect(isValid).toBe(true);
    });

    it('should return false when signature is missing', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = JSON.stringify({ event: 'delivered' });

      const isValid = provider.verifyWebhook('', payload, timestamp);

      expect(isValid).toBe(false);
    });

    it('should return false when timestamp is missing', () => {
      const payload = JSON.stringify({ event: 'delivered' });
      const signature = 'some-signature';

      const isValid = provider.verifyWebhook(signature, payload);

      expect(isValid).toBe(false);
    });

    it('should skip verification when webhook secret is not configured', () => {
      delete process.env.SENDGRID_WEBHOOK_SECRET;
      const providerWithoutSecret = new SendGridProvider({ apiKey: testApiKey });

      const isValid = providerWithoutSecret.verifyWebhook(
        'any-signature',
        'any-payload',
        Math.floor(Date.now() / 1000).toString()
      );

      expect(isValid).toBe(true);
    });

    it('should use webhook secret from config', () => {
      const configSecret = 'config-webhook-secret';
      const providerWithConfigSecret = new SendGridProvider({
        apiKey: testApiKey,
        webhookSecret: configSecret,
      });

      delete process.env.SENDGRID_WEBHOOK_SECRET;

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = JSON.stringify({ event: 'delivered' });
      const signedContent = `${timestamp}${payload}`;

      const signature = crypto
        .createHmac('sha256', configSecret)
        .update(signedContent)
        .digest('base64');

      const isValid = providerWithConfigSecret.verifyWebhook(signature, payload, timestamp);

      expect(isValid).toBe(true);
    });

    it('should handle signature verification errors gracefully', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = JSON.stringify({ event: 'delivered' });

      // Invalid base64 signature that will cause timingSafeEqual to throw
      const invalidSignature = 'not-valid-base64!!!';

      const isValid = provider.verifyWebhook(invalidSignature, payload, timestamp);

      expect(isValid).toBe(false);
    });
  });

  describe('getCapabilities()', () => {
    beforeEach(() => {
      provider = new SendGridProvider({ apiKey: testApiKey });
    });

    it('should return correct provider capabilities', () => {
      const capabilities = provider.getCapabilities();

      expect(capabilities).toEqual({
        supportsAttachments: true,
        supportsBatch: true,
        supportsScheduling: true,
        supportsTracking: true,
        supportsWebhooks: true,
        maxAttachmentSize: 30,
        maxBatchSize: 1000,
      });
    });
  });

  describe('healthCheck()', () => {
    beforeEach(() => {
      provider = new SendGridProvider({ apiKey: testApiKey });
    });

    it('should return true when API is healthy', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      const isHealthy = await provider.healthCheck();

      expect(isHealthy).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/user/profile',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${testApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
    });

    it('should return false when API returns error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
      });

      const isHealthy = await provider.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should return false when fetch throws error', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const isHealthy = await provider.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should use correct API key in health check', async () => {
      const customApiKey = 'SG.custom-key-12345';
      const customProvider = new SendGridProvider({ apiKey: customApiKey });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      await customProvider.healthCheck();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/user/profile',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${customApiKey}`,
          }),
        })
      );
    });
  });

  describe('Provider Name and Mode', () => {
    it('should return correct provider name', () => {
      provider = new SendGridProvider({ apiKey: testApiKey });
      expect(provider.getProviderName()).toBe('sendgrid');
    });

    it('should default to platform mode', () => {
      provider = new SendGridProvider({ apiKey: testApiKey });
      expect(provider.getMode()).toBe('platform');
    });

    it('should respect configured mode', () => {
      provider = new SendGridProvider({ apiKey: testApiKey, mode: 'byok' });
      expect(provider.getMode()).toBe('byok');
    });
  });
});
