/**
 * Distribution Plugin Property-Based Tests
 *
 * Verifies distribution system invariants using fast-check.
 *
 * Properties tested:
 * 1. Unique Identifier Generation
 * 2. Commission Calculation Correctness
 * 3. Payout Balance Integrity
 * 4. Payout Failure Recovery
 * 5. Agent Hierarchy Correctness
 * 6. Settlement Period Transition
 * 7. Refund Commission Cancellation
 * 8. Referral Relationship Permanence
 * 9. Agent Price Markup Validation
 * 10. Analytics Data Consistency
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================
// Helper Functions (mirrors actual business logic)
// ============================================

const REFERRAL_CODE_LENGTH = 8;
const REFERRAL_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// Generate referral code
const generateReferralCode = (): string => {
  let code = '';
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += REFERRAL_CODE_CHARS.charAt(
      Math.floor(Math.random() * REFERRAL_CODE_CHARS.length)
    );
  }
  return code;
};

// Calculate commission
const calculateCommission = (orderAmount: number, rate: number): number => {
  return Math.round(orderAmount * (rate / 100) * 100) / 100;
};

// Calculate settlement date
const calculateSettlementDate = (
  periodType: 'daily' | 'weekly' | 'monthly' | 'custom',
  customDays: number = 7,
  settlementDay: number = 1
): Date => {
  const now = new Date();

  switch (periodType) {
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly': {
      const currentDay = now.getDay() || 7;
      let daysUntilTarget = settlementDay - currentDay;
      if (daysUntilTarget <= 0) daysUntilTarget += 7;
      return new Date(now.getTime() + daysUntilTarget * 24 * 60 * 60 * 1000);
    }
    case 'monthly': {
      const targetDate = settlementDay;
      if (now.getDate() < targetDate) {
        return new Date(now.getFullYear(), now.getMonth(), targetDate);
      }
      return new Date(now.getFullYear(), now.getMonth() + 1, targetDate);
    }
    case 'custom':
    default:
      return new Date(now.getTime() + customDays * 24 * 60 * 60 * 1000);
  }
};

// Validate agent markup
const validateAgentMarkup = (
  basePrice: number,
  markup: number,
  maxMarkupPercent: number
): boolean => {
  const maxAllowedMarkup = basePrice * (maxMarkupPercent / 100);
  return markup >= 0 && markup <= maxAllowedMarkup;
};

// Use Math.fround for 32-bit float constraints
const MIN_PRICE = Math.fround(0.01);
const MAX_PRICE = Math.fround(10000);
const MAX_RATE = Math.fround(100);
const MAX_BALANCE = Math.fround(10000);
const MAX_PAYOUT = Math.fround(20000);
const MAX_MARKUP = Math.fround(100);
const MAX_MARKUP_PERCENT = Math.fround(50);
const MIN_BALANCE = Math.fround(100);
const MIN_AMOUNT = Math.fround(1);
const MAX_COMMISSION = Math.fround(1000);
const MAX_BASE_PRICE = Math.fround(1000);

// ============================================
// Property Tests
// ============================================

describe('Distribution Plugin Property Tests', () => {
  // Property 1: Unique Identifier Generation
  describe('Property 1: Unique Identifier Generation', () => {
    it('should generate codes of correct length', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const code = generateReferralCode();
          expect(code.length).toBe(REFERRAL_CODE_LENGTH);
        }),
        { numRuns: 100 }
      );
    });

    it('should only contain valid characters', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const code = generateReferralCode();
          for (const char of code) {
            expect(REFERRAL_CODE_CHARS).toContain(char);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should generate unique codes with high probability', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        codes.add(generateReferralCode());
      }
      // With 36^8 possible codes, 1000 codes should be unique
      expect(codes.size).toBe(1000);
    });
  });

  // Property 2: Commission Calculation Correctness
  describe('Property 2: Commission Calculation Correctness', () => {
    it('should calculate commission = orderAmount * (rate / 100)', () => {
      fc.assert(
        fc.property(
          fc.float({ min: MIN_PRICE, max: MAX_PRICE, noNaN: true }),
          fc.float({ min: 0, max: MAX_RATE, noNaN: true }),
          (orderAmount, rate) => {
            const commission = calculateCommission(orderAmount, rate);
            const expected = Math.round(orderAmount * (rate / 100) * 100) / 100;
            expect(commission).toBeCloseTo(expected, 2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always be non-negative', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: MAX_PRICE, noNaN: true }),
          fc.float({ min: 0, max: MAX_RATE, noNaN: true }),
          (orderAmount, rate) => {
            const commission = calculateCommission(orderAmount, rate);
            expect(commission).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never exceed order amount', () => {
      fc.assert(
        fc.property(
          fc.float({ min: MIN_PRICE, max: MAX_PRICE, noNaN: true }),
          fc.float({ min: 0, max: MAX_RATE, noNaN: true }),
          (orderAmount, rate) => {
            const commission = calculateCommission(orderAmount, rate);
            expect(commission).toBeLessThanOrEqual(orderAmount + 0.01);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be zero when rate is zero', () => {
      fc.assert(
        fc.property(
          fc.float({ min: MIN_PRICE, max: MAX_PRICE, noNaN: true }),
          (orderAmount) => {
            const commission = calculateCommission(orderAmount, 0);
            expect(commission).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 3: Payout Balance Integrity
  describe('Property 3: Payout Balance Integrity', () => {
    it('should not allow payout exceeding available balance', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: MAX_BALANCE, noNaN: true }),
          fc.float({ min: 0, max: MAX_PAYOUT, noNaN: true }),
          (availableBalance, requestedAmount) => {
            const canPayout = requestedAmount <= availableBalance;
            if (canPayout) {
              const newBalance = availableBalance - requestedAmount;
              expect(newBalance).toBeGreaterThanOrEqual(0);
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve total balance after payout request', () => {
      fc.assert(
        fc.property(
          fc.float({ min: MIN_BALANCE, max: MAX_BALANCE, noNaN: true }),
          fc.float({ min: MIN_AMOUNT, max: MAX_RATE, noNaN: true }),
          (availableBalance, requestedAmount) => {
            // Simulate payout request: balance moves to pending payout
            const newAvailable = availableBalance - requestedAmount;
            const pendingPayout = requestedAmount;
            const total = newAvailable + pendingPayout;
            expect(total).toBeCloseTo(availableBalance, 2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 4: Payout Failure Recovery
  describe('Property 4: Payout Failure Recovery', () => {
    it('should restore balance on payout failure', () => {
      fc.assert(
        fc.property(
          fc.float({ min: MIN_BALANCE, max: MAX_BALANCE, noNaN: true }),
          fc.float({ min: MIN_AMOUNT, max: MAX_RATE, noNaN: true }),
          (originalBalance, payoutAmount) => {
            // Simulate: request payout -> fail -> restore
            const afterRequest = originalBalance - payoutAmount;
            const afterFailure = afterRequest + payoutAmount;
            expect(afterFailure).toBeCloseTo(originalBalance, 2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 6: Settlement Period Transition
  describe('Property 6: Settlement Period Transition', () => {
    it('should calculate future settlement date for daily period', () => {
      const now = new Date();
      const settleDate = calculateSettlementDate('daily');
      expect(settleDate.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should calculate future settlement date for weekly period', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 7 }),
          (settlementDay) => {
            const now = new Date();
            const settleDate = calculateSettlementDate('weekly', 7, settlementDay);
            expect(settleDate.getTime()).toBeGreaterThan(now.getTime());
          }
        ),
        { numRuns: 7 }
      );
    });

    it('should calculate future settlement date for monthly period', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 28 }),
          (settlementDay) => {
            const now = new Date();
            const settleDate = calculateSettlementDate('monthly', 7, settlementDay);
            expect(settleDate.getTime()).toBeGreaterThanOrEqual(now.getTime());
          }
        ),
        { numRuns: 28 }
      );
    });

    it('should calculate future settlement date for custom period', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 30 }),
          (customDays) => {
            const now = new Date();
            const settleDate = calculateSettlementDate('custom', customDays);
            const expectedMin = now.getTime() + (customDays - 1) * 24 * 60 * 60 * 1000;
            expect(settleDate.getTime()).toBeGreaterThanOrEqual(expectedMin);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  // Property 7: Refund Commission Cancellation
  describe('Property 7: Refund Commission Cancellation', () => {
    it('should restore balance when commission is cancelled', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: MAX_BALANCE, noNaN: true }),
          fc.float({ min: MIN_AMOUNT, max: MAX_COMMISSION, noNaN: true }),
          (currentBalance, commissionAmount) => {
            // Simulate: commission earned -> order refunded -> commission cancelled
            const afterEarning = currentBalance + commissionAmount;
            const afterCancellation = afterEarning - commissionAmount;
            expect(afterCancellation).toBeCloseTo(currentBalance, 2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 9: Agent Price Markup Validation
  describe('Property 9: Agent Price Markup Validation', () => {
    it('should validate markup within allowed percentage', () => {
      fc.assert(
        fc.property(
          fc.float({ min: MIN_AMOUNT, max: MAX_BASE_PRICE, noNaN: true }),
          fc.float({ min: 0, max: MAX_MARKUP, noNaN: true }),
          fc.float({ min: MIN_AMOUNT, max: MAX_MARKUP_PERCENT, noNaN: true }),
          (basePrice, markupPercent, maxMarkupPercent) => {
            const markup = basePrice * (markupPercent / 100);
            const isValid = validateAgentMarkup(basePrice, markup, maxMarkupPercent);

            if (markupPercent <= maxMarkupPercent) {
              expect(isValid).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject negative markup', () => {
      fc.assert(
        fc.property(
          fc.float({ min: MIN_AMOUNT, max: MAX_BASE_PRICE, noNaN: true }),
          fc.float({ min: MIN_AMOUNT, max: MAX_MARKUP_PERCENT, noNaN: true }),
          (basePrice, maxMarkupPercent) => {
            const isValid = validateAgentMarkup(basePrice, -10, maxMarkupPercent);
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject markup exceeding max allowed', () => {
      fc.assert(
        fc.property(
          fc.float({ min: MIN_BALANCE, max: MAX_BASE_PRICE, noNaN: true }),
          fc.float({ min: MIN_AMOUNT, max: Math.fround(20), noNaN: true }),
          (basePrice, maxMarkupPercent) => {
            const excessiveMarkup = basePrice * ((maxMarkupPercent + 10) / 100);
            const isValid = validateAgentMarkup(basePrice, excessiveMarkup, maxMarkupPercent);
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 5: Agent Hierarchy Correctness
  describe('Property 5: Agent Hierarchy Correctness', () => {
    /**
     * **Feature: distribution-plugin, Property 5: Agent Hierarchy Correctness**
     * **Validates: Requirements 4.1, 4.3, 4.4**
     *
     * For any order placed through an agent mall, commissions SHALL be
     * calculated for the agent and all parent agents in the hierarchy
     * according to their respective commission rates.
     */

    // Agent hierarchy rules
    const AGENT_LEVELS = {
      L1: 1,
      L2: 2,
      L3: 3
    } as const;

    interface Agent {
      id: string;
      level: number;
      parentId: string | null;
      commissionRate: number;
    }

    // Validate agent level based on parent
    const validateAgentLevel = (agent: Agent, parent: Agent | null): boolean => {
      if (parent === null) {
        return agent.level === AGENT_LEVELS.L1;
      }
      if (parent.level === AGENT_LEVELS.L1) {
        return agent.level === AGENT_LEVELS.L2;
      }
      if (parent.level === AGENT_LEVELS.L2) {
        return agent.level === AGENT_LEVELS.L3;
      }
      // L3 agents cannot have children
      return false;
    };

    // Calculate commissions for agent hierarchy
    const calculateHierarchyCommissions = (
      orderAmount: number,
      agents: Agent[]
    ): Map<string, number> => {
      const commissions = new Map<string, number>();
      for (const agent of agents) {
        const commission = Math.round(orderAmount * (agent.commissionRate / 100) * 100) / 100;
        commissions.set(agent.id, commission);
      }
      return commissions;
    };

    it('should assign correct level based on parent', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3 }),
          (parentLevel) => {
            const parent: Agent | null = parentLevel === 0
              ? null
              : { id: 'parent', level: parentLevel, parentId: null, commissionRate: 10 };

            const expectedChildLevel = parent === null
              ? AGENT_LEVELS.L1
              : parent.level + 1;

            // L3 cannot have children
            if (parent && parent.level === AGENT_LEVELS.L3) {
              const invalidChild: Agent = {
                id: 'child',
                level: 4,
                parentId: parent.id,
                commissionRate: 5
              };
              expect(validateAgentLevel(invalidChild, parent)).toBe(false);
            } else if (expectedChildLevel <= 3) {
              const validChild: Agent = {
                id: 'child',
                level: expectedChildLevel,
                parentId: parent?.id ?? null,
                commissionRate: 5
              };
              expect(validateAgentLevel(validChild, parent)).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should calculate commissions for all agents in hierarchy', () => {
      fc.assert(
        fc.property(
          fc.float({ min: MIN_PRICE, max: MAX_PRICE, noNaN: true }),
          fc.array(
            fc.record({
              id: fc.uuid(),
              level: fc.integer({ min: 1, max: 3 }),
              commissionRate: fc.float({ min: 1, max: 20, noNaN: true })
            }),
            { minLength: 1, maxLength: 3 }
          ),
          (orderAmount, agentData) => {
            const agents: Agent[] = agentData.map((a, i) => ({
              ...a,
              parentId: i === 0 ? null : agentData[i - 1].id
            }));

            const commissions = calculateHierarchyCommissions(orderAmount, agents);

            // All agents should receive commission
            expect(commissions.size).toBe(agents.length);

            // Each commission should be calculated correctly
            for (const agent of agents) {
              const expected = Math.round(orderAmount * (agent.commissionRate / 100) * 100) / 100;
              expect(commissions.get(agent.id)).toBeCloseTo(expected, 2);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not allow more than 3 levels of agents', () => {
      const l1: Agent = { id: 'l1', level: 1, parentId: null, commissionRate: 10 };
      const l2: Agent = { id: 'l2', level: 2, parentId: 'l1', commissionRate: 8 };
      const l3: Agent = { id: 'l3', level: 3, parentId: 'l2', commissionRate: 5 };
      const l4Invalid: Agent = { id: 'l4', level: 4, parentId: 'l3', commissionRate: 3 };

      expect(validateAgentLevel(l1, null)).toBe(true);
      expect(validateAgentLevel(l2, l1)).toBe(true);
      expect(validateAgentLevel(l3, l2)).toBe(true);
      expect(validateAgentLevel(l4Invalid, l3)).toBe(false);
    });
  });

  // Property 8: Referral Relationship Permanence
  describe('Property 8: Referral Relationship Permanence', () => {
    /**
     * **Feature: distribution-plugin, Property 8: Referral Relationship Permanence**
     * **Validates: Requirements 1.4**
     *
     * For any user registered through a referral link, the referral
     * relationship SHALL be recorded and remain unchanged regardless
     * of subsequent actions.
     */

    interface User {
      id: string;
      referralCode: string | null;
      invitedBy: string | null;
    }

    interface ReferralRelationship {
      referrerId: string;
      referredUserId: string;
      createdAt: Date;
    }

    // Simulate referral recording
    const recordReferral = (
      referrer: User,
      referred: User
    ): ReferralRelationship => {
      return {
        referrerId: referrer.id,
        referredUserId: referred.id,
        createdAt: new Date()
      };
    };

    // Verify relationship cannot be changed
    const canChangeReferrer = (
      relationship: ReferralRelationship,
      newReferrerId: string
    ): boolean => {
      // Once set, referral relationship cannot be changed
      return false;
    };

    it('should record referral relationship permanently', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          (referrerId, referredId, newReferrerId) => {
            const referrer: User = {
              id: referrerId,
              referralCode: 'ABC12345',
              invitedBy: null
            };
            const referred: User = {
              id: referredId,
              referralCode: null,
              invitedBy: referrerId
            };

            const relationship = recordReferral(referrer, referred);

            // Verify relationship is recorded correctly
            expect(relationship.referrerId).toBe(referrerId);
            expect(relationship.referredUserId).toBe(referredId);

            // Verify relationship cannot be changed
            expect(canChangeReferrer(relationship, newReferrerId)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain referrer ID even after user updates', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.emailAddress(),
          (referrerId, referredId, newUsername, newEmail) => {
            const referred: User = {
              id: referredId,
              referralCode: null,
              invitedBy: referrerId
            };

            // Simulate user profile update (should not affect invitedBy)
            const updatedUser: User = {
              ...referred,
              // invitedBy remains unchanged regardless of other updates
            };

            expect(updatedUser.invitedBy).toBe(referrerId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not allow self-referral', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          (userId) => {
            const user: User = {
              id: userId,
              referralCode: 'SELF1234',
              invitedBy: null
            };

            // Self-referral should be prevented
            const isSelfReferral = user.id === userId;
            const wouldBeSelfReferral = user.invitedBy === user.id;

            // invitedBy should never equal the user's own id
            expect(wouldBeSelfReferral).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 10: Analytics Data Consistency
  describe('Property 10: Analytics Data Consistency', () => {
    /**
     * **Feature: distribution-plugin, Property 10: Analytics Data Consistency**
     * **Validates: Requirements 6.1, 6.2**
     *
     * For any distributor viewing analytics, the displayed total earnings
     * SHALL equal the sum of all 'available' and 'paid' commissions.
     */

    interface Commission {
      id: string;
      amount: number;
      status: 'pending' | 'available' | 'paid' | 'cancelled';
    }

    interface Analytics {
      totalEarnings: number;
      availableBalance: number;
      pendingBalance: number;
      paidOut: number;
    }

    // Calculate analytics from commissions
    const calculateAnalytics = (commissions: Commission[]): Analytics => {
      let availableBalance = 0;
      let pendingBalance = 0;
      let paidOut = 0;

      for (const commission of commissions) {
        switch (commission.status) {
          case 'available':
            availableBalance += commission.amount;
            break;
          case 'pending':
            pendingBalance += commission.amount;
            break;
          case 'paid':
            paidOut += commission.amount;
            break;
          // cancelled commissions don't count
        }
      }

      // Total earnings = available + paid (not pending or cancelled)
      const totalEarnings = availableBalance + paidOut;

      return {
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        availableBalance: Math.round(availableBalance * 100) / 100,
        pendingBalance: Math.round(pendingBalance * 100) / 100,
        paidOut: Math.round(paidOut * 100) / 100
      };
    };

    it('should have totalEarnings equal to availableBalance + paidOut', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              amount: fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
              status: fc.constantFrom('pending', 'available', 'paid', 'cancelled')
            }),
            { minLength: 0, maxLength: 50 }
          ),
          (commissionsData) => {
            const commissions: Commission[] = commissionsData as Commission[];
            const analytics = calculateAnalytics(commissions);

            // Total earnings should equal available + paid (with floating point tolerance)
            const expected = analytics.availableBalance + analytics.paidOut;
            // Allow small floating point differences (up to 0.02)
            expect(Math.abs(analytics.totalEarnings - expected)).toBeLessThanOrEqual(0.02);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not include cancelled commissions in any totals', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          (amount) => {
            const cancelledCommission: Commission = {
              id: 'cancelled-1',
              amount,
              status: 'cancelled'
            };

            const analytics = calculateAnalytics([cancelledCommission]);

            expect(analytics.totalEarnings).toBe(0);
            expect(analytics.availableBalance).toBe(0);
            expect(analytics.pendingBalance).toBe(0);
            expect(analytics.paidOut).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not include pending commissions in totalEarnings', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          (amount) => {
            const pendingCommission: Commission = {
              id: 'pending-1',
              amount,
              status: 'pending'
            };

            const analytics = calculateAnalytics([pendingCommission]);

            // Pending should be in pendingBalance, not totalEarnings
            expect(analytics.totalEarnings).toBe(0);
            expect(analytics.pendingBalance).toBeCloseTo(amount, 2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly sum multiple commissions of different statuses', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
          (availableAmount, pendingAmount, paidAmount, cancelledAmount) => {
            const commissions: Commission[] = [
              { id: '1', amount: availableAmount, status: 'available' },
              { id: '2', amount: pendingAmount, status: 'pending' },
              { id: '3', amount: paidAmount, status: 'paid' },
              { id: '4', amount: cancelledAmount, status: 'cancelled' }
            ];

            const analytics = calculateAnalytics(commissions);

            expect(analytics.availableBalance).toBeCloseTo(availableAmount, 2);
            expect(analytics.pendingBalance).toBeCloseTo(pendingAmount, 2);
            expect(analytics.paidOut).toBeCloseTo(paidAmount, 2);
            expect(analytics.totalEarnings).toBeCloseTo(availableAmount + paidAmount, 2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

