/**
 * 帮助中心页面组件
 * 展示常见问题和帮助分类
 * Uses @jiffoo/ui design system.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, MessageCircle, Phone, Mail, ChevronRight } from 'lucide-react';
import type { HelpPageProps } from '../../../../shared/src/types/theme';
import { Button } from '../ui/Button';
import { cn } from '@jiffoo/ui';

const helpCategories = [
  { id: 'orders', icon: '📦', title: 'Orders & Shipping', description: 'Track orders, shipping info, and delivery questions', articles: 12 },
  { id: 'returns', icon: '↩️', title: 'Returns & Refunds', description: 'Return policy, refund process, and exchanges', articles: 8 },
  { id: 'account', icon: '👤', title: 'Account & Profile', description: 'Manage your account, password, and personal info', articles: 6 },
  { id: 'payment', icon: '💳', title: 'Payment & Billing', description: 'Payment methods, billing issues, and invoices', articles: 10 },
  { id: 'products', icon: '🛍️', title: 'Products & Catalog', description: 'Product information, availability, and specifications', articles: 15 },
  { id: 'technical', icon: '⚙️', title: 'Technical Support', description: 'Website issues, app problems, and technical help', articles: 9 },
];

export function HelpPage({ config, onNavigateToCategory, onNavigateToContact }: HelpPageProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = helpCategories.filter(cat =>
    cat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <section className="py-16 bg-gradient-to-br from-brand-50 via-white to-purple-50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-4">Help Center</h1>
            <p className="text-lg text-neutral-500 mb-8 max-w-2xl mx-auto">
              Find answers to common questions and get support
            </p>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search help articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  'w-full pl-12 pr-4 py-4 rounded-2xl border border-neutral-200',
                  'bg-white text-neutral-900 placeholder:text-neutral-400',
                  'focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500',
                  'transition-all duration-150 shadow-sm'
                )}
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Help Categories */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCategories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.05 }}
                onClick={() => onNavigateToCategory?.(category.id)}
                className="group cursor-pointer"
              >
                <div className="bg-white border border-neutral-100 rounded-2xl p-6 hover:shadow-brand-md hover:border-brand-200 transition-all duration-300 h-full">
                  <div className="text-4xl mb-4">{category.icon}</div>
                  <h3 className="text-xl font-semibold text-neutral-900 mb-2 group-hover:text-brand-600 transition-colors">
                    {category.title}
                  </h3>
                  <p className="text-neutral-500 text-sm mb-4">
                    {category.description}
                  </p>
                  <div className="flex items-center justify-between text-sm text-neutral-400">
                    <span>{category.articles} articles</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 group-hover:text-brand-600 transition-all" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {filteredCategories.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
              <p className="text-neutral-500 mb-4">No help articles found matching your search.</p>
              <button onClick={() => setSearchQuery('')} className="text-brand-600 hover:underline font-medium">
                Clear search
              </button>
            </motion.div>
          )}
        </div>
      </section>

      {/* Contact Support */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h2 className="text-3xl font-bold text-neutral-900 mb-4">Didn't find what you're looking for?</h2>
            <p className="text-neutral-500 mb-8 max-w-2xl mx-auto">
              Our support team is here to help. Contact us through any of these channels.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              <div className="bg-neutral-50 rounded-2xl p-6 border border-neutral-100">
                <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center mx-auto mb-3">
                  <MessageCircle className="w-6 h-6 text-brand-600" />
                </div>
                <h3 className="font-semibold text-neutral-900 mb-2">Live Chat</h3>
                <p className="text-sm text-neutral-500">Chat with our support team</p>
              </div>

              <div className="bg-neutral-50 rounded-2xl p-6 border border-neutral-100">
                <div className="w-12 h-12 rounded-xl bg-success-50 flex items-center justify-center mx-auto mb-3">
                  <Mail className="w-6 h-6 text-success-600" />
                </div>
                <h3 className="font-semibold text-neutral-900 mb-2">Email</h3>
                <p className="text-sm text-neutral-500">support@jiffoomall.com</p>
              </div>

              <div className="bg-neutral-50 rounded-2xl p-6 border border-neutral-100">
                <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mx-auto mb-3">
                  <Phone className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-neutral-900 mb-2">Phone</h3>
                <p className="text-sm text-neutral-500">+1 (555) 123-4567</p>
              </div>
            </div>

            <Button onClick={() => onNavigateToContact?.()} size="lg" className="mt-8">
              Contact Support
            </Button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

