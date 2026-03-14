'use client';

/**
 * Testimonial Block
 *
 * Customer testimonials/reviews display.
 */

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import type { BlockComponentProps } from '../types';

interface TestimonialItem {
  /** Customer name */
  name: string;
  /** Customer role/title (optional) */
  role?: string;
  /** Customer avatar URL */
  avatar?: string;
  /** Testimonial content */
  content: string;
  /** Rating (1-5) */
  rating?: number;
}

interface TestimonialSettings {
  /** Section title */
  title?: string;
  /** Testimonial items */
  items?: TestimonialItem[];
  /** Whether to show section title */
  showTitle?: boolean;
  /** Auto-rotate testimonials */
  autoplay?: boolean;
  /** Autoplay interval in ms */
  interval?: number;
}

export function TestimonialBlock({ settings, themeConfig, blockId }: BlockComponentProps) {
  const testimonialSettings = settings as TestimonialSettings;
  const [activeIndex, setActiveIndex] = useState(0);

  const {
    title = 'What Our Customers Say',
    items = [],
    showTitle = true,
    autoplay = true,
    interval = 5000,
  } = testimonialSettings;

  // Autoplay
  useEffect(() => {
    if (!autoplay || items.length <= 1) return;

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, interval);

    return () => clearInterval(timer);
  }, [autoplay, interval, items.length]);

  const primaryColor = themeConfig?.colors?.primary || 'var(--theme-color-primary, #2563eb)';

  if (items.length === 0) {
    return null;
  }

  const currentItem = items[activeIndex];

  return (
    <section id={blockId} className="py-12 px-4 bg-gray-50">
      <div className="container mx-auto max-w-4xl">
        {showTitle && title && (
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">{title}</h2>
        )}

        <div className="text-center">
          {/* Quote Icon */}
          <svg
            className="w-12 h-12 mx-auto mb-6 opacity-20"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
          </svg>

          {/* Content */}
          <blockquote className="text-lg md:text-xl text-gray-700 mb-6 italic">
            "{currentItem.content}"
          </blockquote>

          {/* Rating */}
          {currentItem.rating && (
            <div className="flex justify-center gap-1 mb-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg
                  key={i}
                  className={`w-5 h-5 ${i < currentItem.rating! ? 'text-yellow-400' : 'text-gray-300'}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
          )}

          {/* Author */}
          <div className="flex items-center justify-center gap-3">
            {currentItem.avatar && (
              <div className="relative w-12 h-12 rounded-full overflow-hidden">
                <Image
                  src={currentItem.avatar}
                  alt={currentItem.name}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="text-left">
              <p className="font-semibold">{currentItem.name}</p>
              {currentItem.role && (
                <p className="text-sm text-gray-500">{currentItem.role}</p>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Dots */}
        {items.length > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {items.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === activeIndex ? '' : 'bg-gray-300'
                }`}
                style={{
                  backgroundColor: index === activeIndex ? primaryColor : undefined,
                }}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
