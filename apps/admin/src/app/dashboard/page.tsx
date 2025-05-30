'use client';

import React from 'react';
import { Row, Col, Card, Statistic, Typography, Space, Button } from 'antd';
import {
  ShoppingCartOutlined,
  UserOutlined,
  DollarOutlined,
  TrophyOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

// 模拟数据
const statsData = [
  {
    title: '总销售额',
    value: 125680,
    prefix: '$',
    suffix: '',
    precision: 2,
    trend: 'up',
    trendValue: 12.5,
    icon: <DollarOutlined className="text-green-500" />,
    color: 'green',
  },
  {
    title: '订单数量',
    value: 1234,
    prefix: '',
    suffix: '',
    precision: 0,
    trend: 'up',
    trendValue: 8.2,
    icon: <ShoppingCartOutlined className="text-blue-500" />,
    color: 'blue',
  },
  {
    title: '用户数量',
    value: 5678,
    prefix: '',
    suffix: '',
    precision: 0,
    trend: 'down',
    trendValue: 2.1,
    icon: <UserOutlined className="text-purple-500" />,
    color: 'purple',
  },
  {
    title: '转化率',
    value: 3.24,
    prefix: '',
    suffix: '%',
    precision: 2,
    trend: 'up',
    trendValue: 0.5,
    icon: <TrophyOutlined className="text-orange-500" />,
    color: 'orange',
  },
];

export default function DashboardPage() {
  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <Title level={2} className="!mb-2">
          仪表板
        </Title>
        <Text type="secondary">
          欢迎回来！这里是您的业务概览
        </Text>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} className="mb-6">
        {statsData.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card className="h-full">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Text type="secondary" className="text-sm">
                    {stat.title}
                  </Text>
                  <div className="mt-2">
                    <Statistic
                      value={stat.value}
                      prefix={stat.prefix}
                      suffix={stat.suffix}
                      precision={stat.precision}
                      valueStyle={{ fontSize: '24px', fontWeight: 'bold' }}
                    />
                  </div>
                  <div className="mt-2 flex items-center">
                    {stat.trend === 'up' ? (
                      <ArrowUpOutlined className="text-green-500 mr-1" />
                    ) : (
                      <ArrowDownOutlined className="text-red-500 mr-1" />
                    )}
                    <Text
                      className={`text-sm ${
                        stat.trend === 'up' ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {stat.trendValue}%
                    </Text>
                    <Text type="secondary" className="text-sm ml-1">
                      vs 上月
                    </Text>
                  </div>
                </div>
                <div className="text-3xl ml-4">
                  {stat.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 快速操作 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="快速操作" className="h-full">
            <Space wrap size="middle">
              <Button type="primary" size="large">
                添加商品
              </Button>
              <Button size="large">
                查看订单
              </Button>
              <Button size="large">
                用户管理
              </Button>
              <Button size="large">
                营销活动
              </Button>
            </Space>
          </Card>
        </Col>
        
        <Col xs={24} lg={8}>
          <Card title="系统状态" className="h-full">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Text>服务器状态</Text>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  <Text type="success">正常</Text>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <Text>数据库连接</Text>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  <Text type="success">正常</Text>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <Text>缓存服务</Text>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                  <Text type="warning">警告</Text>
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
