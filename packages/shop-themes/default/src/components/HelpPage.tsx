/**
 * 帮助中心页面组件
 * 展示常见问题和帮助分类
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, MessageCircle, Phone, Mail, ChevronRight } from 'lucide-react';
import type { HelpPageProps } from '../../../../shared/src/types/theme';

const helpCategories = [
  {
    id: 'orders',
    icon: '📦',
    title: 'Orders & Shipping',
    description: 'Track orders, shipping info, and delivery questions',
    articles: 12,
  },
  {
    id: 'returns',
    icon: '↩️',
    title: 'Returns & Refunds',
    description: 'Return policy, refund process, and exchanges',
    articles: 8,
  },
  {
    id: 'account',
    icon: '👤',
    title: 'Account & Profile',
    description: 'Manage your account, password, and personal info',
    articles: 6,
  },
  {
    id: 'payment',
    icon: '💳',
    title: 'Payment & Billing',
    description: 'Payment methods, billing issues, and invoices',
    articles: 10,
  },
  {
    id: 'products',
    icon: '🛍️',
    title: 'Products & Catalog',
    description: 'Product information, availability, and specifications',
    articles: 15,
  },
  {
    id: 'technical',
    icon: '⚙️',
    title: 'Technical Support',
    description: 'Website issues, app problems, and technical help',
    articles: 9,
  },
];

export function HelpPage({ config, onNavigateToCategory, onNavigateToContact }: HelpPageProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = helpCategories.filter(cat =>
    cat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="py-16 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Help Center</h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Find answers to common questions and get support
            </p>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input
                type="text"
                placeholder="Search help articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
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
                transition={{ duration: 0.6, delay: index * 0.1 }}
                onClick={() => onNavigateToCategory?.(category.id)}
                className="group cursor-pointer"
              >
                <div className="bg-white border border-border rounded-lg p-6 hover:shadow-lg transition-all duration-300 h-full">
                  <div className="text-4xl mb-4">{category.icon}</div>
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                    {category.title}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    {category.description}
                  </p>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{category.articles} articles</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {filteredCategories.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <p className="text-muted-foreground mb-4">No help articles found matching your search.</p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-primary hover:underline"
              >
                Clear search
              </button>
            </motion.div>
          )}
        </div>
      </section>

      {/* Contact Support */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h2 className="text-3xl font-bold mb-4">Didn't find what you're looking for?</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Our support team is here to help. Contact us through any of these channels.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              <div className="bg-white rounded-lg p-6 border border-border">
                <MessageCircle className="w-8 h-8 text-blue-600 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Live Chat</h3>
                <p className="text-sm text-muted-foreground">Chat with our support team</p>
              </div>

              <div className="bg-white rounded-lg p-6 border border-border">
                <Mail className="w-8 h-8 text-green-600 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Email</h3>
                <p className="text-sm text-muted-foreground">support@jiffoomall.com</p>
              </div>

              <div className="bg-white rounded-lg p-6 border border-border">
                <Phone className="w-8 h-8 text-purple-600 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Phone</h3>
                <p className="text-sm text-muted-foreground">+1 (555) 123-4567</p>
              </div>
            </div>

            <button
              onClick={() => onNavigateToContact?.()}
              className="mt-8 px-8 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            >
              Contact Support
            </button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

