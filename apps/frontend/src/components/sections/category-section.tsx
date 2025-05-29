'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const categories = [
  {
    id: 1,
    name: 'Electronics',
    description: 'Latest gadgets and tech',
    image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&h=300&fit=crop',
    href: '/categories/electronics',
    color: 'from-blue-500 to-purple-600'
  },
  {
    id: 2,
    name: 'Fashion',
    description: 'Trendy clothing and accessories',
    image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&h=300&fit=crop',
    href: '/categories/fashion',
    color: 'from-pink-500 to-rose-600'
  },
  {
    id: 3,
    name: 'Home & Garden',
    description: 'Beautiful home essentials',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop',
    href: '/categories/home-garden',
    color: 'from-green-500 to-emerald-600'
  },
  {
    id: 4,
    name: 'Sports',
    description: 'Fitness and outdoor gear',
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop',
    href: '/categories/sports',
    color: 'from-orange-500 to-red-600'
  },
  {
    id: 5,
    name: 'Books',
    description: 'Knowledge and entertainment',
    image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=300&fit=crop',
    href: '/categories/books',
    color: 'from-indigo-500 to-blue-600'
  },
  {
    id: 6,
    name: 'Beauty',
    description: 'Skincare and cosmetics',
    image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=300&fit=crop',
    href: '/categories/beauty',
    color: 'from-purple-500 to-pink-600'
  }
];

export function CategorySection() {
  return (
    <section className="py-16 bg-muted/20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">Shop by Category</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore our diverse collection of products across different categories
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Link href={category.href} className="group block">
                <div className="relative overflow-hidden rounded-xl bg-white dark:bg-gray-900 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
                  {/* Image */}
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={category.image}
                      alt={category.name}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                    <div className={`absolute inset-0 bg-gradient-to-t ${category.color} opacity-60`} />
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                      {category.name}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {category.description}
                    </p>
                    <div className="flex items-center text-primary font-medium">
                      <span>Explore</span>
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <Link href="/categories">
            <Button size="lg" variant="outline">
              View All Categories
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
