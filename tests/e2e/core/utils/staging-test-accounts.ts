/**
 * Staging Environment Test Accounts
 * 
 * 测试环境专用账号配置
 * 这些账号需要在测试环境数据库中预先创建
 * 
 * 环境: jiffoo.chfastpay.com (K8s NodePort)
 */

export interface StagingTestUser {
  email: string;
  password: string;
  role: 'customer' | 'tenant_admin' | 'super_admin';
  name: string;
  description: string;
}

/**
 * 测试环境账号
 * 
 * 注意: 这些账号需要通过 seed 脚本在测试环境数据库中创建
 */
export const STAGING_TEST_USERS = {
  // 客户账号 (Shop 前端)
  customer: {
    email: 'test-customer@jiffoo.com',
    password: 'TestCustomer@2024',
    role: 'customer' as const,
    name: 'Test Customer',
    description: '普通客户账号，用于测试购物流程',
  },
  
  // 管理员账号 (Admin 后台)
  admin: {
    email: 'test-admin@jiffoo.com',
    password: 'TestAdmin@2024',
    role: 'super_admin' as const,
    name: 'Test Admin',
    description: '管理员账号，用于测试后台功能',
  },
} as const;

/**
 * 测试环境 API URLs
 */
export const STAGING_API_URLS = {
  base: 'http://jiffoo.chfastpay.com:30002',
  auth: {
    login: '/api/auth/login',
    register: '/api/auth/register',
    logout: '/api/auth/logout',
    me: '/api/auth/me',
  },
  products: '/api/products',
  cart: '/api/cart',
  orders: '/api/orders',
  admin: {
    products: '/api/admin/products',
    orders: '/api/admin/orders',
    customers: '/api/admin/customers',
  },
};

/**
 * 获取测试用户
 */
export function getStagingUser(
  type: keyof typeof STAGING_TEST_USERS
): StagingTestUser {
  return STAGING_TEST_USERS[type];
}

/**
 * 通过 API 登录获取 token
 */
export async function loginViaApi(
  user: StagingTestUser
): Promise<{ token: string; user: any }> {
  const response = await fetch(
    `${STAGING_API_URLS.base}${STAGING_API_URLS.auth.login}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        password: user.password,
      }),
    }
  );
  
  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * 验证测试账号是否可用
 */
export async function validateStagingAccounts(): Promise<{
  valid: boolean;
  results: Record<string, { success: boolean; error?: string }>;
}> {
  const results: Record<string, { success: boolean; error?: string }> = {};
  
  for (const [key, user] of Object.entries(STAGING_TEST_USERS)) {
    try {
      await loginViaApi(user);
      results[key] = { success: true };
    } catch (error) {
      results[key] = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  const valid = Object.values(results).every((r) => r.success);
  return { valid, results };
}
