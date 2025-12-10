/**
 * 用户设置页面组件
 * 管理用户个人资料、密码和偏好设置
 * Uses @jiffoo/ui design system.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Lock, Globe, User } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { ProfileSettingsPageProps } from '../../../../shared/src/types/theme';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

const inputStyles = cn(
  'w-full px-4 py-3 rounded-xl border border-neutral-200',
  'bg-white text-neutral-900 placeholder:text-neutral-400',
  'focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500',
  'transition-all duration-150'
);

export const ProfileSettingsPage: React.FC<ProfileSettingsPageProps> = ({
  user,
  isLoading,
  isAuthenticated,
  config,
  onSaveProfile,
  onChangePassword,
  onNavigateBack,
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
              <h2 className="text-2xl font-bold text-neutral-900">Access Denied</h2>
              <p className="text-neutral-500">Please log in to access settings.</p>
              <Button onClick={onNavigateToLogin} className="w-full">
                Go to Login
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  // 本地状态
  const [profileData, setProfileData] = useState({
    name: user.name || '',
    phone: user.phone || '',
    dateOfBirth: user.dateOfBirth || '',
    gender: user.gender || '',
    preferredLanguage: user.preferredLanguage || 'en',
    timezone: user.timezone || 'UTC',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // 保存个人资料
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await onSaveProfile({
        name: profileData.name,
        phone: profileData.phone,
        dateOfBirth: profileData.dateOfBirth,
        gender: profileData.gender as 'MALE' | 'FEMALE' | 'OTHER',
        preferredLanguage: profileData.preferredLanguage,
        timezone: profileData.timezone,
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // 修改密码
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    setIsChangingPassword(true);
    try {
      await onChangePassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setShowPasswordForm(false);
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-2xl mx-auto space-y-6"
        >
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateBack}
              className="rounded-xl"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-3xl font-bold text-neutral-900">Account Settings</h1>
          </div>

          {/* Profile Settings Card */}
          <Card className="bg-white rounded-2xl border border-neutral-100 shadow-sm">
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-semibold text-neutral-900 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                  <User className="h-5 w-5 text-brand-600" />
                </div>
                Personal Information
              </h2>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-neutral-700">Full Name</label>
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      className={inputStyles}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-neutral-700">Phone</label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      className={inputStyles}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-neutral-700">Date of Birth</label>
                    <input
                      type="date"
                      value={profileData.dateOfBirth}
                      onChange={(e) => setProfileData({ ...profileData, dateOfBirth: e.target.value })}
                      className={inputStyles}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-neutral-700">Gender</label>
                    <select
                      value={profileData.gender}
                      onChange={(e) => setProfileData({ ...profileData, gender: e.target.value })}
                      className={inputStyles}
                    >
                      <option value="">Select Gender</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-neutral-700">Language</label>
                    <select
                      value={profileData.preferredLanguage}
                      onChange={(e) => setProfileData({ ...profileData, preferredLanguage: e.target.value })}
                      className={inputStyles}
                    >
                      <option value="en">English</option>
                      <option value="zh">中文</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-neutral-700">Timezone</label>
                    <select
                      value={profileData.timezone}
                      onChange={(e) => setProfileData({ ...profileData, timezone: e.target.value })}
                      className={inputStyles}
                    >
                      <option value="UTC">UTC</option>
                      <option value="UTC+8">UTC+8 (China)</option>
                      <option value="UTC-5">UTC-5 (EST)</option>
                      <option value="UTC+1">UTC+1 (CET)</option>
                    </select>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isSavingProfile ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            </div>
          </Card>

          {/* Password Settings Card */}
          <Card className="bg-white rounded-2xl border border-neutral-100 shadow-sm">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-neutral-900 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-warning-50 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-warning-600" />
                  </div>
                  Security
                </h2>
                {!showPasswordForm && (
                  <Button
                    variant="outline"
                    onClick={() => setShowPasswordForm(true)}
                    className="rounded-xl"
                  >
                    Change Password
                  </Button>
                )}
              </div>

              {showPasswordForm && (
                <form onSubmit={handleChangePassword} className="space-y-4 pt-4 border-t border-neutral-100">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-neutral-700">Current Password</label>
                    <input
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      className={inputStyles}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-neutral-700">New Password</label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      className={inputStyles}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-neutral-700">Confirm Password</label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      className={inputStyles}
                      required
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button type="submit" disabled={isChangingPassword}>
                      {isChangingPassword ? 'Updating...' : 'Update Password'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowPasswordForm(false)}
                      className="rounded-xl"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default ProfileSettingsPage;

