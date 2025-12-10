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

// 标准OAuth2响应格式
export interface StandardAuthResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number; // 秒数
  refresh_token?: string;
}

// 用户信息响应（通过/me端点获取）
export interface UserProfileResponse {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  role: string;
}

// 保留旧的AuthResponse类型以便逐步迁移
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    username: string;
    avatar?: string;
    role: string;
  };
}
