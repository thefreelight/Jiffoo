'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { useTranslation } from '@/hooks/use-translation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ShoppingBag, 
  Search, 
  Filter, 
  Calendar,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Eye,
  Download
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface Order {
  id: string;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  totalAmount: number;
  createdAt: string;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    product: {
      id: string;
      name: string;
      images: string;
    };
  }>;
}

export default function OrdersPage() {
  const { user, isAuthenticated } = useAuthStore();
  const { t, currentLanguage } = useTranslation();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 10;

  // Mock data for demonstration
  useEffect(() => {
    const mockOrders: Order[] = [
      {
        id: 'ORD-001',
        status: 'delivered',
        totalAmount: 199.99,
        createdAt: '2024-01-15T10:30:00Z',
        items: [
          {
            id: '1',
            productId: '1',
            quantity: 1,
            unitPrice: 99.99,
            product: {
              id: '1',
              name: 'Wireless Headphones',
              images: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop'
            }
          },
          {
            id: '2',
            productId: '2',
            quantity: 1,
            unitPrice: 100.00,
            product: {
              id: '2',
              name: 'Smart Watch',
              images: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop'
            }
          }
        ]
      },
      {
        id: 'ORD-002',
        status: 'shipped',
        totalAmount: 89.99,
        createdAt: '2024-01-10T14:20:00Z',
        items: [
          {
            id: '3',
            productId: '3',
            quantity: 1,
            unitPrice: 89.99,
            product: {
              id: '3',
              name: 'Laptop Stand',
              images: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&h=400&fit=crop'
            }
          }
        ]
      },
      {
        id: 'ORD-003',
        status: 'pending',
        totalAmount: 299.99,
        createdAt: '2024-01-08T09:15:00Z',
        items: [
          {
            id: '4',
            productId: '4',
            quantity: 2,
            unitPrice: 149.99,
            product: {
              id: '4',
              name: 'Bluetooth Speaker',
              images: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=400&fit=crop'
            }
          }
        ]
      }
    ];

    setTimeout(() => {
      setOrders(mockOrders);
      setFilteredOrders(mockOrders);
      setIsLoading(false);
    }, 1000);
  }, []);

  // Filter orders based on search and status
  useEffect(() => {
    let filtered = orders;

    if (searchTerm) {
      filtered = filtered.filter(order => 
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.items.some(item => 
          item.product.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    setFilteredOrders(filtered);
    setCurrentPage(1);
  }, [searchTerm, statusFilter, orders]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Package className="w-4 h-4" />;
      case 'paid': return <CheckCircle className="w-4 h-4" />;
      case 'shipped': return <Truck className="w-4 h-4" />;
      case 'delivered': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'paid': return 'bg-blue-100 text-blue-800';
      case 'shipped': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
  const startIndex = (currentPage - 1) * ordersPerPage;
  const endIndex = startIndex + ordersPerPage;
  const currentOrders = filteredOrders.slice(startIndex, endIndex);

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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/profile" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('profile.backToProfile')}
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{t('profile.orderHistory')}</h1>
          <p className="text-gray-600">{t('profile.manageOrders')}</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder={t('profile.searchOrders')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-full md:w-48">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('profile.filterByStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('profile.allOrders')}</SelectItem>
                    <SelectItem value="pending">{t('order.status.pending')}</SelectItem>
                    <SelectItem value="paid">{t('order.status.paid')}</SelectItem>
                    <SelectItem value="shipped">{t('order.status.shipped')}</SelectItem>
                    <SelectItem value="delivered">{t('order.status.delivered')}</SelectItem>
                    <SelectItem value="cancelled">{t('order.status.cancelled')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : currentOrders.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <ShoppingBag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t('profile.noOrdersFound')}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchTerm || statusFilter !== 'all' 
                  ? t('profile.noOrdersMatchFilter')
                  : t('profile.noOrdersYet')
                }
              </p>
              <Link href="/products">
                <Button>
                  {t('profile.startShopping')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {currentOrders.map((order) => (
              <Card key={order.id}>
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4">
                    <div className="flex items-center space-x-4 mb-4 lg:mb-0">
                      <div>
                        <h3 className="font-semibold text-lg">#{order.id}</h3>
                        <p className="text-sm text-gray-600">
                          {new Date(order.createdAt).toLocaleDateString(currentLanguage, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <Badge className={`${getStatusColor(order.status)} flex items-center space-x-1`}>
                        {getStatusIcon(order.status)}
                        <span>{t(`order.status.${order.status}`)}</span>
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-bold">${order.totalAmount}</span>
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        {t('profile.viewDetails')}
                      </Button>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="space-y-3">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                        <div className="w-16 h-16 relative bg-muted rounded-md flex items-center justify-center">
                          {item.product.images && 
                           item.product.images !== '[]' && 
                           item.product.images !== '' && 
                           !item.product.images.startsWith('[') ? (
                            <Image
                              src={item.product.images}
                              alt={item.product.name}
                              fill
                              className="object-cover rounded-md"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center rounded-md">
                              <ShoppingBag className="h-6 w-6 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{item.product.name}</h4>
                          <p className="text-sm text-gray-600">
                            {t('profile.quantity')}: {item.quantity} × ${item.unitPrice}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${(item.quantity * item.unitPrice).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  {t('common.previous')}
                </Button>
                <span className="flex items-center px-4 py-2 text-sm text-gray-700">
                  {t('common.page')} {currentPage} {t('common.of')} {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  {t('common.next')}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
