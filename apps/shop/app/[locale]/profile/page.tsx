/**
 * Profile Page for Shop Application
 *
 * Displays user profile information and navigation to settings/orders.
 * Supports i18n through the translation function.
 */

'use client';

import React from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useAuthStore } from '@/store/auth';
import { apiClient } from '@/lib/api';
import type { AddressBookInput, SavedAddress } from 'shared/src/types/theme';
import { useT } from 'shared/src/i18n/react';

export default function ProfilePage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const { user, isAuthenticated, isLoading, getProfile } = useAuthStore();
  const t = useT();

  // Fetch user profile on mount
  React.useEffect(() => {
    if (isAuthenticated) {
      getProfile();
    }
  }, [isAuthenticated, getProfile]);

  const [addresses, setAddresses] = React.useState<SavedAddress[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = React.useState(false);

  const loadAddresses = React.useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingAddresses(true);
    try {
      const response = await apiClient.get('/me/addresses');
      const items = (response.data?.items ?? []) as Array<{
        id: string;
        label?: string;
        isDefault?: boolean;
        shippingAddress?: {
          name?: string;
          phone?: string;
          line1?: string;
          line2?: string;
          city?: string;
          state?: string;
          postalCode?: string;
          country?: string;
        };
      }>;
      setAddresses(items.map((item) => ({
        id: item.id,
        label: item.label,
        name: item.shippingAddress?.name || '',
        phone: item.shippingAddress?.phone || '',
        line1: item.shippingAddress?.line1 || '',
        line2: item.shippingAddress?.line2 ?? null,
        city: item.shippingAddress?.city || '',
        state: item.shippingAddress?.state ?? null,
        postalCode: item.shippingAddress?.postalCode ?? null,
        country: item.shippingAddress?.country || '',
        isDefault: Boolean(item.isDefault),
      })));
    } catch {
      setAddresses([]);
    } finally {
      setIsLoadingAddresses(false);
    }
  }, [isAuthenticated]);

  React.useEffect(() => {
    void loadAddresses();
  }, [loadAddresses]);

  const handleAddAddress = React.useCallback(async (input: AddressBookInput) => {
    await apiClient.post('/me/addresses', {
      shippingAddress: {
        name: input.name,
        phone: input.phone,
        line1: input.line1,
        ...(input.line2 ? { line2: input.line2 } : {}),
        city: input.city,
        ...(input.state ? { state: input.state } : {}),
        ...(input.postalCode ? { postalCode: input.postalCode } : {}),
        country: input.country,
      },
      ...(input.isDefault !== undefined ? { is_default: input.isDefault } : {}),
    });
    await loadAddresses();
  }, [loadAddresses]);

  const handleDeleteAddress = React.useCallback(async (addressId: string) => {
    await apiClient.delete(`/me/addresses/${encodeURIComponent(addressId)}`);
    await loadAddresses();
  }, [loadAddresses]);

  const handleSetDefaultAddress = React.useCallback(async (addressId: string) => {
    await apiClient.post(`/me/addresses/${encodeURIComponent(addressId)}/default`);
    await loadAddresses();
  }, [loadAddresses]);

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // Theme loading state
  if (themeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">{getText('common.actions.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  // Check theme component availability
  if (!theme?.components?.ProfilePage) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold">{getText('common.errors.componentUnavailable', 'Component Not Found')}</h1>
          <p className="text-muted-foreground">
            {getText('common.errors.componentUnavailable', 'The ProfilePage component is not available in the current theme.')}
          </p>
          <button
            onClick={() => nav.push('/')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            {getText('common.actions.goHome', 'Go Home')}
          </button>
        </div>
      </div>
    );
  }

  const ProfilePageComponent = theme.components.ProfilePage;

  return (
    <ProfilePageComponent
      user={user ? {
        id: user.id,
        email: user.email,
        name: user.username || user.email,
        avatar: user.avatar,
        createdAt: user.createdAt,
      } : null}
      isLoading={isLoading}
      isAuthenticated={isAuthenticated}
      config={config}
      locale={nav.locale}
      t={t}
      onNavigate={(path) => nav.push(path)}
      onNavigateToSettings={() => nav.push('/profile/settings')}
      onNavigateToOrders={() => nav.push('/orders')}
      onNavigateToLogin={() => nav.push('/auth/login')}
      addresses={addresses}
      isLoadingAddresses={isLoadingAddresses}
      onAddAddress={handleAddAddress}
      onDeleteAddress={handleDeleteAddress}
      onSetDefaultAddress={handleSetDefaultAddress}
    />
  );
}
