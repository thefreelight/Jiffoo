'use client';

import React, { useState } from 'react';
import { Table, Card, Button, Space, Tag, Avatar, Typography, Input, Select } from 'antd';
import { UserOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;
const { Search } = Input;

// 模拟用户数据
interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive' | 'banned';
  role: 'customer' | 'vip' | 'admin';
  avatar?: string;
  registeredAt: string;
  lastLogin: string;
}

const mockUsers: User[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1 234 567 8900',
    status: 'active',
    role: 'customer',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face',
    registeredAt: '2024-01-15',
    lastLogin: '2024-01-20',
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '+1 234 567 8901',
    status: 'active',
    role: 'vip',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=40&h=40&fit=crop&crop=face',
    registeredAt: '2024-01-14',
    lastLogin: '2024-01-19',
  },
  {
    id: '3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    phone: '+1 234 567 8902',
    status: 'banned',
    role: 'customer',
    registeredAt: '2024-01-13',
    lastLogin: '2024-01-18',
  },
];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [loading, setLoading] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'green';
      case 'inactive':
        return 'orange';
      case 'banned':
        return 'red';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '活跃';
      case 'inactive':
        return '非活跃';
      case 'banned':
        return '已封禁';
      default:
        return status;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'purple';
      case 'vip':
        return 'gold';
      case 'customer':
        return 'blue';
      default:
        return 'default';
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin':
        return '管理员';
      case 'vip':
        return 'VIP用户';
      case 'customer':
        return '普通用户';
      default:
        return role;
    }
  };

  const columns: ColumnsType<User> = [
    {
      title: '用户',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className="flex items-center space-x-3">
          <Avatar
            src={record.avatar}
            icon={<UserOutlined />}
            size={40}
          />
          <div>
            <div className="font-medium">{text}</div>
            <div className="text-sm text-gray-500">ID: {record.id}</div>
          </div>
        </div>
      ),
    },
    {
      title: '联系信息',
      key: 'contact',
      render: (_, record) => (
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <MailOutlined className="text-gray-400" />
            <span className="text-sm">{record.email}</span>
          </div>
          <div className="flex items-center space-x-2">
            <PhoneOutlined className="text-gray-400" />
            <span className="text-sm">{record.phone}</span>
          </div>
        </div>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color={getRoleColor(role)}>
          {getRoleText(role)}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'registeredAt',
      key: 'registeredAt',
      sorter: (a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime(),
    },
    {
      title: '最后登录',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      sorter: (a, b) => new Date(a.lastLogin).getTime() - new Date(b.lastLogin).getTime(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            onClick={() => console.log('View', record.id)}
          >
            查看
          </Button>
          <Button
            type="link"
            onClick={() => console.log('Edit', record.id)}
          >
            编辑
          </Button>
          {record.status !== 'banned' ? (
            <Button
              type="link"
              danger
              onClick={() => console.log('Ban', record.id)}
            >
              封禁
            </Button>
          ) : (
            <Button
              type="link"
              onClick={() => console.log('Unban', record.id)}
            >
              解封
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <Title level={2} className="!mb-0">
          用户管理
        </Title>
      </div>

      <Card>
        <div className="flex justify-between items-center mb-4">
          <Space>
            <Search
              placeholder="搜索用户名称或邮箱"
              allowClear
              style={{ width: 300 }}
              onSearch={(value) => console.log('Search:', value)}
            />
            <Select
              placeholder="用户角色"
              style={{ width: 120 }}
              allowClear
              options={[
                { label: '管理员', value: 'admin' },
                { label: 'VIP用户', value: 'vip' },
                { label: '普通用户', value: 'customer' },
              ]}
            />
            <Select
              placeholder="用户状态"
              style={{ width: 120 }}
              allowClear
              options={[
                { label: '活跃', value: 'active' },
                { label: '非活跃', value: 'inactive' },
                { label: '已封禁', value: 'banned' },
              ]}
            />
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            total: users.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
        />
      </Card>
    </div>
  );
}
