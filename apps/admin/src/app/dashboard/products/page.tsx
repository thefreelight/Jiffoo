'use client';

import React, { useState } from 'react';
import { Table, Card, Button, Space, Tag, Image, Typography, Input, Select, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;
const { Search } = Input;

// 模拟商品数据
interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: 'active' | 'inactive';
  image: string;
  createdAt: string;
}

const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Wireless Headphones',
    category: 'Electronics',
    price: 99.99,
    stock: 150,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100&h=100&fit=crop',
    createdAt: '2024-01-15',
  },
  {
    id: '2',
    name: 'Smart Watch',
    category: 'Electronics',
    price: 199.99,
    stock: 89,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100&h=100&fit=crop',
    createdAt: '2024-01-14',
  },
  {
    id: '3',
    name: 'Designer Jacket',
    category: 'Fashion',
    price: 159.99,
    stock: 0,
    status: 'inactive',
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=100&h=100&fit=crop',
    createdAt: '2024-01-13',
  },
];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [loading, setLoading] = useState(false);

  const handleDelete = (id: string) => {
    setProducts(products.filter(product => product.id !== id));
  };

  const columns: ColumnsType<Product> = [
    {
      title: '商品',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className="flex items-center space-x-3">
          <Image
            src={record.image}
            alt={text}
            width={50}
            height={50}
            className="rounded-lg object-cover"
          />
          <div>
            <div className="font-medium">{text}</div>
            <div className="text-sm text-gray-500">ID: {record.id}</div>
          </div>
        </div>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category) => <Tag color="blue">{category}</Tag>,
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      render: (price) => `$${price.toFixed(2)}`,
      sorter: (a, b) => a.price - b.price,
    },
    {
      title: '库存',
      dataIndex: 'stock',
      key: 'stock',
      render: (stock) => (
        <span className={stock > 0 ? 'text-green-600' : 'text-red-600'}>
          {stock}
        </span>
      ),
      sorter: (a, b) => a.stock - b.stock,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '上架' : '下架'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => console.log('Edit', record.id)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个商品吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <Title level={2} className="!mb-0">
          商品管理
        </Title>
        <Button type="primary" icon={<PlusOutlined />} size="large">
          添加商品
        </Button>
      </div>

      <Card>
        <div className="flex justify-between items-center mb-4">
          <Space>
            <Search
              placeholder="搜索商品名称"
              allowClear
              style={{ width: 300 }}
              onSearch={(value) => console.log('Search:', value)}
            />
            <Select
              placeholder="选择分类"
              style={{ width: 150 }}
              allowClear
              options={[
                { label: 'Electronics', value: 'electronics' },
                { label: 'Fashion', value: 'fashion' },
                { label: 'Home & Garden', value: 'home' },
              ]}
            />
            <Select
              placeholder="商品状态"
              style={{ width: 120 }}
              allowClear
              options={[
                { label: '上架', value: 'active' },
                { label: '下架', value: 'inactive' },
              ]}
            />
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={products}
          rowKey="id"
          loading={loading}
          pagination={{
            total: products.length,
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
