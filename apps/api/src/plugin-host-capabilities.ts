import { registerHostCapabilityAdapters } from './core/extensions/host-capabilities/service';
import { CatalogReadService } from './core/product/catalog-read-service';
import { AuthIdentityService } from './core/auth/identity-service';
import { requirePluginAction } from './core/auth/plugin-action-authorization';
import { AdminAuditService } from './core/admin/audit-events/service';
import { assertTaskOperation, requireTaskPrincipal, validateTaskPrincipal } from './core/plugins/tasks';

/** Wire public domain projections at the process composition root. */
export function initializePluginHostCapabilities(): void {
  registerHostCapabilityAdapters({
    requirePluginAction,
    catalogue: (ids, locale) => CatalogReadService.purchasableVariants(ids, locale),
    assertOperation: assertTaskOperation,
    principal: requireTaskPrincipal,
    validatePrincipal: validateTaskPrincipal,
    customers: (tx, input) => AuthIdentityService.customerDirectory(tx, input),
    audit: (tx, event) => AdminAuditService.record(tx, event),
  });
}
