'use client'

import { useEffect, useState } from 'react'
import { useT } from 'shared/src/i18n/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAccountProfile, useChangePassword, useUpdateAccountEmail, useUpdateAccountProfile, useUploadAvatar } from '@/lib/hooks/use-api'
import { Mail, Save, ShieldCheck, Upload } from 'lucide-react'
import { ProfileSecurityCard } from '@/components/profile/ProfileSecurityCard'

export default function ProfilePage() {
  const t = useT()
  const { data: profile, isLoading } = useAccountProfile()
  const updateProfile = useUpdateAccountProfile()
  const updateEmail = useUpdateAccountEmail()
  const changePassword = useChangePassword()
  const uploadAvatar = useUploadAvatar()

  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  useEffect(() => {
    if (!profile) return
    setUsername(profile.username || '')
    setAvatarUrl(profile.avatar || '')
  }, [profile?.username, profile?.avatar])

  const effectiveUsername = username
  const effectiveAvatar = avatarUrl
  const effectiveEmail = profile?.email || ''
  const profileInitial = (effectiveUsername?.charAt(0) || effectiveEmail?.charAt(0) || 'A').toUpperCase()

  const handleSaveProfile = async () => {
    await updateProfile.mutateAsync({
      username: effectiveUsername,
      avatar: effectiveAvatar || undefined,
    })
  }

  return (
    <div className="min-h-screen bg-[#fcfdfe]">
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-100 bg-white/80 py-4 pl-4 pr-4 backdrop-blur-md sm:pl-20 sm:pr-8 lg:px-8">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-none">
            {getText('merchant.profile.title', 'Profile')}
          </h1>
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">
            {getText('merchant.profile.subtitle', 'Manage your account information and credentials')}
          </span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1200px] space-y-8 px-4 py-6 sm:px-10 sm:py-10">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-24 bg-gray-50 border-b border-gray-100" />
          <div className="px-8 pb-8 flex flex-col sm:flex-row items-end gap-6 -mt-12 relative z-10">
            <div className="w-24 h-24 rounded-2xl bg-white p-1 shadow-xl ring-1 ring-gray-100 flex-shrink-0">
              {effectiveAvatar ? (
                <img
                  src={effectiveAvatar}
                  alt={effectiveUsername || 'Profile'}
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <div className="w-full h-full bg-gray-50 rounded-xl flex items-center justify-center border border-dashed border-gray-200">
                  <span className="text-xl font-black text-blue-600">{profileInitial}</span>
                </div>
              )}
            </div>
            <div className="flex-1 pb-1 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight leading-none">
                  {effectiveUsername || getText('merchant.profile.username', 'Username')}
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-gray-900 text-white">
                  ADMIN
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <span className="inline-flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-blue-500" />
                  {effectiveEmail || '--'}
                </span>
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                  {isLoading ? getText('common.status.loading', 'Loading...') : getText('common.status.active', 'Active')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 space-y-8">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-4 w-1 bg-blue-600 rounded-full" />
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                {getText('merchant.profile.accountDetails', 'Account Details')}
              </h3>
            </div>
            <p className="text-[10px] font-medium text-gray-300 uppercase tracking-wider pl-3">
              {getText('merchant.profile.subtitle', 'Manage your account information and credentials')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-3">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none block">
                {getText('merchant.profile.username', 'Username')}
              </label>
              <Input
                value={effectiveUsername}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading || updateProfile.isPending}
                className="rounded-xl border-gray-100 bg-gray-50/50 h-11"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none block">
                {getText('merchant.profile.avatarUrl', 'Avatar URL')}
              </label>
              <Input
                value={effectiveAvatar}
                onChange={(e) => setAvatarUrl(e.target.value)}
                disabled={isLoading || updateProfile.isPending}
                className="rounded-xl border-gray-100 bg-gray-50/50 h-11"
              />
            </div>
          </div>

          <div className="pl-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="h-11 px-4 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-white transition-colors cursor-pointer inline-flex items-center gap-2 text-sm font-semibold text-gray-700 w-fit">
              <Upload className="w-4 h-4 text-gray-400" />
              {getText('merchant.profile.uploadAvatar', 'Upload Avatar')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const result = await uploadAvatar.mutateAsync(file)
                  if (result?.url) setAvatarUrl(result.url)
                }}
              />
            </label>
            <Button
              onClick={handleSaveProfile}
              disabled={updateProfile.isPending || isLoading}
              className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-100"
            >
              <Save className="w-4 h-4 mr-2" />
              {updateProfile.isPending ? getText('common.actions.saving', 'Saving...') : getText('common.actions.saveChanges', 'Save Changes')}
            </Button>
          </div>
        </div>

        <ProfileSecurityCard
          initialEmail={effectiveEmail}
          isProfileLoading={isLoading}
          isUpdatingEmail={updateEmail.isPending}
          isChangingPassword={changePassword.isPending}
          onUpdateEmail={(payload) => updateEmail.mutateAsync(payload)}
          onChangePassword={(payload) => changePassword.mutateAsync(payload)}
          t={getText}
        />
      </div>
    </div>
  )
}
