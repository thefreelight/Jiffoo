/**
 * 租户ID安全解析工具
 * 处理HTTP请求中的tenantId字符串到数字的安全转换
 */

/**
 * 安全解析tenantId字符串为数字
 * @param tenantIdStr - 来自HTTP请求的tenantId字符串
 * @returns 有效的tenantId数字，或null表示无效
 */
export function parseTenantId(tenantIdStr: string | undefined | null): number | null {
  // 空值检查
  if (!tenantIdStr || tenantIdStr.trim() === '') {
    return null;
  }

  // 去除前后空格
  const trimmed = tenantIdStr.trim();

  // 检查是否为纯数字字符串
  if (!/^\d+$/.test(trimmed)) {
    console.warn(`Invalid tenantId format: "${tenantIdStr}". Must be a non-negative integer.`);
    return null;
  }

  // 转换为数字
  const parsed = parseInt(trimmed, 10);

  // 检查转换结果 - 现在允许0（超级管理员）
  if (isNaN(parsed) || parsed < 0) {
    console.warn(`Invalid tenantId value: "${tenantIdStr}". Must be a non-negative integer.`);
    return null;
  }

  // 检查是否超出安全整数范围
  if (parsed > Number.MAX_SAFE_INTEGER) {
    console.warn(`TenantId too large: "${tenantIdStr}". Must be within safe integer range.`);
    return null;
  }

  return parsed;
}

/**
 * 从HTTP请求中安全提取tenantId
 * @param request - Fastify请求对象
 * @returns 有效的tenantId数字，或null
 */
export function extractTenantId(request: any): number | null {
  // 优先级：请求头 > 查询参数 > 请求体
  const tenantIdStr = request.headers['x-tenant-id'] as string ||
                      request.query?.tenantId as string ||
                      request.body?.tenantId as string;

  return parseTenantId(tenantIdStr);
}

/**
 * 验证tenantId是否有效（包括超级管理员的0值）
 * @param tenantId - 要验证的tenantId
 * @returns 是否为有效的tenantId
 */
export function isValidTenantId(tenantId: any): tenantId is number {
  return typeof tenantId === 'number' &&
         Number.isInteger(tenantId) &&
         tenantId >= 0 &&  // 允许0（超级管理员）
         tenantId <= Number.MAX_SAFE_INTEGER;
}

/**
 * 验证租户ID是否可用于创建租户（不能是0）
 * @param tenantId - 要验证的tenantId
 * @returns 是否为有效的租户创建ID
 */
export function isValidTenantCreationId(tenantId: any): tenantId is number {
  return typeof tenantId === 'number' &&
         Number.isInteger(tenantId) &&
         tenantId > 0 &&  // 不允许0，0保留给超级管理员
         tenantId <= Number.MAX_SAFE_INTEGER;
}

/**
 * 超级管理员的特殊tenantId值
 * 使用0表示超级管理员，避免null值的复合唯一约束问题
 */
export const SUPER_ADMIN_TENANT_ID = 0;

/**
 * 检查是否为超级管理员的tenantId
 */
export function isSuperAdminTenantId(tenantId: number | null | undefined): boolean {
  return tenantId === SUPER_ADMIN_TENANT_ID;
}

/**
 * 格式化tenantId用于日志输出
 */
export function formatTenantId(tenantId: number | null | undefined): string {
  if (tenantId === null || tenantId === undefined) {
    return 'null';
  }
  if (tenantId === SUPER_ADMIN_TENANT_ID) {
    return 'SUPER_ADMIN';
  }
  return tenantId.toString();
}
