-- Order-item catalog snapshot: generated Prisma columns added nullable, backfilled, then made NOT NULL.
-- No BEGIN/COMMIT wrapper: the executor owns the transaction.
-- Existing quantity, unit price, tax, currency, FKs and financial ledgers are unchanged.
-- Ordered products/variants are protected by the existing ON DELETE RESTRICT FKs, so every join matches;
-- the LEFT JOIN plus the CHECK below make any impossible orphan fail the migration (rolled back) instead of being skipped.
ALTER TABLE public.order_items
  ADD COLUMN "catalogSnapshot" JSONB,
  ADD COLUMN "lineTotal" DECIMAL(18, 2);

-- Catalog values are the available values now, not reconstructed order-time history.
UPDATE public.order_items AS item
SET "catalogSnapshot" = backfill.snapshot,
    "lineTotal" = item."unitPrice" * item.quantity
FROM (
  SELECT original.id, jsonb_build_object(
    'source', 'catalog-backfill',
    'productId', original."productId",
    'variantId', original."variantId",
    'productName', product.name,
    'variantName', variant.name,
    'skuCode', variant."skuCode",
    'variantAttributes', variant.attributes,
    'productType', product."productType",
    'productTypeData', product."typeData",
    'productImages', CASE
      WHEN jsonb_typeof(product."typeData" -> 'images') = 'array' THEN
        COALESCE((SELECT jsonb_agg(image.value ORDER BY image.position)
                  FROM jsonb_array_elements(product."typeData" -> 'images')
                       WITH ORDINALITY AS image(value, position)
                  WHERE jsonb_typeof(image.value) = 'string'), '[]'::jsonb)
      ELSE '[]'::jsonb
    END,
    'productTranslations', COALESCE(
      (SELECT jsonb_object_agg(translation.locale, translation.name)
       FROM public.product_translations AS translation
       WHERE translation."productId" = original."productId"), '{}'::jsonb)
  ) AS snapshot
  FROM public.order_items AS original
  LEFT JOIN public.products AS product ON product.id = original."productId"
  LEFT JOIN public.product_variants AS variant ON variant.id = original."variantId"
) AS backfill
WHERE backfill.id = item.id;

ALTER TABLE public.order_items
  ALTER COLUMN "catalogSnapshot" SET NOT NULL,
  ALTER COLUMN "lineTotal" SET NOT NULL;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_catalog_snapshot_shape_check CHECK (
    jsonb_typeof("catalogSnapshot") = 'object'
    AND "catalogSnapshot" ?& ARRAY[
      'source', 'productId', 'variantId', 'productName', 'variantName', 'skuCode',
      'variantAttributes', 'productType', 'productTypeData', 'productImages', 'productTranslations'
    ]
    AND COALESCE(
      "catalogSnapshot" ->> 'source' IN ('catalog-backfill', 'order-time'),
      false
    )
    AND jsonb_typeof("catalogSnapshot" -> 'productId') = 'string'
    AND jsonb_typeof("catalogSnapshot" -> 'variantId') = 'string'
    AND jsonb_typeof("catalogSnapshot" -> 'productName') = 'string'
    AND jsonb_typeof("catalogSnapshot" -> 'variantName') = 'string'
    AND jsonb_typeof("catalogSnapshot" -> 'productImages') = 'array'
    AND jsonb_typeof("catalogSnapshot" -> 'productTranslations') = 'object'
  ),
  ADD CONSTRAINT order_items_line_total_check CHECK (
    "lineTotal" = "unitPrice" * quantity
  );

CREATE FUNCTION public.enforce_order_item_snapshot_immutable()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF ROW(NEW."catalogSnapshot", NEW.quantity, NEW."unitPrice", NEW."taxAmount", NEW.currency, NEW."lineTotal",
         NEW."productId", NEW."variantId")
     IS DISTINCT FROM
     ROW(OLD."catalogSnapshot", OLD.quantity, OLD."unitPrice", OLD."taxAmount", OLD.currency, OLD."lineTotal",
         OLD."productId", OLD."variantId") THEN
    RAISE EXCEPTION 'Order item snapshot is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER order_items_snapshot_immutable
BEFORE UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_item_snapshot_immutable();
