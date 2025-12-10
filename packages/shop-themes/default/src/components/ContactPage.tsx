/**
 * 联系我们页面组件
 * 展示联系表单和联系信息
 * Uses @jiffoo/ui design system.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Clock, Send } from 'lucide-react';
import type { ContactPageProps } from '../../../../shared/src/types/theme';
import { Button } from '../ui/Button';
import { cn } from '@jiffoo/ui';

const inputStyles = cn(
  'w-full px-4 py-3 rounded-xl border border-neutral-200',
  'bg-white text-neutral-900 placeholder:text-neutral-400',
  'focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500',
  'transition-all duration-150'
);

export function ContactPage({ config, onSubmitForm }: ContactPageProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email || !validateEmail(formData.email) || !formData.subject.trim() || !formData.message.trim()) {
      return;
    }
    try {
      setIsLoading(true);
      await onSubmitForm(formData);
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      console.error('Failed to submit contact form:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
            <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-4">Get in Touch</h1>
            <p className="text-lg text-neutral-500 max-w-2xl mx-auto">
              Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Info & Form */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Contact Information */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-2xl border border-neutral-100 p-6 flex items-start space-x-4">
                <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Mail className="w-6 h-6 text-brand-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-1">Email</h3>
                  <p className="text-neutral-500">support@jiffoomall.com</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-neutral-100 p-6 flex items-start space-x-4">
                <div className="w-12 h-12 bg-success-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Phone className="w-6 h-6 text-success-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-1">Phone</h3>
                  <p className="text-neutral-500">+1 (555) 123-4567</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-neutral-100 p-6 flex items-start space-x-4">
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-1">Address</h3>
                  <p className="text-neutral-500">123 Commerce Street, Business City, BC 12345</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-neutral-100 p-6 flex items-start space-x-4">
                <div className="w-12 h-12 bg-warning-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-warning-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-1">Business Hours</h3>
                  <p className="text-neutral-500">Monday - Friday: 9:00 AM - 6:00 PM</p>
                  <p className="text-neutral-500">Saturday - Sunday: 10:00 AM - 4:00 PM</p>
                </div>
              </div>
            </motion.div>

            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="lg:col-span-2"
            >
              <div className="bg-white rounded-2xl border border-neutral-100 p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="Your name"
                        className={inputStyles}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="your@email.com"
                        className={inputStyles}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Subject</label>
                    <input
                      type="text"
                      value={formData.subject}
                      onChange={(e) => handleInputChange('subject', e.target.value)}
                      placeholder="What is this about?"
                      className={inputStyles}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Message</label>
                    <textarea
                      value={formData.message}
                      onChange={(e) => handleInputChange('message', e.target.value)}
                      placeholder="Tell us more about your inquiry..."
                      rows={6}
                      className={cn(inputStyles, 'resize-none')}
                      required
                    />
                  </div>

                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? 'Sending...' : 'Send Message'}
                    <Send className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}

