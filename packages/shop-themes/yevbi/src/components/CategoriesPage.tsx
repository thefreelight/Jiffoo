/**
 * Categories Page Component
 * Hardcore digital network infrastructure style
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Server, Loader2, Database, Network } from 'lucide-react';
import type { CategoriesPageProps } from '../types';
import { Button } from '../ui/Button';
import { Breadcrumb, BreadcrumbItem } from '../ui/Breadcrumb';

export const CategoriesPage = React.memo(function CategoriesPage({
  categories,
  isLoading,
  error,
  config,
  onCategoryClick,
  onNavigateToHome,
}: CategoriesPageProps) {
  // Breadcrumb items
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'INDEX', onClick: onNavigateToHome },
    { label: 'CLASSIFICATION_NODES' },
  ];
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-[#bdbdbd] font-mono flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[#eaeaea]" />
          <p className="text-[10px] text-[#bdbdbd] uppercase tracking-widest">Fetching Category Trees...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center font-mono">
        <div className="text-center border border-[#2a2a2a] p-8 bg-[#1c1c1c]">
          <p className="text-[10px] font-bold text-[#bdbdbd] mb-4 uppercase tracking-widest">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline" className="border-[#2a2a2a] text-[#bdbdbd] hover:bg-[#1c1c1c] hover:text-[var(--c-000)] rounded-none text-[10px] uppercase tracking-widest">
            RETRY_CONNECTION
          </Button>
        </div>
      </div>
    );
  }

  const featuredCategories = categories.filter(cat => cat.featured);
  const regularCategories = categories.filter(cat => !cat.featured);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#bdbdbd] font-mono pt-[72px] relative overflow-hidden">
      <div className="network-grid-bg absolute inset-0 opacity-[0.03]"></div>

      {/* Breadcrumb */}
      <div className="container mx-auto px-4 pt-6 relative z-10">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* Header */}
      <section className="py-12 border-b border-[#2a2a2a] relative z-10">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 bg-[#1c1c1c] border border-[#2a2a2a] text-[#eaeaea] px-3 py-1 text-[10px] font-bold mb-4 uppercase tracking-widest">
              <Database className="h-3 w-3 text-[#bdbdbd]" />
              <span>SCHEMA_INDEX</span>
            </div>
            <h1 className="text-3xl lg:text-5xl font-bold mb-4 text-[#eaeaea] tracking-tighter uppercase">NETWORK_TOPOLOGY</h1>
            <p className="text-xs text-[#bdbdbd] max-w-2xl mx-auto uppercase tracking-widest">
              Browse available infrastructural classifications and subsystem domains.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Featured Categories */}
      {featuredCategories.length > 0 && (
        <section className="py-16 relative z-10">
          <div className="container mx-auto px-4 max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-8 border-b border-[#2a2a2a] pb-4 flex items-center gap-3"
            >
              <Network className="w-5 h-5 text-[#bdbdbd]" />
              <h2 className="text-sm font-bold text-[#eaeaea] uppercase tracking-widest">PRIMARY_CLUSTERS</h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredCategories.map((category, index) => (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <button
                    onClick={() => onCategoryClick(category.id)}
                    className="group block w-full text-left h-full"
                  >
                    <div className="relative bg-[#141414] border border-[#2a2a2a] group-hover:border-[var(--c-eae)] transition-colors duration-300 h-full flex flex-col">
                      <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-[var(--c-eae)] opacity-0 group-hover:opacity-100 transition-opacity -mt-px -mr-px z-20"></div>
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-[var(--c-eae)] opacity-0 group-hover:opacity-100 transition-opacity -mb-px -ml-px z-20"></div>

                      <div className="relative h-64 overflow-hidden border-b border-[#2a2a2a] bg-[#1c1c1c] flex-shrink-0">
                        {/* Scanline effect override */}
                        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px] z-10 pointer-events-none mix-blend-overlay"></div>

                        <img
                          src={category.image}
                          alt={category.name}
                          className="absolute inset-0 w-full h-full object-cover filter grayscale group-hover: group-hover:scale-105 transition-all duration-700"
                        />
                        <div className={`absolute inset-0 bg-gradient-to-t from-[var(--c-000)] via-[var(--c-000)]/80 to-transparent z-0`} />

                        <div className="absolute inset-0 flex items-end p-6 z-10">
                          <div className="w-full">
                            <h3 className="text-xl font-bold mb-2 text-[#eaeaea] uppercase tracking-widest">{category.name}</h3>
                            <p className="text-[10px] text-[#bdbdbd] mb-3 uppercase tracking-widest line-clamp-2">{category.description}</p>
                            <div className="flex items-center text-[10px] text-[#bdbdbd] font-mono">
                              <Server className="h-3 w-3 mr-2" />
                              <span>ASSETS: {category.productCount.toString().padStart(4, '0')}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-[#181818] group-hover:bg-[var(--c-eae)] transition-colors mt-auto flex-shrink-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-[10px] text-[#bdbdbd] group-hover:text-[var(--c-000)] font-bold uppercase tracking-widest">
                            <span>INITIALIZE_CONNECTION</span>
                            <ArrowRight className="ml-2 h-3 w-3 transition-transform group-hover:translate-x-2" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* All Categories */}
      {regularCategories.length > 0 && (
        <section className="py-16 bg-[#141414] relative z-10 border-t border-[#2a2a2a]">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[var(--c-eae)] to-transparent"></div>
          <div className="container mx-auto px-4 max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-8 border-b border-[#2a2a2a] pb-4"
            >
              <h2 className="text-sm font-bold text-[#eaeaea] uppercase tracking-widest">STANDARD_CLASSIFICATIONS</h2>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {regularCategories.map((category, index) => (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.05 }}
                >
                  <button
                    onClick={() => onCategoryClick(category.id)}
                    className="group block w-full text-left h-full"
                  >
                    <div className="bg-[#1c1c1c] border border-[#2a2a2a] group-hover:border-[var(--c-eae)] transition-colors duration-300 h-full flex flex-col relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[var(--c-eae)] opacity-0 group-hover:opacity-100 transition-opacity -mt-px -mr-px z-20"></div>

                      <div className="p-5 flex-grow flex flex-col justify-between relative z-10">
                        <div>
                          <h3 className="text-sm font-bold mb-3 text-[#eaeaea] group-hover:text-[#bdbdbd] transition-colors uppercase tracking-widest bg-[#0f0f0f] inline-block px-2 py-1 border border-[#2a2a2a]">
                            {category.name}
                          </h3>
                          <p className="text-[10px] text-[#bdbdbd] mb-6 uppercase tracking-widest line-clamp-3 leading-relaxed">
                            {category.description}
                          </p>
                        </div>
                        <div className="flex items-center justify-between border-t border-[#2a2a2a] pt-4 mt-4">
                          <div className="flex items-center text-[10px] text-[#bdbdbd] font-mono group-hover: transition-opacity">
                            <Server className="h-3 w-3 mr-1.5" />
                            <span>VOL: {category.productCount}</span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-[#bdbdbd] group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                        </div>
                      </div>

                      {/* Subtle hover background highlight */}
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
});

