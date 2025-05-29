import { FastifyInstance } from 'fastify';
import { Plugin } from './types';

const i18nDemoPlugin: Plugin = {
  name: 'i18n-demo-plugin',
  version: '1.0.0',
  description: 'Demonstration plugin showing i18n integration',
  
  async register(app: FastifyInstance) {
    // 多语言欢迎消息
    app.get('/api/plugins/i18n-demo/welcome', {
      schema: {
        tags: ['i18n-demo'],
        summary: '多语言欢迎消息',
        description: '根据用户语言返回欢迎消息',
        querystring: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '用户名称' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              language: { type: 'string' },
              timestamp: { type: 'string' }
            }
          }
        }
      }
    }, async (request, reply) => {
      const { name = 'Guest' } = request.query as { name?: string };
      
      // 使用 i18n 中间件提供的翻译函数
      const welcomeText = await request.t('common.welcome', {
        defaultValue: 'Welcome',
        interpolations: { name }
      });
      
      const message = `${welcomeText}, ${name}!`;
      
      return reply.send({
        message,
        language: request.language,
        timestamp: new Date().toISOString()
      });
    });

    // 多语言商品信息
    app.get('/api/plugins/i18n-demo/product/:id', {
      schema: {
        tags: ['i18n-demo'],
        summary: '多语言商品信息',
        description: '根据用户语言返回商品信息',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          },
          required: ['id']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              price: { type: 'string' },
              currency: { type: 'string' },
              language: { type: 'string' }
            }
          }
        }
      }
    }, async (request, reply) => {
      const { id } = request.params as { id: string };
      
      // 模拟商品数据
      const products: Record<string, any> = {
        '1': {
          id: '1',
          basePrice: 999,
          images: ['iphone.jpg']
        },
        '2': {
          id: '2',
          basePrice: 1299,
          images: ['macbook.jpg']
        }
      };

      const product = products[id];
      if (!product) {
        const notFoundMsg = await request.t('error.not_found', {
          defaultValue: 'Product not found'
        });
        return reply.status(404).send({ error: notFoundMsg });
      }

      // 获取本地化的商品信息
      const productName = await request.t(`product.${id}.name`, {
        defaultValue: `Product ${id}`,
        namespace: 'product'
      });

      const productDescription = await request.t(`product.${id}.description`, {
        defaultValue: `Description for product ${id}`,
        namespace: 'product'
      });

      const priceLabel = await request.t('product.price', {
        defaultValue: 'Price',
        namespace: 'product'
      });

      // 根据语言格式化价格
      const languageInfo = request.getLanguageInfo();
      let formattedPrice = '';
      let currency = '';

      switch (request.language) {
        case 'zh-CN':
          formattedPrice = `¥${product.basePrice}`;
          currency = 'CNY';
          break;
        case 'en-US':
          formattedPrice = `$${Math.round(product.basePrice / 7)}`;
          currency = 'USD';
          break;
        case 'ja-JP':
          formattedPrice = `¥${Math.round(product.basePrice * 15)}`;
          currency = 'JPY';
          break;
        case 'ko-KR':
          formattedPrice = `₩${Math.round(product.basePrice * 180)}`;
          currency = 'KRW';
          break;
        case 'es-ES':
          formattedPrice = `€${Math.round(product.basePrice / 8)}`;
          currency = 'EUR';
          break;
        case 'fr-FR':
          formattedPrice = `€${Math.round(product.basePrice / 8)}`;
          currency = 'EUR';
          break;
        default:
          formattedPrice = `¥${product.basePrice}`;
          currency = 'CNY';
      }

      return reply.send({
        id: product.id,
        name: productName,
        description: productDescription,
        price: formattedPrice,
        currency,
        language: request.language,
        languageInfo
      });
    });

    // 多语言表单验证消息
    app.post('/api/plugins/i18n-demo/validate', {
      schema: {
        tags: ['i18n-demo'],
        summary: '多语言表单验证',
        description: '演示多语言表单验证消息',
        body: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            password: { type: 'string' },
            name: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              valid: { type: 'boolean' },
              errors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    message: { type: 'string' }
                  }
                }
              },
              language: { type: 'string' }
            }
          }
        }
      }
    }, async (request, reply) => {
      const { email, password, name } = request.body as {
        email?: string;
        password?: string;
        name?: string;
      };

      const errors: Array<{ field: string; message: string }> = [];

      // 验证邮箱
      if (!email) {
        const message = await request.t('validation.required_field', {
          defaultValue: 'This field is required',
          namespace: 'validation'
        });
        errors.push({ field: 'email', message });
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        const message = await request.t('validation.invalid_email', {
          defaultValue: 'Please enter a valid email address',
          namespace: 'validation'
        });
        errors.push({ field: 'email', message });
      }

      // 验证密码
      if (!password) {
        const message = await request.t('validation.required_field', {
          defaultValue: 'This field is required',
          namespace: 'validation'
        });
        errors.push({ field: 'password', message });
      } else if (password.length < 6) {
        const message = await request.t('validation.password_too_short', {
          defaultValue: 'Password must be at least 6 characters',
          namespace: 'validation'
        });
        errors.push({ field: 'password', message });
      }

      // 验证姓名
      if (!name) {
        const message = await request.t('validation.required_field', {
          defaultValue: 'This field is required',
          namespace: 'validation'
        });
        errors.push({ field: 'name', message });
      }

      return reply.send({
        valid: errors.length === 0,
        errors,
        language: request.language
      });
    });

    // 多语言时间格式化
    app.get('/api/plugins/i18n-demo/time', {
      schema: {
        tags: ['i18n-demo'],
        summary: '多语言时间格式',
        description: '根据用户语言格式化时间显示',
        response: {
          200: {
            type: 'object',
            properties: {
              timestamp: { type: 'string' },
              formatted: { type: 'string' },
              relative: { type: 'string' },
              language: { type: 'string' }
            }
          }
        }
      }
    }, async (request, reply) => {
      const now = new Date();
      const timestamp = now.toISOString();
      
      // 根据语言格式化时间
      let formatted = '';
      let relative = '';

      const timeAgo = await request.t('common.time_ago', {
        defaultValue: 'just now'
      });

      switch (request.language) {
        case 'zh-CN':
          formatted = now.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          relative = '刚刚';
          break;
        case 'en-US':
          formatted = now.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          relative = 'just now';
          break;
        case 'ja-JP':
          formatted = now.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          relative = 'たった今';
          break;
        case 'ko-KR':
          formatted = now.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          relative = '방금 전';
          break;
        default:
          formatted = now.toLocaleDateString('en-US');
          relative = 'just now';
      }

      return reply.send({
        timestamp,
        formatted,
        relative,
        language: request.language
      });
    });

    // 插件健康检查
    app.get('/api/plugins/i18n-demo/health', async (request, reply) => {
      const healthMsg = await request.t('common.healthy', {
        defaultValue: 'healthy'
      });

      return {
        status: healthMsg,
        plugin: this.name,
        version: this.version,
        language: request.language,
        timestamp: new Date().toISOString()
      };
    });

    app.log.info(`i18n Demo plugin registered successfully`);
  },
};

export default i18nDemoPlugin;
