import React from 'react';
import { ArrowRight, Heart } from 'lucide-react';
import type {
  BestsellersPageProps,
  DealsPageProps,
  NewArrivalsPageProps,
  SearchPageProps,
} from 'shared/src/types/theme';
import type { Product, ProductImage } from 'shared/src/types/product';

function getProductImage(product: Product): string {
  const mainImage = product.images?.find((image) => image.isMain) || product.images?.[0];
  return (mainImage as ProductImage | undefined)?.url || '/placeholder-product.svg';
}

function ArchiveCollection({
  products,
  isLoading,
  title,
  description,
  eyebrow,
  onProductClick,
}: {
  products: Product[];
  isLoading: boolean;
  title: string;
  description: string;
  eyebrow: string;
  onProductClick: (productId: string) => void;
}) {
  if (isLoading) {
    return <div className="modelsfind-shell min-h-screen" />;
  }

  return (
    <div className="modelsfind-shell min-h-screen px-4 pb-24 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 sm:pt-24 lg:px-8">
      <div className="mx-auto max-w-[1040px]">
        <div className="modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] bg-[rgba(10,8,12,0.96)]">
          <section className="border-b border-[var(--modelsfind-line)] px-5 py-6">
            <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">{eyebrow}</p>
            <h1 className="mt-3 [font-family:var(--modelsfind-display)] text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.92] tracking-[-0.05em] text-[var(--modelsfind-ink)]">
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--modelsfind-copy)]">{description}</p>
          </section>

          <section className="px-5 py-5">
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
              {products.map((product) => (
                <article
                  key={product.id}
                  className="group overflow-hidden rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(19,15,22,0.92)]"
                >
                  <button type="button" onClick={() => onProductClick(product.id)} className="block w-full text-left">
                    <div className="relative aspect-[0.78] overflow-hidden">
                      <img
                        src={getProductImage(product)}
                        alt={product.name}
                        className="h-full w-full object-cover grayscale transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,8,12,0.04),rgba(10,8,12,0.76))]" />
                    </div>
                  </button>

                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="[font-family:var(--modelsfind-display)] text-[1.25rem] leading-none tracking-[-0.04em] text-[var(--modelsfind-ink)]">
                          {product.name}
                        </h2>
                        <p className="mt-1 text-[11px] text-[var(--modelsfind-copy-soft)]">
                          {product.tags?.slice(0, 2).join(' • ') || product.description}
                        </p>
                      </div>
                      <Heart className="mt-0.5 h-3.5 w-3.5 text-[var(--modelsfind-primary)]" />
                    </div>

                    <button
                      type="button"
                      onClick={() => onProductClick(product.id)}
                      className="mt-3 inline-flex min-h-8 w-full items-center justify-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.02)] px-3 text-[9px] font-semibold uppercase tracking-[0.24em] text-[var(--modelsfind-copy)] transition-colors hover:border-[var(--modelsfind-primary)] hover:text-[var(--modelsfind-ink)]"
                    >
                      View profile
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export const BestsellersPage = React.memo(function BestsellersPage(props: BestsellersPageProps) {
  return (
    <ArchiveCollection
      products={props.products}
      isLoading={props.isLoading}
      title="Most-saved portrait profiles in the current private archive."
      description="This lane surfaces the editorial sets operators shortlist most often when curating featured boards."
      eyebrow="Editor picks"
      onProductClick={props.onProductClick}
    />
  );
});

export const NewArrivalsPage = React.memo(function NewArrivalsPage(props: NewArrivalsPageProps) {
  return (
    <ArchiveCollection
      products={props.products}
      isLoading={props.isLoading}
      title="Fresh arrivals added to the archive this cycle."
      description="Use new arrivals to review recently added portrait sets before they are grouped into broader curated boards."
      eyebrow="New arrivals"
      onProductClick={props.onProductClick}
    />
  );
});

export const DealsPage = React.memo(function DealsPage(props: DealsPageProps) {
  return (
    <ArchiveCollection
      products={props.products}
      isLoading={props.isLoading}
      title="Private bundles, highlighted boards, and limited-access offers."
      description="Use this view when the archive needs a promotional lane without breaking the darker editorial mood."
      eyebrow="Featured offers"
      onProductClick={props.onProductClick}
    />
  );
});

export const SearchPage = React.memo(function SearchPage(props: SearchPageProps) {
  return (
    <ArchiveCollection
      products={props.products}
      isLoading={props.isLoading}
      title={`Results for “${props.searchQuery || 'archive search'}”`}
      description="Search stays framed like an editorial directory so operators can narrow results without losing category context."
      eyebrow="Search"
      onProductClick={props.onProductClick}
    />
  );
});
