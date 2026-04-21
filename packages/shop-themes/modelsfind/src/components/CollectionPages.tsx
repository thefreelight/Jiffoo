import React from 'react';
import { ArrowRight, Heart, Sparkles, WandSparkles } from 'lucide-react';
import type {
  BestsellersPageProps,
  DealsPageProps,
  NewArrivalsPageProps,
  SearchPageProps,
  ThemeConfig,
} from 'shared/src/types/theme';
import type { Product, ProductImage } from 'shared/src/types/product';
import { conciergePrompts, previewPortraits, resolveModelsfindSiteConfig } from '../site';

function getProductImage(product: Product): string {
  const mainImage = product.images?.find((image) => image.isMain) || product.images?.[0];
  return (mainImage as ProductImage | undefined)?.url || previewPortraits[0].image;
}

function getProductSubtitle(product: Product): string {
  return product.tags?.slice(0, 2).join(' • ') || 'Editorial profile';
}

function ArchiveCollection({
  products,
  isLoading,
  title,
  description,
  eyebrow,
  config,
  onProductClick,
}: {
  products: Product[];
  isLoading: boolean;
  title: string;
  description: string;
  eyebrow: string;
  config?: ThemeConfig;
  onProductClick: (productId: string) => void;
}) {
  const site = resolveModelsfindSiteConfig(config);

  if (isLoading) {
    return <div className="modelsfind-shell min-h-screen" />;
  }

  return (
    <div className="modelsfind-shell min-h-screen px-4 pb-32 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 sm:pt-24 lg:px-8">
      <div className="mx-auto max-w-[1560px] xl:flex">
        <aside className="modelsfind-frame hidden w-[16rem] shrink-0 rounded-l-[2rem] rounded-r-none border-r border-[var(--modelsfind-line)] xl:flex xl:min-h-[calc(100vh-8rem)] xl:flex-col xl:px-8 xl:py-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]">Collection lane</p>
            <h2 className="mt-2 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-[var(--modelsfind-primary)]">
              {eyebrow}
            </h2>
          </div>

          <div className="modelsfind-panel mt-8 rounded-[1.4rem] border border-[var(--modelsfind-line)] p-5">
            <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">Profiles in lane</p>
            <p className="mt-3 [font-family:var(--modelsfind-display)] text-[3rem] leading-none tracking-[-0.05em] text-white">
              {products.length}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--modelsfind-copy)]">
              This lane stays visually aligned with the main directory, but narrows the story to one editorial angle.
            </p>
          </div>

          <div className="modelsfind-panel mt-auto rounded-[1.4rem] border border-[var(--modelsfind-line)] p-5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]">
              <WandSparkles className="h-4 w-4" />
            </div>
            <p className="mt-4 text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]">Lane note</p>
            <p className="mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]">
              These secondary pages should still feel like part of the same mobile-and-desktop system, not a detached archive microsite.
            </p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] xl:rounded-l-none xl:border-l-0">
            <div className="p-4 md:p-6 xl:p-8">
              <section className="modelsfind-hero overflow-hidden rounded-[1.8rem] border border-[var(--modelsfind-line)]">
                <img
                  src={products[0] ? getProductImage(products[0]) : previewPortraits[0].image}
                  alt={title}
                  className="absolute inset-0 h-full w-full object-cover grayscale opacity-40"
                />
                <div className="relative z-10 grid min-h-[24rem] gap-6 px-6 pb-8 pt-10 md:px-10 md:pb-10 md:pt-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
                  <div className="max-w-[40rem]">
                    <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--modelsfind-primary)]">{eyebrow}</p>
                    <h1 className="mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.8rem,6vw,5rem)] leading-[0.92] tracking-[-0.05em] text-white">
                      {title}
                    </h1>
                    <p className="mt-4 max-w-[34rem] text-sm leading-7 text-[var(--modelsfind-copy)]">{description}</p>
                  </div>

                  <div className="modelsfind-panel rounded-[1.5rem] border border-[var(--modelsfind-line)] p-5">
                    <p className="text-[9px] uppercase tracking-[0.2em] text-[var(--modelsfind-copy-soft)]">Brand voice</p>
                    <p className="mt-2 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white">
                      {site.brandName}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[var(--modelsfind-copy)]">
                      Editorial search, private access, and quiet luxury remain intact even when the page narrows to a single lane.
                    </p>
                  </div>
                </div>
              </section>

              {products.length === 0 ? (
                <div className="mt-6 rounded-[1.8rem] border border-dashed border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-6 py-16 text-center">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">This lane is empty</p>
                  <h2 className="mt-4 [font-family:var(--modelsfind-display)] text-[2.6rem] leading-none tracking-[-0.04em] text-white">
                    Nothing is staged here yet.
                  </h2>
                  <p className="mx-auto mt-4 max-w-[28rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
                    Keep the empty state editorial and restrained rather than dropping back to a generic placeholder.
                  </p>
                </div>
              ) : (
                <section className="mt-8">
                  <div className="flex flex-col gap-4 border-b border-[var(--modelsfind-line)] pb-6 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">Profiles</p>
                      <h2 className="[font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white">
                        Styled like a focused shortlist
                      </h2>
                    </div>
                    <div className="hidden items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)] md:flex">
                      <Sparkles className="h-4 w-4 text-[var(--modelsfind-primary)]" />
                      Mobile and desktop aligned
                    </div>
                  </div>

                  <div className="mt-6 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                    {products.map((product, index) => (
                      <article
                        key={product.id}
                        className={[
                          'group overflow-hidden rounded-[1.5rem] border border-[var(--modelsfind-line)] bg-[rgba(20,16,24,0.92)] transition-transform duration-500 hover:-translate-y-1',
                          index % 2 === 1 ? 'md:translate-y-6' : '',
                        ].join(' ')}
                      >
                        <button type="button" onClick={() => onProductClick(product.id)} className="block w-full text-left">
                          <div className="relative aspect-[0.78] overflow-hidden">
                            <img
                              src={getProductImage(product)}
                              alt={product.name}
                              className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-[1.04] group-hover:grayscale-0"
                            />
                            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,7,10,0.08),rgba(8,7,10,0.84))]" />
                            <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-3">
                              <span className="rounded-full border border-[var(--modelsfind-line-strong)] bg-[rgba(15,12,18,0.7)] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-primary)]">
                                {eyebrow}
                              </span>
                              <Heart className="h-4 w-4 text-[var(--modelsfind-primary)] opacity-70 transition-opacity group-hover:opacity-100" />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-4">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
                                {getProductSubtitle(product)}
                              </p>
                              <h3 className="mt-2 [font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white">
                                {product.name}
                              </h3>
                            </div>
                          </div>
                        </button>

                        <div className="p-4">
                          <p className="text-sm leading-7 text-[var(--modelsfind-copy)]">
                            {product.description || 'Curated profile presented for a tighter archive lane with the same cinematic browse language.'}
                          </p>
                          <button
                            type="button"
                            onClick={() => onProductClick(product.id)}
                            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--modelsfind-ink)] transition-colors hover:border-[var(--modelsfind-primary)] hover:bg-[var(--modelsfind-primary)] hover:text-[#140d16]"
                          >
                            View profile
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              <section className="mt-8 rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-5">
                <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]">
                  <WandSparkles className="h-4 w-4" />
                  Concierge follow-ups
                </div>
                <p className="mt-3 max-w-[38rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
                  Quick prompts borrowed from the AI concierge mobile draft. These can become future shortcuts on curated collection pages too.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {conciergePrompts.map((prompt) => (
                    <div
                      key={prompt}
                      className="rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-[var(--modelsfind-copy)]"
                    >
                      {prompt}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
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
      config={props.config}
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
      config={props.config}
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
      config={props.config}
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
      config={props.config}
      onProductClick={props.onProductClick}
    />
  );
});
