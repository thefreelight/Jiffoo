-- Merge duplicate cart lines before the unique index can exist.
-- The oldest line of a (cartId, variantId) pair survives and carries the summed quantity;
-- every other line of that pair is removed. A cart without duplicates is untouched.
WITH totals AS (
  SELECT "cartId", "variantId", SUM(quantity)::int AS total
  FROM public.cart_items
  GROUP BY "cartId", "variantId"
  HAVING COUNT(*) > 1
), keeper AS (
  SELECT DISTINCT ON ("cartId", "variantId") id, "cartId", "variantId"
  FROM public.cart_items
  ORDER BY "cartId", "variantId", "createdAt", id
)
UPDATE public.cart_items c
SET quantity = t.total
FROM totals t
JOIN keeper k ON k."cartId" = t."cartId" AND k."variantId" = t."variantId"
WHERE c.id = k.id;

WITH keeper AS (
  SELECT DISTINCT ON ("cartId", "variantId") id, "cartId", "variantId"
  FROM public.cart_items
  ORDER BY "cartId", "variantId", "createdAt", id
)
DELETE FROM public.cart_items c
USING keeper k
WHERE k."cartId" = c."cartId" AND k."variantId" = c."variantId" AND c.id <> k.id;

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cartId_variantId_key" ON "cart_items"("cartId", "variantId");
