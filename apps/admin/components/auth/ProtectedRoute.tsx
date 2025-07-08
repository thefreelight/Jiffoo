'use client'

import { useEffect, ReactNode, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: ReactNode
  requireAdmin?: boolean
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isLoading, isChecking, user, checkAuth } = useAuthStore()
  const [hasInitialized, setHasInitialized] = useState(false)

  useEffect(() => {
    // 初始化时检查认证状态
    const initAuth = async () => {
      await checkAuth()
      setHasInitialized(true)
    }
    
    if (!hasInitialized) {
      initAuth()
    }
  }, [checkAuth, hasInitialized])

  useEffect(() => {
    // 只有在初始化完成且不在加载状态时才进行重定向判断
    if (hasInitialized && !isLoading && !isChecking) {
      if (!isAuthenticated) {
        // 保存当前路径用于登录后重定向
        if (pathname !== '/auth/login' && pathname !== '/') {
          sessionStorage.setItem('redirectPath', pathname)
        }
        router.replace('/auth/login')
        return
      }

      if (requireAdmin && user?.role !== 'ADMIN') {
        router.replace('/auth/login')
        return
      }
    }
  }, [hasInitialized, isAuthenticated, isLoading, isChecking, user, requireAdmin, router, pathname])

  // 显示加载状态：初始化中或正在检查认证
  if (!hasInitialized || isLoading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">验证身份中...</p>
        </div>
      </div>
    )
  }

  // 认证检查完成后，如果未认证则显示重定向提示
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">重定向到登录页面...</p>
        </div>
      </div>
    )
  }

  // 权限检查
  if (requireAdmin && user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-semibold text-red-800 mb-2">访问被拒绝</h2>
            <p className="text-red-600">您没有权限访问此页面。需要管理员权限。</p>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
} 