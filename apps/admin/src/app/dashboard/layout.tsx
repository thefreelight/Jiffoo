'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Layout, Menu, Avatar, Dropdown, Button, Typography, Space } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  ShoppingCartOutlined,
  TagsOutlined,
  BarChartOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/store/auth';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

// 菜单项配置
const menuItems = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '仪表板',
  },
  {
    key: 'products',
    icon: <ShoppingOutlined />,
    label: '商品管理',
    children: [
      {
        key: '/dashboard/products',
        label: '商品列表',
      },
      {
        key: '/dashboard/products/categories',
        label: '分类管理',
      },
      {
        key: '/dashboard/products/add',
        label: '添加商品',
      },
    ],
  },
  {
    key: 'orders',
    icon: <ShoppingCartOutlined />,
    label: '订单管理',
    children: [
      {
        key: '/dashboard/orders',
        label: '订单列表',
      },
      {
        key: '/dashboard/orders/pending',
        label: '待处理订单',
      },
    ],
  },
  {
    key: '/dashboard/users',
    icon: <TeamOutlined />,
    label: '用户管理',
  },
  {
    key: 'marketing',
    icon: <TagsOutlined />,
    label: '营销管理',
    children: [
      {
        key: '/dashboard/coupons',
        label: '优惠券',
      },
      {
        key: '/dashboard/promotions',
        label: '促销活动',
      },
    ],
  },
  {
    key: '/dashboard/analytics',
    icon: <BarChartOutlined />,
    label: '数据分析',
  },
  {
    key: '/dashboard/settings',
    icon: <SettingOutlined />,
    label: '系统设置',
  },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const { user, logout, isAuthenticated, checkAuth } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState(['/dashboard']);

  // 检查认证状态
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // 如果未认证，重定向到登录页
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  // 处理菜单点击
  const handleMenuClick = ({ key }: { key: string }) => {
    setSelectedKeys([key]);
    router.push(key);
  };

  // 处理登出
  const handleLogout = () => {
    logout();
    router.push('/');
  };

  // 用户下拉菜单
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '账户设置',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  if (!isAuthenticated) {
    return null; // 重定向中
  }

  return (
    <Layout className="min-h-screen">
      {/* 侧边栏 */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={256}
        className="!bg-white border-r border-gray-200"
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-gray-200">
          {collapsed ? (
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">J</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">J</span>
              </div>
              <span className="text-xl font-bold text-gradient">Jiffoo Admin</span>
            </div>
          )}
        </div>

        {/* 菜单 */}
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          items={menuItems}
          onClick={handleMenuClick}
          className="border-none"
        />
      </Sider>

      {/* 主要内容区域 */}
      <Layout>
        {/* 顶部导航 */}
        <Header className="!bg-white !px-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="mr-4"
            />
          </div>

          <div className="flex items-center space-x-4">
            {/* 通知 */}
            <Button type="text" icon={<BellOutlined />} />

            {/* 用户信息 */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded-lg">
                <Avatar
                  size="small"
                  src={user?.avatar}
                  icon={<UserOutlined />}
                />
                {!collapsed && (
                  <Space>
                    <Text className="font-medium">{user?.name}</Text>
                  </Space>
                )}
              </div>
            </Dropdown>
          </div>
        </Header>

        {/* 内容区域 */}
        <Content className="bg-gray-50">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
