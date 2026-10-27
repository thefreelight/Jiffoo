# Raw indexes outside the Prisma datamodel

Some unique indexes exist in the database only as hand-written SQL. The Prisma datamodel
(`apps/api/prisma/schema/**.prisma`) cannot express them: a partial index (`WHERE ...`) and an
expression index (`lower(...)`) have no Prisma equivalent. They are therefore invisible to
`prisma migrate diff`, `prisma db pull` and every Prisma-generated migration: neither the
datamodel nor a generated migration knows that they exist.

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
   and the case-insensitive uniqueness of the product SPU and variant SKU codes). The
   `migrations/**/migration.sql` files below are their only record; a database that was rebuilt
   from a Prisma-generated migration alone would lose them.
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

Every row above was read back from the migration files: each of the eight indexes is created by
the migration named in the last column, and no later migration drops it. The only `DROP INDEX`
statements of the migration history remove the four superseded indexes below.

Notes on the two superseded indexes of the payment convergence migration:

- `payment_ledger_one_success_per_payment` and `refunds_one_completed_per_payment` were dropped
  by `20261010120922_payment_contract_v2/migration.sql` and replaced by the two rows above.
- `products_spu_lower_migration_tmp` and `product_variants_sku_lower_migration_tmp` were dropped
  by `20261013163101_product_spu_variant_sku/migration.sql` and replaced by the two `lower()` rows
  above.

The names above are the names Prisma would use for the columns involved
(`products_spuCode_lower_key` is stored by PostgreSQL in lower case as
`products_spucode_lower_key`, because the creating statement does not quote the identifier).
