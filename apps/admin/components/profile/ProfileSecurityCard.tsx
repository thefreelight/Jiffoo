'use client'

import { useEffect, useState } from 'react'
import { AtSign, KeyRound, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ProfileSecurityCardProps {
  initialEmail: string
  isProfileLoading: boolean
  isUpdatingEmail: boolean
  isChangingPassword: boolean
  onUpdateEmail: (payload: { newEmail: string; currentPassword: string }) => Promise<unknown>
  onChangePassword: (payload: { currentPassword: string; newPassword: string }) => Promise<unknown>
  t: (key: string, fallback: string) => string
}

export function ProfileSecurityCard({
  initialEmail,
  isProfileLoading,
  isUpdatingEmail,
  isChangingPassword,
  onUpdateEmail,
  onChangePassword,
  t,
}: ProfileSecurityCardProps) {
  const [email, setEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [emailValidationError, setEmailValidationError] = useState('')
  const [passwordValidationError, setPasswordValidationError] = useState('')

  useEffect(() => {
    setEmail(initialEmail || '')
  }, [initialEmail])

  const normalizedInitialEmail = (initialEmail || '').trim()
  const normalizedEmail = email.trim()
  const hasEmailChange = normalizedEmail.length > 0 && normalizedEmail !== normalizedInitialEmail

  const handleUpdateEmail = async () => {
    setEmailValidationError('')
    const nextEmail = normalizedEmail

    if (!nextEmail) {
      setEmailValidationError(t('merchant.profile.emailRequired', 'Email is required'))
      return
    }

    if (!hasEmailChange) {
      setEmailValidationError(t('merchant.profile.noSecurityChanges', 'No security changes to save'))
      return
    }

    if (!emailPassword.trim()) {
      setEmailValidationError(t('merchant.profile.currentPasswordRequired', 'Current password is required'))
      return
    }

    await onUpdateEmail({
      newEmail: nextEmail,
      currentPassword: emailPassword,
    })
    setEmailPassword('')
  }

  const handleChangePassword = async () => {
    setPasswordValidationError('')
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordValidationError(t('merchant.profile.passwordFieldsRequired', 'All password fields are required'))
      return
    }

    if (newPassword.length < 6) {
      setPasswordValidationError(t('merchant.profile.passwordMinLength', 'Password must be at least 6 characters'))
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordValidationError(t('merchant.profile.passwordMismatch', 'Passwords do not match'))
      return
    }

    await onChangePassword({ currentPassword, newPassword })
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 space-y-8">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="h-4 w-1 bg-blue-600 rounded-full" />
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            {t('merchant.settings.security.authentication', 'Security')}
          </h3>
        </div>
        <p className="text-[10px] font-medium text-gray-300 uppercase tracking-wider pl-3">
          {t('merchant.profile.subtitle', 'Manage your account information and credentials')}
        </p>
      </div>

      <div className="pl-3 space-y-6">
        <div className="space-y-4 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AtSign className="w-4 h-4 text-blue-600" />
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {t('merchant.profile.emailSection', 'Email')}
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isProfileLoading || isUpdatingEmail}
              placeholder={t('merchant.profile.email', 'Email')}
              className="rounded-xl border-gray-100 bg-gray-50/50 h-11"
            />
            <Input
              type="password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              disabled={isUpdatingEmail}
              placeholder={t('merchant.profile.currentPassword', 'Current Password')}
              className="rounded-xl border-gray-100 bg-gray-50/50 h-11"
            />
          </div>
          {emailValidationError ? (
            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <p className="text-xs font-bold uppercase tracking-wide">{emailValidationError}</p>
            </div>
          ) : null}
          <p className="text-xs text-gray-500">
            {t('merchant.profile.emailPasswordHint', 'Current password is required by API policy when changing email.')}
          </p>
          <div className="flex justify-end">
            <Button
              onClick={handleUpdateEmail}
              disabled={isProfileLoading || isUpdatingEmail || !hasEmailChange}
              className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              {isUpdatingEmail ? t('common.actions.saving', 'Saving...') : t('merchant.profile.updateEmailAction', 'Update Email')}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-blue-600" />
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {t('merchant.profile.passwordSection', 'Password')}
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isChangingPassword}
              placeholder={t('merchant.profile.newPassword', 'New Password')}
              className="rounded-xl border-gray-100 bg-gray-50/50 h-11"
            />
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isChangingPassword}
              placeholder={t('merchant.profile.confirmPassword', 'Confirm Password')}
              className="rounded-xl border-gray-100 bg-gray-50/50 h-11"
            />
          </div>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={isChangingPassword}
            placeholder={t('merchant.profile.currentPasswordPlaceholder', 'Current password (required for security changes)')}
            className="rounded-xl border-gray-100 bg-gray-50/50 h-11"
          />
          {passwordValidationError ? (
            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <p className="text-xs font-bold uppercase tracking-wide">{passwordValidationError}</p>
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button
              onClick={handleChangePassword}
              disabled={isProfileLoading || isChangingPassword}
              className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              {isChangingPassword ? t('common.actions.saving', 'Saving...') : t('merchant.profile.updatePasswordAction', 'Update Password')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
