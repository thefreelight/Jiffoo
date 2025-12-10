/**
 * 分类页面组件
 * 展示所有商品分类
 * Uses @jiffoo/ui design system.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Package, Loader2 } from 'lucide-react';
import type { CategoriesPageProps } from '../../../../shared/src/types/theme';
import { Button } from '../ui/Button';
import { Breadcrumb, BreadcrumbItem } from '../ui/Breadcrumb';

export function CategoriesPage({
  categories,
  isLoading,
  error,
  config,
  onCategoryClick,
  onNavigateToHome,
}: CategoriesPageProps) {
  // Breadcrumb items
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Home', onClick: onNavigateToHome },
    { label: 'Categories' },
  ];
  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-brand-600" />
          <p className="text-neutral-500">Loading categories...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-error-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  const featuredCategories = categories.filter(cat => cat.featured);
  const regularCategories = categories.filter(cat => !cat.featured);

  return (
    <div className="min-h-screen bg-neutral-50 pt-[72px]">
      {/* Breadcrumb */}
      <div className="container mx-auto px-4 pt-6">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* Header */}
      <section className="py-12 bg-gradient-to-br from-brand-50 via-white to-neutral-50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-4xl lg:text-5xl font-bold mb-4 text-neutral-900">All Categories</h1>
            <p className="text-lg text-neutral-500 max-w-2xl mx-auto">
              Discover our complete collection of premium products
            </p>
          </motion.div>
        </div>
      </section>

      {/* Featured Categories */}
      {featuredCategories.length > 0 && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-12"
            >
              <h2 className="text-3xl font-bold mb-4 text-neutral-900">Featured Categories</h2>
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
                    className="group block w-full text-left"
                  >
                    <div className="relative overflow-hidden rounded-2xl bg-white shadow-brand-sm hover:shadow-brand-md transition-all duration-300 transform hover:-translate-y-2">
                      <div className="relative h-64 overflow-hidden">
                        <img
                          src={category.image}
                          alt={category.name}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                        <div className={`absolute inset-0 bg-gradient-to-t ${category.featured ? 'from-brand-600' : 'from-neutral-600'} opacity-60`} />

                        <div className="absolute inset-0 flex items-end p-6">
                          <div className="text-white">
                            <h3 className="text-2xl font-bold mb-2">{category.name}</h3>
                            <p className="text-white/90 mb-3">{category.description}</p>
                            <div className="flex items-center text-white/80">
                              <Package className="h-4 w-4 mr-1" />
                              <span className="text-sm">{category.productCount} Products</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-brand-600 font-medium">
                            <span>Explore</span>
                            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
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
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-12"
            >
              <h2 className="text-3xl font-bold mb-4 text-neutral-900">All Categories</h2>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {regularCategories.map((category, index) => (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <button
                    onClick={() => onCategoryClick(category.id)}
                    className="group block w-full text-left"
                  >
                    <div className="bg-neutral-50 rounded-2xl shadow-sm hover:shadow-brand-sm transition-all duration-300 overflow-hidden border border-neutral-100">
                      <div className="relative h-48 overflow-hidden">
                        <img
                          src={category.image}
                          alt={category.name}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/60 to-transparent" />
                      </div>

                      <div className="p-5">
                        <h3 className="text-lg font-semibold mb-2 text-neutral-900 group-hover:text-brand-600 transition-colors">
                          {category.name}
                        </h3>
                        <p className="text-neutral-500 text-sm mb-3">{category.description}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-neutral-500 text-sm">
                            <Package className="h-4 w-4 mr-1" />
                            <span>{category.productCount} Products</span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-brand-600 transition-transform group-hover:translate-x-1" />
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
    </div>
  );
}

