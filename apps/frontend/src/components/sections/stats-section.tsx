'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Users, Package, Star, Truck } from 'lucide-react';

const stats = [
  {
    icon: Users,
    value: '50K+',
    label: 'Happy Customers',
    description: 'Satisfied customers worldwide',
    color: 'text-blue-600 dark:text-blue-400'
  },
  {
    icon: Package,
    value: '10K+',
    label: 'Products Sold',
    description: 'Quality products delivered',
    color: 'text-green-600 dark:text-green-400'
  },
  {
    icon: Star,
    value: '4.9/5',
    label: 'Customer Rating',
    description: 'Based on 5,000+ reviews',
    color: 'text-yellow-600 dark:text-yellow-400'
  },
  {
    icon: Truck,
    value: '99%',
    label: 'On-Time Delivery',
    description: 'Fast and reliable shipping',
    color: 'text-purple-600 dark:text-purple-400'
  }
];

export function StatsSection() {
  return (
    <section className="py-16 bg-gradient-to-r from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Trusted by Thousands
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join our growing community of satisfied customers who trust us for their shopping needs
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center group"
              >
                <div className="relative">
                  {/* Icon Background */}
                  <div className="mx-auto w-16 h-16 rounded-full bg-background shadow-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Icon className={`h-8 w-8 ${stat.color}`} />
                  </div>

                  {/* Animated Ring */}
                  <div className="absolute inset-0 w-16 h-16 mx-auto rounded-full border-2 border-primary/20 group-hover:border-primary/40 transition-colors duration-300" />
                </div>

                {/* Stats */}
                <motion.div
                  initial={{ scale: 0.8 }}
                  whileInView={{ scale: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.1 + 0.3 }}
                  viewport={{ once: true }}
                  className="space-y-2"
                >
                  <div className="text-3xl lg:text-4xl font-bold text-foreground">
                    {stat.value}
                  </div>
                  <div className="text-lg font-semibold text-foreground">
                    {stat.label}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {stat.description}
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <div className="bg-background/50 backdrop-blur-sm rounded-2xl p-8 border shadow-lg max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold mb-4">Why Choose Jiffoo Mall?</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div className="space-y-2">
                <div className="font-semibold">Premium Quality</div>
                <div className="text-muted-foreground">
                  Carefully curated products from trusted brands
                </div>
              </div>
              <div className="space-y-2">
                <div className="font-semibold">Fast Shipping</div>
                <div className="text-muted-foreground">
                  Free delivery on orders over $50 worldwide
                </div>
              </div>
              <div className="space-y-2">
                <div className="font-semibold">24/7 Support</div>
                <div className="text-muted-foreground">
                  Round-the-clock customer service assistance
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
