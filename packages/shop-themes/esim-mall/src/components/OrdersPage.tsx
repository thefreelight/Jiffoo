/**
 * Orders Page — TravelPass Design (my-trips.html)
 * eSIM orders with tabs (Active/Upcoming/Expired/All),
 * data usage bars, QR/TopUp buttons, and help section.
 */

import React, { useState } from 'react';
import { cn } from '../lib/utils';
import type { OrdersPageProps } from '../types';

type TabKey = 'active' | 'upcoming' | 'expired' | 'all';

export const OrdersPage = React.memo(function OrdersPage({
  orders,
  isLoading,
  error,
  currentPage,
  totalPages,
  config,
  onPageChange,
  onOrderClick,
  onCancelOrder,
  t,
}: OrdersPageProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  // Filter orders by tab
  const filterOrders = (tab: TabKey) => {
    switch (tab) {
      case 'active':
        return orders.filter((o) => ['PROCESSING', 'SHIPPED', 'DELIVERED', 'PAID'].includes(o.status));
      case 'upcoming':
        return orders.filter((o) => o.status === 'PENDING');
      case 'expired':
        return orders.filter((o) => ['COMPLETED', 'CANCELLED'].includes(o.status));
      default:
        return orders;
    }
  };

  const filteredOrders = filterOrders(activeTab);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'active', label: `Active (${filterOrders('active').length})` },
    { key: 'upcoming', label: `Upcoming (${filterOrders('upcoming').length})` },
    { key: 'expired', label: `Expired (${filterOrders('expired').length})` },
    { key: 'all', label: `All (${orders.length})` },
  ];

  const statusBadge: Record<string, string> = {
    PENDING: 'text-yellow-600',
    PROCESSING: 'text-blue-600',
    SHIPPED: 'text-purple-600',
    DELIVERED: 'text-green-600',
    COMPLETED: 'text-gray-600',
    CANCELLED: 'text-red-600',
    PAID: 'text-green-600',
  };

  // Illustrative region icons for eSIM cards
  const regionIcons = ['fas fa-globe-americas', 'fas fa-globe-europe', 'fas fa-globe-asia', 'fas fa-globe-africa'];
  const regionColors = ['bg-blue-100 text-blue-600', 'bg-green-100 text-green-600', 'bg-purple-100 text-purple-600', 'bg-yellow-100 text-yellow-600'];
  const bgColors = ['bg-blue-50', 'bg-green-50', 'bg-purple-50', 'bg-yellow-50'];
  const barColors = ['bg-blue-600', 'bg-green-600', 'bg-purple-600', 'bg-yellow-600'];

  if (isLoading) return <div className="min-h-screen bg-gray-50" />;

  // Error
  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50 pt-20">
        <div className="text-center">
          <i className="fas fa-exclamation-triangle text-red-500 text-5xl mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Something went wrong</h2>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-gray-100 pt-20 pb-2">
        <div className="container mx-auto px-4">
          <nav className="flex text-sm">
            <span className="text-gray-500">Home</span>
            <span className="mx-2 text-gray-500">/</span>
            <span className="text-gray-500">My Account</span>
            <span className="mx-2 text-gray-500">/</span>
            <span className="text-gray-800 font-medium">My eSIMs</span>
          </nav>
        </div>
      </div>

      <section className="py-12">
        <div className="container mx-auto px-4">
          {/* Title + Buy Button */}
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800">
              {getText('travelpass.orders.title', 'My eSIMs')}
            </h1>
            <button className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition flex items-center">
              <i className="fas fa-plus mr-2" />
              Buy New eSIM
            </button>
          </div>

          {/* Tabs */}
          <div className="mb-8 border-b border-gray-200">
            <nav className="flex -mb-px">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'py-4 px-6 border-b-2 font-medium transition-colors',
                    activeTab === tab.key
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Empty state */}
          {filteredOrders.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-lg shadow-sm border border-gray-200">
              <i className="fas fa-sim-card text-gray-300 text-5xl mb-4" />
              <h2 className="text-xl font-semibold text-gray-800 mb-2">No eSIMs Found</h2>
              <p className="text-gray-500 mb-6">You don&apos;t have any eSIMs in this category yet.</p>
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-6 py-3 transition-colors">
                Browse Packages
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {filteredOrders.map((order, idx) => {
                const colorIdx = idx % regionColors.length;
                // Illustrative usage data
                const usedGB = ((idx * 2.3 + 1.5) % 8).toFixed(1);
                const totalGB = [5, 10, 15, 20][colorIdx];
                const usagePercent = Math.min(100, Math.round((parseFloat(usedGB) / totalGB) * 100));
                const daysRemaining = Math.max(1, 30 - idx * 7);
                const firstItemName = order.items?.[0]?.productName || 'eSIM Package';
                const isActive = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'PAID'].includes(order.status);

                return (
                  <div key={order.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <div className="flex flex-col lg:flex-row">
                      {/* Left panel — Info */}
                      <div className={cn('lg:w-1/3 xl:w-1/4 p-6 flex flex-col', bgColors[colorIdx])}>
                        <div className="mb-4 flex-grow">
                          <h2 className="text-xl font-semibold text-gray-800 mb-1">{firstItemName}</h2>
                          <p className="text-gray-600 text-sm">Order #{order.id.slice(0, 8)}</p>
                          <div className="flex items-center mt-2">
                            <i className={cn(regionIcons[colorIdx], barColors[colorIdx].replace('bg-', 'text-'), 'mr-2')} />
                            <span className="text-gray-600 text-sm">${order.totalAmount.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Ordered:</span>
                            <span className="font-medium">{new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Status:</span>
                            <span className={cn('font-medium', statusBadge[order.status] || 'text-gray-600')}>
                              {order.status === 'DELIVERED' || order.status === 'PAID' ? 'Active' : order.status === 'PENDING' ? 'Upcoming' : order.status === 'COMPLETED' || order.status === 'CANCELLED' ? order.status.charAt(0) + order.status.slice(1).toLowerCase() : order.status.charAt(0) + order.status.slice(1).toLowerCase()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right panel — Usage & Actions */}
                      <div className="lg:w-2/3 xl:w-3/4 p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
                          <div className="mb-4 md:mb-0">
                            <h3 className="font-medium mb-1">Data Usage</h3>
                            <div className="flex items-center">
                              <span className="text-2xl font-bold text-gray-800">{usedGB} GB</span>
                              <span className="text-gray-600 ml-2">/ {totalGB} GB</span>
                            </div>
                            {isActive && (
                              <p className="text-sm text-gray-600 mt-1">{daysRemaining} days remaining</p>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {isActive && (
                              <button className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors text-sm">
                                <i className="fas fa-sync-alt mr-1" /> Top Up Data
                              </button>
                            )}
                            <button
                              onClick={() => onOrderClick(order.id)}
                              className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 py-2 px-4 rounded-md transition text-sm"
                            >
                              <i className="fas fa-qrcode mr-1" /> Show QR Code
                            </button>
                          </div>
                        </div>

                        {/* Usage bar */}
                        <div className="mb-6">
                          <div className="h-2 w-full bg-gray-200 rounded-full">
                            <div
                              className={cn('h-2 rounded-full', barColors[colorIdx])}
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-1 text-xs text-gray-500">
                            <span>0 GB</span>
                            <span>{totalGB} GB</span>
                          </div>
                        </div>

                        {/* Info cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center mb-1">
                              <i className={cn('fas fa-wifi mr-2', barColors[colorIdx].replace('bg-', 'text-'))} />
                              <h4 className="font-medium text-sm">Speed</h4>
                            </div>
                            <p className="text-gray-600 text-sm">4G/5G High-Speed</p>
                          </div>
                          <div className="border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center mb-1">
                              <i className={cn('fas fa-signal mr-2', barColors[colorIdx].replace('bg-', 'text-'))} />
                              <h4 className="font-medium text-sm">Network</h4>
                            </div>
                            <p className="text-gray-600 text-sm">Major Carriers</p>
                          </div>
                          <div className="border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center mb-1">
                              <i className="fas fa-phone-alt mr-2 text-blue-600" />
                              <h4 className="font-medium text-sm">Support</h4>
                            </div>
                            <p className="text-gray-600 text-sm">24/7 Available</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Tabs */}
                    <div className="bg-gray-50 px-6 py-3 flex items-center flex-wrap gap-4 text-sm">
                      <button onClick={() => onOrderClick(order.id)} className="text-blue-600 font-medium hover:text-blue-800 transition-colors">
                        <i className="fas fa-cog mr-1" /> Manage Settings
                      </button>
                      <button className="text-blue-600 font-medium hover:text-blue-800 transition-colors">
                        <i className="fas fa-info-circle mr-1" /> Device Instructions
                      </button>
                      <button className="text-blue-600 font-medium hover:text-blue-800 transition-colors">
                        <i className="fas fa-headset mr-1" /> Get Support
                      </button>
                      <button className="text-blue-600 font-medium hover:text-blue-800 transition-colors">
                        <i className="fas fa-file-alt mr-1" /> View Receipt
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <nav className="flex items-center gap-1">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => onPageChange(currentPage - 1)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    currentPage <= 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-200',
                  )}
                >
                  &laquo; Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                  Math.max(0, currentPage - 3),
                  Math.min(totalPages, currentPage + 2),
                ).map((page) => (
                  <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={cn(
                      'min-w-[40px] px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      currentPage === page ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200',
                    )}
                  >
                    {page}
                  </button>
                ))}
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => onPageChange(currentPage + 1)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    currentPage >= totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-200',
                  )}
                >
                  Next &raquo;
                </button>
              </nav>
            </div>
          )}

          {/* Help Section */}
          <div className="mt-12 bg-blue-50 rounded-lg p-6">
            <div className="flex flex-col md:flex-row md:items-center">
              <div className="mb-6 md:mb-0 md:mr-6 md:w-2/3">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Need help with your eSIM?</h2>
                <p className="text-gray-600 mb-4">Our support team is available 24/7 to help you with any issues regarding your eSIM activation, data usage, or technical problems.</p>
                <div className="flex flex-wrap gap-4">
                  <button className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors">
                    <i className="fas fa-headset mr-2" />
                    Contact Support
                  </button>
                  <button className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 py-2 px-4 rounded-md transition-colors">
                    <i className="fas fa-book mr-2" />
                    View FAQ
                  </button>
                </div>
              </div>
              <div className="md:w-1/3 flex justify-center">
                <img src="https://cdn-icons-png.flaticon.com/512/3932/3932768.png" alt="eSIM Support" className="h-40" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
});
