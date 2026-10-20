# Changelog

Release history prior to the Core V1 work is in this file's git history.

## Unreleased

### Changed

- `POST /api/v1/orders` now requires an `idempotencyKey`. A repeated request with the
  same key returns the original order with `200` instead of creating a second order;
  reusing a key with a different request returns `409 ORDER_IDEMPOTENCY_CONFLICT`.
