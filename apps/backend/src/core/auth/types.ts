import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email format'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  avatar: z.string().url().optional(),
});

export type LoginRequest = z.infer<typeof LoginSchema>;
export type RegisterRequest = z.infer<typeof RegisterSchema>;

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    username: string;
    avatar?: string;
    role: string;
  };
  token: string;
}
