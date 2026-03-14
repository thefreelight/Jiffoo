/**
 * Company Account Page for Shop Application
 *
 * Displays company account information and user management for B2B customers.
 * Supports i18n through the translation function.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { b2bApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useT } from 'shared/src/i18n/react';
import { CompanyAccountCard } from '@/components/b2b/CompanyAccountCard';
import { CompanyUsersList } from '@/components/b2b/CompanyUsersList';
import type { PageResult } from 'shared/src';

interface Company {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  taxId: string | null;
  accountType: string;
  paymentTerms: string;
  creditLimit: number | null;
  currentBalance: number;
  taxExempt: boolean;
  isActive: boolean;
  customerGroupId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CompanyUser {
  id: string;
  companyId: string;
  userId: string;
  role: string;
  permissions: string[];
  approvalLimit: number | null;
  isActive: boolean;
  user: {
    id: string;
    email: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  };
}

interface UserCompany {
  id: string;
  companyId: string;
  userId: string;
  role: string;
  permissions: string[];
  approvalLimit: number | null;
  isActive: boolean;
  company: Company;
}

export default function CompanyAccountPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const { toast } = useToast();
  const t = useT();

  const [userCompany, setUserCompany] = useState<UserCompany | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper function for translations with fallback
  const getText = useCallback((key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  }, [t]);

  // Fetch user's companies
  const fetchUserCompanies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await b2bApi.getUserCompanies();

      if (response.success && response.data) {
        const companies = response.data;

        if (companies.length === 0) {
          setError(getText('shop.b2b.noCompany', 'You are not associated with any company'));
          setLoading(false);
          return;
        }

        // Use the first company (users typically belong to one company)
        const primaryCompany = companies[0];
        setUserCompany(primaryCompany as UserCompany);

        // Fetch full company details
        await fetchCompanyDetails(primaryCompany.companyId);

        // Fetch company users
        await fetchCompanyUsers(primaryCompany.companyId);
      } else {
        setError(response.error?.message || getText('common.errors.general', 'Failed to fetch company information'));
      }
    } catch (err: unknown) {
      setError((err as { message?: string }).message || getText('common.errors.general', 'Failed to fetch company information'));
    } finally {
      setLoading(false);
    }
  }, [getText]);

  // Fetch company details
  const fetchCompanyDetails = async (companyId: string) => {
    try {
      const response = await b2bApi.getCompany(companyId);

      if (response.success && response.data) {
        setCompany(response.data);
      }
    } catch (err: unknown) {
      // Don't show error toast, just log it
      console.error('Failed to fetch company details:', err);
    }
  };

  // Fetch company users
  const fetchCompanyUsers = async (companyId: string) => {
    try {
      setUsersLoading(true);
      const response = await b2bApi.getCompanyUsers(companyId, {
        page: 1,
        limit: 50,
      });

      if (response.success && response.data) {
        const responseData = response.data as PageResult<CompanyUser>;
        setCompanyUsers(responseData.items);
      }
    } catch (err: unknown) {
      // Don't show error toast, just log it
      console.error('Failed to fetch company users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchUserCompanies();
  }, [fetchUserCompanies]);

  // Theme loading state
  if (themeLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="mt-4 text-sm text-gray-600">{getText('common.actions.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <h2 className="text-lg font-semibold text-red-900 mb-2">
              {getText('common.errors.error', 'Error')}
            </h2>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={() => nav.push('/profile')}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              {getText('shop.b2b.backToProfile', 'Back to Profile')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="mt-4 text-sm text-gray-600">{getText('common.actions.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {getText('shop.b2b.companyAccount', 'Company Account')}
            </h1>
            <p className="text-muted-foreground mt-2">
              {getText('shop.b2b.companyAccountDescription', 'Manage your company account and users')}
            </p>
          </div>
          <button
            onClick={() => nav.push('/profile')}
            className="px-4 py-2 text-sm border rounded-md hover:bg-muted"
          >
            {getText('shop.b2b.backToProfile', 'Back to Profile')}
          </button>
        </div>

        {/* Company Information Card */}
        {company && (
          <CompanyAccountCard
            company={company}
            userRole={userCompany?.role}
            getText={getText}
          />
        )}

        {/* Company Users List */}
        <CompanyUsersList
          users={companyUsers}
          isLoading={usersLoading}
          getText={getText}
        />
      </div>
    </div>
  );
}
