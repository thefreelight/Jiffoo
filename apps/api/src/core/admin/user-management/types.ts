/**
 * Admin User Types (单商户版本)
 */

export interface UserCreateInput {
  email: string;
  password: string;
  username?: string;
  role?: string;
}

export interface UserUpdateInput {
  username?: string;
  role?: string;
  avatar?: string;
}

export interface UserFilters {
  search?: string;
  role?: string;
}
