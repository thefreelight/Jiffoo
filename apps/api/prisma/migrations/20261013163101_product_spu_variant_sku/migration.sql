-- Add the SPU column as nullable so populated stores can be backfilled.
ALTER TABLE public.products ADD COLUMN "spuCode" TEXT;

-- The Core executor owns the transaction; block catalog writes until indexes exist.
LOCK TABLE public.product_variants IN ACCESS EXCLUSIVE MODE;

-- Index collision probes while backfilling random identifiers.
CREATE INDEX products_spu_lower_migration_tmp ON public.products (lower("spuCode"));
DO $spu$
DECLARE
    product_row RECORD;
    alphabet CONSTANT TEXT := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
    candidate TEXT;
    character_number INTEGER;
BEGIN
    FOR product_row IN
        SELECT id FROM public.products ORDER BY "createdAt", id
    LOOP
        LOOP
            candidate := '';
            FOR character_number IN 1..8 LOOP
                candidate := candidate || substr(alphabet, floor(random() * 30)::int + 1, 1);
            END LOOP;
            EXIT WHEN NOT EXISTS (
                SELECT 1 FROM public.products WHERE lower("spuCode") = lower(candidate)
            );
        END LOOP;
        UPDATE public.products
        SET "spuCode" = candidate
        WHERE id = product_row.id;
    END LOOP;
END
$spu$;

-- Normalize historical SKUs without imposing new format rules on existing values.
UPDATE public.product_variants SET "skuCode" = NULLIF(btrim("skuCode"), '');
CREATE INDEX product_variants_sku_lower_migration_tmp ON public.product_variants (lower("skuCode"));

-- Keep the earliest variant in each case-insensitive duplicate group.
-- Probe all existing and already-renamed SKUs before assigning each DUP suffix.
DO $dedupe$
DECLARE
    variant_row RECORD;
    suffix_number BIGINT;
    candidate TEXT;
BEGIN
    FOR variant_row IN
        SELECT id, "productId", "skuCode", duplicate_number
        FROM (
            SELECT id, "productId", "skuCode", "createdAt",
                   row_number() OVER (
                       PARTITION BY lower("skuCode") ORDER BY "createdAt", id
                   ) AS duplicate_number
            FROM public.product_variants WHERE "skuCode" IS NOT NULL
        ) ranked
        WHERE duplicate_number > 1
        ORDER BY "createdAt", id
    LOOP
        suffix_number := variant_row.duplicate_number - 1;
        LOOP
            candidate := variant_row."skuCode" || '-DUP' || suffix_number::text;
            EXIT WHEN NOT EXISTS (
                SELECT 1 FROM public.product_variants WHERE lower("skuCode") = lower(candidate)
            );
            suffix_number := suffix_number + 1;
        END LOOP;
        UPDATE public.product_variants SET "skuCode" = candidate WHERE id = variant_row.id;
        INSERT INTO public.admin_audit_events
            (id, "actorId", action, "targetType", "targetId", summary, "createdAt")
        VALUES (
            gen_random_uuid()::text, 'system', 'VARIANT_SKU_DEDUPLICATED', 'variant', variant_row.id,
            jsonb_build_object('old', variant_row."skuCode", 'new', candidate, 'productId', variant_row."productId", 'reason', 'case_insensitive_duplicate'),
            clock_timestamp() AT TIME ZONE 'UTC'
        );
    END LOOP;
END
$dedupe$;

-- Start at each variant's position within its product, then skip globally occupied SKUs.
-- Padding is a minimum width: lpad must never truncate numbers above 99.
DO $sku$
DECLARE
    variant_row RECORD;
    suffix_number BIGINT;
    suffix_text TEXT;
    candidate TEXT;
BEGIN
    FOR variant_row IN
        SELECT ranked.id, ranked.variant_number, products."spuCode"
        FROM (
            SELECT id, "productId", "skuCode", "sortOrder", "createdAt",
                   row_number() OVER (
                       PARTITION BY "productId" ORDER BY "sortOrder", "createdAt", id
                   ) AS variant_number
            FROM public.product_variants
        ) ranked
        JOIN public.products ON products.id = ranked."productId"
        WHERE ranked."skuCode" IS NULL
        ORDER BY ranked."productId", ranked."sortOrder", ranked."createdAt", ranked.id
    LOOP
        suffix_number := variant_row.variant_number;
        LOOP
            suffix_text := suffix_number::text;
            candidate := variant_row."spuCode" || '-' || lpad(suffix_text, greatest(2, length(suffix_text)), '0');
            EXIT WHEN NOT EXISTS (
                SELECT 1 FROM public.product_variants WHERE lower("skuCode") = lower(candidate)
            );
            suffix_number := suffix_number + 1;
        END LOOP;
        UPDATE public.product_variants SET "skuCode" = candidate WHERE id = variant_row.id;
    END LOOP;
END
$sku$;

-- Require both codes only after every historical row has been populated.
ALTER TABLE public.products ALTER COLUMN "spuCode" SET NOT NULL;
ALTER TABLE public.product_variants ALTER COLUMN "skuCode" SET NOT NULL;

-- Separate global, case-insensitive namespaces; retain product_variants_skuCode_idx
-- for existing exact-value lookups and Prisma schema parity. No format CHECK is added.
DROP INDEX public.products_spu_lower_migration_tmp;
CREATE UNIQUE INDEX products_spuCode_lower_key ON public.products (lower("spuCode"));
DROP INDEX public.product_variants_sku_lower_migration_tmp;
CREATE UNIQUE INDEX product_variants_skuCode_lower_key ON public.product_variants (lower("skuCode"));
