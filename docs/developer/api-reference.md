# API 参考

## 基础信息

### Base URL
```
https://api.yourdomain.com/api
```

### 认证
大部分 API 需要 Bearer Token 认证：
```
Authorization: Bearer <token>
```

### 租户标识
所有请求需要包含租户 ID：
```
x-tenant-id: <tenant_id>
```

## 认证 API

### 注册
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "username": "username"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "user": { "id": "1", "email": "user@example.com" },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### 登录
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

## 商品 API

### 商品列表
```http
GET /products?page=1&limit=20&category=electronics
```

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| limit | number | 每页数量 |
| category | string | 分类筛选 |
| search | string | 搜索关键词 |
| sort | string | 排序字段 |

### 商品详情
```http
GET /products/:id
```

### 创建商品 (商户)
```http
POST /products
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Product Name",
  "description": "Description",
  "price": 99.99,
  "categoryId": "cat-1",
  "images": ["url1", "url2"]
}
```

## 购物车 API

### 获取购物车
```http
GET /cart
Authorization: Bearer <token>
```

### 添加商品
```http
POST /cart/add
Authorization: Bearer <token>
Content-Type: application/json

{
  "productId": "prod-1",
  "variantId": "var-1",
  "quantity": 2
}
```

### 更新数量
```http
PUT /cart/update
Authorization: Bearer <token>
Content-Type: application/json

{
  "itemId": "item-1",
  "quantity": 3
}
```

### 删除商品
```http
DELETE /cart/remove/:itemId
Authorization: Bearer <token>
```

## 订单 API

### 创建订单
```http
POST /orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    { "productId": "prod-1", "variantId": "var-1", "quantity": 2 }
  ],
  "shippingAddress": {
    "name": "John Doe",
    "phone": "1234567890",
    "address": "123 Main St",
    "city": "New York",
    "postalCode": "10001",
    "country": "US"
  },
  "paymentMethod": "stripe"
}
```

### 订单列表
```http
GET /orders?page=1&limit=10&status=pending
Authorization: Bearer <token>
```

### 订单详情
```http
GET /orders/:id
Authorization: Bearer <token>
```

## 错误响应

所有错误响应格式：
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### 错误码

| 状态码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

## 分页响应

列表 API 返回分页信息：
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

