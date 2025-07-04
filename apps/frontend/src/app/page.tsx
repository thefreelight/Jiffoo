import { HeroSection } from '@/components/sections/hero-section';
import { FeaturedProducts } from '@/components/sections/featured-products';
import { CategorySection } from '@/components/sections/category-section';
import { StatsSection } from '@/components/sections/stats-section';
import { NewsletterSection } from '@/components/sections/newsletter-section';
import { TranslationTest } from '@/components/translation-test';

export default function HomePage() {
  return (
    <>
      <div className="container mx-auto px-4 py-4">
        <TranslationTest />
      </div>
      <HeroSection />
      <CategorySection />
      <FeaturedProducts />
      <StatsSection />
      <NewsletterSection />
    </>
  );
}
