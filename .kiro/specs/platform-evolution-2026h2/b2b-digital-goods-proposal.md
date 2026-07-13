# B2B × Digital Goods — Proposal

> Status: **Proposal (not scheduled for implementation)**
> Created: 2026-07-06
> Spec: Platform Evolution 2026 H2 — R7.5
> Author: Platform Evolution Team

## 1. Motivation

Jiffoo's B2B module (`src/core/b2b`) and digital commerce capabilities (R7.1–R7.3) currently operate as parallel tracks with no integration. This creates a gap for high-value B2B digital commerce scenarios:

- **Corporate gift card procurement**: A company purchases 500 × $50 gift cards for employee rewards — needs bulk code allocation, invoicing, and centralized code management.
- **Enterprise eSIM provisioning**: A travel company bulk-purchases 1,000 eSIM data plans for distribution to staff — needs batch QR code generation and assignment tracking.
- **Software license volume licensing**: A company buys 100 × Microsoft Office 365 licenses — needs license key pool management and per-seat allocation.

Today, these scenarios require manual workarounds because:
1. B2B purchase orders (`PurchaseOrder`) are physical-goods-oriented (shipping address, tracking number, carrier)
2. Digital fulfillment (`ExternalOrderService`) is triggered only from consumer checkout flow, not from B2B purchase orders
3. No "code pool" or "license pool" concept exists for bulk allocation

## 2. Current State Inventory

### B2B Module (`src/core/b2b/`)

| Sub-module | Capabilities | Digital Gap |
|---|---|---|
| `company/` | Company CRUD, credit limits | No digital-specific fields |
| `company-user/` | User-company association, roles | N/A |
| `customer-group/` | Customer group for pricing tiers | Works for digital (no change needed) |
| `pricing/` | Tiered pricing: min/max quantity, percentage/fixed discount | Works for digital (no change needed) |
| `quote/` | Quote creation with line items, pricing calculation | No fulfillment type awareness |
| `purchase-order/` | PO lifecycle (DRAFT → APPROVED → RECEIVED), shipping address, tracking number | **No `fulfillmentStatus`/`fulfillmentData` on PO items; no digital delivery fields; `quantityReceived` assumes physical receiving** |
| `payment-term/` | Net-30/60 payment terms | Works for digital (no change needed) |

### Digital Fulfillment (`src/core/external-orders/`)

| Capability | Status |
|---|---|
| Supplier product classification (`esim`, `card`, `data`) | ✅ Implemented |
| External order creation via plugin gateway | ✅ Implemented |
| Fulfillment polling (QR code, card UID, plan ID, download link) | ✅ Implemented |
| `OrderItem.fulfillmentData` (structured JSON) | ✅ Implemented |
| Trigger from consumer checkout | ✅ Implemented (via `payment/reconciliation.ts`) |
| Trigger from B2B purchase order | ❌ Not implemented |
| Batch/bulk code allocation | ❌ Not implemented |
| Code pool management (pre-purchased codes) | ❌ Not implemented |

### Order Success / Delivery Display (R7.1)

| Capability | Status |
|---|---|
| Order success page shows digital credentials | ✅ Fixed in R7.1 |
| Order detail page shows fulfillment data | ✅ Fixed in R7.1 |
| Digital delivery email template | ✅ Created in R7.1 |

## 3. Proposed Capabilities (Future Spec)

### 3.1 B2B Digital Purchase Order

Extend `PurchaseOrder` and `PurchaseOrderItem` to support digital goods:

- Add `fulfillmentType` to PO items: `shipping` | `esim` | `card` | `download`
- Add `fulfillmentStatus` to PO items: `pending` | `processing` | `fulfilled` | `failed`
- Add `fulfillmentData` JSON field to PO items (reuses the same structure as consumer `OrderItem.fulfillmentData`)
- Skip shipping address validation for digital-only POs
- Replace `quantityReceived` semantics with `quantityFulfilled` for digital items

### 3.2 Code Pool / License Pool

New model for pre-purchased digital inventory:

```prisma
model DigitalCodePool {
  id            String   @id @default(uuid())
  productId     String
  variantId     String
  code          String   // Redemption code, license key, or QR data
  status        String   @default("available") // available | allocated | expired | revoked
  allocatedTo   String?  // OrderItem ID or CompanyUser ID
  allocatedAt   DateTime?
  expiresAt     DateTime?
  batchId       String?  // Groups codes purchased in the same PO
  createdAt     DateTime @default(now())
}
```

- Codes can be pre-loaded (bulk import) or provisioned on-demand via supplier plugin
- `allocateFromPool(productId, quantity)` → atomically reserves N codes
- Integrates with PO: when PO is APPROVED + PAID, codes are allocated from pool

### 3.3 Bulk Fulfillment Trigger

Wire `ExternalOrderService.processPaidOrder()` to also handle B2B purchase orders:

- When PO status becomes `APPROVED` and payment is `PAID`:
  1. For each digital PO item, check if a code pool exists
  2. If pool has available codes → allocate and set `fulfillmentStatus = fulfilled`
  3. If no pool → call supplier plugin (same as consumer flow) → poll for fulfillment data
  4. Batch-allocate codes and generate a delivery manifest (CSV/JSON)

### 3.4 B2B Delivery Dashboard

Admin UI for B2B digital order management:

- PO detail page shows digital fulfillment status per item
- "Download codes" button: exports allocated codes as CSV (for distribution to employees)
- "Resend delivery email" per item
- Code pool management: import codes, view pool status, revoke codes

### 3.5 Corporate eSIM Portal (Stretch)

Self-service portal for company users:

- Company user logs in → sees allocated eSIM plans
- Each plan shows QR code + activation instructions
- Admin can reassign codes between company users
- Usage tracking (data consumed, expiry)

## 4. Data Model Impact

| Change | Migration Required? | Notes |
|---|---|---|
| Add `fulfillmentType` to `PurchaseOrderItem` | Yes | New enum field |
| Add `fulfillmentStatus` to `PurchaseOrderItem` | Yes | New enum field |
| Add `fulfillmentData` to `PurchaseOrderItem` | Yes | JSON field (same as OrderItem) |
| Add `DigitalCodePool` model | Yes | New table |
| Modify `PurchaseOrder` shipping validation | No | Code change only |

**Total: 1 new migration with 1 new table + 3 new fields**

## 5. API Surface (Proposed)

```
POST   /api/v1/admin/b2b/purchase-orders/:id/fulfill          — Trigger digital fulfillment
GET    /api/v1/admin/b2b/purchase-orders/:id/codes             — List allocated codes
POST   /api/v1/admin/b2b/purchase-orders/:id/codes/export      — Export codes as CSV
POST   /api/v1/admin/b2b/code-pools                            — Create code pool
POST   /api/v1/admin/b2b/code-pools/:id/import                 — Bulk import codes
GET    /api/v1/admin/b2b/code-pools                            — List pools
GET    /api/v1/admin/b2b/code-pools/:id/status                 — Pool status (available/allocated/total)
DELETE /api/v1/admin/b2b/code-pools/:id/codes/:codeId          — Revoke a code
```

## 6. Priority Assessment

| Capability | Business Value | Effort | Priority |
|---|---|---|---|
| 3.1 B2B Digital PO | High — unblocks corporate gift card / license sales | Medium | P1 |
| 3.2 Code Pool | High — required for 3.1 and 3.3 | Medium | P1 |
| 3.3 Bulk Fulfillment | High — automates delivery | Low (wires existing service) | P1 |
| 3.4 B2B Delivery Dashboard | Medium — admin UX | Medium | P2 |
| 3.5 Corporate eSIM Portal | Medium — self-service | High | P2 |

## 7. Dependencies

- R7.1 (digital fulfillment display) — ✅ Completed
- R7.2 (vertical templates) — ✅ Completed
- R4 (unified async task layer) — needed for bulk fulfillment job processing
- B2B module existing stability (no breaking changes to PO/Quote APIs)

## 8. Open Questions

1. **Code pool exhaustion**: What happens when pool runs empty mid-order? Options: (a) fail the PO item, (b) auto-provision via supplier plugin, (c) backorder. Recommendation: (b) with fallback to (a).
2. **Code format**: Should code pool support arbitrary formats or enforce structure (e.g., XXXX-XXXX-XXXX)? Recommendation: free-form with optional format validation per product.
3. **Audit trail**: Should code allocation be tracked in `AuditLog`? Recommendation: yes, with `action = "code_allocated"`, `entityType = "PurchaseOrderItem"`.
4. **Multi-store**: Does code pool need `storeId` scoping? Recommendation: yes, for multi-store deployments.
5. **Revocation**: If a code is revoked after allocation, should the PO item status revert? Recommendation: yes, set `fulfillmentStatus = pending` and notify admin.

## 9. Conclusion

The B2B × Digital Goods intersection is a natural next step after R7's digital commerce foundation. The highest-value capabilities (digital PO, code pool, bulk fulfillment) can be delivered as a cohesive feature set in the next development cycle. This proposal should be refined into an executable spec with task breakdown once prioritized.
