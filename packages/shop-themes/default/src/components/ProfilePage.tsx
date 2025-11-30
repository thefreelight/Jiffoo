/**
 * 用户个人资料页面组件
 * 显示用户基本信息和快速操作
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
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="w-full max-w-md">
            <div className="p-8 text-center space-y-6">
              <div className="flex justify-center">
                <div className="p-3 bg-primary/10 rounded-full">
                  <User className="w-8 h-8 text-primary" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
                <p className="text-muted-foreground">
                  Please log in to view your profile.
                </p>
              </div>
              <Button
                onClick={onNavigateToLogin}
                className="w-full"
              >
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  // 获取用户首字母
  const userInitial = user.name?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-4xl mx-auto space-y-6"
        >
          {/* Profile Header Card */}
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-8">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-24 h-24 rounded-full object-cover border-4 border-background shadow-lg"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary border-4 border-background shadow-lg">
                      {userInitial}
                    </div>
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-2">{user.name}</h1>
                  <p className="text-muted-foreground mb-4">{user.email}</p>
                  <p className="text-sm text-muted-foreground">
                    Member since {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Action Button */}
                <Button
                  onClick={onNavigateToSettings}
                  variant="outline"
                  className="flex items-center gap-2"
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
              <Card className="h-full cursor-pointer hover:shadow-lg transition-shadow" onClick={onNavigateToOrders}>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Order History</h3>
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <ShoppingBag className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    View and manage your orders
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={(e) => {
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
              <Card className="h-full cursor-pointer hover:shadow-lg transition-shadow" onClick={onNavigateToSettings}>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Account Settings</h3>
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Settings className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Manage your account preferences
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={(e) => {
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
          <Card>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold">Account Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Email Address</p>
                  <p className="font-medium">{user.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Member Since</p>
                  <p className="font-medium">
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

