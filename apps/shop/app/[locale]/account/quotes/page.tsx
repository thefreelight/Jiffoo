/**
 * Quote Requests Page for Shop Application
 *
 * Displays quote request form and list of existing quotes.
 * Supports i18n through the translation function.
 */

'use client';

import * as React from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { useQuoteStore } from '@/store/quotes';
import { useAuthStore } from '@/store/auth';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n/react';
import { LoadingState, ErrorState } from '@/components/ui/state-components';
import { QuoteRequestForm } from '@/components/b2b/QuoteRequestForm';
import { QuoteList } from '@/components/b2b/QuoteList';
import { b2bApi } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function QuotesPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const { quotes, isLoading, fetchQuotes, createQuote, error } = useQuoteStore();
  const { isAuthenticated } = useAuthStore();
  const t = useT();

  const [userCompanies, setUserCompanies] = React.useState<any[]>([]);
  const [loadingCompanies, setLoadingCompanies] = React.useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState('list');

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // Fetch user's companies on mount
  React.useEffect(() => {
    const loadUserCompanies = async () => {
      if (!isAuthenticated) {
        return;
      }

      try {
        setLoadingCompanies(true);
        const response = await b2bApi.getUserCompanies();
        if (response.success && response.data) {
          setUserCompanies(response.data);
          // Auto-select first company if available
          if (response.data.length > 0) {
            setSelectedCompanyId(response.data[0].companyId);
          }
        }
      } catch (err) {
        // Silently fail - user might not be a B2B customer
      } finally {
        setLoadingCompanies(false);
      }
    };

    loadUserCompanies();
  }, [isAuthenticated]);

  // Fetch quotes when company is selected
  React.useEffect(() => {
    if (isAuthenticated && selectedCompanyId) {
      fetchQuotes({ companyId: selectedCompanyId });
    }
  }, [isAuthenticated, selectedCompanyId, fetchQuotes]);

  // Handle quote creation
  const handleCreateQuote = async (data: {
    companyId: string;
    items: Array<{
      productId: string;
      variantId: string;
      quantity: number;
      unitPrice?: number;
      discount?: number;
      taxRate?: number;
      notes?: string;
    }>;
    notes?: string;
    customerNotes?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
  }) => {
    try {
      await createQuote(data);
      // Switch to list tab after successful creation
      setActiveTab('list');
    } catch (err) {
      throw err;
    }
  };

  // Handle view quote details
  const handleViewQuote = (quoteId: string) => {
    // Navigate to quote detail page (if implemented)
    nav.push(`/account/quotes/${quoteId}`);
  };

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (!isAuthenticated && !themeLoading) {
      sessionStorage.setItem('redirectAfterLogin', nav.getHref('/account/quotes'));
      nav.push('/auth/login');
    }
  }, [isAuthenticated, themeLoading, nav]);

  // Theme loading state
  if (themeLoading || loadingCompanies) {
    return (
      <LoadingState
        type="spinner"
        message={getText('common.actions.loading', 'Loading...')}
        fullPage
      />
    );
  }

  // Check if user has B2B company access
  if (!loadingCompanies && userCompanies.length === 0) {
    return (
      <ErrorState
        title={getText('shop.b2b.noCompanyAccess', 'No Company Access')}
        message={getText('shop.b2b.noCompanyAccessMessage', 'You need to be associated with a company to access quote requests.')}
        onGoHome={() => nav.push('/')}
        fullPage
      />
    );
  }

  // Main content
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {getText('shop.b2b.quoteRequests', 'Quote Requests')}
        </h1>
        <p className="text-muted-foreground">
          {getText('shop.b2b.quoteRequestsDescription', 'Request and manage custom quotes for bulk orders')}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="list">
            {getText('shop.b2b.myQuotes', 'My Quotes')}
          </TabsTrigger>
          <TabsTrigger value="new">
            {getText('shop.b2b.newQuote', 'New Quote')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-md">
              {error}
            </div>
          )}
          <QuoteList
            quotes={quotes}
            isLoading={isLoading}
            onViewQuote={handleViewQuote}
            getText={getText}
          />
        </TabsContent>

        <TabsContent value="new" className="space-y-4">
          {selectedCompanyId ? (
            <QuoteRequestForm
              companyId={selectedCompanyId}
              onSubmit={handleCreateQuote}
              isLoading={isLoading}
              getText={getText}
            />
          ) : (
            <ErrorState
              title={getText('shop.b2b.noCompanySelected', 'No Company Selected')}
              message={getText('shop.b2b.noCompanySelectedMessage', 'Please select a company to create a quote request.')}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
