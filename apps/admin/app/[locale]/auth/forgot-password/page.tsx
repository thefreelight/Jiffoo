'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Loader2, MailCheck } from 'lucide-react'
import { useLocale, useT } from 'shared/src/i18n/react'
import { authApi } from '@/lib/api'

type Step = 'email' | 'reset' | 'done'

/**
 * Admin forgot password — request a reset code, then set a new password.
 * The core emails a six-digit code; this page completes the reset.
 */
export default function AdminForgotPasswordPage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useT()
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const goSignIn = () => router.push(`/${locale}/auth/login`)

  const submitEmail = async (event: React.FormEvent) => {
    event.preventDefault()
    const value = email.trim().toLowerCase()
    if (!value.includes('@')) {
      setError(getText('merchant.auth.resetErrorEmail', 'Enter a valid email address.'))
      return
    }
    setBusy(true)
    setError('')
    try {
      await authApi.forgotPassword(value)
      setStep('reset')
      setNotice(getText('merchant.auth.resetNoticeSent', 'If an admin account exists for this email, a six-digit reset code is on its way. It expires in 10 minutes.'))
    } catch (caught: any) {
      setError(caught?.message || getText('merchant.auth.resetErrorSend', 'Could not send the reset code. Try again in a moment.'))
    } finally {
      setBusy(false)
    }
  }

  const submitReset = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(code.trim())) {
      setError(getText('merchant.auth.resetErrorCode', 'Enter the six-digit code from the email.'))
      return
    }
    if (password.length < 8) {
      setError(getText('merchant.auth.resetErrorPassword', 'The new password must be at least 8 characters.'))
      return
    }
    if (password !== confirm) {
      setError(getText('merchant.auth.resetErrorConfirm', 'The passwords do not match.'))
      return
    }
    setBusy(true)
    setError('')
    try {
      await authApi.resetPassword({ email: email.trim().toLowerCase(), code: code.trim(), password })
      setStep('done')
    } catch (caught: any) {
      setError(caught?.message || getText('merchant.auth.resetErrorReset', 'Could not reset the password. Check the code and try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#fcfdfe] p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white">
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : step === 'done' ? <MailCheck className="h-6 w-6" /> : <KeyRound className="h-6 w-6" />}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {step === 'email'
              ? getText('merchant.auth.resetTitleEmail', 'Forgot your password?')
              : step === 'reset'
                ? getText('merchant.auth.resetTitleReset', 'Check your email')
                : getText('merchant.auth.resetTitleDone', 'Password updated')}
          </h1>
          <p className="text-sm text-gray-500">
            {step === 'email'
              ? getText('merchant.auth.resetEmailHint', 'Enter the admin account email and we will send a six-digit reset code.')
              : step === 'reset'
                ? notice || getText('merchant.auth.resetCodeHint', 'Enter the six-digit code and choose a new password.')
                : getText('merchant.auth.resetDoneHint', 'Your password has been changed. Sign in with the new password.')}
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 space-y-5">
          {error ? (
            <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
          ) : null}

          {step === 'email' ? (
            <form onSubmit={submitEmail} className="space-y-4">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@example.com"
                className="w-full py-3 px-4 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50 text-sm font-bold text-gray-900"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full h-11 rounded-xl bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {getText('merchant.auth.resetSendCode', 'Send reset code')}
              </button>
            </form>
          ) : null}

          {step === 'reset' ? (
            <form onSubmit={submitReset} className="space-y-4">
              <input
                inputMode="numeric"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={getText('merchant.auth.resetCodePlaceholder', 'Six-digit code')}
                className="w-full py-3 px-4 border border-gray-100 rounded-xl text-center text-lg font-bold tracking-[0.4em] text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50"
              />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={getText('merchant.auth.resetNewPasswordPlaceholder', 'New password (8+ characters)')}
                className="w-full py-3 px-4 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50 text-sm font-bold text-gray-900"
              />
              <input
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder={getText('merchant.auth.resetConfirmPlaceholder', 'Confirm new password')}
                className="w-full py-3 px-4 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50 text-sm font-bold text-gray-900"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full h-11 rounded-xl bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {getText('merchant.auth.resetSubmit', 'Reset password')}
              </button>
            </form>
          ) : null}

          {step === 'done' ? (
            <button
              type="button"
              onClick={goSignIn}
              className="w-full h-11 rounded-xl bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              {getText('merchant.auth.resetBackToSignIn', 'Back to sign in')}
            </button>
          ) : null}
        </div>

        <p className="text-center text-xs text-gray-500">
          <button type="button" onClick={goSignIn} className="underline underline-offset-4 hover:text-gray-700">
            {getText('merchant.auth.resetBackToSignIn', 'Back to sign in')}
          </button>
        </p>
      </div>
    </div>
  )
}
