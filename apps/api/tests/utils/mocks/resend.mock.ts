/**
 * Resend Mock Service
 * 
 * Mock implementation of Resend SDK for testing.
 */

import { vi } from 'vitest';

// ============================================
// Types
// ============================================

export interface MockEmail {
  id: string;
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  created_at: string;
}

export interface SendEmailParams {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string;
  tags?: Array<{ name: string; value: string }>;
}

// ============================================
// Mock Data
// ============================================

let emailCounter = 0;
const sentEmails: MockEmail[] = [];

export function createMockEmail(params: SendEmailParams): MockEmail {
  emailCounter++;
  const email: MockEmail = {
    id: `email_test_${emailCounter}`,
    from: params.from,
    to: Array.isArray(params.to) ? params.to : [params.to],
    subject: params.subject,
    html: params.html,
    text: params.text,
    created_at: new Date().toISOString(),
  };
  sentEmails.push(email);
  return email;
}

// ============================================
// Mock Resend Client
// ============================================

export const mockResend = {
  emails: {
    send: vi.fn().mockImplementation(async (params: SendEmailParams) => {
      const email = createMockEmail(params);
      return { data: { id: email.id }, error: null };
    }),
    get: vi.fn().mockImplementation(async (id: string) => {
      const email = sentEmails.find(e => e.id === id);
      return { data: email || null, error: email ? null : { message: 'Email not found' } };
    }),
  },
  domains: {
    list: vi.fn().mockResolvedValue({ data: [], error: null }),
    get: vi.fn().mockResolvedValue({ data: { id: 'domain_test', name: 'test.com' }, error: null }),
  },
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get all sent emails (for assertions)
 */
export function getSentEmails(): MockEmail[] {
  return [...sentEmails];
}

/**
 * Get emails sent to a specific address
 */
export function getEmailsSentTo(email: string): MockEmail[] {
  return sentEmails.filter(e => e.to.includes(email));
}

/**
 * Get emails with a specific subject
 */
export function getEmailsBySubject(subject: string): MockEmail[] {
  return sentEmails.filter(e => e.subject.includes(subject));
}

/**
 * Reset all Resend mocks and clear sent emails
 */
export function resetResendMocks() {
  emailCounter = 0;
  sentEmails.length = 0;
  vi.clearAllMocks();
}

/**
 * Configure mock to simulate errors
 */
export function configureResendError(error: { message: string; name?: string }) {
  mockResend.emails.send.mockResolvedValueOnce({
    data: null,
    error: { message: error.message, name: error.name || 'ResendError' },
  });
}

/**
 * Assert that an email was sent
 */
export function expectEmailSent(to: string, subject?: string) {
  const emails = getEmailsSentTo(to);
  if (emails.length === 0) {
    throw new Error(`No email was sent to ${to}`);
  }
  if (subject && !emails.some(e => e.subject.includes(subject))) {
    throw new Error(`No email with subject "${subject}" was sent to ${to}`);
  }
}

export default mockResend;

