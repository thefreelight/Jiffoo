import { z } from 'zod';

export const UpdateUserSchema = z.object({
  username: z.string().min(3).optional(),
  avatar: z.string().url().optional(),
});

export const UpdateUserRoleSchema = z.object({
  role: z.enum(['USER', 'ADMIN']),
});

export type UpdateUserRequest = z.infer<typeof UpdateUserSchema>;
export type UpdateUserRoleRequest = z.infer<typeof UpdateUserRoleSchema>;

export interface UserResponse {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}
