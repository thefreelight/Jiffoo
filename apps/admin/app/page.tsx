'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function HomePage() {
  const router = useRouter()
  const { login, isAuthenticated, isLoading, checkAuth } = useAuthStore()
  const [email, setEmail] = useState('admin@jiffoo.com')
  const [password, setPassword] = useState('123456')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    // 检查认证状态
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoginLoading(true)

    try {
      await login(email, password)
      // 登录成功后会通过useEffect重定向
    } catch (error: any) {
      setError(error.message || 'Login failed')
    } finally {
      setLoginLoading(false)
    }
  }

  const fillDemo = () => {
    setEmail('admin@jiffoo.com')
    setPassword('123456')
  }

  // Show loading spinner only during initial auth check
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">正在加载...</p>
        </div>
      </div>
    )
  }

  // Show loading spinner when authenticated and redirecting
  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">正在跳转到仪表板...</p>
        </div>
      </div>
    )
  }

  // Show login form when not authenticated
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Jiffoo Admin</CardTitle>
          <CardDescription>登录到管理员仪表板</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                邮箱
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@jiffoo.com"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                密码
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <div className="text-red-600 text-sm text-center">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loginLoading}
            >
              {loginLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={fillDemo}
            >
              填充演示账号
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
