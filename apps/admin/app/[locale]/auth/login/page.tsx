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
import { Sparkles, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useT, useLocale } from 'shared/src/i18n/react'
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

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

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
      loginSchema.parse({ email, password });
      // Validation passed, proceed with login
      await login(email, password)
      // Redirect logic after successful login is handled in useEffect
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errors' in error) {
        // Zod validation error
        const zodError = error as { errors: Array<{ message: string }> };
        const firstError = zodError.errors[0];
        setError(firstError.message);
      } else if (error instanceof Error) {
        // Login API error
        setError(error.message || getText('merchant.auth.loginFailed', 'Login failed'));
      } else {
        setError(getText('merchant.auth.loginFailed', 'Login failed'));
      }
    }
  }

  const fillDemo = () => {
    setEmail('admin@jiffoo.com')
    setPassword('admin123')
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Title */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {getText('merchant.auth.title', 'Jiffoo Admin')}
            </h1>
            <p className="text-gray-600">
              {getText('merchant.auth.welcomeBack', 'Welcome back! Please sign in to your account.')}
            </p>
          </div>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl border-0 p-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">{getText('merchant.auth.signIn', 'Sign in')}</h2>
              <p className="text-gray-600">
                {getText('merchant.auth.enterCredentials', 'Enter your credentials to access the admin dashboard')}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Field */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">{getText('merchant.auth.emailAddress', 'Email address')}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={getText('merchant.auth.enterEmail', 'Enter your email')}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">{getText('merchant.auth.password', 'Password')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={getText('merchant.auth.enterPassword', 'Enter your password')}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {getText('merchant.auth.signingIn', 'Signing in...')}
                  </>
                ) : (
                  getText('merchant.auth.signIn', 'Sign in')
                )}
              </Button>
            </form>

            {/* Demo Credentials */}
            <div className="pt-4 border-t">
              <div className="text-center space-y-3">
                <p className="text-sm text-gray-600">{getText('merchant.auth.demoCredentials', 'Demo Credentials')}</p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{getText('merchant.auth.email', 'Email')}:</span>
                    <span className="font-mono">admin@jiffoo.com</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{getText('merchant.auth.password', 'Password')}:</span>
                    <span className="font-mono">admin123</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fillDemo}
                  className="w-full"
                  disabled={isLoading}
                >
                  {getText('merchant.auth.useDemoCredentials', 'Use Demo Credentials')}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-gray-500">
            {getText('merchant.auth.copyright', '© 2024 Jiffoo Mall. All rights reserved.')}
          </p>
        </div>
      </div>
    </div>
  )
}