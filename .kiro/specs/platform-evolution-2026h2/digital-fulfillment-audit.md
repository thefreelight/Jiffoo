# Digital Fulfillment Audit (Task 7.1.1)

> Audit date: 2026-07-05
> Auditor: Platform Evolution 2026 H2 — R7

## End-to-End Flow

```
User places order (CartService → OrderService.createOrder)
  └─ Order created with PENDING status
  └─ Order items include fulfillmentData for supplier products

User initiates payment (payment/routes.ts → create-session)
  └─ Payment session created via plugin gateway
  └─ User redirected to payment provider (e.g., Stripe)

Payment webhook received (payment/routes.ts → /webhook/:provider)
  └─ syncPaymentFromPlugin() called
  └─ On success:
      ├─ Order status → PROCESSING
      ├─ Payment status → PAID
      ├─ PaymentLedger entry created
      └─ ExternalOrderService.processPaidOrder() called (async, fire-and-forget)

External order processing (external-orders/service.ts)
  └─ For each order item with supplier product profile:
      ├─ Create ExternalOrderLink
      ├─ Call supplier plugin to create external order
      ├─ Poll for fulfillment status (QR code, card UID, plan ID, download link)
      └─ Update OrderItem.fulfillmentStatus + fulfillmentData
```

## Current State Analysis

### ✅ Working Components

| Component | Location | Status |
|-----------|----------|--------|
| Order creation with fulfillmentData | `order/service.ts` | ✅ Stores fulfillmentData per item |
| Payment reconciliation | `payment/reconciliation.ts` | ✅ Marks PAID, triggers external orders |
| External order link creation | `external-orders/service.ts` | ✅ Creates supplier orders, polls status |
| Product type classification | `external-orders/utils.ts` | ✅ Classifies esim/card/data/unknown |
| Fulfillment data persistence | `OrderItem.fulfillmentData` (JSON) | ✅ Stores QR codes, card UIDs, plan IDs |
| Order API response includes fulfillmentData | `order/service.ts:formatOrderResponse` | ✅ Returns fulfillmentData in API response |

### ❌ Identified Gaps

#### GAP-1: OrderSuccessPage shows physical shipping copy for all orders
- **Location**: `packages/shop-themes/default/src/components/OrderSuccessPage.tsx`
- **Issue**: Displays "TRACKING INFO", "3-5 BUSINESS DAYS", "Your order will be shipped" for ALL orders, including digital goods
- **Impact**: Digital goods customers see irrelevant shipping information instead of download links / redemption codes
- **Fix**: Add digital fulfillment display when order items have fulfillmentData

#### GAP-2: OrderDetailPage doesn't display fulfillment data
- **Location**: `packages/shop-themes/default/src/components/OrderDetailPage.tsx`
- **Issue**: Shows item name, quantity, and price, but NOT fulfillment data (download links, QR codes, redemption codes)
- **Impact**: Customers cannot access their digital purchases from the order detail page
- **Fix**: Add fulfillment data section to order detail items

#### GAP-3: Fulfillment handler not wired
- **Location**: `apps/api/src/infra/jobs/handlers.ts` — `fulfillmentHandler`
- **Issue**: Has `TODO: Wire to fulfillment service for digital/physical goods`
- **Impact**: The unified job layer (BullMQ/Outbox) doesn't actually process fulfillment — `ExternalOrderService` is called directly from `reconciliation.ts` as a side effect
- **Fix**: This is acceptable for R7 — the direct call from reconciliation works. The handler should log and monitor, not duplicate the external order flow. Mark as intentional.

#### GAP-4: Email handler not wired for digital delivery
- **Location**: `apps/api/src/infra/jobs/handlers.ts` — `emailHandler`
- **Issue**: Has `TODO: Wire to NotificationService once email templates are finalized`
- **Impact**: Order confirmation emails don't include digital delivery credentials
- **Fix**: Add digital delivery email template + wire email handler

#### GAP-5: No email template for digital goods delivery
- **Location**: `apps/api/src/core/notification/` (no digital delivery template)
- **Issue**: No template exists for "Your digital purchase is ready" emails
- **Impact**: Customers must log in to access their digital purchases
- **Fix**: Create digital delivery email template

#### GAP-6: OrderSuccessPageProps doesn't include order items/fulfillmentData
- **Location**: `packages/shared/src/types/theme.ts` — `OrderSuccessPageProps`
- **Issue**: Only receives `orderNumber`, `order`, `isVerifying` — no fulfillment data
- **Impact**: Theme cannot display delivery credentials on success page
- **Fix**: Extend OrderSuccessPageProps to include fulfillment data

## Fix Plan (Task 7.1.2)

| Priority | Gap | Fix | Scope |
|----------|-----|-----|-------|
| P0 | GAP-1 | OrderSuccessPage: detect digital orders, show delivery section | Theme |
| P0 | GAP-2 | OrderDetailPage: display fulfillmentData per item | Theme |
| P0 | GAP-6 | Extend OrderSuccessPageProps + OrderDetailPage to pass fulfillmentData | Types + Theme |
| P1 | GAP-5 | Digital delivery email template | API |
| P1 | GAP-4 | Wire email handler to send delivery email | API |
| P2 | GAP-3 | Document fulfillmentHandler as monitoring-only | Docs |

## E2E Test Plan (Task 7.1.3)

1. Create a digital product with fulfillment data (card-code type)
2. Add to cart, checkout, mock payment success
3. Verify order success page shows redemption code
4. Verify order detail page shows delivery credentials
5. Verify email handler queues delivery notification
