/**
 * User Profile Page Component - Admin Style Design
 */

import React from 'react';
import { User, ShoppingBag } from 'lucide-react';
import type { ProfilePageProps } from '../../../../shared/src/types/theme';

export const ProfilePage = React.memo(function ProfilePage({
  user,
  isLoading,
  isAuthenticated,
  config,
  onNavigateToSettings,
  onNavigateToOrders,
  onNavigateToLogin,
}: ProfilePageProps) {
  // Unauthenticated state
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm p-8 sm:p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <User className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="space-y-3 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Access Denied</h2>
              <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                PLEASE LOG IN TO VIEW YOUR PROFILE
              </p>
            </div>
            <button
              onClick={onNavigateToLogin}
              className="w-full h-12 rounded-xl font-semibold text-sm shadow-md shadow-blue-100 dark:shadow-none bg-blue-600 hover:bg-blue-700 text-white transition-all"
            >
              GO TO LOGIN
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-100 dark:border-slate-700 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">LOADING PROFILE...</p>
        </div>
      </div>
    );
  }

  // Get user initial
  const userInitial = user.name?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
          {/* Profile Header Card */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="h-24 sm:h-32 bg-gray-50 dark:bg-slate-700 border-b border-gray-100 dark:border-slate-600" />
            <div className="px-6 sm:px-8 pb-6 sm:pb-8 flex flex-col sm:flex-row items-end gap-6 sm:gap-8 -mt-12 sm:-mt-16 relative z-10">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-white dark:bg-slate-800 p-1 shadow-xl ring-1 ring-gray-100 dark:ring-slate-700 flex-shrink-0">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <div className="w-full h-full bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-3xl sm:text-4xl font-bold text-blue-600 dark:text-blue-400">
                    {userInitial}
                  </div>
                )}
              </div>

              <div className="flex-1 pb-2 space-y-3 text-center sm:text-left">
                <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight leading-none">
                    {user.name}
                  </h1>
                  <span className="bg-gray-900 dark:bg-slate-700 text-white text-[10px] font-bold uppercase tracking-widest h-5 px-3 rounded-full flex items-center">
                    MEMBER
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest justify-center sm:justify-start">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-blue-500 rounded-full" />
                    {user.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-blue-500 rounded-full" />
                    JOINED {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 gap-6">
            {/* Orders Card */}
            <div
              onClick={onNavigateToOrders}
              className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm p-6 sm:p-8 cursor-pointer hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                    <ShoppingBag className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-3 w-0.5 bg-blue-600 rounded-full" />
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">ORDERS</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Order History</h3>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                View and manage your orders
              </p>
              <button
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onNavigateToOrders();
                }}
                className="w-full h-11 rounded-xl border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold text-sm text-gray-700 dark:text-gray-300 transition-all uppercase tracking-wider"
              >
                VIEW ORDERS
              </button>
            </div>
          </div>

          {/* Account Info Card */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-4 w-1 bg-blue-600 rounded-full" />
              <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">ACCOUNT INFORMATION</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">EMAIL ADDRESS</p>
                <p className="font-bold text-gray-900 dark:text-white">{user.email}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">MEMBER SINCE</p>
                <p className="font-bold text-gray-900 dark:text-white">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ProfilePage;
