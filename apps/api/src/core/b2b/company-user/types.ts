import { z } from 'zod';

// Enum definitions matching Prisma schema
export const CompanyUserRoleEnum = z.enum(['ADMIN', 'BUYER', 'APPROVER', 'VIEWER']);

// Add user to company schema
export const AddCompanyUserSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  role: CompanyUserRoleEnum.optional().default('BUYER'),
  permissions: z.string().optional(), // JSON string for custom permissions
  approvalLimit: z.number().min(0).optional().default(0), // 0 = unlimited
  isActive: z.boolean().optional().default(true),
  invitedBy: z.string().optional(),
});

// Update company user schema
export const UpdateCompanyUserSchema = z.object({
  role: CompanyUserRoleEnum.optional(),
  permissions: z.string().optional(), // JSON string for custom permissions
  approvalLimit: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

// Update company user role schema (simplified for admin actions)
export const UpdateCompanyUserRoleSchema = z.object({
  role: CompanyUserRoleEnum,
});

// Type exports
export type AddCompanyUserRequest = z.infer<typeof AddCompanyUserSchema>;
export type UpdateCompanyUserRequest = z.infer<typeof UpdateCompanyUserSchema>;
export type UpdateCompanyUserRoleRequest = z.infer<typeof UpdateCompanyUserRoleSchema>;
export type CompanyUserRole = z.infer<typeof CompanyUserRoleEnum>;

// Response type
export interface CompanyUserResponse {
  id: string;
  companyId: string;
  userId: string;
  role: string;
  permissions?: string;
  approvalLimit: number;
  isActive: boolean;
  invitedBy?: string;
  invitedAt?: Date;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Response with user details
export interface CompanyUserWithDetailsResponse extends CompanyUserResponse {
  user: {
    id: string;
    email: string;
    username: string;
    avatar?: string;
  };
}

// Response with company details
export interface CompanyUserWithCompanyResponse extends CompanyUserResponse {
  company: {
    id: string;
    name: string;
    email: string;
    accountStatus: string;
  };
}
