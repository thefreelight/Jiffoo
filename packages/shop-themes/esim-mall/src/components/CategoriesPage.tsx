/**
 * Categories Page — TravelPass Design
 * eSIM region cards (Asia, Europe, Americas, etc.) with FA icons.
 */

import React from 'react';
import { cn } from '../lib/utils';
import type { CategoriesPageProps } from '../types';

// Region icon and color mapping for eSIM categories
const regionStyle: Record<string, { icon: string; color: string; bg: string }> = {
  asia: { icon: 'fas fa-globe-asia', color: 'text-blue-600', bg: 'bg-blue-50' },
  europe: { icon: 'fas fa-globe-europe', color: 'text-green-600', bg: 'bg-green-50' },
  americas: { icon: 'fas fa-globe-americas', color: 'text-purple-600', bg: 'bg-purple-50' },
  africa: { icon: 'fas fa-globe-africa', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  oceania: { icon: 'fas fa-globe', color: 'text-cyan-600', bg: 'bg-cyan-50' },
  'middle east': { icon: 'fas fa-globe', color: 'text-red-600', bg: 'bg-red-50' },
  global: { icon: 'fas fa-globe', color: 'text-indigo-600', bg: 'bg-indigo-50' },
};

const getRegionStyle = (name: string) => {
  const lc = name.toLowerCase();
  for (const [key, val] of Object.entries(regionStyle)) {
    if (lc.includes(key)) return val;
  }
  return { icon: 'fas fa-sim-card', color: 'text-blue-600', bg: 'bg-blue-50' };
};

export const CategoriesPage = React.memo(function CategoriesPage({
  categories,
  isLoading,
  error,
  config,
  onCategoryClick,
  onNavigateToHome,
  t,
}: CategoriesPageProps) {
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  if (isLoading) return <div className="min-h-screen bg-gray-50" />;

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="text-center">
          <i className="fas fa-exclamation-triangle text-red-500 text-5xl mb-4" />
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Something went wrong</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-gray-100 py-2">
        <div className="container mx-auto px-4">
          <nav className="flex items-center gap-2 text-sm text-gray-600">
            <button onClick={onNavigateToHome} className="text-gray-500 hover:text-blue-600 transition-colors">Home</button>
            <span>/</span>
            <span className="text-gray-900 font-medium">Destinations</span>
          </nav>
        </div>
      </div>

      {/* Header */}
      <section className="bg-blue-600 pt-28 pb-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            <i className="fas fa-globe mr-3" />
            {getText('travelpass.categories.title', 'Browse by Destination')}
          </h1>
          <p className="mt-3 text-blue-100 text-lg max-w-2xl mx-auto">
            {getText('travelpass.categories.subtitle', 'Choose your travel region to find the perfect eSIM package')}
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4">
          {categories.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-lg shadow-sm">
              <i className="fas fa-globe text-gray-300 text-5xl mb-4" />
              <p className="text-gray-400 text-lg">No destinations available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map((category) => {
                const style = getRegionStyle(category.name);
                return (
                  <button
                    key={category.id}
                    onClick={() => onCategoryClick(category.id)}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:-translate-y-[3px] hover:shadow-md hover:border-blue-300 transition-all duration-200 text-left group"
                  >
                    {/* Image */}
                    {category.image && (
                      <div className="h-40 bg-gray-100 overflow-hidden">
                        <img
                          src={category.image}
                          alt={category.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      </div>
                    )}

                    <div className="p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', style.bg)}>
                          <i className={cn(style.icon, style.color)} />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800">{category.name}</h3>
                          <p className="text-sm text-gray-600">{category.productCount} packages</p>
                        </div>
                      </div>
                      {category.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">{category.description}</p>
                      )}
                      {category.featured && (
                        <span className="inline-block mt-3 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          <i className="fas fa-star mr-1" />Popular
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
});
