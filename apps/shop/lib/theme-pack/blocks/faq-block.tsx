'use client';

/**
 * FAQ Block
 *
 * Frequently asked questions accordion.
 */

import React, { useState } from 'react';
import type { BlockComponentProps } from '../types';

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqSettings {
  /** Section title */
  title?: string;
  /** FAQ items */
  items?: FaqItem[];
  /** Whether to show section title */
  showTitle?: boolean;
  /** Allow multiple items open at once */
  allowMultiple?: boolean;
}

export function FaqBlock({ settings, themeConfig, blockId }: BlockComponentProps) {
  const faqSettings = settings as FaqSettings;
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());

  const {
    title = 'Frequently Asked Questions',
    items = [],
    showTitle = true,
    allowMultiple = false,
  } = faqSettings;

  const toggleItem = (index: number) => {
    setOpenItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        if (!allowMultiple) {
          newSet.clear();
        }
        newSet.add(index);
      }
      return newSet;
    });
  };

  const primaryColor = themeConfig?.colors?.primary || 'var(--theme-color-primary, #2563eb)';

  if (items.length === 0) {
    return null;
  }

  return (
    <section id={blockId} className="py-12 px-4">
      <div className="container mx-auto max-w-3xl">
        {showTitle && title && (
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">{title}</h2>
        )}

        <div className="space-y-4">
          {items.map((item, index) => {
            const isOpen = openItems.has(index);
            return (
              <div
                key={index}
                className="border rounded-lg overflow-hidden"
                style={{ borderColor: 'var(--theme-color-border, #e5e7eb)' }}
              >
                <button
                  onClick={() => toggleItem(index)}
                  className="w-full flex items-center justify-between p-4 text-left font-medium hover:bg-gray-50 transition-colors"
                >
                  <span>{item.question}</span>
                  <svg
                    className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    style={{ color: primaryColor }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {isOpen && (
                  <div className="p-4 pt-0 text-gray-600">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
