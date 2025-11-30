'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authApi } from '@/lib/api';
import { Loader2, Shield } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = () => {
      // 如果是登录页面，直接显示
      if (pathname === '/login') {
        setIsLoading(false);
        return;
      }

      // 检查是否有token
      const token = localStorage.getItem('auth_token');
      const user = authApi.getCurrentUser();

      if (!token || !user) {
        router.push('/login');
        return;
      }

      // 检查是否有Super-Admin权限
      if (!authApi.isSuperAdmin()) {
        // 清除无效的认证信息
        authApi.logout();
        return;
      }

      setIsAuthenticated(true);
      setIsLoading(false);
    };

    checkAuth();
  }, [pathname, router]);

  // 登录页面直接显示
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // 加载中状态
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-600 rounded-full">
              <Shield className="h-8 w-8 text-white" />
            </div>
          </div>
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // 未认证状态
  if (!isAuthenticated) {
    return null; // 会被重定向到登录页
  }

  // 已认证，显示内容
  return <>{children}</>;
}

// 高阶组件版本
export function withAuthGuard<P extends object>(
  Component: React.ComponentType<P>
) {
  return function AuthGuardedComponent(props: P) {
    return (
      <AuthGuard>
        <Component {...props} />
      </AuthGuard>
    );
  };
}
