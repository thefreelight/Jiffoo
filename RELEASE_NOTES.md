# 🎉 Jiffoo Release Notes

## 🐳 **v0.2.1 - Docker 容器化验证版本** (2025-08-02)

### ✨ **新增功能**

#### **🔧 Docker 完整验证系统**
- **新增**: `scripts/validate-docker.sh` - 完整的 Docker 环境验证工具
- **新增**: Docker Compose 环境自动化测试和验证
- **新增**: PostgreSQL、Redis、Backend API 健康检查
- **新增**: 自动生成 Docker 验证报告文档

#### **🛠️ 验证工具功能**
- `--check`: Docker 环境检查和配置验证
- `--build`: 镜像构建和依赖检查
- `--up/--down`: 服务启停和状态管理
- `--test`: 服务连接测试和健康检查
- `--status`: 实时服务状态监控
- `--logs`: 服务日志查看和分析
- `--clean/--reset`: 环境清理和重置

### 🔧 **修复和优化**

#### **Stripe API 兼容性修复**
- 修复了 TypeScript 类型错误
- 使用正确的 Stripe API 版本 `2025-05-28.basil`
- 确保与最新 Stripe SDK 的兼容性

#### **Docker 容器权限优化**
- 修复了日志文件写入权限问题
- 优化了 fastify 用户权限设置
- 改进了容器内文件系统权限管理

#### **构建流程优化**
- 移除了可能导致版本冲突的 TypeScript 检查
- 优化了 Docker 镜像构建过程
- 改进了依赖安装和缓存策略

### 📊 **验证结果**
```
✅ PostgreSQL 15-alpine - 数据库服务正常运行
✅ Redis 7-alpine - 缓存服务正常运行
✅ Backend API - 服务正常，健康检查通过
✅ 热更新功能 - 在容器环境中正常工作
✅ 服务端点 - http://localhost:8001/health 响应正常
```

### 🌐 **可用服务端点**
- **Backend API**: http://localhost:8001 ✅
- **API 文档**: http://localhost:8001/docs ✅
- **PostgreSQL**: localhost:5432 ✅
- **Redis**: localhost:6379 ✅

---

## 🚀 **v1.0.1-opensource** - 开源版本发布

### ✨ **Enhanced Open Source Experience**

### ✨ **Enhanced Open Source Experience**

#### **🔧 One-Click Setup**
- **New**: `start-opensource.sh` script for instant deployment
- **Improved**: Automatic dependency checking and installation
- **Added**: Smart environment configuration detection
- **Enhanced**: Better error handling and user guidance

#### **🔌 Plugin Ecosystem Integration**
- **Connected**: Official Jiffoo plugin store integration
- **Added**: License server connectivity for commercial plugins
- **Improved**: Plugin discovery and installation workflow
- **Enhanced**: Seamless upgrade path to commercial features

#### **⚙️ Configuration Optimization**
- **Simplified**: SQLite default for easy development setup
- **Added**: PostgreSQL support for production
- **Improved**: Environment variable management
- **Enhanced**: Docker and cloud deployment readiness

### 🆓 **Open Source Core Features**

#### **Complete Authentication System**
```
✅ JWT-based authentication
✅ Role-based permissions (ADMIN, USER, TENANT_ADMIN)
✅ Multi-tenant support framework
✅ OAuth2 provider integration
✅ Session management
```

#### **Full E-commerce Functionality**
```
✅ Product management (CRUD, categories, variants)
✅ Shopping cart and checkout
✅ Order management and tracking
✅ User profiles and preferences
✅ Inventory tracking
✅ Search and filtering
✅ Payment interface (extensible via plugins)
```

#### **Plugin System Framework**
```
✅ Complete plugin SDK and API
✅ Hot-swappable plugin architecture
✅ Event system and hooks
✅ Plugin lifecycle management
✅ Configuration management
✅ TypeScript support
```

#### **Developer Experience**
```
✅ RESTful API with OpenAPI documentation
✅ TypeScript SDK
✅ Database migrations (Prisma)
✅ Docker support
✅ Development tools
✅ Comprehensive testing framework
```

### 💰 **Commercial Ecosystem Ready**

#### **Plugin Store Integration**
- **URL**: https://plugins.jiffoo.com
- **Features**: Browse, purchase, and install commercial plugins
- **Categories**: Payment gateways, marketing tools, analytics, AI features

#### **Available Commercial Plugins**
- **Stripe Pro**: Advanced payment processing ($29.99/month)
- **PayPal Advanced**: Marketplace and multi-vendor support ($29.99/month)
- **WeChat Pay & Alipay**: China market integration ($39.99/month)
- **Email Marketing**: Automation and campaigns ($49.99/month)
- **Advanced Analytics**: Business intelligence ($59.99/month)
- **AI Recommendations**: Machine learning features ($79.99/month)

#### **SaaS Services**
- **Cloud Hosting**: Multi-tenant deployment ($199-$499/month)
- **Enterprise Support**: Dedicated assistance and SLA
- **Custom Development**: Tailored solutions

## 🚀 **Quick Start Guide**

### **Method 1: One-Click Setup (Recommended)**
```bash
git clone https://github.com/thefreelight/Jiffoo.git
cd Jiffoo
./start-opensource.sh
```

### **Method 2: Manual Setup**
```bash
# Prerequisites: Node.js >= 18, PostgreSQL/SQLite
git clone https://github.com/thefreelight/Jiffoo.git
cd Jiffoo
pnpm install
cp apps/backend/.env.example apps/backend/.env
# Edit .env with your configuration
pnpm db:migrate
pnpm db:seed
pnpm dev
```

### **Access Your Store**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Docs**: http://localhost:3001/docs
- **Admin Panel**: http://localhost:3000/admin

### **Default Credentials**
```
Admin: admin@jiffoo.com / admin123
User: user@jiffoo.com / user123
```

## 🔌 **Plugin Development**

### **Create a Plugin**
```typescript
import { JiffooPlugin, PluginContext } from '@jiffoo/plugin-sdk';

export default class MyPlugin implements JiffooPlugin {
  metadata = {
    name: 'my-plugin',
    version: '1.0.0',
    description: 'My awesome plugin'
  };

  async activate(context: PluginContext) {
    // Your plugin logic here
  }
}
```

### **Install Plugins**
```bash
# Free community plugin
pnpm plugin:install my-community-plugin

# Commercial plugin (requires license)
pnpm plugin:install stripe-pro --license=your-license-key
```

## 🤝 **Contributing**

We welcome contributions! See our [Contributing Guide](CONTRIBUTING.md) for details.

### **Areas We Need Help**
- 🐛 Bug fixes and testing
- 📚 Documentation improvements
- 🌍 Translations (i18n)
- 🔌 Community plugins
- 💡 Feature suggestions

## 📞 **Support & Community**

### **Free Support**
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Community Q&A
- **Documentation**: Comprehensive guides

### **Commercial Support**
- **Plugin Store**: https://plugins.jiffoo.com
- **Cloud Services**: https://cloud.jiffoo.com
- **Enterprise**: enterprise@jiffoo.com

### **Community**
- **Discord**: https://discord.gg/jiffoo
- **Twitter**: @JiffooMall
- **Blog**: https://blog.jiffoo.com

## 📄 **License**

**Open Source Core**: MIT License - Use freely for any purpose
**Commercial Plugins**: Proprietary licenses - Subscription required

---

## 🎯 **What's Next?**

### **Upcoming Features**
- Enhanced mobile responsiveness
- Advanced search capabilities
- Improved admin dashboard
- More community plugins
- Better documentation

### **Commercial Roadmap**
- AI-powered features
- Advanced analytics
- Multi-vendor marketplace
- White-label solutions
- Enterprise integrations

---

**🚀 Ready to build your e-commerce empire? Start with open source, scale with commercial features!**

**⭐ If you find Jiffoo useful, please star our repository and share with the community!**
