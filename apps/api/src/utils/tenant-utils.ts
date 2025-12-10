/**
 * Tenant Utils (单商户版本 - 兼容性 shim)
 * 
 * 这些函数保留是为了兼容性，但在单商户版本中返回固定值。
 * 多租户插件安装后会覆盖这些函数。
 */

/**
 * @deprecated 单商户版本不需要租户ID
 */
export function getTenantId(): number {
  return 0;
}

/**
 * @deprecated 单商户版本不需要租户上下文
 */
export function getTenantContext(): null {
  return null;
}

/**
 * @deprecated 单商户版本不需要租户验证
 */
export function validateTenant(): boolean {
  return true;
}
