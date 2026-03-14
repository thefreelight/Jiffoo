/**
 * Reset Password Dialog Component
 */
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Key, User, ShieldAlert, Mail } from 'lucide-react'
import { usersApi, unwrapApiResponse, type UserProfile } from '@/lib/api'
import { useT } from 'shared/src/i18n/react'
import { resolveApiErrorMessage } from '@/lib/error-utils'
import { UserAvatar } from '@/components/ui/user-avatar'

interface ResetPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  user: UserProfile | null
}

export function ResetPasswordDialog({ open, onOpenChange, onSuccess, user }: ResetPasswordDialogProps) {
  const t = useT()
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleReset = async () => {
    if (!user) return

    setError('')

    // Validate password
    if (!newPassword || newPassword.length < 6) {
      setError(getText('merchant.customers.resetPassword.passwordMinLength', 'Password must be at least 6 characters'))
      return
    }

    if (newPassword !== confirmPassword) {
      setError(getText('merchant.customers.resetPassword.passwordMismatch', 'Passwords do not match'))
      return
    }

    setLoading(true)

    try {
      const response = await usersApi.resetPassword(user.id, newPassword)
      unwrapApiResponse(response)

      onSuccess()
      onOpenChange(false)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      setError(resolveApiErrorMessage(err, t, 'merchant.customers.resetPassword.failed', 'Failed to reset password'))
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setNewPassword('')
    setConfirmPassword('')
    setError('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] rounded-[32px] border-gray-100 p-8 shadow-2xl overflow-hidden gap-0">
        <DialogHeader className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-blue-50 rounded-2xl">
              <Key className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-gray-900 tracking-tight">
                {getText('merchant.customers.resetPassword.title', 'Reset Password')}
              </DialogTitle>
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                Security Protocol Upgrade
              </span>
            </div>
          </div>
          <DialogDescription className="text-sm text-gray-500 font-medium">
            {getText('merchant.customers.resetPassword.description', 'Set a new password for the user')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <p className="text-xs font-bold uppercase tracking-wide">{error}</p>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-100 p-6 rounded-2xl space-y-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
                {getText('merchant.customers.resetPassword.userInfo', 'Target Account')}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                <UserAvatar
                  src={user?.avatar}
                  name={user?.username}
                  username={user?.username}
                  className="h-full w-full rounded-xl"
                  imageClassName="h-full w-full rounded-xl object-cover"
                  fallbackClassName="h-full w-full rounded-xl bg-gray-50 text-gray-500"
                  textClassName="text-sm"
                />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-gray-900 tracking-tight">
                  {user?.username || getText('merchant.customers.unknown', 'Unknown')}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <Mail className="w-3 h-3 text-blue-500" />
                  {user?.email}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="space-y-2.5">
              <Label htmlFor="newPassword" className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
                {getText('merchant.customers.resetPassword.newPassword', 'New Password Specification')}
              </Label>
              <Input
                id="newPassword"
                type="password"
                placeholder={getText('merchant.customers.resetPassword.passwordPlaceholder', 'At least 6 characters')}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-12 px-4 rounded-xl border-gray-100 bg-gray-50/50 focus:bg-white transition-all font-medium"
              />
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="confirmPassword" className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
                {getText('merchant.customers.resetPassword.confirmPassword', 'Confirm New Password')}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={getText('merchant.customers.resetPassword.confirmPlaceholder', 'Enter new password again')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-12 px-4 rounded-xl border-gray-100 bg-gray-50/50 focus:bg-white transition-all font-medium"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-8 flex gap-3 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 sm:flex-none h-11 px-6 rounded-xl font-bold text-gray-500 hover:bg-gray-100"
          >
            {getText('merchant.customers.resetPassword.cancel', 'Cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleReset}
            disabled={loading || !newPassword || !confirmPassword}
            className="flex-1 sm:flex-none h-11 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-100 transition-all disabled:opacity-50"
          >
            {loading ? getText('merchant.customers.resetPassword.resetting', 'Resetting...') : getText('merchant.customers.resetPassword.submit', 'Update Password')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
