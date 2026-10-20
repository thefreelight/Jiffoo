import { z } from 'zod';

export const LoginSchema = z.object({
  identifier: z.string().trim().min(1, 'Email or username is required').optional(),
  email: z.string().email('Invalid email format').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
}).refine((data) => Boolean(data.identifier || data.email), {
  message: 'Email or username is required',
  path: ['identifier'],
});

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email format'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  avatar: z.string().url().optional(),
});

export type LoginRequest = z.infer<typeof LoginSchema>;
export type RegisterRequest = z.infer<typeof RegisterSchema>;

// Standard OAuth2 response format
export interface StandardAuthResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number; // Seconds
  refresh_token?: string;
}

// User profile response (via /me endpoint)
export interface UserProfileResponse {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  role: string;
}

// Keep old AuthResponse type for gradual migration
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    username: string;
    avatar?: string;
    role: string;
  };
}
