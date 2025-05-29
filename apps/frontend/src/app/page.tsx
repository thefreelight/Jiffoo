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
  );
}
