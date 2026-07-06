/**
 * Home Page Component - "Aurora" glass design
 *
 * Airy light-blue storefront landing page with a glassmorphism hero,
 * feature strip, category grid, new-arrivals carousel, lifestyle banner
 * and newsletter section. Demo content uses local raster product imagery.
 */

import React from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Check,
  Compass,
  Headphones,
  Heart,
  Mail,
  Play,
  RotateCcw,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import type { HomePageProps } from '../../../../shared/src/types/theme';

interface ProductAsset {
  name: string;
  image: string;
}

interface ArrivalAsset extends ProductAsset {
  price: string;
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

export const StorefrontHomePage = React.memo(function StorefrontHomePage({ config, onNavigate, t }: HomePageProps) {
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const arrivalsRef = React.useRef<HTMLDivElement>(null);
  const [subscribed, setSubscribed] = React.useState(false);
  const [email, setEmail] = React.useState('');

  const scrollArrivals = (direction: -1 | 1) => {
    arrivalsRef.current?.scrollBy({ left: direction * 300, behavior: 'smooth' });
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail('');
    }
  };

  const categories: ProductAsset[] = [
    {
      name: getText('shop.home.categories.homeLiving', 'Home & Living'),
      image: '/theme-assets/default/category-home-living.webp',
    },
    {
      name: getText('shop.home.categories.bags', 'Bags & Accessories'),
      image: '/theme-assets/default/category-bags.webp',
    },
    {
      name: getText('shop.home.categories.watches', 'Watches'),
      image: '/theme-assets/default/category-watches.webp',
    },
    {
      name: getText('shop.home.categories.lifestyle', 'Lifestyle'),
      image: '/theme-assets/default/category-lifestyle.webp',
    },
  ];

  const arrivals: ArrivalAsset[] = [
    { name: getText('shop.home.products.candle', 'Scented Candle'), price: '$49.00', image: '/theme-assets/default/product-candle.webp' },
    { name: getText('shop.home.products.vase', 'Minimalist Vase'), price: '$65.00', image: '/theme-assets/default/product-vase.webp' },
    { name: getText('shop.home.products.cardholder', 'Leather Cardholder'), price: '$89.00', image: '/theme-assets/default/product-cardholder.webp' },
    { name: getText('shop.home.products.watch', 'Classic Blue Watch'), price: '$199.00', image: '/theme-assets/default/product-watch.webp' },
  ];

  const features = [
    {
      icon: Truck,
      title: getText('shop.home.features.shipping.title', 'Free Shipping'),
      subtitle: getText('shop.home.features.shipping.subtitle', 'On orders over $100'),
    },
    {
      icon: ShieldCheck,
      title: getText('shop.home.features.secure.title', 'Secure Payment'),
      subtitle: getText('shop.home.features.secure.subtitle', '100% secure checkout'),
    },
    {
      icon: RotateCcw,
      title: getText('shop.home.features.returns.title', 'Easy Returns'),
      subtitle: getText('shop.home.features.returns.subtitle', '30-day return policy'),
    },
    {
      icon: Headphones,
      title: getText('shop.home.features.support.title', '24/7 Support'),
      subtitle: getText('shop.home.features.support.subtitle', "We're here to help"),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* ================= Hero ================= */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 items-center gap-12 pt-28 pb-16 sm:pt-36 sm:pb-24 min-h-[560px]">
            {/* Copy */}
            <div className="relative z-10 space-y-6 sm:space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-full shadow-sm">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                  {getText('shop.home.hero.badge', 'Welcome to Jiffoo')}
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-slate-900 dark:text-white tracking-tight leading-[1.05]">
                {getText('shop.home.hero.title', 'Quality Products,')}
                <br />
                {getText('shop.home.hero.titleLine2', 'Delivered')}{' '}
                <span className="relative inline-block text-blue-500">
                  {getText('shop.home.hero.titleAccent', 'Fast')}
                  <svg viewBox="0 0 120 16" className="absolute left-0 -bottom-2 w-full h-3 text-blue-500" fill="none" aria-hidden="true">
                    <path d="M4 10 C40 2 80 2 116 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    <path d="M14 14 C44 8 74 8 104 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                  </svg>
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                {getText('shop.home.hero.subtitle', 'Carefully curated products that elevate your everyday life.')}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={() => onNavigate?.('/products')}
                  className="inline-flex items-center gap-2.5 h-12 sm:h-14 px-7 sm:px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold text-sm transition-all shadow-lg shadow-blue-500/25"
                >
                  {getText('shop.home.hero.shopNow', 'Shop Now')}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onNavigate?.('/categories')}
                  className="inline-flex items-center gap-2.5 h-12 sm:h-14 px-5 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {getText('shop.home.hero.explore', 'Explore')}
                  <span className="w-9 h-9 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center">
                    <Compass className="w-4 h-4" />
                  </span>
                </button>
              </div>
            </div>

            {/* Product image composition */}
            <div className="relative hidden lg:block h-[480px]" aria-hidden="true">
              <ProductImage
                src="/theme-assets/default/hero-glass.webp"
                alt=""
                className="absolute inset-0"
                imageClassName="object-contain object-center"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ================= Feature strip (overlaps hero bottom edge) ================= */}
      <section className="relative z-10 -mt-14 sm:-mt-16 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-2xl sm:rounded-3xl shadow-xl shadow-blue-900/5 border border-white/60 dark:border-slate-700/60 px-6 py-6 sm:px-10 sm:py-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ icon: Icon, title, subtitle }) => (
              <div key={title} className="flex items-center gap-4">
                <span className="w-11 h-11 shrink-0 rounded-full bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= Shop by Category ================= */}
      <section className="pt-16 sm:pt-20 pb-8 sm:pb-12 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <div className="flex items-end justify-between mb-8 sm:mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {getText('shop.home.categories.title', 'Shop by Category')}
            </h2>
            <button
              onClick={() => onNavigate?.('/categories')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:gap-3 transition-all"
            >
              {getText('shop.home.viewAll', 'View all')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {categories.map(({ name, image }) => (
              <button
                key={name}
                onClick={() => onNavigate?.('/products')}
                className="group relative rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-b from-blue-50 to-white dark:from-slate-800 dark:to-slate-900 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all text-left"
              >
                <ProductImage
                  src={image}
                  alt={name}
                  className="aspect-[4/5] bg-blue-50/60 dark:bg-slate-900"
                  imageClassName="object-cover"
                />
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between bg-white/85 dark:bg-slate-900/85 backdrop-blur rounded-xl px-4 py-3 shadow-sm">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{name}</span>
                  <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-600 group-hover:text-white text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* dots */}
          <div className="flex justify-center gap-1.5 mt-8" aria-hidden="true">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
          </div>
        </div>
      </section>

      {/* ================= New Arrivals ================= */}
      <section className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl relative">
          <div className="flex items-end justify-between mb-8 sm:mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {getText('shop.home.newArrivals.title', 'New Arrivals')}
            </h2>
            <button
              onClick={() => onNavigate?.('/products')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:gap-3 transition-all"
            >
              {getText('shop.home.viewAll', 'View all')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* carousel arrows */}
          <button
            onClick={() => scrollArrivals(-1)}
            aria-label="Previous products"
            className="hidden sm:flex lg:hidden absolute -left-3 top-1/2 z-10 w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-100 dark:border-slate-700 items-center justify-center text-slate-600 dark:text-slate-300 hover:text-blue-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scrollArrivals(1)}
            aria-label="Next products"
            className="hidden sm:flex lg:hidden absolute -right-3 top-1/2 z-10 w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-100 dark:border-slate-700 items-center justify-center text-slate-600 dark:text-slate-300 hover:text-blue-600"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div
            ref={arrivalsRef}
            className="flex lg:grid lg:grid-cols-4 gap-5 sm:gap-6 overflow-x-auto lg:overflow-visible snap-x pb-2 lg:pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {arrivals.map(({ name, price, image }) => (
              <div
                key={name}
                className="group min-w-[240px] lg:min-w-0 snap-start bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all overflow-hidden"
              >
                <div className="relative aspect-square bg-gradient-to-b from-blue-50/80 to-white dark:from-slate-800 dark:to-slate-900 cursor-pointer" onClick={() => onNavigate?.('/products')}>
                  <span className="absolute top-4 left-4 px-2.5 py-1 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                    {getText('shop.home.newArrivals.badge', 'New')}
                  </span>
                  <button
                    aria-label={`Add ${name} to wishlist`}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors"
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
                <div className="px-5 py-4">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{price}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-1.5 mt-8" aria-hidden="true">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
          </div>
        </div>
      </section>

      {/* ================= Lifestyle banner ================= */}
      <section className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-100 via-blue-50 to-blue-200 dark:from-blue-950 dark:via-slate-900 dark:to-blue-900 px-8 py-12 sm:px-12 sm:py-16">
            <img
              src="/theme-assets/default/lifestyle-banner.webp"
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-y-0 right-0 hidden h-full w-[58%] object-cover object-right opacity-80 md:block"
            />
            <div className="absolute inset-y-0 left-0 hidden w-[48%] bg-gradient-to-r from-blue-100 via-blue-100/95 to-blue-100/10 dark:from-blue-950 dark:via-blue-950/95 dark:to-blue-950/10 md:block" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-8">
              <div className="max-w-xs sm:max-w-sm">
                <h3 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                  {getText('shop.home.banner.title', 'Designed for modern living')}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-4 leading-relaxed">
                  {getText('shop.home.banner.subtitle', 'Thoughtful details. Premium quality. Timeless design.')}
                </p>
              </div>
              <button
                onClick={() => onNavigate?.('/products')}
                aria-label={getText('shop.home.banner.watch', 'Watch video')}
                className="w-14 h-14 shrink-0 rounded-full bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center text-blue-600 dark:text-blue-400 hover:scale-105 transition-transform"
              >
                <Play className="w-5 h-5 ml-0.5 fill-current" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ================= Newsletter ================= */}
      <section className="py-8 sm:py-12 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm px-8 py-10 sm:px-12 flex flex-col lg:flex-row items-start lg:items-center gap-8">
            <div className="flex items-start gap-5 flex-1">
              <span className="w-12 h-12 shrink-0 rounded-2xl bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </span>
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {getText('shop.home.newsletter.title', 'Join the Jiffoo community')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
                  {getText('shop.home.newsletter.subtitle', 'Get exclusive offers and early access to new arrivals.')}
                </p>
              </div>
            </div>
            <form onSubmit={handleSubscribe} className="w-full lg:w-auto flex items-center gap-0 bg-slate-50 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 p-1.5 pl-5 focus-within:border-blue-400 transition-colors">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={getText('shop.home.newsletter.placeholder', 'Enter your email')}
                className="flex-1 lg:w-64 border-0 p-0 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-0"
              />
              <button
                type="submit"
                aria-label={getText('shop.home.newsletter.subscribe', 'Subscribe')}
                className="w-10 h-10 shrink-0 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors"
              >
                {subscribed ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
});
