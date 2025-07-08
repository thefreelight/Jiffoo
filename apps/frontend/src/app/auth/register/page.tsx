'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/use-translation';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/components/ui/toaster';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const { currentLanguage } = useTranslation();
  const { register, isLoading, error, clearError } = useAuthStore();
  const { toast } = useToast();
  const router = useRouter();

  const [formData, setFormData] = React.useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [acceptTerms, setAcceptTerms] = React.useState(false);

  // Clear any previous errors when component mounts
  React.useEffect(() => {
    clearError();
  }, [clearError]);

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      title: 'Create Account',
      subtitle: 'Join Jiffoo Mall and start your shopping journey',
      usernameLabel: 'Username',
      usernamePlaceholder: 'Choose a username',
      emailLabel: 'Email Address',
      emailPlaceholder: 'Enter your email',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Create a password',
      confirmPasswordLabel: 'Confirm Password',
      confirmPasswordPlaceholder: 'Confirm your password',
      signUp: 'Sign Up',
      haveAccount: 'Already have an account?',
      signIn: 'Sign in',
      orContinueWith: 'Or continue with',
      google: 'Google',
      facebook: 'Facebook',
      usernameRequired: 'Username is required',
      emailRequired: 'Email is required',
      passwordRequired: 'Password is required',
      confirmPasswordRequired: 'Please confirm your password',
      invalidEmail: 'Please enter a valid email address',
      passwordTooShort: 'Password must be at least 6 characters',
      passwordMismatch: 'Passwords do not match',
      registerSuccess: 'Account created successfully!',
      registerError: 'Failed to create account',
      acceptTerms: 'I agree to the Terms of Service and Privacy Policy',
      termsRequired: 'You must accept the terms and conditions',
      termsOfService: 'Terms of Service',
      privacyPolicy: 'Privacy Policy',
    },
    'zh-CN': {
      title: '创建账户',
      subtitle: '加入 Jiffoo 商城，开始您的购物之旅',
      usernameLabel: '用户名',
      usernamePlaceholder: '选择一个用户名',
      emailLabel: '邮箱地址',
      emailPlaceholder: '请输入邮箱',
      passwordLabel: '密码',
      passwordPlaceholder: '创建密码',
      confirmPasswordLabel: '确认密码',
      confirmPasswordPlaceholder: '确认您的密码',
      signUp: '注册',
      haveAccount: '已有账户？',
      signIn: '登录',
      orContinueWith: '或者使用以下方式继续',
      google: '谷歌',
      facebook: '脸书',
      usernameRequired: '用户名是必填项',
      emailRequired: '邮箱是必填项',
      passwordRequired: '密码是必填项',
      confirmPasswordRequired: '请确认您的密码',
      invalidEmail: '请输入有效的邮箱地址',
      passwordTooShort: '密码至少需要6个字符',
      passwordMismatch: '密码不匹配',
      registerSuccess: '账户创建成功！',
      registerError: '创建账户失败',
      acceptTerms: '我同意服务条款和隐私政策',
      termsRequired: '您必须接受条款和条件',
      termsOfService: '服务条款',
      privacyPolicy: '隐私政策',
    },
    'ja-JP': {
      title: 'アカウント作成',
      subtitle: 'Jiffoo Mallに参加してショッピングの旅を始めましょう',
      usernameLabel: 'ユーザー名',
      usernamePlaceholder: 'ユーザー名を選択',
      emailLabel: 'メールアドレス',
      emailPlaceholder: 'メールアドレスを入力',
      passwordLabel: 'パスワード',
      passwordPlaceholder: 'パスワードを作成',
      confirmPasswordLabel: 'パスワード確認',
      confirmPasswordPlaceholder: 'パスワードを確認',
      signUp: 'サインアップ',
      haveAccount: 'すでにアカウントをお持ちですか？',
      signIn: 'サインイン',
      orContinueWith: 'または以下で続行',
      google: 'Google',
      facebook: 'Facebook',
      usernameRequired: 'ユーザー名は必須です',
      emailRequired: 'メールアドレスは必須です',
      passwordRequired: 'パスワードは必須です',
      confirmPasswordRequired: 'パスワードを確認してください',
      invalidEmail: '有効なメールアドレスを入力してください',
      passwordTooShort: 'パスワードは6文字以上である必要があります',
      passwordMismatch: 'パスワードが一致しません',
      registerSuccess: 'アカウントが正常に作成されました！',
      registerError: 'アカウントの作成に失敗しました',
      acceptTerms: '利用規約とプライバシーポリシーに同意します',
      termsRequired: '利用規約に同意する必要があります',
      termsOfService: '利用規約',
      privacyPolicy: 'プライバシーポリシー',
    },
  };

  const t = (key: string) => {
    return translations[currentLanguage]?.[key] || translations['en-US'][key] || key;
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear any previous errors
    clearError();

    // Validation
    if (!formData.username.trim()) {
      toast({
        title: t('usernameRequired'),
        variant: 'destructive',
      });
      return;
    }

    if (!formData.email) {
      toast({
        title: t('emailRequired'),
        variant: 'destructive',
      });
      return;
    }

    if (!validateEmail(formData.email)) {
      toast({
        title: t('invalidEmail'),
        variant: 'destructive',
      });
      return;
    }

    if (!formData.password) {
      toast({
        title: t('passwordRequired'),
        variant: 'destructive',
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: t('passwordTooShort'),
        variant: 'destructive',
      });
      return;
    }

    if (!formData.confirmPassword) {
      toast({
        title: t('confirmPasswordRequired'),
        variant: 'destructive',
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: t('passwordMismatch'),
        variant: 'destructive',
      });
      return;
    }

    if (!acceptTerms) {
      toast({
        title: t('termsRequired'),
        variant: 'destructive',
      });
      return;
    }

    try {
      // 使用真实的API调用进行注册
      await register({
        email: formData.email,
        username: formData.username,
        password: formData.password,
      });

      toast({
        title: t('registerSuccess'),
      });

      // 注册成功后跳转到首页
      router.push('/');
    } catch (error: any) {
      // 错误已经在store中处理，这里只需要显示toast
      toast({
        title: error.message || t('registerError'),
        variant: 'destructive',
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Display error if any */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Username Field */}
        <div className="space-y-2">
          <label htmlFor="username" className="text-sm font-medium">
            {t('usernameLabel')}
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="username"
              type="text"
              placeholder={t('usernamePlaceholder')}
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              className="pl-10"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Email Field */}
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            {t('emailLabel')}
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="pl-10"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            {t('passwordLabel')}
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder={t('passwordPlaceholder')}
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className="pl-10 pr-10"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              disabled={isLoading}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Confirm Password Field */}
        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            {t('confirmPasswordLabel')}
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder={t('confirmPasswordPlaceholder')}
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              className="pl-10 pr-10"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              disabled={isLoading}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Terms Acceptance */}
        <div className="flex items-start space-x-2">
          <input
            type="checkbox"
            id="acceptTerms"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-1 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
            disabled={isLoading}
          />
          <label htmlFor="acceptTerms" className="text-sm text-muted-foreground">
            {t('acceptTerms').split('Terms of Service')[0]}
            <Link href="/terms" className="text-primary hover:underline">
              {t('termsOfService')}
            </Link>
            {' and '}
            <Link href="/privacy" className="text-primary hover:underline">
              {t('privacyPolicy')}
            </Link>
          </label>
        </div>

        {/* Sign Up Button */}
        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Creating account...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <span>{t('signUp')}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          )}
        </Button>
      </form>

      {/* Social Login */}
      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              {t('orContinueWith')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-6">
          <Button variant="outline" disabled={isLoading}>
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {t('google')}
          </Button>
          <Button variant="outline" disabled={isLoading}>
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            {t('facebook')}
          </Button>
        </div>
      </div>

      {/* Sign In Link */}
      <div className="text-center mt-6">
        <p className="text-muted-foreground">
          {t('haveAccount')}{' '}
          <Link href="/auth/login" className="text-primary hover:underline font-medium">
            {t('signIn')}
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
