import { z } from 'zod';

// Enum definitions matching Prisma schema
export const AccountStatusEnum = z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED']);
export const AccountTypeEnum = z.enum(['STANDARD', 'PREMIUM', 'ENTERPRISE']);
export const PaymentTermsEnum = z.enum(['IMMEDIATE', 'NET15', 'NET30', 'NET60', 'NET90']);

// Create company schema
export const CreateCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  taxId: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  description: z.string().optional(),

  // Business information
  industry: z.string().optional(),
  employeeCount: z.string().optional(),
  annualRevenue: z.string().optional(),

  // Status and settings
  isActive: z.boolean().optional().default(true),
  accountStatus: AccountStatusEnum.optional().default('PENDING'),
  accountType: AccountTypeEnum.optional().default('STANDARD'),

  // Payment and credit
  paymentTerms: PaymentTermsEnum.optional().default('IMMEDIATE'),
  creditLimit: z.number().min(0).optional().default(0),
  taxExempt: z.boolean().optional().default(false),
  taxExemptionId: z.string().optional(),

  // Pricing and discounts
  customerGroupId: z.string().optional(),
  discountPercent: z.number().min(0).max(100).optional().default(0),

  // Billing address
  billingAddress1: z.string().optional(),
  billingAddress2: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
  billingCountry: z.string().optional(),
  billingPostalCode: z.string().optional(),
});

// Update company schema (all fields optional except where constraints needed)
export const UpdateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  taxId: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  description: z.string().optional(),

  // Business information
  industry: z.string().optional(),
  employeeCount: z.string().optional(),
  annualRevenue: z.string().optional(),

  // Status and settings
  isActive: z.boolean().optional(),
  accountStatus: AccountStatusEnum.optional(),
  accountType: AccountTypeEnum.optional(),

  // Payment and credit
  paymentTerms: PaymentTermsEnum.optional(),
  creditLimit: z.number().min(0).optional(),
  taxExempt: z.boolean().optional(),
  taxExemptionId: z.string().optional(),

  // Pricing and discounts
  customerGroupId: z.string().optional(),
  discountPercent: z.number().min(0).max(100).optional(),

  // Billing address
  billingAddress1: z.string().optional(),
  billingAddress2: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
  billingCountry: z.string().optional(),
  billingPostalCode: z.string().optional(),
});

// Update company status schema (for admin actions)
export const UpdateCompanyStatusSchema = z.object({
  accountStatus: AccountStatusEnum,
});

// Type exports
export type CreateCompanyRequest = z.infer<typeof CreateCompanySchema>;
export type UpdateCompanyRequest = z.infer<typeof UpdateCompanySchema>;
export type UpdateCompanyStatusRequest = z.infer<typeof UpdateCompanyStatusSchema>;
export type AccountStatus = z.infer<typeof AccountStatusEnum>;
export type AccountType = z.infer<typeof AccountTypeEnum>;
export type PaymentTerms = z.infer<typeof PaymentTermsEnum>;

// Response type
export interface CompanyResponse {
  id: string;
  name: string;
  email: string;
  phone?: string;
  taxId?: string;
  website?: string;
  description?: string;

  // Business information
  industry?: string;
  employeeCount?: string;
  annualRevenue?: string;

  // Status and settings
  isActive: boolean;
  accountStatus: string;
  accountType: string;

  // Payment and credit
  paymentTerms: string;
  creditLimit: number;
  currentBalance: number;
  taxExempt: boolean;
  taxExemptionId?: string;

  // Pricing and discounts
  customerGroupId?: string;
  discountPercent: number;

  // Billing address
  billingAddress1?: string;
  billingAddress2?: string;
  billingCity?: string;
  billingState?: string;
  billingCountry?: string;
  billingPostalCode?: string;

  createdAt: Date;
  updatedAt: Date;
}
