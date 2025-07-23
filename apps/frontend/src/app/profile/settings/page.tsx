'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { useTranslation } from '@/hooks/use-translation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  User, 
  Lock, 
  Globe, 
  Bell,
  Shield,
  Camera,
  Save,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

export default function ProfileSettingsPage() {
  const { user, updateProfile } = useAuthStore();
  const { t, currentLanguage, switchLanguage } = useTranslation();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    username: user?.name || '',
    email: user?.email || '',
    avatar: user?.avatar || ''
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [languagePreferences, setLanguagePreferences] = useState({
    language: currentLanguage,
    timezone: 'UTC+8',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '24h',
    currency: 'USD'
  });

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await updateProfile(profileData);
      toast({
        title: t('profile.success'),
        description: t('profile.profileUpdated'),
      });
    } catch (error) {
      toast({
        title: t('profile.error'),
        description: t('profile.updateFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: t('profile.error'),
        description: t('profile.passwordMismatch'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      // TODO: Implement password change API call
      toast({
        title: t('profile.success'),
        description: t('profile.passwordChanged'),
      });
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      toast({
        title: t('profile.error'),
        description: t('profile.passwordChangeFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLanguageChange = async (newLanguage: string) => {
    try {
      await switchLanguage(newLanguage);
      setLanguagePreferences(prev => ({ ...prev, language: newLanguage }));
      toast({
        title: t('profile.success'),
        description: t('profile.languageChanged'),
      });
    } catch (error) {
      toast({
        title: t('profile.error'),
        description: t('profile.languageChangeFailed'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/profile" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('profile.backToProfile')}
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{t('profile.accountSettings')}</h1>
          <p className="text-gray-600">{t('profile.manageAccountSettings')}</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>{t('profile.profile')}</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center space-x-2">
              <Lock className="w-4 h-4" />
              <span>{t('profile.security')}</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center space-x-2">
              <Globe className="w-4 h-4" />
              <span>{t('profile.preferences')}</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center space-x-2">
              <Bell className="w-4 h-4" />
              <span>{t('profile.notifications')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>{t('profile.profileInformation')}</CardTitle>
                <CardDescription>
                  {t('profile.updateProfileDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileUpdate} className="space-y-6">
                  {/* Avatar Section */}
                  <div className="flex items-center space-x-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                      {profileData.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <Button type="button" variant="outline" className="flex items-center space-x-2">
                        <Camera className="w-4 h-4" />
                        <span>{t('profile.changeAvatar')}</span>
                      </Button>
                      <p className="text-sm text-gray-600 mt-2">{t('profile.avatarDescription')}</p>
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="username">{t('profile.username')}</Label>
                      <Input
                        id="username"
                        value={profileData.username}
                        onChange={(e) => setProfileData(prev => ({ ...prev, username: e.target.value }))}
                        placeholder={t('profile.enterUsername')}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">{t('profile.email')}</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileData.email}
                        disabled
                        className="bg-gray-50"
                      />
                      <p className="text-sm text-gray-600">{t('profile.emailCannotChange')}</p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={isLoading} className="flex items-center space-x-2">
                      <Save className="w-4 h-4" />
                      <span>{isLoading ? t('profile.saving') : t('profile.saveChanges')}</span>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>{t('profile.passwordSecurity')}</CardTitle>
                <CardDescription>
                  {t('profile.passwordSecurityDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">{t('profile.currentPassword')}</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      placeholder={t('profile.enterCurrentPassword')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">{t('profile.newPassword')}</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder={t('profile.enterNewPassword')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">{t('profile.confirmPassword')}</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder={t('profile.confirmNewPassword')}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={isLoading} className="flex items-center space-x-2">
                      <Shield className="w-4 h-4" />
                      <span>{isLoading ? t('profile.updating') : t('profile.updatePassword')}</span>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences">
            <Card>
              <CardHeader>
                <CardTitle>{t('profile.languagePreferences')}</CardTitle>
                <CardDescription>
                  {t('profile.languagePreferencesDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>{t('profile.language')}</Label>
                    <Select value={languagePreferences.language} onValueChange={handleLanguageChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="zh-CN">中文 (简体)</SelectItem>
                        <SelectItem value="zh-TW">中文 (繁體)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('profile.timezone')}</Label>
                    <Select value={languagePreferences.timezone} onValueChange={(value) => 
                      setLanguagePreferences(prev => ({ ...prev, timezone: value }))
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC+8">UTC+8 (Beijing)</SelectItem>
                        <SelectItem value="UTC+0">UTC+0 (London)</SelectItem>
                        <SelectItem value="UTC-5">UTC-5 (New York)</SelectItem>
                        <SelectItem value="UTC-8">UTC-8 (Los Angeles)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('profile.dateFormat')}</Label>
                    <Select value={languagePreferences.dateFormat} onValueChange={(value) => 
                      setLanguagePreferences(prev => ({ ...prev, dateFormat: value }))
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('profile.currency')}</Label>
                    <Select value={languagePreferences.currency} onValueChange={(value) => 
                      setLanguagePreferences(prev => ({ ...prev, currency: value }))
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="CNY">CNY (¥)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>{t('profile.notificationSettings')}</CardTitle>
                <CardDescription>
                  {t('profile.notificationSettingsDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">{t('profile.notificationsComingSoon')}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
