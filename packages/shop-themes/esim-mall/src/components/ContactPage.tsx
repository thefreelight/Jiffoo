/**
 * Contact Page — TravelPass Design
 * eSIM support page with contact form and FA icons.
 */

import React, { useState } from 'react';
import { cn } from '../lib/utils';
import type { ContactPageProps } from '../types';

export const ContactPage = React.memo(function ContactPage({
  config,
  onSubmitForm,
  t,
}: ContactPageProps) {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email || !validateEmail(formData.email) || !formData.subject.trim() || !formData.message.trim()) return;
    try {
      setIsLoading(true);
      await onSubmitForm(formData);
      setFormData({ name: '', email: '', subject: '', message: '' });
      setSubmitted(true);
    } catch (error) {
      console.error('Failed to submit contact form:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyles = 'w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-blue-600 pt-28 pb-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            <i className="fas fa-headset mr-3" />
            {getText('travelpass.contact.title', 'eSIM Support')}
          </h1>
          <p className="mt-3 text-blue-100 text-lg max-w-2xl mx-auto">
            {getText('travelpass.contact.subtitle', 'Our team is available 24/7 to help with activation, connectivity, or billing')}
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-8">
            {/* Contact Info */}
            <div className="lg:w-1/3 space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                    <i className="fas fa-envelope text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Email</h3>
                    <p className="text-sm text-gray-600">support@travelpass.com</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                    <i className="fas fa-phone-alt text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Phone</h3>
                    <p className="text-sm text-gray-600">+1 (555) 123-4567</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                    <i className="fas fa-comment-dots text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Live Chat</h3>
                    <p className="text-sm text-gray-600">Available 24/7</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center">
                    <i className="fas fa-clock text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Response Time</h3>
                    <p className="text-sm text-gray-600">Usually within 1 hour</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:w-2/3">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                {submitted ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fas fa-check-circle text-green-600 text-3xl" />
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-800 mb-2">Message Sent!</h2>
                    <p className="text-gray-600 mb-6">We&apos;ll get back to you within 1 hour.</p>
                    <button
                      onClick={() => setSubmitted(false)}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-semibold text-gray-800 mb-6">Send us a message</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                            placeholder="Your name"
                            className={inputStyles}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                            placeholder="you@example.com"
                            className={inputStyles}
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                        <select
                          value={formData.subject}
                          onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))}
                          className={inputStyles}
                          required
                        >
                          <option value="">Select a topic</option>
                          <option value="activation">eSIM Activation Help</option>
                          <option value="connectivity">Connectivity Issues</option>
                          <option value="billing">Billing & Refunds</option>
                          <option value="account">Account Issues</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                        <textarea
                          value={formData.message}
                          onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
                          placeholder="Describe your issue or question..."
                          rows={5}
                          className={inputStyles}
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className={cn(
                          'w-full py-3 rounded-md font-semibold text-white transition-colors',
                          isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700',
                        )}
                      >
                        {isLoading ? (
                          <><i className="fas fa-spinner fa-spin mr-2" />Sending...</>
                        ) : (
                          <><i className="fas fa-paper-plane mr-2" />Send Message</>
                        )}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
});
