/**
 * Help Center Page Component - Admin Style Design
 */

import React, { useState } from 'react';
import { Search, MessageCircle, Phone, Mail, ChevronRight } from 'lucide-react';
import type { HelpPageProps } from '../../../../shared/src/types/theme';
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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <section className="py-16 sm:py-20 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-full mb-6">
              <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">SUPPORT CENTER</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">Help Center</h1>
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-8">
              FIND ANSWERS TO COMMON QUESTIONS
            </p>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Search help articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  'w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-100 dark:border-slate-700',
                  'bg-gray-50/50 dark:bg-slate-800 text-sm font-bold text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400',
                  'transition-all duration-150 shadow-sm'
                )}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Help Categories */}
      <section className="py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-7xl mx-auto">
            {filteredCategories.map((category) => (
              <div
                key={category.id}
                onClick={() => onNavigateToCategory?.(category.id)}
                className="group cursor-pointer"
              >
                <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-3xl p-6 sm:p-8 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-700 transition-all duration-300 h-full">
                  <div className="text-4xl sm:text-5xl mb-4 sm:mb-6">{category.icon}</div>
                  <div className="space-y-3">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors tracking-tight">
                      {category.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      {category.description}
                    </p>
                    <div className="flex items-center justify-between text-xs pt-2">
                      <span className="text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">{category.articles} ARTICLES</span>
                      <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:translate-x-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredCategories.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm max-w-2xl mx-auto">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No help articles found matching your search.</p>
              <button onClick={() => setSearchQuery('')} className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold text-sm uppercase tracking-wider">
                CLEAR SEARCH
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Contact Support */}
      <section className="py-12 sm:py-16 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-6 justify-center">
              <div className="h-4 w-1 bg-blue-600 rounded-full" />
              <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">NEED MORE HELP</h2>
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">Didn't find what you're looking for?</h3>
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-8 sm:mb-12">
              OUR SUPPORT TEAM IS HERE TO HELP
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-slate-600">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">LIVE CHAT</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">Chat with our support team</p>
              </div>

              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-slate-600">
                <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-7 h-7 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">EMAIL</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">support@jiffoomall.com</p>
              </div>

              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-slate-600">
                <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">PHONE</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">+1 (555) 123-4567</p>
              </div>
            </div>

            <button
              onClick={() => onNavigateToContact?.()}
              className="h-12 px-8 rounded-xl font-semibold text-sm shadow-md shadow-blue-100 dark:shadow-none bg-blue-600 hover:bg-blue-700 text-white transition-all uppercase tracking-wider w-full sm:w-auto"
            >
              CONTACT SUPPORT
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
