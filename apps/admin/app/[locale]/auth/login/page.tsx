/**
 * Admin Login Page
 *
 * Tenant admin authentication page with i18n support.
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store'
import { authApi } from '@/lib/api'
import { Sparkles, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useT, useLocale } from 'shared/src/i18n/react'
import { resolveApiErrorMessage } from '@/lib/error-utils'
import type { AuthBootstrapStatus } from 'shared/src/types/auth'
import { ZodError } from 'zod'
// Validation using shared Zod schema
import { loginSchema } from 'shared'

export default function AdminLoginPage() {
  const router = useRouter()
  const { login, isAuthenticated, isLoading, checkAuth } = useAuthStore()
  const t = useT()
  const locale = useLocale()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [bootstrapStatus, setBootstrapStatus] = useState<AuthBootstrapStatus | null>(null)
  const [isLoadingBootstrap, setIsLoadingBootstrap] = useState(true)

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
    let mounted = true

    async function loadBootstrapStatus() {
      try {
        const response = await authApi.bootstrapStatus()
        if (!mounted) return
        if (response.success && response.data) {
          setBootstrapStatus(response.data)
        } else {
          setBootstrapStatus(null)
        }
      } catch {
        if (mounted) {
          setBootstrapStatus(null)
        }
      } finally {
        if (mounted) {
          setIsLoadingBootstrap(false)
        }
      }
    }

    loadBootstrapStatus()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      if (useAuthStore.getState().user?.requiresPasswordRotation) {
        router.push(`/${locale}/profile`)
        return
      }
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
      loginSchema.parse({ email, password });
      // Validation passed, proceed with login
      await login(email, password)
      // Redirect logic after successful login is handled in useEffect
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const firstPath = String(error.issues[0]?.path?.[0] || '')
        if (firstPath === 'email') {
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

  const fillDemo = () => {
    const credentials = bootstrapStatus?.credentials
    if (!credentials) return
    setEmail(credentials.email)
    setPassword(credentials.password)
  }

  const shouldShowDemoCredentials = Boolean(bootstrapStatus?.showDemoCredentials && bootstrapStatus?.credentials)
  const bootstrapHint = bootstrapStatus?.requiresPasswordRotation
    ? getText('merchant.auth.bootstrapPasswordRotationHint', 'Change the initial admin password after sign-in to hide these bootstrap credentials.')
    : getText('merchant.auth.demoCredentialsHint', 'These credentials are visible because this instance is still in bootstrap or demo mode.')

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fcfdfe] p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and Title */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-sm">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              {getText('merchant.auth.title', 'Jiffoo Admin')}
            </h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {getText('merchant.auth.welcomeBack', 'AUTHENTICATION INTERFACE')}
            </p>
          </div>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-1 bg-blue-600 rounded-full" />
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {getText('merchant.auth.signIn', 'SYSTEM ACCESS')}
                </h2>
              </div>
              <p className="text-[10px] font-medium text-gray-300 uppercase tracking-wider pl-3">
                {getText('merchant.auth.enterCredentials', 'ENTER CREDENTIALS TO PROCEED')}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div className="space-y-3">
                <label htmlFor="email" className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                  {getText('merchant.auth.emailAddress', 'EMAIL INTERFACE')}
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={getText('merchant.auth.enterEmail', 'Enter your email')}
                    className="w-full pl-11 pr-4 py-3 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50 text-sm font-bold text-gray-900"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-3">
                <label htmlFor="password" className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                  {getText('merchant.auth.password', 'SECURITY KEY')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={getText('merchant.auth.enterPassword', 'Enter your password')}
                    className="w-full pl-11 pr-11 py-3 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50 text-sm font-bold text-gray-900"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-11 rounded-xl font-semibold text-sm shadow-md shadow-blue-100 transition-all bg-blue-600 hover:bg-blue-700 mt-6"
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

            {isLoadingBootstrap ? (
              <div className="pt-6 border-t border-gray-50">
                <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3 text-xs text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {getText('common.loading', 'Loading...')}
                </div>
              </div>
            ) : shouldShowDemoCredentials ? (
              <div className="pt-6 border-t border-gray-50">
                <div className="text-center space-y-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {getText('merchant.auth.demoCredentials', 'DEMO CREDENTIALS')}
                  </p>
                  <div className="bg-gray-50/50 rounded-xl p-4 space-y-2 text-xs border border-gray-100">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                        {getText('merchant.auth.email', 'Email')}:
                      </span>
                      <span className="font-mono text-gray-900 font-bold">{bootstrapStatus?.credentials?.email}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                        {getText('merchant.auth.password', 'Password')}:
                      </span>
                      <span className="font-mono text-gray-900 font-bold">{bootstrapStatus?.credentials?.password}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">{bootstrapHint}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fillDemo}
                    className="w-full rounded-xl border-gray-200 hover:bg-gray-50 font-semibold text-sm h-10"
                    disabled={isLoading}
                  >
                    {getText('merchant.auth.useDemoCredentials', 'USE DEMO CREDENTIALS')}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {getText('merchant.auth.copyright', '© 2026 JIFFOO MALL. ALL RIGHTS RESERVED.')}
          </p>
        </div>
      </div>
    </div>
  )
}
