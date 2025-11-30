/**
 * Contact Page for Shop Application
 *
 * Displays contact form for customer inquiries.
 * Supports i18n through the translation function.
 */

'use client';

import React from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { useToast } from '@/hooks/use-toast';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n';

export default function ContactPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const { toast } = useToast();
  const nav = useLocalizedNavigation();
  const t = useT();

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // Theme loading state
  if (themeLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Check theme component availability
  if (!theme?.components?.ContactPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-6">
          <h1 className="text-xl font-bold text-red-600">{getText('common.errors.componentUnavailable', 'Contact Page Not Found')}</h1>
          <p className="mt-2 text-sm text-gray-600">{getText('common.errors.componentUnavailable', 'The contact page component is not available in the current theme.')}</p>
        </div>
      </div>
    );
  }

  const handleSubmitForm = async (data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }) => {
    try {
      toast({
        title: getText('shop.contact.underDevelopment', 'Feature Under Development'),
        description: getText('shop.contact.underDevelopmentDescription', 'The contact form feature is currently under development. Please try again later.'),
        variant: 'default',
      });
    } catch (error) {
      toast({
        title: getText('common.errors.error', 'Error'),
        description: getText('common.errors.general', 'An error occurred. Please try again.'),
        variant: 'destructive',
      });
      throw error;
    }
  };

  const ContactPageComponent = theme.components.ContactPage;

  return (
    <ContactPageComponent
      config={config}
      locale={nav.locale}
      t={t}
      onSubmitForm={handleSubmitForm}
    />
  );
}
