'use client'

import { useEffect, useState } from 'react'
import { useT } from 'shared/src/i18n/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/lib/store'
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
    <div className="min-h-screen bg-page-surface">
      <div className="border-b border-neutral-faint pl-20 pr-8 lg:px-8 py-4 sticky top-0 bg-surface/80 backdrop-blur-md z-40 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-neutral-deepest tracking-tight leading-none">
            {getText('merchant.profile.title', 'Profile')}
          </h1>
          <span className="text-[10px] font-bold text-action-strong uppercase tracking-widest mt-1">
            {getText('merchant.profile.subtitle', 'Manage your account information and credentials')}
          </span>
        </div>
      </div>

      <div className="w-full px-10 py-10 space-y-8 max-w-[1200px] mx-auto">
        <div className="bg-surface rounded-3xl border border-neutral-faint shadow-sm overflow-hidden">
          <div className="h-24 bg-neutral-veil border-b border-neutral-faint" />
          <div className="px-8 pb-8 flex flex-col sm:flex-row items-end gap-6 -mt-12 relative z-10">
            <div className="w-24 h-24 rounded-2xl bg-surface p-1 shadow-xl ring-1 ring-neutral-faint flex-shrink-0">
              {effectiveAvatar ? (
                <img
                  src={effectiveAvatar}
                  alt={effectiveUsername || 'Profile'}
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <div className="w-full h-full bg-neutral-veil rounded-xl flex items-center justify-center border border-dashed border-neutral-soft">
                  <span className="text-xl font-black text-action-strong">{profileInitial}</span>
                </div>
              )}
            </div>
            <div className="flex-1 pb-1 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-bold text-neutral-deepest tracking-tight leading-none">
                  {effectiveUsername || getText('merchant.profile.username', 'Username')}
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-neutral-deepest text-surface">
                  ADMIN
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-5 text-[10px] font-bold text-neutral-light uppercase tracking-widest">
                <span className="inline-flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-action-base" />
                  {effectiveEmail || '--'}
                </span>
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-action-base" />
                  {isLoading ? getText('common.status.loading', 'Loading...') : getText('common.status.active', 'Active')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-3xl border border-neutral-faint shadow-sm p-8 space-y-8">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-4 w-1 bg-action-strong rounded-full" />
              <h3 className="text-xs font-bold text-neutral-light uppercase tracking-widest">
                {getText('merchant.profile.accountDetails', 'Account Details')}
              </h3>
            </div>
            <p className="text-[10px] font-medium text-neutral-pale uppercase tracking-wider pl-3">
              {getText('merchant.profile.subtitle', 'Manage your account information and credentials')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-3">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-neutral-light uppercase tracking-widest leading-none block">
                {getText('merchant.profile.username', 'Username')}
              </label>
              <Input
                value={effectiveUsername}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading || updateProfile.isPending}
                className="rounded-xl border-neutral-faint bg-neutral-veil/50 h-11"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-neutral-light uppercase tracking-widest leading-none block">
                {getText('merchant.profile.avatarUrl', 'Avatar URL')}
              </label>
              <Input
                value={effectiveAvatar}
                onChange={(e) => setAvatarUrl(e.target.value)}
                disabled={isLoading || updateProfile.isPending}
                className="rounded-xl border-neutral-faint bg-neutral-veil/50 h-11"
              />
            </div>
          </div>

          <div className="pl-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="h-11 px-4 rounded-xl border border-neutral-faint bg-neutral-veil/60 hover:bg-surface transition-colors cursor-pointer inline-flex items-center gap-2 text-sm font-semibold text-neutral-deep w-fit">
              <Upload className="w-4 h-4 text-neutral-light" />
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
              className="h-11 px-6 rounded-xl bg-action-strong hover:bg-action-deep text-surface font-bold shadow-md shadow-action-faint"
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
