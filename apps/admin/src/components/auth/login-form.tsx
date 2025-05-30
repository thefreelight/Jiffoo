'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, Card, Typography, message, Divider } from 'antd';
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { useAuthStore } from '@/store/auth';

const { Title, Text } = Typography;

interface LoginFormData {
  email: string;
  password: string;
}

export function LoginForm() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();

  const handleSubmit = async (values: LoginFormData) => {
    setLoading(true);
    
    try {
      await login(values.email, values.password);
      message.success('登录成功！');
      router.push('/dashboard');
    } catch (error) {
      message.error('登录失败，请检查邮箱和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">J</span>
          </div>
          <Title level={2} className="!mb-2">
            <span className="text-gradient">Jiffoo Admin</span>
          </Title>
          <Text type="secondary" className="text-base">
            管理后台登录
          </Text>
        </div>

        {/* 登录表单 */}
        <Card className="shadow-lg border-0">
          <Form
            form={form}
            name="login"
            onFinish={handleSubmit}
            layout="vertical"
            size="large"
            requiredMark={false}
          >
            <Form.Item
              name="email"
              label="邮箱地址"
              rules={[
                { required: true, message: '请输入邮箱地址' },
                { type: 'email', message: '请输入有效的邮箱地址' },
              ]}
            >
              <Input
                prefix={<UserOutlined className="text-gray-400" />}
                placeholder="请输入邮箱地址"
                autoComplete="email"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6位字符' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-gray-400" />}
                placeholder="请输入密码"
                autoComplete="current-password"
                iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              />
            </Form.Item>

            <Form.Item className="!mb-6">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                className="h-12 text-base font-medium"
              >
                {loading ? '登录中...' : '登录'}
              </Button>
            </Form.Item>
          </Form>

          <Divider className="!my-6">
            <Text type="secondary" className="text-sm">
              演示账号
            </Text>
          </Divider>

          {/* 演示账号信息 */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <Text className="text-sm text-gray-600">邮箱:</Text>
              <Text className="text-sm font-mono">admin@jiffoo.com</Text>
            </div>
            <div className="flex justify-between items-center">
              <Text className="text-sm text-gray-600">密码:</Text>
              <Text className="text-sm font-mono">123456</Text>
            </div>
            <Button
              type="link"
              size="small"
              className="!p-0 !h-auto text-xs"
              onClick={() => {
                form.setFieldsValue({
                  email: 'admin@jiffoo.com',
                  password: '123456',
                });
              }}
            >
              一键填入
            </Button>
          </div>
        </Card>

        {/* 页脚信息 */}
        <div className="text-center mt-8">
          <Text type="secondary" className="text-sm">
            © 2024 Jiffoo Mall. All rights reserved.
          </Text>
        </div>
      </div>
    </div>
  );
}
