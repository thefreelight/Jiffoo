/**
 * Profile Settings Page — TravelPass Design
 * Account settings with form styling, FA icons, and plain Tailwind.
 */

import React, { useState } from 'react';
import { cn } from '../lib/utils';
import type { ProfileSettingsPageProps } from '../types';

export const ProfileSettingsPage = React.memo(function ProfileSettingsPage({
  user,
  isLoading,
  isAuthenticated,
  config,
  onSaveProfile,
  onChangePassword,
  onNavigateBack,
  onNavigateToLogin,
  t,
}: ProfileSettingsPageProps) {
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    dateOfBirth: user?.dateOfBirth || '',
    gender: user?.gender || '' as string,
    preferredLanguage: user?.preferredLanguage || 'en',
    timezone: user?.timezone || 'UTC',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  if (isLoading) return <div className="min-h-screen bg-gray-50" />;

  if (!isAuthenticated || !user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="text-center">
          <i className="fas fa-user-lock text-gray-400 text-5xl mb-4" />
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Sign In Required</h2>
          <p className="text-gray-600 mb-6">Please sign in to access settings.</p>
          <button onClick={onNavigateToLogin} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md px-6 py-3 transition-colors">
            <i className="fas fa-sign-in-alt mr-2" />Sign In
          </button>
        </div>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await onSaveProfile({
        name: profileData.name,
        phone: profileData.phone,
        dateOfBirth: profileData.dateOfBirth || undefined,
        gender: (profileData.gender as 'MALE' | 'FEMALE' | 'OTHER') || undefined,
        preferredLanguage: profileData.preferredLanguage,
        timezone: profileData.timezone,
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) return;
    if (passwordData.newPassword.length < 6) return;
    try {
      setChangingPassword(true);
      await onChangePassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordChanged(true);
      setTimeout(() => setPasswordChanged(false), 3000);
    } catch (err) {
      console.error('Failed to change password:', err);
    } finally {
      setChangingPassword(false);
    }
  };

  const inputStyles = 'w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-gray-100 pt-20 pb-2">
        <div className="container mx-auto px-4">
          <nav className="flex items-center gap-2 text-sm text-gray-600">
            <button onClick={onNavigateBack} className="text-gray-500 hover:text-blue-600 transition-colors">My Account</button>
            <span>/</span>
            <span className="text-gray-900 font-medium">Settings</span>
          </nav>
        </div>
      </div>

      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  <i className="fas fa-cog mr-3 text-blue-600" />
                  Account Settings
                </h1>
                <p className="text-gray-600 mt-1">Manage your profile and account preferences</p>
              </div>
              <button
                onClick={onNavigateBack}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                <i className="fas fa-arrow-left mr-2" />Back
              </button>
            </div>

            {/* Profile Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-6">
                <i className="fas fa-user mr-2 text-blue-600" />
                Profile Information
              </h2>

              {profileSaved && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                  <i className="fas fa-check-circle mr-2" />Profile saved successfully!
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => setProfileData((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Your full name"
                      className={inputStyles}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={user.email} disabled className={cn(inputStyles, 'bg-gray-50 text-gray-500 cursor-not-allowed')} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="+1 (555) 000-0000"
                      className={inputStyles}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={profileData.dateOfBirth}
                      onChange={(e) => setProfileData((p) => ({ ...p, dateOfBirth: e.target.value }))}
                      className={inputStyles}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                    <select
                      value={profileData.gender}
                      onChange={(e) => setProfileData((p) => ({ ...p, gender: e.target.value }))}
                      className={inputStyles}
                    >
                      <option value="">Prefer not to say</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                    <select
                      value={profileData.preferredLanguage}
                      onChange={(e) => setProfileData((p) => ({ ...p, preferredLanguage: e.target.value }))}
                      className={inputStyles}
                    >
                      <option value="en">English</option>
                      <option value="zh">Chinese</option>
                      <option value="ja">Japanese</option>
                      <option value="ko">Korean</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                  <select
                    value={profileData.timezone}
                    onChange={(e) => setProfileData((p) => ({ ...p, timezone: e.target.value }))}
                    className={inputStyles}
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="Asia/Tokyo">Japan Standard Time</option>
                    <option value="Asia/Shanghai">China Standard Time</option>
                    <option value="Europe/London">GMT</option>
                    <option value="Europe/Paris">Central European Time</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className={cn(
                    'py-3 px-6 rounded-md font-semibold text-white transition-colors',
                    saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700',
                  )}
                >
                  {saving ? (
                    <><i className="fas fa-spinner fa-spin mr-2" />Saving...</>
                  ) : (
                    <><i className="fas fa-save mr-2" />Save Changes</>
                  )}
                </button>
              </form>
            </div>

            {/* Change Password */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-6">
                <i className="fas fa-lock mr-2 text-blue-600" />
                Change Password
              </h2>

              {passwordChanged && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                  <i className="fas fa-check-circle mr-2" />Password changed successfully!
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData((p) => ({ ...p, currentPassword: e.target.value }))}
                    placeholder="Enter current password"
                    className={inputStyles}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData((p) => ({ ...p, newPassword: e.target.value }))}
                      placeholder="Enter new password"
                      className={inputStyles}
                      required
                      minLength={6}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData((p) => ({ ...p, confirmPassword: e.target.value }))}
                      placeholder="Confirm new password"
                      className={inputStyles}
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                {passwordData.newPassword && passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                  <p className="text-sm text-red-600">
                    <i className="fas fa-exclamation-circle mr-1" />Passwords do not match
                  </p>
                )}

                <button
                  type="submit"
                  disabled={changingPassword || !passwordData.currentPassword || !passwordData.newPassword || passwordData.newPassword !== passwordData.confirmPassword}
                  className={cn(
                    'py-3 px-6 rounded-md font-semibold text-white transition-colors',
                    changingPassword || !passwordData.currentPassword || !passwordData.newPassword || passwordData.newPassword !== passwordData.confirmPassword
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700',
                  )}
                >
                  {changingPassword ? (
                    <><i className="fas fa-spinner fa-spin mr-2" />Changing...</>
                  ) : (
                    <><i className="fas fa-lock mr-2" />Change Password</>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
});
