/**
 * User Settings Page Component
 * Hardcore digital network infrastructure style
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Lock, Terminal, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ProfileSettingsPageProps } from '../types';
import { Button } from '../ui/Button';

const inputStyles = cn(
  'w-full px-4 py-3 border border-[#2a2a2a]',
  'bg-[#0f0f0f] text-[#eaeaea] placeholder:text-[#bdbdbd] placeholder:opacity-30',
  'focus:outline-none focus:border-[var(--c-eae)] focus:ring-1 focus:ring-[var(--c-eae)]',
  'transition-all duration-150 font-mono text-sm'
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
  // Unauthenticated state
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-[#bdbdbd] flex items-center justify-center px-4 font-mono">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          <div className="p-8 text-center border border-[#2a2a2a] bg-[#1c1c1c] relative overflow-hidden">
            <h2 className="text-xl font-bold mb-2 text-[#eaeaea] uppercase tracking-widest text-[#bdbdbd]">ACCESS_DENIED</h2>
            <p className="text-xs text-[#bdbdbd] mb-8 uppercase">
              AUTHENTICATION REQUIRED TO MODIFY SYS_PARAMETERS.
            </p>
            <Button onClick={onNavigateToLogin} className="w-full bg-[#1c1c1c] hover:bg-[#1c1c1c] text-[#bdbdbd] hover:text-[#eaeaea] border-[#2a2a2a]">
              SECURE_LOGIN
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Local state
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

  // Save profile
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

  // Change password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('HASH_MISMATCH: Passwords do not match');
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
    <div className="min-h-screen bg-[#0f0f0f] text-[#bdbdbd] font-mono">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-3xl mx-auto space-y-6"
        >
          {/* Header */}
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-[#2a2a2a]">
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateBack}
              className="hover:bg-[#1c1c1c] hover:text-[#eaeaea]"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              BACK
            </Button>
            <h1 className="text-xl md:text-2xl font-bold text-[#eaeaea] uppercase tracking-widest flex items-center gap-3">
              <Terminal className="w-6 h-6" />
              SYS_CONFIGURATION
            </h1>
          </div>

          {/* Profile Settings Card */}
          <div className="bg-[#1c1c1c] border border-[#2a2a2a] p-6 md:p-8 relative">
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[var(--c-eae)] -mt-px -mr-px"></div>
            <div className="space-y-8">
              <h2 className="text-sm font-bold text-[#eaeaea] flex items-center gap-3 uppercase tracking-widest border-b border-[#2a2a2a] pb-4">
                <span className="w-2 h-2 bg-[var(--c-eae)] animate-pulse inline-block"></span>
                METRICS_UPDATE
              </h2>
              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#bdbdbd] mb-2 tracking-widest">OPERATOR_ID (NAME)</label>
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      className={inputStyles}
                      placeholder="ENTER_IDENTIFIER"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#bdbdbd] mb-2 tracking-widest">COMMS_CHANNEL (PHONE)</label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      className={inputStyles}
                      placeholder="ENTER_PHONE"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#bdbdbd] mb-2 tracking-widest">INIT_DATE (DOB)</label>
                    <input
                      type="date"
                      value={profileData.dateOfBirth}
                      onChange={(e) => setProfileData({ ...profileData, dateOfBirth: e.target.value })}
                      className={inputStyles}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#bdbdbd] mb-2 tracking-widest">GENDER_SPEC</label>
                    <select
                      value={profileData.gender}
                      onChange={(e) => setProfileData({ ...profileData, gender: e.target.value })}
                      className={inputStyles}
                    >
                      <option value="">SELECT_SPEC</option>
                      <option value="MALE">MALE</option>
                      <option value="FEMALE">FEMALE</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#2a2a2a]">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#bdbdbd] mb-2 tracking-widest">LANGUAGE_MODEL</label>
                    <select
                      value={profileData.preferredLanguage}
                      onChange={(e) => setProfileData({ ...profileData, preferredLanguage: e.target.value })}
                      className={inputStyles}
                    >
                      <option value="en">ENGLISH [EN]</option>
                      <option value="zh">CHINESE [ZH]</option>
                      <option value="es">SPANISH [ES]</option>
                      <option value="fr">FRENCH [FR]</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#bdbdbd] mb-2 tracking-widest">TIME_SYNC</label>
                    <select
                      value={profileData.timezone}
                      onChange={(e) => setProfileData({ ...profileData, timezone: e.target.value })}
                      className={inputStyles}
                    >
                      <option value="UTC">UTC [GLOBAL]</option>
                      <option value="UTC+8">UTC+8 [ASIA]</option>
                      <option value="UTC-5">UTC-5 [EST]</option>
                      <option value="UTC+1">UTC+1 [CET]</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button
                    type="submit"
                    disabled={isSavingProfile}
                    className="flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {isSavingProfile ? 'WRITING...' : 'COMMIT_CHANGES'}
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* Password Settings Card */}
          <div className="bg-[#1c1c1c] border border-[#2a2a2a] p-6 md:p-8 mt-6">
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2a2a2a] pb-4">
                <h2 className="text-sm font-bold text-[#eaeaea] flex items-center gap-3 uppercase tracking-widest">
                  <ShieldAlert className="w-5 h-5 text-[#bdbdbd]" />
                  ACCESS_CREDENTIALS
                </h2>
                {!showPasswordForm && (
                  <Button
                    variant="outline"
                    onClick={() => setShowPasswordForm(true)}
                    className="border-[#2a2a2a] text-[#bdbdbd] hover:bg-[#1c1c1c] hover:text-[#bdbdbd] uppercase tracking-widest text-[10px]"
                  >
                    ROTATE_KEYS
                  </Button>
                )}
              </div>

              {showPasswordForm && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  onSubmit={handleChangePassword}
                  className="space-y-6 pt-4"
                >
                  <div className="bg-[#1c1c1c] border border-[#2a2a2a] p-4 mb-6">
                    <p className="text-[10px] uppercase text-[#bdbdbd] tracking-widest flex items-center gap-2">
                      <Lock className="w-3 h-3" />
                      WARNING: KEY ROTATION REQUIRES CURRENT AUTHENTICATION
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#bdbdbd] mb-2 tracking-widest">CURRENT_KEY</label>
                    <input
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      className={inputStyles}
                      required
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-[#bdbdbd] mb-2 tracking-widest">NEW_KEY</label>
                      <input
                        type="password"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        className={inputStyles}
                        required
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-[#bdbdbd] mb-2 tracking-widest">VERIFY_NEW_KEY</label>
                      <input
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        className={inputStyles}
                        required
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <Button type="submit" disabled={isChangingPassword} className="bg-[#1c1c1c] hover:bg-[#1c1c1c] text-[#eaeaea] border-[#2a2a2a]">
                      {isChangingPassword ? 'PROCESSING...' : 'EXECUTE_ROTATION'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowPasswordForm(false)}
                    >
                      ABORT
                    </Button>
                  </div>
                </motion.form>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ProfileSettingsPage;

