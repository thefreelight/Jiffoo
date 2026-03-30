/**
 * Profile Page — TravelPass Design (account.html)
 * 2-column layout: sidebar nav + main dashboard with stat cards,
 * quick actions, active eSIMs with usage bars, recent orders, payment methods.
 */

import React from 'react';
import { cn } from '../lib/utils';
import type { ProfilePageProps } from '../types';

export const ProfilePage = React.memo(function ProfilePage({
  user,
  isLoading,
  isAuthenticated,
  config,
  onNavigateToSettings,
  onNavigateToOrders,
  onNavigateToLogin,
  t,
}: ProfilePageProps) {
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  if (isLoading) return <div className="min-h-screen bg-gray-50" />;

  // Not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="text-center">
          <i className="fas fa-user-lock text-gray-400 text-5xl mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Sign In Required</h2>
          <p className="text-gray-500 mb-6">Please sign in to access your account.</p>
          <button
            onClick={onNavigateToLogin}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-6 py-3 transition-colors"
          >
            <i className="fas fa-sign-in-alt mr-2" />
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // User initials for avatar
  const initials = user.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email[0].toUpperCase();

  // Illustrative data (backend doesn't provide eSIM-specific data via ProfilePageProps)
  const activeEsims = [
    { name: 'Japan 5GB eSIM', network: 'NTT DoCoMo', region: 'Asia', regionIcon: 'fas fa-globe-asia', color: 'blue', usedGB: 2.8, totalGB: 5, daysLeft: 8, expiresDate: 'Apr 10, 2025' },
    { name: 'Europe Unlimited eSIM', network: 'Multiple Networks', region: 'Europe', regionIcon: 'fas fa-globe-europe', color: 'green', usedGB: 12.4, totalGB: 0, daysLeft: 22, expiresDate: 'Apr 24, 2025' },
  ];

  const recentOrders = [
    { id: '#TP-7890', date: 'Mar 28, 2025', product: 'Japan 5GB eSIM', amount: '$24.99', status: 'Active', statusColor: 'bg-green-100 text-green-800' },
    { id: '#TP-7889', date: 'Mar 25, 2025', product: 'Europe Unlimited eSIM', amount: '$39.99', status: 'Active', statusColor: 'bg-green-100 text-green-800' },
    { id: '#TP-7836', date: 'Feb 12, 2025', product: 'Thailand 3GB eSIM', amount: '$12.99', status: 'Expired', statusColor: 'bg-gray-100 text-gray-800' },
  ];

  const paymentMethods = [
    { type: 'Visa', icon: 'fab fa-cc-visa', iconColor: 'text-blue-800', last4: '4582', expires: '09/2025' },
    { type: 'Mastercard', icon: 'fab fa-cc-mastercard', iconColor: 'text-red-600', last4: '1234', expires: '11/2024' },
  ];

  const sidebarItems = [
    { icon: 'fas fa-tachometer-alt', label: 'Dashboard', active: true },
    { icon: 'fas fa-user', label: 'My Profile', onClick: onNavigateToSettings },
    { icon: 'fas fa-suitcase-rolling', label: 'My eSIMs', onClick: onNavigateToOrders },
    { icon: 'fas fa-shopping-bag', label: 'Order History', onClick: onNavigateToOrders },
    { icon: 'fas fa-credit-card', label: 'Payment Methods' },
    { icon: 'fas fa-mobile-alt', label: 'My Devices' },
    { icon: 'fas fa-cog', label: 'Account Settings', onClick: onNavigateToSettings },
    { icon: 'fas fa-headset', label: 'Support' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-gray-100 pt-20 pb-2">
        <div className="container mx-auto px-4">
          <nav className="flex text-sm">
            <span className="text-gray-500">Home</span>
            <span className="mx-2 text-gray-500">/</span>
            <span className="text-gray-800 font-medium">My Account</span>
          </nav>
        </div>
      </div>

      <section className="py-12">
        <div className="container mx-auto px-4">
          {/* Welcome */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-800">My Account</h1>
            <p className="text-gray-600">Welcome back, {user.name || user.email}!</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar */}
            <div className="lg:w-1/4">
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {/* Blue header with avatar */}
                <div className="p-4 bg-blue-600 text-white">
                  <div className="flex items-center">
                    <div className="h-12 w-12 rounded-full bg-white text-blue-600 flex items-center justify-center font-bold text-xl">
                      {initials}
                    </div>
                    <div className="ml-4">
                      <div className="font-medium">{user.name || 'User'}</div>
                      <div className="text-sm opacity-90">{user.email}</div>
                    </div>
                  </div>
                </div>

                {/* Nav */}
                <nav className="p-4">
                  <ul className="space-y-1">
                    {sidebarItems.map((item) => (
                      <li key={item.label}>
                        <button
                          onClick={item.onClick}
                          className={cn(
                            'flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm transition-colors',
                            item.active
                              ? 'text-blue-600 bg-blue-50 font-medium'
                              : 'text-gray-700 hover:bg-gray-50',
                          )}
                        >
                          <i className={cn(item.icon, 'w-5 text-center')} />
                          <span>{item.label}</span>
                        </button>
                      </li>
                    ))}
                    <li>
                      <button className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors">
                        <i className="fas fa-sign-out-alt w-5 text-center" />
                        <span>Log Out</span>
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:w-3/4 space-y-8">
              {/* Dashboard — Stat Cards */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-6">Dashboard</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-blue-50 p-6 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-blue-800">Active eSIMs</h3>
                      <i className="fas fa-sim-card text-blue-600 text-xl" />
                    </div>
                    <p className="text-3xl font-bold text-blue-800">2</p>
                    <p className="text-sm text-blue-700 mt-1">View active eSIMs</p>
                  </div>

                  <div className="bg-green-50 p-6 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-green-800">Data Remaining</h3>
                      <i className="fas fa-wifi text-green-600 text-xl" />
                    </div>
                    <p className="text-3xl font-bold text-green-800">7.2 GB</p>
                    <p className="text-sm text-green-700 mt-1">Valid for 8 more days</p>
                  </div>

                  <div className="bg-purple-50 p-6 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-purple-800">Recent Orders</h3>
                      <i className="fas fa-shopping-bag text-purple-600 text-xl" />
                    </div>
                    <p className="text-3xl font-bold text-purple-800">3</p>
                    <p className="text-sm text-purple-700 mt-1">View order history</p>
                  </div>
                </div>

                {/* Quick Actions */}
                <h3 className="text-lg font-medium mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { icon: 'fas fa-shopping-cart', label: 'Buy New eSIM' },
                    { icon: 'fas fa-sync-alt', label: 'Top Up Data' },
                    { icon: 'fas fa-qrcode', label: 'Scan QR Code' },
                    { icon: 'fas fa-headset', label: 'Get Support' },
                  ].map((action) => (
                    <button
                      key={action.label}
                      className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                    >
                      <i className={cn(action.icon, 'text-blue-600 text-xl mb-2')} />
                      <span className="text-gray-800 text-sm">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Active eSIMs */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Active eSIMs</h2>
                  <button onClick={onNavigateToOrders} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                    View All
                  </button>
                </div>

                <div className="space-y-6">
                  {activeEsims.map((esim) => {
                    const isUnlimited = esim.totalGB === 0;
                    const usagePercent = isUnlimited ? 100 : Math.round((esim.usedGB / esim.totalGB) * 100);
                    const barColor = esim.color === 'blue' ? 'bg-blue-600' : 'bg-green-600';
                    const iconBg = esim.color === 'blue' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600';

                    return (
                      <div key={esim.name} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between">
                          <div className="flex items-center mb-4 md:mb-0">
                            <div className={cn('h-12 w-12 rounded-full flex items-center justify-center mr-4', iconBg)}>
                              <i className={esim.regionIcon} />
                            </div>
                            <div>
                              <h3 className="font-medium">{esim.name}</h3>
                              <p className="text-sm text-gray-600">Expires in {esim.daysLeft} days ({esim.expiresDate})</p>
                            </div>
                          </div>

                          <div className="flex flex-col md:flex-row md:items-center gap-3">
                            <div className="flex-1 min-w-[150px]">
                              <div className="flex justify-between mb-1 text-sm">
                                <span className="text-gray-600">Data Usage</span>
                                <span className="font-medium">
                                  {esim.usedGB}GB / {isUnlimited ? 'Unlimited' : `${esim.totalGB}GB`}
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className={cn('h-2 rounded-full', barColor)} style={{ width: `${usagePercent}%` }} />
                              </div>
                            </div>
                            <button onClick={onNavigateToOrders} className="text-blue-600 hover:text-blue-800 whitespace-nowrap text-sm">
                              <i className="fas fa-cog mr-1" /> Manage
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Orders */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Recent Orders</h2>
                  <button onClick={onNavigateToOrders} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                    View All
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {recentOrders.map((order) => (
                        <tr key={order.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.id}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.date}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.product}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.amount}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={cn('px-2 inline-flex text-xs leading-5 font-semibold rounded-full', order.statusColor)}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button className="text-blue-600 hover:text-blue-800">
                              <i className="fas fa-download" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Saved Payment Methods */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Saved Payment Methods</h2>
                  <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">Add New Card</button>
                </div>

                <div className="space-y-4">
                  {paymentMethods.map((pm) => (
                    <div key={pm.last4} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <i className={cn(pm.icon, 'text-2xl mr-4', pm.iconColor)} />
                          <div>
                            <h3 className="font-medium">{pm.type} ending in {pm.last4}</h3>
                            <p className="text-sm text-gray-600">Expires {pm.expires}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button className="text-gray-600 hover:text-blue-600 transition-colors">
                            <i className="fas fa-pencil-alt" />
                          </button>
                          <button className="text-gray-600 hover:text-red-600 transition-colors">
                            <i className="fas fa-trash-alt" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
});
