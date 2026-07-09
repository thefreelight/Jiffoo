'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authApi, ordersApi, type Order } from '../../../lib/api';

// Color mapping to avoid dynamic Tailwind classes
const colorClasses = {
  blue: {
    bg: 'bg-blue-100',
    text: 'text-blue-600',
    progress: 'bg-blue-600',
  },
  green: {
    bg: 'bg-green-100',
    text: 'text-green-600',
    progress: 'bg-green-600',
  },
};

type ColorKey = keyof typeof colorClasses;

// Status color mapping
const statusColors = {
  active: { bg: 'bg-green-100', text: 'text-green-800' },
  expired: { bg: 'bg-gray-100', text: 'text-gray-800' },
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800' },
};

type StatusKey = keyof typeof statusColors;

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ firstName?: string; lastName?: string; email: string } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mock data 已移除 - 等待 eSIM 插件和支付插件实现
  // 使用订单视角作为替代方案
  const activeESims: never[] = [];
  const paymentMethods: never[] = [];

  useEffect(() => {
    const checkAuth = async () => {
      const isAuth = authApi.isAuthenticated();
      setIsAuthenticated(isAuth);
      if (!isAuth) {
        router.push(`/${locale}/auth/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      // Fetch user info
      try {
        const currentUser = await authApi.getProfile();
        if (currentUser) {
          setUser({
            firstName: currentUser.username?.split(' ')[0] || 'User',
            lastName: currentUser.username?.split(' ')[1] || '',
            email: currentUser.email,
          });
        }
      } catch (error) {
        console.error('Failed to get user:', error);
      }

      // Fetch orders
      try {
        const ordersData = await ordersApi.getOrders();
        setOrders(ordersData.items.slice(0, 3)); // Show only recent 3
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      }

      setIsLoading(false);
    };
    checkAuth();
  }, [locale, router]);

  const handleNavigate = (path: string) => {
    router.push(`/${locale}${path}`);
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
      router.push(`/${locale}`);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const getInitials = () => {
    if (!user) return 'U';
    const first = user.firstName?.[0] || '';
    const last = user.lastName?.[0] || '';
    return (first + last).toUpperCase() || 'U';
  };

  const getStatusColor = (status: string): { bg: string; text: string } => {
    const normalizedStatus = status.toLowerCase() as StatusKey;
    return statusColors[normalizedStatus] || statusColors.pending;
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-tachometer-alt' },
    { id: 'profile', label: 'My Profile', icon: 'fas fa-user' },
    { id: 'esims', label: 'My eSIMs', icon: 'fas fa-sim-card', href: '/orders' },
    { id: 'devices', label: 'My Devices', icon: 'fas fa-mobile-alt' },
    { id: 'orders', label: 'Order History', icon: 'fas fa-shopping-bag', href: '/orders' },
    { id: 'payment', label: 'Payment Methods', icon: 'fas fa-credit-card' },
    { id: 'settings', label: 'Account Settings', icon: 'fas fa-cog' },
    { id: 'support', label: 'Support', icon: 'fas fa-headset', href: '/help' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gray-100 py-2">
          <div className="container mx-auto px-4">
            <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
          </div>
        </div>
        <section className="py-12">
          <div className="container mx-auto px-4">
            <div className="h-8 bg-gray-200 rounded w-48 mb-8 animate-pulse"></div>
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="lg:w-1/4">
                <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                  <div className="h-16 bg-gray-200 rounded mb-4"></div>
                  <div className="space-y-3">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-10 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="lg:w-3/4">
                <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-32 mb-6"></div>
                  <div className="grid grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-32 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-gray-100 py-2">
        <div className="container mx-auto px-4">
          <nav className="flex text-sm">
            <button onClick={() => router.push(`/${locale}`)} className="text-gray-500 hover:text-blue-600">Home</button>
            <span className="mx-2 text-gray-500">/</span>
            <span className="text-gray-800 font-medium">My Profile</span>
          </nav>
        </div>
      </div>

      {/* Profile Section */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          {/* Welcome Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
            <p className="text-gray-600">Welcome back, {user?.firstName || 'User'} {user?.lastName || ''}!</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar Navigation */}
            <div className="lg:w-1/4">
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="p-4 bg-blue-600 text-white">
                  <div className="flex items-center">
                    <div className="h-12 w-12 rounded-full bg-white text-blue-600 flex items-center justify-center font-bold text-xl">
                      {getInitials()}
                    </div>
                    <div className="ml-4">
                      <div className="font-medium">{user?.firstName} {user?.lastName}</div>
                      <div className="text-sm opacity-90">{user?.email}</div>
                    </div>
                  </div>
                </div>

                <nav className="p-4">
                  <ul className="space-y-1">
                    {menuItems.map((item) => (
                      <li key={item.id}>
                        <button
                          onClick={() => item.href ? handleNavigate(item.href) : setActiveTab(item.id)}
                          className={`flex items-center px-4 py-3 w-full text-left rounded-lg transition ${activeTab === item.id
                            ? 'text-blue-600 bg-blue-50 font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                          <i className={`${item.icon} w-5`}></i>
                          <span>{item.label}</span>
                        </button>
                      </li>
                    ))}
                    <li>
                      <button
                        onClick={handleLogout}
                        className="flex items-center px-4 py-3 w-full text-left text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <i className="fas fa-sign-out-alt w-5"></i>
                        <span>Log Out</span>
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:w-3/4">
              {/* Dashboard */}
              <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                <h2 className="text-xl font-semibold mb-6">Dashboard</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  {/* Active eSIMs */}
                  <div className="bg-blue-50 p-6 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-blue-800">Active eSIMs</h3>
                      <i className="fas fa-sim-card text-blue-600 text-xl"></i>
                    </div>
                    <p className="text-3xl font-bold text-blue-800">{activeESims.length}</p>
                    <p className="text-sm text-blue-700 mt-1">View active eSIMs</p>
                  </div>

                  {/* Data Usage */}
                  <div className="bg-green-50 p-6 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-green-800">Data Remaining</h3>
                      <i className="fas fa-wifi text-green-600 text-xl"></i>
                    </div>
                    <p className="text-3xl font-bold text-green-800">7.2 GB</p>
                    <p className="text-sm text-green-700 mt-1">Valid for 8 more days</p>
                  </div>

                  {/* Recent Orders */}
                  <div className="bg-purple-50 p-6 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-purple-800">Recent Orders</h3>
                      <i className="fas fa-shopping-bag text-purple-600 text-xl"></i>
                    </div>
                    <p className="text-3xl font-bold text-purple-800">{orders.length || 0}</p>
                    <p className="text-sm text-purple-700 mt-1">View order history</p>
                  </div>
                </div>

                {/* Quick Actions */}
                <h3 className="text-lg font-medium mb-4">Quick Actions</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <button
                    onClick={() => handleNavigate('/products')}
                    className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
                  >
                    <i className="fas fa-shopping-cart text-blue-600 text-xl mb-2"></i>
                    <span className="text-gray-800">Buy New eSIM</span>
                  </button>

                  <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition">
                    <i className="fas fa-sync-alt text-blue-600 text-xl mb-2"></i>
                    <span className="text-gray-800">Top Up Data</span>
                  </button>

                  <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition">
                    <i className="fas fa-qrcode text-blue-600 text-xl mb-2"></i>
                    <span className="text-gray-800">Scan QR Code</span>
                  </button>

                  <button
                    onClick={() => handleNavigate('/help')}
                    className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
                  >
                    <i className="fas fa-headset text-blue-600 text-xl mb-2"></i>
                    <span className="text-gray-800">Get Support</span>
                  </button>
                </div>
              </div>

              {/* Active eSIMs */}
              <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">My eSIMs</h2>
                  <button
                    onClick={() => handleNavigate('/orders')}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-4">
                  {[
                    { id: 1, name: 'Japan 5GB eSIM', network: 'NTT DoCoMo', used: 2.8, total: 5, days: 8, status: 'active', color: 'blue' as ColorKey },
                    { id: 2, name: 'Europe Unlimited', network: 'Multiple Carriers', used: 12.4, total: 'Unlimited', days: 22, status: 'active', color: 'green' as ColorKey },
                  ].map((esim) => (
                    <div key={esim.id} className="border border-gray-100 rounded-lg overflow-hidden">
                      <div className="flex flex-col md:flex-row">
                        <div className={`md:w-1/3 p-4 ${colorClasses[esim.color].bg}`}>
                          <div className="font-semibold text-gray-800">{esim.name}</div>
                          <div className="text-sm text-gray-600">{esim.network}</div>
                        </div>
                        <div className="md:w-2/3 p-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">Usage</span>
                            <span className="text-sm text-gray-600">{esim.used} GB / {esim.total} {esim.total !== 'Unlimited' && 'GB'}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full mb-2">
                            <div
                              className={`h-2 rounded-full ${colorClasses[esim.color].progress}`}
                              style={{ width: esim.total === 'Unlimited' ? '100%' : `${(esim.used / (esim.total as number)) * 100}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">{esim.days} days remaining</span>
                            <button className="text-sm text-blue-600 font-medium">Manage</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Orders */}
              <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Recent Orders</h2>
                  <button
                    onClick={() => handleNavigate('/orders')}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View All
                  </button>
                </div>

                {orders.length === 0 ? (
                  <div className="text-center py-8">
                    <i className="fas fa-shopping-bag text-4xl text-gray-300 mb-4"></i>
                    <p className="text-gray-500">No orders yet</p>
                    <button
                      onClick={() => handleNavigate('/products')}
                      className="mt-4 text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Browse eSIM Packages
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {orders.map((order) => {
                          const statusColor = getStatusColor(order.status);
                          return (
                            <tr key={order.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">#{order.id.slice(0, 8)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {new Date(order.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${order.totalAmount.toFixed(2)}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor.bg} ${statusColor.text}`}>
                                  {order.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() => handleNavigate(`/orders/${order.id}`)}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <i className="fas fa-eye"></i>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Saved Payment Methods - 隐藏，等待支付插件实现 */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Saved Payment Methods</h2>
                </div>

                <div className="text-center py-8">
                  <i className="fas fa-credit-card text-4xl text-gray-300 mb-4"></i>
                  <p className="text-gray-600 mb-2">支付方式管理功能</p>
                  <p className="text-sm text-gray-500">
                    等待支付插件实现后，您将能够在这里保存和管理您的支付方式。
                    <br />
                    目前每次购买时都需要输入支付信息。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
