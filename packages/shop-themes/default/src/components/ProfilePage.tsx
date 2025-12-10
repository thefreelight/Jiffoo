/**
 * 用户个人资料页面组件
 * 显示用户基本信息和快速操作
 * Uses @jiffoo/ui design system.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { User, Settings, ShoppingBag, LogOut } from 'lucide-react';
import type { ProfilePageProps } from '../../../../shared/src/types/theme';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export const ProfilePage: React.FC<ProfilePageProps> = ({
  user,
  isLoading,
  isAuthenticated,
  config,
  onNavigateToSettings,
  onNavigateToOrders,
  onNavigateToLogin,
}) => {
  // 未认证状态
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="w-full max-w-md bg-white rounded-2xl border border-neutral-100 shadow-sm">
            <div className="p-8 text-center space-y-6">
              <div className="flex justify-center">
                <div className="p-4 bg-brand-50 rounded-2xl">
                  <User className="w-8 h-8 text-brand-600" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2 text-neutral-900">Access Denied</h2>
                <p className="text-neutral-500">
                  Please log in to view your profile.
                </p>
              </div>
              <Button onClick={onNavigateToLogin} className="w-full">
                Go to Login
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  // 加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin mx-auto" />
          <p className="text-neutral-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  // 获取用户首字母
  const userInitial = user.name?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-4xl mx-auto space-y-6"
        >
          {/* Profile Header Card */}
          <Card className="overflow-hidden bg-white rounded-2xl border border-neutral-100 shadow-sm">
            <div className="bg-gradient-to-r from-brand-50 via-brand-25 to-transparent p-8">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-brand-sm"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-brand-100 flex items-center justify-center text-3xl font-bold text-brand-600 border-4 border-white shadow-brand-sm">
                      {userInitial}
                    </div>
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-2 text-neutral-900">{user.name}</h1>
                  <p className="text-neutral-500 mb-4">{user.email}</p>
                  <p className="text-sm text-neutral-400">
                    Member since {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Action Button */}
                <Button
                  onClick={onNavigateToSettings}
                  variant="outline"
                  className="flex items-center gap-2 rounded-xl"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Button>
              </div>
            </div>
          </Card>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Orders Card */}
            <motion.div
              whileHover={{ translateY: -4 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="h-full cursor-pointer bg-white rounded-2xl border border-neutral-100 shadow-sm hover:shadow-brand-sm transition-all" onClick={onNavigateToOrders}>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-neutral-900">Order History</h3>
                    <div className="p-2.5 bg-brand-50 rounded-xl">
                      <ShoppingBag className="w-5 h-5 text-brand-600" />
                    </div>
                  </div>
                  <p className="text-neutral-500 text-sm">View and manage your orders</p>
                  <Button
                    variant="outline"
                    className="w-full rounded-xl"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onNavigateToOrders();
                    }}
                  >
                    View Orders
                  </Button>
                </div>
              </Card>
            </motion.div>

            {/* Settings Card */}
            <motion.div
              whileHover={{ translateY: -4 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="h-full cursor-pointer bg-white rounded-2xl border border-neutral-100 shadow-sm hover:shadow-brand-sm transition-all" onClick={onNavigateToSettings}>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-neutral-900">Account Settings</h3>
                    <div className="p-2.5 bg-brand-50 rounded-xl">
                      <Settings className="w-5 h-5 text-brand-600" />
                    </div>
                  </div>
                  <p className="text-neutral-500 text-sm">Manage your account preferences</p>
                  <Button
                    variant="outline"
                    className="w-full rounded-xl"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onNavigateToSettings();
                    }}
                  >
                    Go to Settings
                  </Button>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Account Info Card */}
          <Card className="bg-white rounded-2xl border border-neutral-100 shadow-sm">
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-neutral-900">Account Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-neutral-400 mb-1">Email Address</p>
                  <p className="font-medium text-neutral-900">{user.email}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-400 mb-1">Member Since</p>
                  <p className="font-medium text-neutral-900">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default ProfilePage;

