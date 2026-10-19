-- AlterTable
ALTER TABLE "orders" ADD COLUMN "order_number" TEXT;

-- CreateTable
CREATE TABLE "order_number_counters" (
    "day" TEXT NOT NULL,
    "last_value" INTEGER NOT NULL,
    CONSTRAINT "order_number_counters_pkey" PRIMARY KEY ("day")
);

-- Backfill in the store timezone using UTC timestamps independently of the session timezone.
WITH store AS (
    SELECT COALESCE((SELECT settings->>'localization.timezone'
      FROM public.system_settings WHERE id = 'system'), 'UTC') AS timezone
), dated AS (
    SELECT id, "createdAt", to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE store.timezone, 'YYYYMMDD') AS day
    FROM public.orders CROSS JOIN store
), numbered AS (
    SELECT id, day, row_number() OVER (PARTITION BY day ORDER BY "createdAt", id) AS number
    FROM dated
)
UPDATE public.orders AS orders
SET order_number = 'JF-' || numbered.day || '-' ||
    lpad(numbered.number::text, greatest(4, length(numbered.number::text)), '0')
FROM numbered WHERE orders.id = numbered.id;

INSERT INTO public.order_number_counters (day, last_value)
SELECT split_part(order_number, '-', 2), max(split_part(order_number, '-', 3)::integer)
FROM public.orders GROUP BY split_part(order_number, '-', 2);

ALTER TABLE "orders" ALTER COLUMN "order_number" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");
