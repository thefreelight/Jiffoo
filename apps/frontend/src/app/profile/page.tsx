'use client';

import React from 'react';
import { useAuthStore } from '@/store/auth';
import { useTranslation } from '@/hooks/use-translation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  User, 
  ShoppingBag, 
  Settings, 
  CreditCard, 
  MapPin, 
  Bell,
  Calendar,
  DollarSign,
  Package,
  TrendingUp
} from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const { user, isAuthenticated } = useAuthStore();
  const { t, currentLanguage } = useTranslation();

  // Mock data for demonstration
  const orderStats = {
    totalOrders: 12,
    totalSpent: 1299.99,
    pendingOrders: 2,
    completedOrders: 8,
    cancelledOrders: 2
  };

  const recentOrders = [
    {
      id: '1',
      status: 'delivered',
      totalAmount: 199.99,
      createdAt: '2024-01-15T10:30:00Z',
      itemCount: 2
    },
    {
      id: '2', 
      status: 'shipped',
      totalAmount: 89.99,
      createdAt: '2024-01-10T14:20:00Z',
      itemCount: 1
    },
    {
      id: '3',
      status: 'pending',
      totalAmount: 299.99,
      createdAt: '2024-01-08T09:15:00Z',
      itemCount: 3
    }
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>{t('auth.loginRequired')}</CardTitle>
            <CardDescription>
              {t('profile.loginToAccess')}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/auth/login">
              <Button className="w-full">
                {t('auth.login')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'shipped': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {t('profile.welcome')}, {user?.name}!
              </h1>
              <p className="text-gray-600">{user?.email}</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>{t('profile.overview')}</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center space-x-2">
              <ShoppingBag className="w-4 h-4" />
              <span>{t('profile.orders')}</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>{t('profile.settings')}</span>
            </TabsTrigger>
            <TabsTrigger value="addresses" className="flex items-center space-x-2">
              <MapPin className="w-4 h-4" />
              <span>{t('profile.addresses')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{t('profile.totalOrders')}</p>
                      <p className="text-2xl font-bold text-gray-900">{orderStats.totalOrders}</p>
                    </div>
                    <ShoppingBag className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{t('profile.totalSpent')}</p>
                      <p className="text-2xl font-bold text-gray-900">${orderStats.totalSpent}</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{t('profile.pendingOrders')}</p>
                      <p className="text-2xl font-bold text-gray-900">{orderStats.pendingOrders}</p>
                    </div>
                    <Package className="w-8 h-8 text-yellow-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{t('profile.completedOrders')}</p>
                      <p className="text-2xl font-bold text-gray-900">{orderStats.completedOrders}</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Orders */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {t('profile.recentOrders')}
                  <Link href="/profile?tab=orders">
                    <Button variant="outline" size="sm">
                      {t('profile.viewAll')}
                    </Button>
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div>
                          <p className="font-medium">#{t('order.order')} {order.id}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(order.createdAt).toLocaleDateString(currentLanguage)}
                          </p>
                        </div>
                        <Badge className={getStatusColor(order.status)}>
                          {t(`order.status.${order.status}`)}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${order.totalAmount}</p>
                        <p className="text-sm text-gray-600">
                          {order.itemCount} {t('profile.items')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>{t('profile.orderHistory')}</CardTitle>
                <CardDescription>
                  {t('profile.orderHistoryDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">{t('profile.orderHistoryPlaceholder')}</p>
                  <Link href="/orders">
                    <Button>
                      {t('profile.viewDetailedOrders')}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>{t('profile.accountSettings')}</CardTitle>
                <CardDescription>
                  {t('profile.accountSettingsDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">{t('profile.settingsPlaceholder')}</p>
                  <Link href="/profile/settings">
                    <Button>
                      {t('profile.manageSettings')}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Addresses Tab */}
          <TabsContent value="addresses">
            <Card>
              <CardHeader>
                <CardTitle>{t('profile.shippingAddresses')}</CardTitle>
                <CardDescription>
                  {t('profile.shippingAddressesDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">{t('profile.addressesPlaceholder')}</p>
                  <Link href="/profile/addresses">
                    <Button>
                      {t('profile.manageAddresses')}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
