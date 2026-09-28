/**
 * Admin Login Page
 *
 * Admin authentication page with i18n support.
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useThemeAssets } from '@/lib/theme-assets'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store'
import { Sparkles, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useT, useLocale } from 'shared/src/i18n/react'
import { resolveApiErrorMessage } from '@/lib/error-utils'
import { ZodError } from 'zod'
// Validation using shared Zod schema
import { loginSchema } from 'shared'

export default function AdminLoginPage() {
  const { logo, loginBackground } = useThemeAssets()
  const router = useRouter()
  const { login, isAuthenticated, isLoading, checkAuth } = useAuthStore()
  const t = useT()
  const locale = useLocale()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    let cancelled = false

    async function redirectFreshInstall() {
      try {
        const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || '/api/v1').replace(/\/$/, '')
        const response = await fetch(`${apiBaseUrl}/install/status`, { credentials: 'include' })
        if (!response.ok) return

        const status = await response.json()
        if (!cancelled && status?.isInstalled === false) {
          router.replace(`/${locale}/install`)
        }
      } catch {
        // Login remains available if the installation status endpoint is unreachable.
      }
    }

    redirectFreshInstall()

    return () => {
      cancelled = true
    }
  }, [locale, router])

  useEffect(() => { document.title = 'Commerce Admin - Management Dashboard' }, [])

  useEffect(() => {
    if (isAuthenticated) {
      // Check if there's a saved redirect path
      const redirectPath = sessionStorage.getItem('redirectPath')
      if (redirectPath && redirectPath !== `/${locale}/auth/login`) {
        sessionStorage.removeItem('redirectPath')
        router.push(redirectPath)
      } else {
        router.push(`/${locale}/dashboard`)
      }
    }
  }, [isAuthenticated, router, locale])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation using shared Zod schema
    try {
      loginSchema.parse({ identifier: email, password });
      // Validation passed, proceed with login
      await login(email, password)
      // Redirect logic after successful login is handled in useEffect
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const firstPath = String(error.issues[0]?.path?.[0] || '')
        if (firstPath === 'identifier') {
          setError(getText('common.validation.invalidEmail', 'Please enter a valid email address'))
        } else {
          setError(getText('common.errors.validation', 'Validation Error'))
        }
        return
      }

      if (error instanceof Error) {
        setError(resolveApiErrorMessage(error, t, 'merchant.auth.loginFailed', 'Login failed'))
        return
      }

      setError(getText('merchant.auth.loginFailed', 'Login failed'))
    }
  }

  const brandedTitle = getText('merchant.auth.title', 'Store Console')
  const brandedSubtitle = getText('merchant.auth.welcomeBack', 'SECURE ACCESS')
  const brandedFooter = getText('merchant.auth.copyright', '© 2026 STORE CONSOLE. ALL RIGHTS RESERVED.')

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <main className={`min-h-screen flex items-center justify-center p-4 ${loginBackground ? 'bg-cover bg-center' : 'bg-page-surface'}`}
      style={loginBackground ? { backgroundImage: `url("${loginBackground}")` } : undefined}>
      <div className="w-full max-w-md space-y-6">
        {/* Logo and Title */}
        <div className="text-center space-y-4">
          {logo
            ? <Image src={logo} alt="Store Console logo" width={64} height={64} unoptimized
              className="inline-block h-16 w-16 object-contain" />
            : <div className="inline-flex items-center justify-center w-16 h-16 bg-action-strong rounded-2xl shadow-sm">
                <Sparkles className="w-8 h-8 text-surface" />
              </div>}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-neutral-deepest tracking-tight">
              {brandedTitle}
            </h1>
            <p className="text-[10px] font-bold text-neutral-light uppercase tracking-widest">
              {brandedSubtitle}
            </p>
          </div>
        </div>

        {/* Login Form */}
        <div className="bg-surface rounded-3xl shadow-sm border border-neutral-faint p-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-1 bg-action-strong rounded-full" />
                <h2 className="text-xs font-bold text-neutral-light uppercase tracking-widest">
                  {getText('merchant.auth.signIn', 'SYSTEM ACCESS')}
                </h2>
              </div>
              <p className="text-[10px] font-medium text-neutral-pale uppercase tracking-wider pl-3">
                {getText('merchant.auth.enterCredentials', 'ENTER CREDENTIALS TO PROCEED')}
              </p>
            </div>

            {error && (
              <div className="bg-danger-veil border border-danger-faint text-danger-deep px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div className="space-y-3">
                <label htmlFor="email" className="text-[10px] font-bold text-neutral-light uppercase tracking-widest block">
                  {getText('merchant.auth.emailAddress', 'EMAIL INTERFACE')}
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-light w-4 h-4" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={getText('merchant.auth.enterEmail', 'Enter your email')}
                    className="w-full pl-11 pr-4 py-3 border border-neutral-faint rounded-xl focus:ring-2 focus:ring-action-base/20 focus:border-action-base bg-neutral-veil/50 text-sm font-bold text-neutral-deepest"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-3">
                <label htmlFor="password" className="text-[10px] font-bold text-neutral-light uppercase tracking-widest block">
                  {getText('merchant.auth.password', 'SECURITY KEY')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-light w-4 h-4" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={getText('merchant.auth.enterPassword', 'Enter your password')}
                    className="w-full pl-11 pr-11 py-3 border border-neutral-faint rounded-xl focus:ring-2 focus:ring-action-base/20 focus:border-action-base bg-neutral-veil/50 text-sm font-bold text-neutral-deepest"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-neutral-light hover:text-neutral-strong"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Link href={`/${locale}/auth/forgot-password`} className="block text-right text-sm text-action-deep hover:underline">
                Forgot password?
              </Link>
              <Button
                type="submit"
                className="w-full h-11 rounded-xl font-semibold text-sm shadow-md shadow-action-faint transition-all bg-action-strong hover:bg-action-deep mt-6"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {getText('merchant.auth.signingIn', 'AUTHENTICATING...')}
                  </>
                ) : (
                  getText('merchant.auth.signIn', 'AUTHENTICATE')
                )}
              </Button>
            </form>

          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-[10px] font-bold text-neutral-light uppercase tracking-widest">
            {brandedFooter}
          </p>
        </div>
      </div>
    </main>
  )
}
