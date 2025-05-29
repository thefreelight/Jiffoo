import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { HeroSection } from '@/components/sections/hero-section';
import { FeaturedProducts } from '@/components/sections/featured-products';
import { CategorySection } from '@/components/sections/category-section';
import { StatsSection } from '@/components/sections/stats-section';
import { NewsletterSection } from '@/components/sections/newsletter-section';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Chrome-like window frame */}
      <div className="chrome-window max-w-[1440px] mx-auto my-8">
        {/* Chrome header */}
        <div className="chrome-header">
          <div className="flex space-x-2">
            <div className="chrome-dot chrome-dot-red"></div>
            <div className="chrome-dot chrome-dot-yellow"></div>
            <div className="chrome-dot chrome-dot-green"></div>
          </div>
          <div className="flex-1 text-center">
            <span className="text-xs text-muted-foreground">Jiffoo Mall - Modern E-commerce</span>
          </div>
        </div>

        {/* Main content */}
        <div className="bg-background">
          <Header />

          <main className="flex-1">
            <HeroSection />
            <CategorySection />
            <FeaturedProducts />
            <StatsSection />
            <NewsletterSection />
          </main>

          <Footer />
        </div>
      </div>
    </div>
  );
}
