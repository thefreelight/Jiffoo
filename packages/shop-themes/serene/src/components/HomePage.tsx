/**
 * Home Page Component - "Serene" design
 *
 * Calm, editorial storefront landing page with a botanical vase hero,
 * trust indicators, icon-chip category cards, new-arrivals grid and a
 * deep-indigo community banner. Demo content uses local raster product imagery.
 */

import React from 'react';
import {
  ArrowRight,
  Check,
  Headphones,
  Heart,
  Home,
  Leaf,
  Package,
  Play,
  ShieldCheck,
  ShoppingBag,
  Star,
  Watch,
  Zap,
} from 'lucide-react';
import type { HomePageProps } from '../../../../shared/src/types/theme';

const AVATAR_TONES = ['bg-indigo-400', 'bg-blue-400', 'bg-violet-400', 'bg-sky-400', 'bg-indigo-500'];

interface ProductAsset {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  image: string;
}

interface ArrivalAsset {
  name: string;
  price: string;
  image: string;
}

function ProductImage({
  src,
  alt,
  className = '',
  imageClassName = 'object-contain',
}: {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
}) {
  return (
    <div className={`overflow-hidden ${className}`}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`h-full w-full ${imageClassName}`}
      />
    </div>
  );
}

function AvatarStack({ count = 4 }: { count?: number }) {
  return (
    <div className="flex -space-x-2.5" aria-hidden="true">
      {AVATAR_TONES.slice(0, count).map((tone, i) => (
        <span
          key={i}
          className={`w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 ${tone} flex items-center justify-center`}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-white/90" fill="currentColor">
            <circle cx="12" cy="8.5" r="3.5" />
            <path d="M4.5 20 C5.5 15.5 8.5 13.5 12 13.5 C15.5 13.5 18.5 15.5 19.5 20 Z" />
          </svg>
        </span>
      ))}
    </div>
  );
}

export const HomePage = React.memo(function HomePage({ config, onNavigate, t }: HomePageProps) {
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const [subscribed, setSubscribed] = React.useState(false);
  const [email, setEmail] = React.useState('');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail('');
    }
  };

  const categories: ProductAsset[] = [
    { name: getText('shop.home.categories.homeLiving', 'Home & Living'), icon: Home, image: '/theme-assets/default/category-home-living.webp' },
    { name: getText('shop.home.categories.bags', 'Bags & Accessories'), icon: ShoppingBag, image: '/theme-assets/default/category-bags.webp' },
    { name: getText('shop.home.categories.watches', 'Watches'), icon: Watch, image: '/theme-assets/default/category-watches.webp' },
    { name: getText('shop.home.categories.lifestyle', 'Lifestyle'), icon: Leaf, image: '/theme-assets/default/category-lifestyle.webp' },
  ];

  const arrivals: ArrivalAsset[] = [
    { name: getText('shop.home.products.candle', 'Scented Candle'), price: '$49.00', image: '/theme-assets/default/product-candle.webp' },
    { name: getText('shop.home.products.vase', 'Minimalist Vase'), price: '$65.00', image: '/theme-assets/default/product-vase.webp' },
    { name: getText('shop.home.products.cardholder', 'Leather Cardholder'), price: '$89.00', image: '/theme-assets/default/product-cardholder.webp' },
    { name: getText('shop.home.products.watch', 'Classic Blue Watch'), price: '$199.00', image: '/theme-assets/default/product-watch.webp' },
  ];

  const features = [
    {
      icon: Zap,
      title: getText('shop.home.featuresSerene.shipping.title', 'Fast Shipping'),
      subtitle: getText('shop.home.featuresSerene.shipping.subtitle', '1-3 business days'),
    },
    {
      icon: ShieldCheck,
      title: getText('shop.home.features.secure.title', 'Secure Payment'),
      subtitle: getText('shop.home.features.secure.subtitle', '100% secure checkout'),
    },
    {
      icon: Package,
      title: getText('shop.home.features.quality.title', 'Premium Quality'),
      subtitle: getText('shop.home.features.quality.subtitle', 'Carefully selected'),
    },
    {
      icon: Headphones,
      title: getText('shop.home.features.support.title', '24/7 Support'),
      subtitle: getText('shop.home.features.support.subtitle', "We're here to help"),
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* ================= Hero ================= */}
      <section className="relative overflow-hidden">
        {/* soft backdrop blob */}
        <div
          className="absolute top-0 right-0 w-[55%] h-[110%] bg-gradient-to-bl from-indigo-100 via-blue-50 to-transparent dark:from-indigo-950 dark:via-slate-900 dark:to-transparent rounded-bl-[45%]"
          aria-hidden="true"
        />
        <div className="absolute bottom-10 right-6 w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 opacity-70 blur-[1px] hidden lg:block" aria-hidden="true" />

        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 items-center gap-12 pt-28 pb-14 sm:pt-36 sm:pb-20 min-h-[560px]">
            {/* Copy */}
            <div className="relative z-10 space-y-6 sm:space-y-7">
              <button
                onClick={() => onNavigate?.('/products')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors"
              >
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                  {getText('shop.home.heroSerene.badge', 'New arrivals are here')}
                </span>
                <ArrowRight className="w-3 h-3 text-indigo-500" />
              </button>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white tracking-tight leading-[1.08]">
                {getText('shop.home.hero.title', 'Quality Products,')}
                <br />
                {getText('shop.home.hero.titleLine2', 'Delivered')}{' '}
                <span className="text-indigo-500">{getText('shop.home.hero.titleAccent', 'Fast')}</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                {getText('shop.home.heroSerene.subtitle', 'Carefully curated products for modern living. Premium quality you can trust.')}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <button
                  onClick={() => onNavigate?.('/products')}
                  className="inline-flex items-center gap-2.5 h-12 sm:h-13 px-7 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-full font-semibold text-sm transition-colors shadow-lg shadow-slate-900/10"
                >
                  {getText('shop.home.heroSerene.explore', 'Explore Products')}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onNavigate?.('/products')}
                  className="inline-flex items-center gap-3 h-12 px-2 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <span className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-100 dark:border-slate-700 flex items-center justify-center">
                    <Play className="w-4 h-4 ml-0.5 fill-current" />
                  </span>
                  {getText('shop.home.heroSerene.watchVideo', 'Watch Video')}
                </button>
              </div>

              {/* Trust row */}
              <div className="flex items-center gap-4 pt-3">
                <AvatarStack count={5} />
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {getText('shop.home.heroSerene.trustedBy', 'Trusted by 10,000+ customers')}
                  </p>
                  <div className="flex gap-0.5 mt-1" aria-label="5 star rating">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 text-indigo-500 fill-current" />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Hero visual */}
            <div className="relative hidden lg:block h-[500px]" aria-hidden="true">
              <ProductImage
                src="/theme-assets/default/hero-vase.webp"
                alt=""
                className="absolute inset-x-0 top-0 mx-auto h-full"
                imageClassName="object-contain"
              />
              {/* floating delivery card */}
              <div className="absolute top-24 -right-2 xl:right-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur rounded-2xl shadow-xl shadow-indigo-900/10 border border-slate-100 dark:border-slate-700 px-5 py-4 w-52">
                <div className="flex items-start justify-between">
                  <span className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center">
                    <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1" />
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-3">
                  {getText('shop.home.heroSerene.fastDelivery', 'Fast Delivery')}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {getText('shop.home.heroSerene.deliveryTime', '1-3 business days')}
                </p>
                <svg viewBox="0 0 180 24" className="mt-3 w-full h-5 text-indigo-200 dark:text-indigo-800" fill="none">
                  <path d="M2 18 C30 18 40 6 70 6 C100 6 110 20 140 14 C160 10 170 8 178 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Feature strip */}
        <div className="border-y border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur relative z-10">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-100 dark:divide-slate-800 [&>div]:px-5 [&>div]:sm:px-8 [&>div]:py-6 [&>div]:sm:py-8">
              {features.map(({ icon: Icon, title, subtitle }) => (
                <div key={title} className="flex items-center gap-4">
                  <span className="w-11 h-11 shrink-0 rounded-full border border-indigo-100 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-900/30 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= Shop by Category ================= */}
      <section className="pt-16 sm:pt-20 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <div className="flex items-end justify-between mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {getText('shop.home.categories.title', 'Shop by Category')}
            </h2>
            <button
              onClick={() => onNavigate?.('/categories')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              {getText('shop.home.viewAll', 'View all')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {categories.map(({ name, icon: Icon, image }) => (
              <button
                key={name}
                onClick={() => onNavigate?.('/products')}
                className="group relative rounded-2xl overflow-hidden bg-gradient-to-b from-indigo-50/60 to-white dark:from-slate-800 dark:to-slate-900 border border-slate-100 dark:border-slate-800 hover:shadow-xl hover:shadow-indigo-900/5 hover:-translate-y-1 transition-all text-left"
              >
                <span className="absolute top-4 left-4 z-10 w-9 h-9 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                </span>
                <ProductImage
                  src={image}
                  alt={name}
                  className="aspect-[4/5] bg-indigo-50/60 dark:bg-slate-900"
                  imageClassName="object-cover"
                />
                <div className="px-5 pb-5 -mt-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{name}</p>
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:gap-2.5 transition-all">
                    {getText('shop.home.categories.explore', 'Explore')}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ================= New Arrivals ================= */}
      <section className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <div className="flex items-end justify-between mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {getText('shop.home.newArrivals.title', 'New Arrivals')}
            </h2>
            <button
              onClick={() => onNavigate?.('/products')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              {getText('shop.home.viewAll', 'View all')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {arrivals.map(({ name, price, image }) => (
              <div
                key={name}
                className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 hover:shadow-xl hover:shadow-indigo-900/5 hover:-translate-y-1 transition-all overflow-hidden"
              >
                <div
                  className="relative aspect-square bg-gradient-to-b from-indigo-50/50 to-white dark:from-slate-800 dark:to-slate-900 cursor-pointer"
                  onClick={() => onNavigate?.('/products')}
                >
                  <span className="absolute top-4 left-4 px-2.5 py-1 bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                    {getText('shop.home.newArrivals.badge', 'New')}
                  </span>
                  <button
                    aria-label={`Add ${name} to wishlist`}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur shadow-sm flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <Heart className="w-4 h-4" />
                  </button>
                  <ProductImage
                    src={image}
                    alt={name}
                    className="h-full w-full p-5"
                    imageClassName="object-contain"
                  />
                </div>
                <div className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{price}</p>
                  </div>
                  <button
                    onClick={() => onNavigate?.('/products')}
                    aria-label={`View ${name}`}
                    className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:bg-indigo-600 group-hover:border-indigo-600 group-hover:text-white transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center items-center gap-1.5 mt-9" aria-hidden="true">
            <span className="w-6 h-2 rounded-full bg-indigo-600" />
            <span className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700" />
            <span className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
      </section>

      {/* ================= Community banner ================= */}
      <section className="py-10 sm:py-14 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-950 via-indigo-800 to-blue-700 px-8 py-12 sm:px-12 sm:py-16">
            {/* decorative waves + glass J */}
            <svg viewBox="0 0 400 200" className="absolute right-0 top-0 h-full w-1/2 text-white/10 hidden md:block" fill="none" aria-hidden="true">
              <path d="M20 200 C120 140 180 60 400 40" stroke="currentColor" strokeWidth="30" strokeLinecap="round" />
              <path d="M80 220 C180 160 240 80 420 70" stroke="currentColor" strokeWidth="18" strokeLinecap="round" opacity="0.7" />
            </svg>
            <span
              className="absolute -bottom-10 right-8 text-[180px] leading-none font-black text-white/15 select-none hidden md:block"
              style={{ textShadow: '0 8px 32px rgba(255,255,255,0.15)' }}
              aria-hidden="true"
            >
              J
            </span>

            <div className="relative z-10 grid lg:grid-cols-2 items-center gap-8">
              <div>
                <h3 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
                  {getText('shop.home.newsletter.sereneTitle', 'Join the Jiffoo Community')}
                </h3>
                <p className="text-sm text-indigo-100/80 mt-3 leading-relaxed max-w-sm">
                  {getText('shop.home.newsletter.sereneSubtitle', 'Be the first to know about new arrivals and exclusive offers.')}
                </p>
              </div>
              <div className="max-w-md">
                <form
                  onSubmit={handleSubscribe}
                  className="flex items-center gap-0 bg-white rounded-full p-1.5 pl-5 shadow-lg"
                >
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={getText('shop.home.newsletter.placeholder', 'Enter your email')}
                    className="flex-1 border-0 p-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-0 min-w-0"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 h-10 px-5 shrink-0 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
                  >
                    {subscribed ? (
                      <>
                        {getText('shop.home.newsletter.subscribed', 'Subscribed')}
                        <Check className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        {getText('shop.home.newsletter.subscribe', 'Subscribe')}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
                <div className="flex items-center gap-3 mt-4">
                  <AvatarStack count={4} />
                  <p className="text-xs font-semibold text-indigo-100/90">
                    {getText('shop.home.newsletter.subscribers', '10k+ subscribers')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
});
