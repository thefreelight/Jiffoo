'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { Loader2 } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated, isLoading, isChecking, checkAuth } = useAuthStore()
  const [hasInitialized, setHasInitialized] = useState(false)

  useEffect(() => {
    // 初始化认证检查
    const initAuth = async () => {
      await checkAuth()
      setHasInitialized(true)
    }

    if (!hasInitialized) {
      initAuth()
    }
  }, [checkAuth, hasInitialized])

  useEffect(() => {
    // 只有在初始化完成且不在加载状态时才进行重定向
    if (hasInitialized && !isLoading && !isChecking) {
      if (isAuthenticated) {
        // 检查是否有保存的重定向路径
        const redirectPath = sessionStorage.getItem('redirectPath')
        if (redirectPath && redirectPath !== '/auth/login' && redirectPath !== '/') {
          sessionStorage.removeItem('redirectPath')
          router.replace(redirectPath)
        } else {
          router.replace('/dashboard')
        }
      } else {
        router.replace('/auth/login')
      }
    }
  }, [hasInitialized, isAuthenticated, isLoading, isChecking, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
        <p className="text-gray-600">正在加载...</p>
      </div>
    </div>
  )
}
