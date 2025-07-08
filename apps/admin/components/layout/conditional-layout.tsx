'use client';

import { useAuth } from '@/hooks/useAuth';
import { AdminLayout } from './admin-layout';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // 登录页面路径
  const isLoginPage = pathname === '/';

  // 路由保护：未认证用户访问受保护页面时重定向到登录页
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isLoginPage) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, isLoginPage, router]);

  // 如果已认证用户在登录页面，重定向到仪表板
  useEffect(() => {
    if (!isLoading && isAuthenticated && isLoginPage) {
      router.push('/dashboard');
    }
  }, [isLoading, isAuthenticated, isLoginPage, router]);

  // 如果正在加载认证状态，显示加载界面
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // 如果用户已认证且不在登录页面，显示管理后台布局
  if (isAuthenticated && !isLoginPage) {
    return <AdminLayout>{children}</AdminLayout>;
  }

  // 如果用户未认证且在登录页面，只显示登录页面内容
  if (!isAuthenticated && isLoginPage) {
    return <>{children}</>;
  }

  // 其他情况（未认证用户访问受保护页面）显示加载状态，等待重定向
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}
