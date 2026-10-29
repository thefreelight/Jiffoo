# Raw indexes outside the Prisma datamodel

Some indexes exist in the database only as hand-written SQL. The Prisma datamodel
(`apps/api/prisma/schema/**.prisma`) cannot express them: a partial index (`WHERE ...`), an
expression index (`lower(...)`) and an operator class index (`USING gin (... gin_trgm_ops)`) have
no Prisma equivalent. They are therefore invisible to `prisma migrate diff`, `prisma db pull` and
every Prisma-generated migration: neither the datamodel nor a generated migration knows that they
exist.

## Warning

Because `prisma migrate diff` compares the datamodel with the database, and these indexes are in
neither side of that comparison, the diff does not see them. The repository's own drift gate
proves it: `deploy/compose/core-migration-parity.mjs` runs exactly

```
prisma migrate diff --from-url <database> --to-schema-datamodel prisma/schema --exit-code
```

and it passes - exit code 0, no difference - on a database that carries every index listed
below. A generated migration therefore neither drops nor re-creates them.

Two rules follow from that, and they point in opposite directions:

1. **Do not drop them.** They carry the business invariants (one open payment per order, one
   accepted capture per order, one completed refund per capture, one automatic payment
   notification per order, one order-paid event per order, one payment-succeeded event per order,
   and the case-insensitive uniqueness of the product SPU and variant SKU codes) and the search
   access paths that the catalogue searches need (the trigram GIN indexes and the partial refund
   review index). The `migrations/**/migration.sql` files below are their only record; a database
   that was rebuilt from a Prisma-generated migration alone would lose them.
2. **Do not re-declare them in a migration either.** They already exist in every database built
   from the migration history, so a migration that contains
   `CREATE UNIQUE INDEX products_spuCode_lower_key ON public.products (lower("spuCode"));` is
   answered by PostgreSQL with `relation "products_spuCode_lower_key" already exists`, the
   migration aborts, and `deploy/release/core-migrations.mjs` rolls the whole update back.

In short: a generated migration is a no-op for these indexes. Leave them alone - do not add them,
do not drop them.

## The raw indexes

| Index name | Table | Definition | Created by |
| --- | --- | --- | --- |
| `payments_one_open_per_order` | `payments` | `CREATE UNIQUE INDEX payments_one_open_per_order ON payments("orderId") WHERE status NOT IN ('SUCCEEDED','FAILED','CANCELLED','EXPIRED')` | `20261010080216_payment_convergence/migration.sql` |
| `event_records_one_order_paid` | `event_records` | `CREATE UNIQUE INDEX event_records_one_order_paid ON event_records("aggregateId") WHERE type = 'order.paid'` | `20261010080216_payment_convergence/migration.sql` |
| `event_records_one_payment_succeeded_per_order` | `event_records` | `CREATE UNIQUE INDEX event_records_one_payment_succeeded_per_order ON event_records((data->>'orderId')) WHERE type = 'payment.succeeded'` | `20261010080216_payment_convergence/migration.sql` |
| `notifications_one_automatic_payment_received` | `notifications` | `CREATE UNIQUE INDEX notifications_one_automatic_payment_received ON notifications("relatedId") WHERE type = 'payment_received' AND "relatedType" = 'order' AND "resentFromId" IS NULL` | `20261010080216_payment_convergence/migration.sql` |
| `payment_ledger_one_accepted_capture_per_order` | `payment_ledger` | `CREATE UNIQUE INDEX payment_ledger_one_accepted_capture_per_order ON payment_ledger("orderId") WHERE "eventType" = 'SUCCEEDED' AND "refundRequired" = false` | `20261010120922_payment_contract_v2/migration.sql` |
| `refunds_one_completed_per_capture` | `refunds` | `CREATE UNIQUE INDEX refunds_one_completed_per_capture ON refunds("paymentLedgerId") WHERE status = 'COMPLETED'` | `20261010120922_payment_contract_v2/migration.sql` |
| `products_spuCode_lower_key` | `products` | `CREATE UNIQUE INDEX products_spuCode_lower_key ON public.products (lower("spuCode"))` | `20261013163101_product_spu_variant_sku/migration.sql` |
| `product_variants_skuCode_lower_key` | `product_variants` | `CREATE UNIQUE INDEX product_variants_skuCode_lower_key ON public.product_variants (lower("skuCode"))` | `20261013163101_product_spu_variant_sku/migration.sql` |
| `products_name_trgm_idx` | `products` | `CREATE INDEX IF NOT EXISTS "products_name_trgm_idx" ON "products" USING gin ("name" gin_trgm_ops) WHERE "name" IS NOT NULL` | `20261028031500_data_reliability_indexes/migration.sql` |
| `products_description_trgm_idx` | `products` | `CREATE INDEX IF NOT EXISTS "products_description_trgm_idx" ON "products" USING gin ("description" gin_trgm_ops) WHERE "description" IS NOT NULL` | `20261028031500_data_reliability_indexes/migration.sql` |
| `products_spuCode_trgm_idx` | `products` | `CREATE INDEX IF NOT EXISTS "products_spuCode_trgm_idx" ON "products" USING gin ("spuCode" gin_trgm_ops) WHERE "spuCode" IS NOT NULL` | `20261028031500_data_reliability_indexes/migration.sql` |
| `orders_orderNumber_trgm_idx` | `orders` | `CREATE INDEX IF NOT EXISTS "orders_orderNumber_trgm_idx" ON "orders" USING gin ("order_number" gin_trgm_ops) WHERE "order_number" IS NOT NULL` | `20261028031500_data_reliability_indexes/migration.sql` |
| `users_email_trgm_idx` | `users` | `CREATE INDEX IF NOT EXISTS "users_email_trgm_idx" ON "users" USING gin ("email" gin_trgm_ops) WHERE "email" IS NOT NULL` | `20261028031500_data_reliability_indexes/migration.sql` |
| `users_username_trgm_idx` | `users` | `CREATE INDEX IF NOT EXISTS "users_username_trgm_idx" ON "users" USING gin ("username" gin_trgm_ops) WHERE "username" IS NOT NULL` | `20261028031500_data_reliability_indexes/migration.sql` |
| `product_variants_skuCode_trgm_idx` | `product_variants` | `CREATE INDEX IF NOT EXISTS "product_variants_skuCode_trgm_idx" ON "product_variants" USING gin ("skuCode" gin_trgm_ops) WHERE "skuCode" IS NOT NULL` | `20261028031500_data_reliability_indexes/migration.sql` |
| `payment_ledger_succeeded_refund_required_idx` | `payment_ledger` | `CREATE INDEX IF NOT EXISTS "payment_ledger_succeeded_refund_required_idx" ON "payment_ledger" ("orderId") WHERE "eventType" = 'SUCCEEDED' AND "refundRequired" = true` | `20261028031500_data_reliability_indexes/migration.sql` |
| `orders_id_trgm_idx` | `orders` | `CREATE INDEX IF NOT EXISTS "orders_id_trgm_idx" ON "orders" USING gin ("id" gin_trgm_ops) WHERE "id" IS NOT NULL` | `20261029061832_orders_id_trgm_index/migration.sql` |

Every row above was read back from the migration files: each of the seventeen indexes is created by
the migration named in the last column, and no later migration drops it. The plain btree indexes
of the same migrations are not listed here, because the Prisma datamodel expresses them and
`prisma migrate diff` therefore sees them on both sides of the comparison.

The `DROP INDEX` statements of the migration history remove the superseded indexes: the four of
the notes below, and the four single column indexes that the data reliability migration drops
after their composite replacements exist (`orders_status_idx`, `orders_paymentStatus_idx`,
`notifications_resentFromId_idx` and `orders_idempotencyKey_key`). None of them is a row of the
table above, so the table stays complete.

Notes on the two superseded indexes of the payment convergence migration:

- `payment_ledger_one_success_per_payment` and `refunds_one_completed_per_payment` were dropped
  by `20261010120922_payment_contract_v2/migration.sql` and replaced by the two rows above.
- `products_spu_lower_migration_tmp` and `product_variants_sku_lower_migration_tmp` were dropped
  by `20261013163101_product_spu_variant_sku/migration.sql` and replaced by the two `lower()` rows
  above.

The names above are the names Prisma would use for the columns involved
(`products_spuCode_lower_key` is stored by PostgreSQL in lower case as
`products_spucode_lower_key`, because the creating statement does not quote the identifier). The
rows of the data reliability migration quote their identifiers, so PostgreSQL keeps their case:
`products_spuCode_trgm_idx` and `product_variants_skuCode_trgm_idx` are stored with the capital
letter of the column they cover. The `orders_id_trgm_idx` row quotes its identifiers as well, but
its name carries no capital letter, so PostgreSQL stores it unchanged.
