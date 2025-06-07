'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Clock, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/use-translation';
import { useToast } from '@/components/ui/toaster';

export default function ContactPage() {
  const { currentLanguage } = useTranslation();
  const { toast } = useToast();
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isLoading, setIsLoading] = React.useState(false);

  const translations: Record<string, Record<string, string>> = {
    'en-US': {
      title: 'Contact Us',
      subtitle: 'Get in touch with our team. We\'re here to help!',
      getInTouch: 'Get in Touch',
      contactInfo: 'Contact Information',
      nameLabel: 'Full Name',
      namePlaceholder: 'Enter your full name',
      emailLabel: 'Email Address',
      emailPlaceholder: 'Enter your email',
      subjectLabel: 'Subject',
      subjectPlaceholder: 'What is this about?',
      messageLabel: 'Message',
      messagePlaceholder: 'Tell us how we can help you...',
      sendMessage: 'Send Message',
      emailAddress: 'Email Address',
      phoneNumber: 'Phone Number',
      officeAddress: 'Office Address',
      businessHours: 'Business Hours',
      mondayFriday: 'Monday - Friday',
      saturday: 'Saturday',
      sunday: 'Sunday',
      closed: 'Closed',
      messageSent: 'Message sent successfully!',
      messageError: 'Failed to send message. Please try again.',
      nameRequired: 'Name is required',
      emailRequired: 'Email is required',
      subjectRequired: 'Subject is required',
      messageRequired: 'Message is required',
      invalidEmail: 'Please enter a valid email address',
    },
    'zh-CN': {
      title: '联系我们',
      subtitle: '与我们的团队取得联系。我们随时为您提供帮助！',
      getInTouch: '联系我们',
      contactInfo: '联系信息',
      nameLabel: '姓名',
      namePlaceholder: '请输入您的姓名',
      emailLabel: '邮箱地址',
      emailPlaceholder: '请输入您的邮箱',
      subjectLabel: '主题',
      subjectPlaceholder: '这是关于什么的？',
      messageLabel: '留言',
      messagePlaceholder: '告诉我们如何为您提供帮助...',
      sendMessage: '发送消息',
      emailAddress: '邮箱地址',
      phoneNumber: '电话号码',
      officeAddress: '办公地址',
      businessHours: '营业时间',
      mondayFriday: '周一 - 周五',
      saturday: '周六',
      sunday: '周日',
      closed: '休息',
      messageSent: '消息发送成功！',
      messageError: '发送消息失败，请重试。',
      nameRequired: '姓名是必填项',
      emailRequired: '邮箱是必填项',
      subjectRequired: '主题是必填项',
      messageRequired: '留言是必填项',
      invalidEmail: '请输入有效的邮箱地址',
    },
    'ja-JP': {
      title: 'お問い合わせ',
      subtitle: 'チームにお気軽にお問い合わせください。喜んでサポートいたします！',
      getInTouch: 'お問い合わせ',
      contactInfo: '連絡先情報',
      nameLabel: 'お名前',
      namePlaceholder: 'お名前を入力してください',
      emailLabel: 'メールアドレス',
      emailPlaceholder: 'メールアドレスを入力してください',
      subjectLabel: '件名',
      subjectPlaceholder: 'どのような件でしょうか？',
      messageLabel: 'メッセージ',
      messagePlaceholder: 'どのようにお手伝いできるかお聞かせください...',
      sendMessage: 'メッセージを送信',
      emailAddress: 'メールアドレス',
      phoneNumber: '電話番号',
      officeAddress: 'オフィス住所',
      businessHours: '営業時間',
      mondayFriday: '月曜日 - 金曜日',
      saturday: '土曜日',
      sunday: '日曜日',
      closed: '休業',
      messageSent: 'メッセージが正常に送信されました！',
      messageError: 'メッセージの送信に失敗しました。もう一度お試しください。',
      nameRequired: 'お名前は必須です',
      emailRequired: 'メールアドレスは必須です',
      subjectRequired: '件名は必須です',
      messageRequired: 'メッセージは必須です',
      invalidEmail: '有効なメールアドレスを入力してください',
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
    
    // Validation
    if (!formData.name.trim()) {
      toast({
        title: t('nameRequired'),
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

    if (!formData.subject.trim()) {
      toast({
        title: t('subjectRequired'),
        variant: 'destructive',
      });
      return;
    }

    if (!formData.message.trim()) {
      toast({
        title: t('messageRequired'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: t('messageSent'),
      });

      // Reset form
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: '',
      });
    } catch (error) {
      toast({
        title: t('messageError'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="py-16 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">{t('title')}</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('subtitle')}
            </p>
          </motion.div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6">{t('getInTouch')}</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium mb-2">
                      {t('nameLabel')}
                    </label>
                    <Input
                      id="name"
                      type="text"
                      placeholder={t('namePlaceholder')}
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-2">
                      {t('emailLabel')}
                    </label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={t('emailPlaceholder')}
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium mb-2">
                    {t('subjectLabel')}
                  </label>
                  <Input
                    id="subject"
                    type="text"
                    placeholder={t('subjectPlaceholder')}
                    value={formData.subject}
                    onChange={(e) => handleInputChange('subject', e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium mb-2">
                    {t('messageLabel')}
                  </label>
                  <textarea
                    id="message"
                    rows={6}
                    placeholder={t('messagePlaceholder')}
                    value={formData.message}
                    onChange={(e) => handleInputChange('message', e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  loading={isLoading}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {t('sendMessage')}
                </Button>
              </form>
            </div>
          </motion.div>

          {/* Contact Information */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6">{t('contactInfo')}</h2>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-100 dark:bg-blue-900/20 rounded-full p-3">
                    <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{t('emailAddress')}</h3>
                    <p className="text-muted-foreground">support@jiffoo.com</p>
                    <p className="text-muted-foreground">sales@jiffoo.com</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-green-100 dark:bg-green-900/20 rounded-full p-3">
                    <Phone className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{t('phoneNumber')}</h3>
                    <p className="text-muted-foreground">+1 (555) 123-4567</p>
                    <p className="text-muted-foreground">+1 (555) 987-6543</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-purple-100 dark:bg-purple-900/20 rounded-full p-3">
                    <MapPin className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{t('officeAddress')}</h3>
                    <p className="text-muted-foreground">
                      123 Commerce Street<br />
                      Tech City, TC 12345<br />
                      United States
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-orange-100 dark:bg-orange-900/20 rounded-full p-3">
                    <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{t('businessHours')}</h3>
                    <div className="text-muted-foreground space-y-1">
                      <p>{t('mondayFriday')}: 9:00 AM - 6:00 PM</p>
                      <p>{t('saturday')}: 10:00 AM - 4:00 PM</p>
                      <p>{t('sunday')}: {t('closed')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Map Placeholder */}
            <div className="mt-8 bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8">
              <div className="bg-muted rounded-lg h-64 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Interactive Map</p>
                  <p className="text-sm text-muted-foreground">Coming Soon</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
