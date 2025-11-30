import { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { OAuth2Client } from 'google-auth-library'
import * as jwt from 'jsonwebtoken'
import Stripe from 'stripe'

/**
 * Google OAuth 插件配置选项
 * 支持平台级和租户级（BYOK）双模式配置
 */
interface GoogleOAuthOptions {
  clientId?: string        // 平台级别的 Google Client ID（可选）
  clientSecret?: string    // 平台级别的 Google Client Secret（可选）
  redirectUri?: string     // 平台级别的重定向 URI（可选）
  jwtSecret: string        // JWT 签名密钥（必需）
  stripeSecretKey?: string // 平台级别的 Stripe Secret Key（用于订阅管理）
  stripeWebhookSecret?: string // 平台级别的 Stripe Webhook Secret
}

/**
 * Google OAuth 插件
 * 
 * 功能：
 * 1. 支持 OAuth 2.0 授权码流程
 * 2. 支持平台模式和 BYOK 模式
 * 3. 与现有用户系统集成
 * 4. 支持商业化（订阅计划、使用量限制）
 * 5. 多租户隔离
 */
const googleOAuthPlugin = async (
  fastify: FastifyInstance,
  options: GoogleOAuthOptions & FastifyPluginOptions
) => {
  fastify.log.info('🔐 Initializing Google OAuth Plugin...')

  /**
   * 获取租户的 Google OAuth 配置
   * 支持平台模式和 BYOK 模式
   */
  async function getGoogleOAuthConfig(tenantId: number) {
    const installation = await fastify.prisma.pluginInstallation.findFirst({
      where: {
        tenantId,
        plugin: { slug: 'google' },
        status: 'ACTIVE'
      }
    })

    if (!installation) {
      throw new Error('Google OAuth plugin not installed')
    }

    const config = installation.configData
      ? JSON.parse(installation.configData)
      : {}

    return {
      mode: config.mode || 'platform',
      clientId: config.googleClientId || options.clientId,
      clientSecret: config.googleClientSecret || options.clientSecret,
      redirectUri: config.googleRedirectUri || options.redirectUri
    }
  }

  /**
   * 创建租户专属的 Google OAuth2 客户端
   */
  function createGoogleOAuthClient(clientId: string, clientSecret: string, redirectUri: string) {
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth Client ID and Client Secret are required')
    }

    return new OAuth2Client(clientId, clientSecret, redirectUri)
  }

  // 🔧 创建平台级 Google OAuth 客户端（用于无租户上下文的操作）
  const platformGoogleClient = (options.clientId && options.clientSecret && options.redirectUri)
    ? createGoogleOAuthClient(options.clientId, options.clientSecret, options.redirectUri)
    : null

  /**
   * 获取Stripe配置（用于订阅管理）
   */
  async function getStripeConfig(tenantId: number) {
    const installation = await fastify.prisma.pluginInstallation.findFirst({
      where: {
        tenantId,
        plugin: { slug: 'google' },
        status: 'ACTIVE'
      }
    });

    if (!installation) {
      throw new Error('Google OAuth plugin not installed');
    }

    const config = installation.configData
      ? JSON.parse(installation.configData)
      : {};

    return {
      mode: config.mode || 'platform',
      secretKey: config.stripeSecretKey || options.stripeSecretKey,
      webhookSecret: config.stripeWebhookSecret || options.stripeWebhookSecret
    };
  }

  /**
   * 创建Stripe实例（用于订阅管理）
   */
  function createStripeInstance(secretKey: string) {
    if (!secretKey) {
      throw new Error('Stripe Secret Key is required');
    }

    return new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia' as any
    });
  }

  /**
   * 获取插件计划配置
   */
  async function getPlanConfig(pluginId: string, planId: string) {
    return await fastify.prisma.subscriptionPlan.findUnique({
      where: {
        pluginId_planId: {
          pluginId,
          planId
        }
      }
    })
  }

  // ==================== 路由定义 ====================

  // 健康检查
  fastify.get('/health', {
    schema: {
      tags: ['plugins', 'google'],
      summary: 'Google OAuth Plugin Health Check',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            plugin: { type: 'string' },
            version: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async () => {
    return {
      status: 'ok',
      plugin: 'google',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    }
  })

  // 获取授权 URL
  // 🆕 支持 returnUrl 参数，用于 OAuth 完成后重定向回原始页面
  fastify.post('/auth/url', {
    schema: {
      tags: ['plugins', 'google'],
      summary: 'Get Authorization URL',
      description: 'Generate Google OAuth authorization URL. The returnUrl will be used to redirect back after OAuth completion.',
      body: {
        type: 'object',
        properties: {
          state: { type: 'string', description: 'Optional custom state data' },
          scope: { type: 'array', items: { type: 'string' } },
          returnUrl: { type: 'string', description: 'URL to redirect back after OAuth (e.g., https://bamboi.com/auth/callback)' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                authUrl: { type: 'string' }
              }
            }
          }
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // API 调用次数限制检查
      const apiCallCheck = await fastify.checkUsageLimit(
        request.tenant.id,
        'google',
        'api_calls'
      )

      if (!apiCallCheck.allowed) {
        return reply.status(429).send({
          error: 'API call limit exceeded',
          current: apiCallCheck.current,
          limit: apiCallCheck.limit,
          percentage: apiCallCheck.percentage,
          upgradeUrl: `/plugins/google/upgrade`
        })
      }

      // 记录 API 调用次数
      await fastify.recordPluginUsage(request.tenant.id, 'google', 'api_calls')
    }
  }, async (request: any, reply: any) => {
    const { state: customState, scope, returnUrl } = request.body

    try {
      // 🔧 获取租户的 Google OAuth 配置
      const config = await getGoogleOAuthConfig(request.tenant.id)

      // 🆕 使用平台统一的 auth 域名作为回调 URI
      // 这样 Google Console 只需要配置一个 redirect_uri
      const platformAuthDomain = process.env.PLATFORM_AUTH_DOMAIN || 'auth.jiffoo.com'
      const platformRedirectUri = `https://${platformAuthDomain}/google/callback`

      // 对于 BYOK 模式，仍然使用租户配置的 redirectUri
      const effectiveRedirectUri = config.mode === 'byok' && config.redirectUri
        ? config.redirectUri
        : platformRedirectUri

      const googleClient = createGoogleOAuthClient(
        config.clientId,
        config.clientSecret,
        effectiveRedirectUri
      )

      // 🆕 构造增强的 state 对象
      const stateObject = {
        tenantId: request.tenant.id,
        returnUrl: returnUrl, // 前端传入的返回 URL
        customState: customState, // 保留前端自定义的 state
        timestamp: Date.now()
      }

      // 生成授权 URL
      const authUrl = googleClient.generateAuthUrl({
        access_type: 'offline',
        prompt: 'select_account',
        scope: scope || [
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email'
        ],
        state: JSON.stringify(stateObject)
      })

      return {
        success: true,
        data: { authUrl }
      }
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to generate auth URL')
      return reply.status(500).send({
        success: false,
        error: 'Failed to generate authorization URL'
      })
    }
  })

  // OAuth 回调处理
  fastify.get('/auth/callback', {
    schema: {
      tags: ['plugins', 'google'],
      summary: 'OAuth Callback',
      querystring: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string' },
          state: { type: 'string' }
        }
      },
      response: {
        302: {
          type: 'null',
          description: 'Redirects to frontend'
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    }
  }, async (request: any, reply: any) => {
    const { code, state } = request.query

    if (!code) {
      return reply.status(400).send({
        success: false,
        error: 'Authorization code is required'
      })
    }

    try {
      // 解析 state 获取 tenantId
      const stateData = state ? JSON.parse(state) : {}
      const tenantId = stateData.tenantId

      if (!tenantId) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid state: missing tenantId'
        })
      }

      // 🔧 使用商城上下文服务获取租户信息（包含保底机制）
      const { MallContextService } = await import('../core/mall/context/service.js');
      const context = await MallContextService.getContextByIdentifier(tenantId);

      if (!context) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid tenant'
        })
      }

      // 获取完整的租户信息
      const tenant = await fastify.prisma.tenant.findUnique({
        where: { id: parseInt(context.tenantId) }
      });

      if (!tenant) {
        return reply.status(400).send({
          success: false,
          error: 'Tenant not found'
        })
      }

      // 设置租户上下文（模拟租户中间件的行为）
      request.tenant = tenant;

      // 🔧 获取租户的 Google OAuth 配置
      const config = await getGoogleOAuthConfig(tenant.id)
      const googleClient = createGoogleOAuthClient(config.clientId, config.clientSecret, config.redirectUri)

      // 交换授权码获取 token
      const { tokens } = await googleClient.getToken(code)
      googleClient.setCredentials(tokens)

      // 获取用户信息
      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token!,
        audience: config.clientId
      })
      const payload = ticket.getPayload()

      if (!payload) {
        throw new Error('Failed to get user info from ID token')
      }

      // 查找或创建用户
      const { user, socialAccount, isNewUser } = await handleGoogleUser(
        fastify,
        tenant.id,
        payload,
        tokens
      )

      // 生成平台 JWT token
      const jwtToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId
        },
        options.jwtSecret,
        { expiresIn: '7d' }
      )

      // 记录登录次数
      await fastify.recordPluginUsage(tenant.id, 'google', 'login_attempts')

      // 🔧 重定向到商城前台页面，而不是返回JSON
      // 使用新命名：NEXT_PUBLIC_SHOP_URL（商城前台端口 3004）
      const shopUrl = process.env.NEXT_PUBLIC_SHOP_URL || 'http://localhost:3004';
      const redirectUrl = new URL('/auth/google-callback', shopUrl);

      // 将认证信息作为查询参数传递
      redirectUrl.searchParams.set('success', 'true');
      redirectUrl.searchParams.set('isNewUser', isNewUser.toString());
      redirectUrl.searchParams.set('token', jwtToken);
      redirectUrl.searchParams.set('userId', user.id);
      redirectUrl.searchParams.set('tenant', context.tenantId);

      return reply.redirect(redirectUrl.toString());
    } catch (error: any) {
      fastify.log.error({ err: error }, 'OAuth callback failed')
      console.error('OAuth callback error details:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to complete OAuth authentication',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      })
    }
  })

  // 刷新 token
  fastify.post('/auth/refresh', {
    schema: {
      tags: ['plugins', 'google'],
      summary: 'Refresh Token',
      body: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            accessToken: { type: 'string' },
            expiresAt: { type: 'number' }
          }
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // API 调用次数限制检查
      const apiCallCheck = await fastify.checkUsageLimit(
        request.tenant.id,
        'google',
        'api_calls'
      )

      if (!apiCallCheck.allowed) {
        return reply.status(429).send({
          error: 'API call limit exceeded',
          current: apiCallCheck.current,
          limit: apiCallCheck.limit,
          percentage: apiCallCheck.percentage,
          upgradeUrl: `/plugins/google/upgrade`
        })
      }

      await fastify.recordPluginUsage(request.tenant.id, 'google', 'api_calls')
    }
  }, async (request: any, reply: any) => {
    const { userId } = request.body

    try {
      // 查找社交账户
      const socialAccount = await fastify.prisma.socialAccount.findFirst({
        where: {
          userId,
          provider: 'google'
        }
      })

      if (!socialAccount || !socialAccount.refreshToken) {
        return reply.status(404).send({
          success: false,
          error: 'Social account not found or no refresh token available'
        })
      }

      // 🔧 获取租户的 Google OAuth 配置
      const user = await fastify.prisma.user.findUnique({ where: { id: userId } })
      if (!user) {
        return reply.status(404).send({ success: false, error: 'User not found' })
      }

      const config = await getGoogleOAuthConfig(user.tenantId)
      const googleClient = createGoogleOAuthClient(config.clientId, config.clientSecret, config.redirectUri)

      // 使用 refresh token 获取新的 access token
      googleClient.setCredentials({
        refresh_token: socialAccount.refreshToken
      })

      const { credentials } = await googleClient.refreshAccessToken()

      // 更新数据库中的 token
      await fastify.prisma.socialAccount.update({
        where: { id: socialAccount.id },
        data: {
          accessToken: credentials.access_token,
          expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
          updatedAt: new Date()
        }
      })

      return {
        success: true,
        accessToken: credentials.access_token,
        expiresAt: credentials.expiry_date
      }
    } catch (error) {
      fastify.log.error({ err: error }, 'Token refresh failed')
      return reply.status(500).send({
        success: false,
        error: 'Failed to refresh access token'
      })
    }
  })

  // 获取用户信息
  fastify.get('/auth/userinfo', {
    schema: {
      tags: ['plugins', 'google'],
      summary: 'Get User Info',
      querystring: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            userInfo: { type: 'object', additionalProperties: true }
          }
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // API 调用次数限制检查
      const apiCallCheck = await fastify.checkUsageLimit(
        request.tenant.id,
        'google',
        'api_calls'
      )

      if (!apiCallCheck.allowed) {
        return reply.status(429).send({
          error: 'API call limit exceeded',
          current: apiCallCheck.current,
          limit: apiCallCheck.limit,
          percentage: apiCallCheck.percentage,
          upgradeUrl: `/plugins/google/upgrade`
        })
      }

      await fastify.recordPluginUsage(request.tenant.id, 'google', 'api_calls')
    }
  }, async (request: any, reply: any) => {
    const { userId } = request.query

    try {
      // 查找社交账户
      const socialAccount = await fastify.prisma.socialAccount.findFirst({
        where: {
          userId,
          provider: 'google'
        },
        include: {
          user: true
        }
      })

      if (!socialAccount || !socialAccount.accessToken) {
        return reply.status(404).send({
          success: false,
          error: 'Google account not linked or access token not available'
        })
      }

      // 🔧 获取租户的 Google OAuth 配置
      const config = await getGoogleOAuthConfig(socialAccount.user.tenantId)
      const googleClient = createGoogleOAuthClient(config.clientId, config.clientSecret, config.redirectUri)

      // 设置 access token
      googleClient.setCredentials({
        access_token: socialAccount.accessToken
      })

      // 获取用户信息
      const userInfoResponse = await googleClient.request({
        url: 'https://www.googleapis.com/oauth2/v2/userinfo'
      })

      return {
        success: true,
        userInfo: userInfoResponse.data
      }
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to get user info')
      return reply.status(500).send({
        success: false,
        error: 'Failed to get user information'
      })
    }
  })

  // 撤销授权
  fastify.post('/auth/revoke', {
    schema: {
      tags: ['plugins', 'google'],
      summary: 'Revoke Authorization',
      body: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // API 调用次数限制检查
      const apiCallCheck = await fastify.checkUsageLimit(
        request.tenant.id,
        'google',
        'api_calls'
      )

      if (!apiCallCheck.allowed) {
        return reply.status(429).send({
          error: 'API call limit exceeded',
          current: apiCallCheck.current,
          limit: apiCallCheck.limit,
          percentage: apiCallCheck.percentage,
          upgradeUrl: `/plugins/google/upgrade`
        })
      }

      await fastify.recordPluginUsage(request.tenant.id, 'google', 'api_calls')
    }
  }, async (request: any, reply: any) => {
    const { userId } = request.body

    try {
      // 查找社交账户
      const socialAccount = await fastify.prisma.socialAccount.findFirst({
        where: {
          userId,
          provider: 'google'
        },
        include: {
          user: true
        }
      })

      if (!socialAccount) {
        return reply.status(404).send({
          success: false,
          error: 'Google account not linked'
        })
      }

      // 🔧 获取租户的 Google OAuth 配置
      const config = await getGoogleOAuthConfig(socialAccount.user.tenantId)
      const googleClient = createGoogleOAuthClient(config.clientId, config.clientSecret, config.redirectUri)

      // 撤销 token
      if (socialAccount.accessToken) {
        try {
          await googleClient.revokeToken(socialAccount.accessToken)
        } catch (error) {
          fastify.log.warn({ err: error }, 'Failed to revoke token with Google')
          // 继续删除本地记录，即使 Google 撤销失败
        }
      }

      // 删除社交账户关联
      await fastify.prisma.socialAccount.delete({
        where: { id: socialAccount.id }
      })

      // 删除 OAuth2AccessToken 记录
      if (socialAccount.accessToken) {
        await fastify.prisma.oAuth2AccessToken.deleteMany({
          where: {
            accessToken: socialAccount.accessToken
          }
        })
      }

      return {
        success: true,
        message: 'Google account unlinked successfully'
      }
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to revoke authorization')
      return reply.status(500).send({
        success: false,
        error: 'Failed to revoke authorization'
      })
    }
  })

  // ==================== 🆕 业务功能端点 ====================

  // 🆕 Mall前端OAuth登录端点
  // 前端使用此端点交换授权码获取用户信息和JWT token
  fastify.post('/oauth/login', {
    schema: {
      tags: ['plugins', 'google'],
      summary: 'OAuth Login',
      description: 'Exchange authorization code for user info and JWT token. The redirectUrl must match the one used when generating the auth URL.',
      body: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string', description: 'Authorization code from Google' },
          state: { type: 'string', description: 'State parameter from OAuth callback' },
          redirectUrl: { type: 'string', description: 'Must match the redirect_uri used in auth URL generation' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            token: { type: 'string', nullable: true },
            user: { type: 'object', additionalProperties: true },
            isNewUser: { type: 'boolean' },
            googleProfile: { type: 'object', additionalProperties: true }
          }
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // API 调用次数限制检查
      const apiCallCheck = await fastify.checkUsageLimit(
        request.tenant.id,
        'google',
        'api_calls'
      )

      if (!apiCallCheck.allowed) {
        return reply.status(429).send({
          error: 'API call limit exceeded',
          current: apiCallCheck.current,
          limit: apiCallCheck.limit,
          percentage: apiCallCheck.percentage,
          upgradeUrl: `/plugins/google/upgrade`
        })
      }

      await fastify.recordPluginUsage(request.tenant.id, 'google', 'api_calls')
    }
  }, async (request: any, reply: any) => {
    const { code, state, redirectUrl } = request.body

    if (!code) {
      return reply.status(400).send({
        error: 'Authorization code is required'
      })
    }

    try {
      // 获取OAuth配置
      const config = await getGoogleOAuthConfig(request.tenant.id)

      // 🆕 使用平台统一的 auth 域名作为回调 URI（必须与 auth/url 生成时一致）
      const platformAuthDomain = process.env.PLATFORM_AUTH_DOMAIN || 'auth.jiffoo.com'
      const platformRedirectUri = `https://${platformAuthDomain}/google/callback`

      // 对于 BYOK 模式，使用租户配置的 redirectUri
      // 对于平台模式，使用平台统一的 redirectUri
      // 如果前端传入了 redirectUrl，优先使用（用于兼容旧版本）
      const effectiveRedirectUri = redirectUrl
        || (config.mode === 'byok' && config.redirectUri ? config.redirectUri : platformRedirectUri)

      const googleClient = createGoogleOAuthClient(
        config.clientId,
        config.clientSecret,
        effectiveRedirectUri
      )

      // 交换授权码获取token
      const { tokens } = await googleClient.getToken(code)
      googleClient.setCredentials(tokens)

      // 获取用户信息
      const userInfoResponse = await googleClient.request({
        url: 'https://www.googleapis.com/oauth2/v2/userinfo'
      })
      const userInfo = userInfoResponse.data

      // 处理用户登录逻辑
      const result = await handleGoogleUser(fastify, request.tenant.id, userInfo, tokens)

      // 记录登录尝试
      await fastify.recordPluginUsage(request.tenant.id, 'google', 'login_attempts')

      // 如果是新用户，记录活跃用户数
      if (result.isNewUser) {
        await fastify.recordPluginUsage(request.tenant.id, 'google', 'active_users')
      }

      // 生成JWT token (需要检查fastify是否有jwt插件)
      let jwtToken = null
      try {
        if ((fastify as any).jwt) {
          jwtToken = (fastify as any).jwt.sign({
            userId: result.user.id,
            tenantId: request.tenant.id,
            email: result.user.email,
            role: result.user.role
          })
        }
      } catch (error) {
        fastify.log.warn('JWT plugin not available, skipping token generation')
      }

      return {
        success: true,
        token: jwtToken,
        user: {
          id: result.user.id,
          email: result.user.email,
          username: result.user.username,
          role: result.user.role,
          avatar: result.user.avatar
        },
        isNewUser: result.isNewUser,
        googleProfile: {
          id: (userInfo as any).id,
          name: (userInfo as any).name,
          picture: (userInfo as any).picture,
          verified_email: (userInfo as any).verified_email
        }
      }
    } catch (error) {
      fastify.log.error({ err: error }, 'OAuth login failed')
      return reply.status(500).send({
        error: 'OAuth login failed',
        details: error.message
      })
    }
  })

  // 🆕 获取OAuth用户列表 (Admin管理端点，不计入API使用量)
  fastify.get('/oauth/users', {
    schema: {
      hide: true,
      tags: ['plugins', 'google'],
      summary: 'Get OAuth Users',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          limit: { type: 'number' },
          search: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object', additionalProperties: true } },
            pagination: { type: 'object', additionalProperties: true }
          }
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // 基础许可证检查（不检查API使用量限制，因为这是Admin管理功能）
      const licenseCheck = await fastify.checkPluginLicense(
        request.tenant.id,
        'google'
      )

      if (!licenseCheck.valid) {
        return reply.status(403).send({
          error: 'Plugin license check failed',
          reason: licenseCheck.reason
        })
      }

      // 注意：Admin管理端点不记录API使用量
    }
  }, async (request: any, reply: any) => {
    const { page = 1, limit = 20, search } = request.query

    try {
      const offset = (Number(page) - 1) * Number(limit)

      // 构建查询条件
      const whereCondition: any = {
        provider: 'google',
        user: {
          tenantId: request.tenant.id
        }
      }

      if (search) {
        whereCondition.user.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } }
        ]
      }

      // 查询OAuth用户
      const [socialAccounts, total] = await Promise.all([
        fastify.prisma.socialAccount.findMany({
          where: whereCondition,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true,
                role: true,
                avatar: true,
                createdAt: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip: offset,
          take: Number(limit)
        }),
        fastify.prisma.socialAccount.count({
          where: whereCondition
        })
      ])

      return {
        success: true,
        data: socialAccounts.map(account => ({
          id: account.id,
          providerId: account.providerId,
          user: account.user,
          linkedAt: account.createdAt,
          lastUpdated: account.updatedAt,
          hasValidToken: !!account.accessToken && (!account.expiresAt || account.expiresAt > new Date())
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to get OAuth users')
      return reply.status(500).send({
        error: 'Failed to get OAuth users',
        details: error.message
      })
    }
  })

  // 🆕 获取OAuth会话状态 (Admin管理端点，不计入API使用量)
  fastify.get('/oauth/sessions', {
    schema: {
      hide: true,
      tags: ['plugins', 'google'],
      summary: 'Get OAuth Sessions',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object', additionalProperties: true } }
          }
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // 基础许可证检查（不检查API使用量限制，因为这是Admin管理功能）
      const licenseCheck = await fastify.checkPluginLicense(
        request.tenant.id,
        'google'
      )

      if (!licenseCheck.valid) {
        return reply.status(403).send({
          error: 'Plugin license check failed',
          reason: licenseCheck.reason
        })
      }

      // 注意：Admin管理端点不记录API使用量
    }
  }, async (request: any, reply: any) => {
    try {
      // 查询活跃的OAuth会话
      const activeSessions = await fastify.prisma.oAuth2AccessToken.findMany({
        where: {
          user: {
            tenantId: request.tenant.id
          },
          expiresAt: {
            gt: new Date()
          }
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              role: true,
              avatar: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      // 查询对应的社交账户信息
      const sessionsWithSocialInfo = await Promise.all(
        activeSessions.map(async (session) => {
          const socialAccount = await fastify.prisma.socialAccount.findFirst({
            where: {
              userId: session.userId,
              provider: 'google'
            }
          })

          return {
            id: session.id,
            user: session.user,
            clientId: session.clientId,
            scope: session.scope,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            refreshExpiresAt: session.refreshExpiresAt,
            hasRefreshToken: !!session.refreshToken,
            socialAccount: socialAccount ? {
              providerId: socialAccount.providerId,
              linkedAt: socialAccount.createdAt
            } : null
          }
        })
      )

      return {
        success: true,
        data: sessionsWithSocialInfo,
        total: sessionsWithSocialInfo.length
      }
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to get OAuth sessions')
      return reply.status(500).send({
        error: 'Failed to get OAuth sessions',
        details: error.message
      })
    }
  })

  // 🆕 批量撤销OAuth授权 (Admin管理端点，不计入API使用量)
  fastify.post('/oauth/revoke-all', {
    schema: {
      hide: true,
      tags: ['plugins', 'google'],
      summary: 'Revoke OAuth for multiple users',
      body: {
        type: 'object',
        properties: {
          userIds: { type: 'array', items: { type: 'string' } }
        }
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // 基础许可证检查（不检查API使用量限制，因为这是Admin管理功能）
      const licenseCheck = await fastify.checkPluginLicense(
        request.tenant.id,
        'google'
      )

      if (!licenseCheck.valid) {
        return reply.status(403).send({
          error: 'Plugin license check failed',
          reason: licenseCheck.reason
        })
      }

      // 注意：Admin管理端点不记录API使用量
    }
  }, async (request: any, reply: any) => {
    const { userIds } = request.body

    if (!userIds || !Array.isArray(userIds)) {
      return reply.status(400).send({
        error: 'userIds array is required'
      })
    }

    try {
      const results = []

      for (const userId of userIds) {
        try {
          // 查找社交账户
          const socialAccount = await fastify.prisma.socialAccount.findFirst({
            where: {
              userId: userId.toString(),
              provider: 'google',
              user: {
                tenantId: request.tenant.id
              }
            },
            include: {
              user: true
            }
          })

          if (socialAccount) {
            // 获取OAuth配置
            const config = await getGoogleOAuthConfig(request.tenant.id)
            const googleClient = createGoogleOAuthClient(config.clientId, config.clientSecret, config.redirectUri)

            // 撤销Google token
            if (socialAccount.accessToken) {
              try {
                await googleClient.revokeToken(socialAccount.accessToken)
              } catch (error) {
                fastify.log.warn({ err: error }, `Failed to revoke Google token for user ${userId}`)
              }
            }

            // 删除本地记录
            await fastify.prisma.socialAccount.delete({
              where: { id: socialAccount.id }
            })

            // 删除OAuth2AccessToken记录
            if (socialAccount.accessToken) {
              await fastify.prisma.oAuth2AccessToken.deleteMany({
                where: {
                  accessToken: socialAccount.accessToken
                }
              })
            }

            results.push({
              userId: userId,
              success: true,
              message: 'OAuth authorization revoked successfully'
            })
          } else {
            results.push({
              userId: userId,
              success: false,
              message: 'Google account not found'
            })
          }
        } catch (error) {
          results.push({
            userId: userId,
            success: false,
            message: error.message
          })
        }
      }

      const successCount = results.filter(r => r.success).length
      const failureCount = results.filter(r => !r.success).length

      return {
        success: true,
        results: results,
        summary: {
          total: userIds.length,
          success: successCount,
          failed: failureCount
        }
      }
    } catch (error) {
      fastify.log.error('Failed to revoke OAuth authorizations:', error)
      return reply.status(500).send({
        error: 'Failed to revoke OAuth authorizations',
        details: error.message
      })
    }
  })

  // ==================== 商业化管理路由 ====================

  /**
   * 1. 查询当前计划状态
   * 返回：当前计划、使用量、限制、到期时间等
   */
  fastify.get('/plan/current', {
    schema: {
      hide: true,
      tags: ['plugins', 'google'],
      summary: 'Get current Google OAuth plan',
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // 基础许可证检查
      const licenseCheck = await fastify.checkPluginLicense(
        request.tenant.id,
        'google'
      )

      if (!licenseCheck.valid) {
        return reply.status(403).send({
          error: 'Plugin not installed',
          reason: licenseCheck.reason,
          upgradeUrl: licenseCheck.upgradeUrl
        })
      }
    }
  }, async (request: any, reply: any) => {
    try {
      // 🆕 Step 0: 懒加载 - 检查并在需要时重置使用量
      await fastify.checkAndResetUsageIfNeeded(request.tenant.id, 'google')

      // 1. 获取插件安装信息
      const installation = await fastify.prisma.pluginInstallation.findFirst({
        where: {
          tenantId: request.tenant.id,
          plugin: { slug: 'google' },
          status: 'ACTIVE'
        },
        include: { plugin: true }
      })

      if (!installation) {
        return reply.status(404).send({
          error: 'Plugin not installed'
        })
      }

      // 🔧 统一数据源 - 查找活跃订阅获取当前计划
      const subscription = await fastify.prisma.subscription.findFirst({
        where: {
          tenantId: request.tenant.id,
          pluginId: installation.pluginId,
          status: { in: ['active', 'trialing', 'past_due'] }  // ✅ 包含past_due（宽限期）
        }
      })

      // 获取当前计划
      const currentPlanId = subscription?.planId || 'free'

      // 3. 获取当前计划配置
      const planConfig = await getPlanConfig(installation.pluginId, currentPlanId)

      // 获取所有可用计划
      const availablePlans = await fastify.prisma.subscriptionPlan.findMany({
        where: {
          pluginId: installation.pluginId,
          isActive: true,
          isPublic: true
        },
        orderBy: {
          amount: 'asc'
        }
      })

      // 4. 确定 period
      let period: string
      if (subscription) {
        // 使用订阅周期作为 period
        const startDate = subscription.currentPeriodStart.toISOString().split('T')[0]
        period = `${subscription.id}:${startDate}`
      } else {
        // Free Plan：使用自然月
        period = new Date().toISOString().slice(0, 7)
      }

      // 5. 获取使用量
      const usage = await fastify.prisma.pluginUsage.findMany({
        where: {
          tenantId: request.tenant.id,
          pluginSlug: 'google',
          period: period
        }
      })

      const usageMap: any = {}
      usage.forEach(u => {
        usageMap[u.metricName] = u.value
      })

      // 6. 获取活跃用户数
      const activeUsersCount = await fastify.prisma.socialAccount.count({
        where: {
          provider: 'google',
          user: {
            tenantId: request.tenant.id,
            isActive: true
          }
        }
      })

      // 解析当前计划的限制
      const limits = planConfig?.limits || {}

      // 7. 查找待生效的变更
      let pendingChange = null
      if (subscription) {
        const change = await fastify.prisma.subscriptionChange.findFirst({
          where: {
            subscriptionId: subscription.id,
            changeType: 'downgraded',
            effectiveDate: { gt: new Date() }
          },
          orderBy: { createdAt: 'desc' }
        })

        if (change) {
          pendingChange = {
            type: 'downgrade',
            fromPlan: change.fromPlanId,
            targetPlan: change.toPlanId,
            effectiveDate: change.effectiveDate.toISOString(),
            daysRemaining: Math.ceil((change.effectiveDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          }
        }
      }

      return {
        success: true,
        plan: currentPlanId,
        features: planConfig?.features || [],
        limits: planConfig?.limits || {},
        usage: {
          login_attempts: usageMap.login_attempts || 0,
          active_users: activeUsersCount,
          api_calls: usageMap.api_calls || 0
        },
        subscription: subscription ? {
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          amount: subscription.amount,
          currency: subscription.currency
        } : null,
        pendingChange: pendingChange,
        availablePlans: availablePlans.map(plan => ({
          planId: plan.planId,
          name: plan.name,
          description: plan.description,
          amount: plan.amount,
          currency: plan.currency,
          billingCycle: plan.billingCycle,
          features: plan.features ? JSON.parse(plan.features) : [],
          limits: plan.limits ? JSON.parse(plan.limits) : {}
        }))
      }
    } catch (error) {
      fastify.log.error('Failed to get current plan:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to get current plan information'
      })
    }
  })

  /**
   * 2. 升级费用预览
   * 计算升级到目标计划的费用（按比例计算）
   */
  fastify.post('/plan/upgrade-preview', {
    schema: {
      hide: true,
      tags: ['plugins', 'google'],
      summary: 'Preview plan upgrade',
      body: {
        type: 'object',
        properties: {
          targetPlan: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // 基础许可证检查
      const licenseCheck = await fastify.checkPluginLicense(
        request.tenant.id,
        'google'
      )

      if (!licenseCheck.valid) {
        return reply.status(403).send({
          error: 'Plugin not installed',
          reason: licenseCheck.reason,
          upgradeUrl: licenseCheck.upgradeUrl
        })
      }
    }
  }, async (request: any, reply: any) => {
    const { targetPlan } = request.body

    if (!targetPlan) {
      return reply.status(400).send({
        error: 'targetPlan is required'
      })
    }

    try {
      // 获取插件信息
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: 'google' }
      })

      if (!plugin) {
        return reply.status(404).send({ error: 'Plugin not found' })
      }

      // 获取目标计划配置
      const targetPlanConfig = await getPlanConfig(plugin.id, targetPlan)

      if (!targetPlanConfig) {
        return reply.status(400).send({
          error: `Plan ${targetPlan} not found`
        })
      }

      // 获取当前安装信息
      const installation = await fastify.prisma.pluginInstallation.findFirst({
        where: {
          tenantId: request.tenant.id,
          pluginId: plugin.id,
          status: 'ACTIVE'
        }
      })

      if (!installation) {
        return reply.status(404).send({ error: 'Plugin not installed' })
      }

      // 获取当前活跃订阅
      const activeSubscription = await fastify.prisma.subscription.findFirst({
        where: {
          tenantId: request.tenant.id,
          pluginId: plugin.id,
          status: { in: ['active', 'trialing', 'past_due'] }
        },
        orderBy: { createdAt: 'desc' }
      })

      const currentPlan = activeSubscription?.planId || 'free'

      // 获取当前计划配置
      const currentPlanConfig = await getPlanConfig(plugin.id, currentPlan)
      if (!currentPlanConfig) {
        return reply.status(400).send({
          error: `Current plan ${currentPlan} not found`
        })
      }

      // 计算升级预览
      let upgradePreview: any = {
        upgradeType: 'immediate',
        prorationAmount: 0,
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        immediateCharge: false
      }

      // Case 1: Free → Paid (需要支付)
      if (currentPlan === 'free' && targetPlan !== 'free') {
        upgradePreview = {
          upgradeType: 'payment',
          prorationAmount: targetPlanConfig.amount,
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          immediateCharge: true
        }
      }
      // Case 2: Paid → Paid (按比例计费)
      else if (currentPlan !== 'free' && targetPlan !== 'free' && activeSubscription) {
        // 计算按比例金额
        const currentPeriodEnd = new Date(activeSubscription.currentPeriodEnd)
        const now = new Date()
        const remainingDays = Math.max(0, Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        const totalDays = 30 // 假设月付

        // 当前计划未使用的信用
        const unusedCredit = (currentPlanConfig.amount * remainingDays) / totalDays

        // 新计划费用
        const newPlanCharge = targetPlanConfig.amount

        // 按比例金额
        const prorationAmount = Math.max(0, newPlanCharge - unusedCredit)

        upgradePreview = {
          upgradeType: 'proration',
          prorationAmount: Math.round(prorationAmount * 100) / 100,
          nextBillingDate: currentPeriodEnd.toISOString(),
          immediateCharge: true
        }
      }

      return reply.send({
        success: true,
        data: {
          currentPlan: {
            name: currentPlanConfig.name,
            amount: currentPlanConfig.amount,
            currency: currentPlanConfig.currency || 'USD',
            billingCycle: currentPlanConfig.billingCycle,
            features: currentPlanConfig.features ? JSON.parse(currentPlanConfig.features) : [],
            limits: currentPlanConfig.limits ? JSON.parse(currentPlanConfig.limits) : {}
          },
          targetPlan: {
            name: targetPlanConfig.name,
            amount: targetPlanConfig.amount,
            currency: targetPlanConfig.currency || 'USD',
            billingCycle: targetPlanConfig.billingCycle,
            features: targetPlanConfig.features ? JSON.parse(targetPlanConfig.features) : [],
            limits: targetPlanConfig.limits ? JSON.parse(targetPlanConfig.limits) : {}
          },
          upgradePreview
        }
      })
    } catch (error) {
      fastify.log.error('Failed to preview upgrade:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to preview upgrade'
      })
    }
  })

  /**
   * 3. 升级计划
   * 创建 Stripe Checkout Session 进行支付
   */
  fastify.post('/plan/upgrade', {
    schema: {
      hide: true,
      tags: ['plugins', 'google'],
      summary: 'Upgrade plan',
      body: {
        type: 'object',
        properties: {
          targetPlanId: { type: 'string' },
          successUrl: { type: 'string' },
          cancelUrl: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // 基础许可证检查（不检查使用量限制）
      const licenseCheck = await fastify.checkPluginLicense(
        request.tenant.id,
        'google'
      )

      if (!licenseCheck.valid) {
        return reply.status(403).send({
          error: 'Plugin not installed',
          reason: licenseCheck.reason,
          upgradeUrl: licenseCheck.upgradeUrl
        })
      }
    }
  }, async (request: any, reply: any) => {
    const { targetPlanId, successUrl, cancelUrl } = request.body

    if (!targetPlanId) {
      return reply.status(400).send({
        error: 'Missing required field: targetPlanId'
      })
    }

    try {
      // 获取插件信息
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: 'google' }
      })

      if (!plugin) {
        return reply.status(404).send({ error: 'Plugin not found' })
      }

      // 获取目标计划
      const targetPlan = await fastify.prisma.subscriptionPlan.findFirst({
        where: {
          pluginId: plugin.id,
          planId: targetPlanId
        }
      })

      if (!targetPlan || !targetPlan.stripePriceId) {
        return reply.status(404).send({
          error: 'Target plan not found or Stripe Price ID not configured'
        })
      }

      // 获取租户的 Stripe 配置（使用 Stripe 插件的配置）
      const stripeInstallation = await fastify.prisma.pluginInstallation.findFirst({
        where: {
          tenantId: request.tenant.id,
          plugin: { slug: 'stripe' },
          status: 'ACTIVE'
        }
      })

      if (!stripeInstallation) {
        return reply.status(400).send({
          error: 'Stripe plugin not installed',
          message: 'Please install Stripe Payment plugin first to process payments'
        })
      }

      // 获取 Stripe 配置
      const stripeConfig = stripeInstallation.configData
        ? JSON.parse(stripeInstallation.configData)
        : {}

      const stripeSecretKey = stripeConfig.stripeSecretKey || process.env.STRIPE_SECRET_KEY

      if (!stripeSecretKey) {
        return reply.status(500).send({
          error: 'Stripe not configured',
          message: 'Please configure Stripe credentials'
        })
      }

      // 动态导入 Stripe
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2025-02-24.acacia' as any
      })

      // 检查现有订阅
      const existingSubscription = await fastify.prisma.subscription.findFirst({
        where: {
          tenantId: request.tenant.id,
          pluginId: plugin.id,
          status: { in: ['active', 'trialing', 'past_due'] }
        },
        orderBy: { createdAt: 'desc' }
      })

      // Case 1: 如果有活跃的付费订阅，使用proration升级
      if (existingSubscription?.stripeSubscriptionId) {
        fastify.log.info(`🔄 Upgrading from ${existingSubscription.planId} to ${targetPlanId} with proration`)

        try {
          // 获取Stripe订阅详情
          const stripeSubscription = await stripe.subscriptions.retrieve(
            existingSubscription.stripeSubscriptionId
          )

          if (!stripeSubscription.items.data[0]) {
            throw new Error('No subscription items found')
          }

          const subscriptionItemId = stripeSubscription.items.data[0].id

          // 确保目标计划有Stripe价格ID
          let stripePriceId = targetPlan.stripePriceId
          if (!stripePriceId || stripePriceId.startsWith('price_google_oauth_')) {
            // 动态创建Stripe价格
            try {
              // 先创建或获取产品
              let stripeProduct
              const productId = `prod_google_oauth_${plugin.id}`
              try {
                stripeProduct = await stripe.products.retrieve(productId)
              } catch {
                stripeProduct = await stripe.products.create({
                  id: productId,
                  name: `Google OAuth - ${targetPlan.name}`,
                  description: targetPlan.description || 'Google OAuth authentication service'
                })
              }

              // 创建价格
              const stripePrice = await stripe.prices.create({
                product: stripeProduct.id,
                unit_amount: Math.round(targetPlan.amount * 100), // 转换为分
                currency: targetPlan.currency.toLowerCase(),
                recurring: {
                  interval: targetPlan.billingCycle === 'yearly' ? 'year' : 'month'
                }
              })

              stripePriceId = stripePrice.id

              // 更新数据库中的stripePriceId
              await fastify.prisma.subscriptionPlan.update({
                where: {
                  pluginId_planId: {
                    pluginId: plugin.id,
                    planId: targetPlanId
                  }
                },
                data: {
                  stripePriceId: stripePriceId
                }
              })
            } catch (error) {
              fastify.log.error('Failed to create Stripe price:', error)
              throw error
            }
          }

          // 使用proration更新现有订阅
          const updatedSubscription = await stripe.subscriptions.update(
            existingSubscription.stripeSubscriptionId,
            {
              items: [{
                id: subscriptionItemId,
                price: stripePriceId
              }],
              proration_behavior: 'create_prorations',  // 立即按比例计费
              metadata: {
                tenantId: request.tenant.id.toString(),
                pluginSlug: 'google',
                targetPlan: targetPlanId,
                upgradeType: 'proration'
              }
            }
          )

          // 🔧 修复：使用与Stripe插件相同的逻辑 - 取消旧订阅，创建新订阅
          const oldPlanId = existingSubscription.planId

          // 1. 取消旧订阅记录（标记为canceled）
          await fastify.prisma.subscription.update({
            where: { id: existingSubscription.id },
            data: {
              status: 'canceled',
              canceledAt: new Date(),
              updatedAt: new Date()
            }
          })

          // 2. 创建旧订阅的取消记录
          await fastify.prisma.subscriptionChange.create({
            data: {
              subscriptionId: existingSubscription.id,
              changeType: 'canceled',
              fromPlanId: oldPlanId,
              toPlanId: oldPlanId,
              fromAmount: existingSubscription.amount || 0,
              toAmount: existingSubscription.amount || 0,
              effectiveDate: new Date(),
              reason: `${oldPlanId} subscription canceled due to upgrade to ${targetPlanId}`,
              initiatedBy: 'tenant'
            }
          })

          // 3. 创建新的订阅记录
          const newSubscription = await fastify.prisma.subscription.create({
            data: {
              tenantId: request.tenant.id,
              pluginId: plugin.id,
              planId: targetPlanId,
              stripeSubscriptionId: existingSubscription.stripeSubscriptionId, // 使用相同的Stripe订阅ID
              stripeItemId: subscriptionItemId,
              stripeCustomerId: existingSubscription.stripeCustomerId,
              status: 'active',
              billingCycle: 'monthly',
              currentPeriodStart: new Date((updatedSubscription as any).current_period_start * 1000),
              currentPeriodEnd: new Date((updatedSubscription as any).current_period_end * 1000),
              amount: targetPlan.amount,
              currency: targetPlan.currency,
              autoRenew: true
            }
          })

          // 4. 创建新订阅的创建记录
          await fastify.prisma.subscriptionChange.create({
            data: {
              subscriptionId: newSubscription.id,
              changeType: 'created',
              fromPlanId: null,
              toPlanId: targetPlanId,
              fromAmount: 0,
              toAmount: targetPlan.amount,
              effectiveDate: new Date(),
              reason: `Created ${targetPlanId} subscription after upgrade from ${oldPlanId}`,
              initiatedBy: 'tenant'
            }
          })

          // 5. 创建升级记录
          await fastify.prisma.subscriptionChange.create({
            data: {
              subscriptionId: newSubscription.id,
              changeType: 'upgraded',
              fromPlanId: oldPlanId,
              toPlanId: targetPlanId,
              fromAmount: existingSubscription.amount || 0,
              toAmount: targetPlan.amount,
              effectiveDate: new Date(),
              reason: `Upgraded from ${oldPlanId} to ${targetPlanId} plan via proration`,
              initiatedBy: 'tenant'
            }
          })

          // 6. 重置使用量
          fastify.log.info('Usage will be reset by webhook handler')

          fastify.log.info(`✅ Successfully upgraded from ${oldPlanId} to ${targetPlanId} with proration`)

          return {
            success: true,
            type: 'proration',
            message: 'Plan upgraded successfully with prorated billing',
            subscription: {
              id: newSubscription.id,
              planId: targetPlanId,
              amount: targetPlan.amount,
              currency: targetPlan.currency,
              currentPeriodEnd: new Date((updatedSubscription as any).current_period_end * 1000)
            }
          }
        } catch (error) {
          fastify.log.error('Failed to upgrade with proration:', error)
          throw error
        }
      }

      // Case 2: 如果没有活跃订阅或是Free计划，创建新的Checkout Session
      fastify.log.info(`💳 Creating new checkout session for ${existingSubscription?.planId || 'free'} to ${targetPlanId} upgrade`)

      // 创建或获取Stripe价格
      let stripePriceId = targetPlan.stripePriceId
      if (!stripePriceId || stripePriceId.startsWith('price_google_oauth_')) {
        // 动态创建Stripe价格
        try {
          // 先创建或获取产品
          let stripeProduct: any
          const productId = `prod_google_oauth_${plugin.id}`
          try {
            stripeProduct = await stripe.products.retrieve(productId)
          } catch {
            stripeProduct = await stripe.products.create({
              id: productId,
              name: `Google OAuth - ${targetPlan.name}`,
              description: targetPlan.description || 'Google OAuth authentication service'
            })
          }

          // 创建价格
          const stripePrice = await stripe.prices.create({
            product: stripeProduct.id,
            unit_amount: Math.round(targetPlan.amount * 100), // 转换为分
            currency: targetPlan.currency.toLowerCase(),
            recurring: {
              interval: targetPlan.billingCycle === 'yearly' ? 'year' : 'month'
            }
          })

          stripePriceId = stripePrice.id

          // 更新数据库中的stripePriceId
          await fastify.prisma.subscriptionPlan.update({
            where: {
              pluginId_planId: {
                pluginId: plugin.id,
                planId: targetPlanId
              }
            },
            data: {
              stripePriceId: stripePriceId
            }
          })
        } catch (error) {
          fastify.log.error('Failed to create Stripe price:', error)
          throw error
        }
      }

      // 创建 Checkout Session
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: stripePriceId,
            quantity: 1
          }
        ],
        // 使用新命名：NEXT_PUBLIC_SHOP_URL（商城前台）
        success_url: successUrl || `${process.env.NEXT_PUBLIC_SHOP_URL || 'http://localhost:3004'}/plugins/google/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_SHOP_URL || 'http://localhost:3004'}/plugins/google/upgrade/cancel`,
        client_reference_id: request.tenant.id.toString(),
        metadata: {
          isUpgrade: 'true',
          tenantId: request.tenant.id.toString(),
          pluginSlug: 'google',
          targetPlan: targetPlanId,
          planId: targetPlanId,
          upgradeType: 'plan_upgrade'
        }
      })

      return {
        success: true,
        sessionId: session.id,
        checkoutUrl: session.url,
        targetPlan: {
          planId: targetPlan.planId,
          name: targetPlan.name,
          amount: targetPlan.amount,
          currency: targetPlan.currency
        }
      }
    } catch (error) {
      fastify.log.error('Failed to create upgrade session:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to create upgrade session'
      })
    }
  })

  /**
   * 4. 降级计划
   * 延期生效（当前周期结束后生效）
   */
  fastify.post('/plan/downgrade', {
    schema: {
      hide: true,
      tags: ['plugins', 'google'],
      summary: 'Schedule plan downgrade',
      body: {
        type: 'object',
        properties: {
          targetPlan: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // 基础许可证检查
      const licenseCheck = await fastify.checkPluginLicense(
        request.tenant.id,
        'google'
      )

      if (!licenseCheck.valid) {
        return reply.status(403).send({
          error: 'Plugin not installed',
          reason: licenseCheck.reason,
          upgradeUrl: licenseCheck.upgradeUrl
        })
      }
    }
  }, async (request: any, reply: any) => {
    const { targetPlan } = request.body

    if (!targetPlan) {
      return reply.status(400).send({
        error: 'targetPlan is required'
      })
    }

    try {
      // 1. 获取插件安装信息
      const installation = await fastify.prisma.pluginInstallation.findFirst({
        where: {
          tenantId: request.tenant.id,
          plugin: { slug: 'google' },
          status: 'ACTIVE'
        },
        include: { plugin: true }
      })

      if (!installation) {
        return reply.status(404).send({
          error: 'Plugin not installed'
        })
      }

      // 2. 查找活跃订阅（按创建时间倒序，获取最新的订阅）
      const subscription = await fastify.prisma.subscription.findFirst({
        where: {
          tenantId: request.tenant.id,
          pluginId: installation.pluginId,
          status: { in: ['active', 'trialing', 'past_due'] }
        },
        orderBy: { createdAt: 'desc' }
      })

      if (!subscription) {
        return reply.status(404).send({
          error: 'No active subscription found'
        })
      }

      const currentPlan = subscription.planId

      // 3. 验证目标计划
      const targetPlanConfig = await getPlanConfig(installation.pluginId, targetPlan)
      if (!targetPlanConfig) {
        return reply.status(400).send({
          error: `Plan ${targetPlan} not found`
        })
      }

      // 4. 验证是否是降级
      const planHierarchy: { [key: string]: number } = {
        'free': 0,
        'business': 1,
        'enterprise': 2
      }

      const currentLevel = planHierarchy[currentPlan] || 0
      const targetLevel = planHierarchy[targetPlan] || 0

      if (targetLevel >= currentLevel) {
        return reply.status(400).send({
          error: 'Invalid downgrade',
          message: 'Target plan must be lower tier than current plan'
        })
      }

      // 5. 更新订阅，设置在周期结束时取消
      await fastify.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: true,
          updatedAt: new Date()
        }
      })

      // 6. 创建降级变更记录
      await fastify.prisma.subscriptionChange.create({
        data: {
          subscriptionId: subscription.id,
          changeType: 'downgraded',
          fromPlanId: currentPlan,
          toPlanId: targetPlan,
          fromAmount: subscription.amount,
          toAmount: targetPlanConfig.amount,
          effectiveDate: subscription.currentPeriodEnd,
          reason: 'User initiated downgrade',
          initiatedBy: 'tenant',
          createdBy: request.user?.id?.toString()
        }
      })

      const effectiveDate = subscription.currentPeriodEnd.toISOString().split('T')[0]
      const daysRemaining = Math.ceil((subscription.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

      return {
        success: true,
        currentPlan: currentPlan,
        targetPlan: targetPlan,
        effectiveDate: subscription.currentPeriodEnd.toISOString(),
        immediate: false,
        message: `Downgrade will take effect at the end of the current billing cycle (${effectiveDate})`,
        daysRemaining: daysRemaining
      }
    } catch (error: any) {
      fastify.log.error('Failed to schedule downgrade:', error)
      return reply.status(500).send({
        error: 'Failed to schedule downgrade',
        details: error.message
      })
    }
  })

  /**
   * 5. 取消降级
   * 取消计划的降级，恢复订阅
   */
  fastify.post('/plan/cancel-downgrade', {
    schema: {
      hide: true,
      tags: ['plugins', 'google'],
      summary: 'Cancel Downgrade',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            subscription: { type: 'object', additionalProperties: true }
          }
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // 基础许可证检查
      const licenseCheck = await fastify.checkPluginLicense(
        request.tenant.id,
        'google'
      )

      if (!licenseCheck.valid) {
        return reply.status(403).send({
          error: 'Plugin not installed',
          reason: licenseCheck.reason,
          upgradeUrl: licenseCheck.upgradeUrl
        })
      }
    }
  }, async (request: any, reply: any) => {
    try {
      // 1. 获取插件安装信息
      const installation = await fastify.prisma.pluginInstallation.findFirst({
        where: {
          tenantId: request.tenant.id,
          plugin: { slug: 'google' },
          status: 'ACTIVE'
        },
        include: { plugin: true }
      })

      if (!installation) {
        return reply.status(404).send({
          error: 'Plugin not installed'
        })
      }

      // 2. 查找活跃订阅（按创建时间倒序，获取最新的订阅）
      const subscription = await fastify.prisma.subscription.findFirst({
        where: {
          tenantId: request.tenant.id,
          pluginId: installation.pluginId,
          status: { in: ['active', 'trialing', 'past_due'] }
        },
        orderBy: { createdAt: 'desc' }
      })

      if (!subscription) {
        return reply.status(404).send({
          error: 'No active subscription found'
        })
      }

      // 3. 检查是否有待生效的降级
      if (!subscription.cancelAtPeriodEnd) {
        return reply.status(400).send({
          error: 'No pending downgrade found'
        })
      }

      // 4. 检查订阅是否已到期
      if (subscription.currentPeriodEnd < new Date()) {
        return reply.status(400).send({
          error: 'Subscription has already expired, cannot cancel downgrade'
        })
      }

      // 5. 更新订阅，取消在周期结束时取消的设置
      await fastify.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: false,
          autoRenew: true,
          updatedAt: new Date()
        }
      })

      // 6. 删除待生效的降级记录
      await fastify.prisma.subscriptionChange.deleteMany({
        where: {
          subscriptionId: subscription.id,
          changeType: 'downgraded',
          effectiveDate: { gt: new Date() }
        }
      })

      // 7. 记录取消降级事件
      await fastify.prisma.subscriptionChange.create({
        data: {
          subscriptionId: subscription.id,
          changeType: 'downgrade_canceled',
          fromPlanId: subscription.planId,
          toPlanId: subscription.planId,
          fromAmount: subscription.amount,
          toAmount: subscription.amount,
          effectiveDate: new Date(),
          reason: 'User canceled downgrade',
          initiatedBy: 'tenant',
          createdBy: request.user?.id?.toString()
        }
      })

      return {
        success: true,
        message: 'Downgrade canceled successfully. Your subscription will continue to auto-renew.',
        subscription: {
          id: subscription.id,
          planId: subscription.planId,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          cancelAtPeriodEnd: false,
          autoRenew: true
        }
      }
    } catch (error: any) {
      fastify.log.error('Failed to cancel downgrade:', error)
      return reply.status(500).send({
        error: 'Failed to cancel downgrade',
        details: error.message
      })
    }
  })

  // 获取插件统计信息 (Admin管理端点，不计入API使用量)
  fastify.get('/stats', {
    schema: {
      hide: true,
      tags: ['plugins', 'google'],
      summary: 'Get Google OAuth stats',
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // 基础许可证检查（不检查API使用量限制，因为这是Admin管理功能）
      const licenseCheck = await fastify.checkPluginLicense(
        request.tenant.id,
        'google'
      )

      if (!licenseCheck.valid) {
        return reply.status(403).send({
          error: 'Plugin license check failed',
          reason: licenseCheck.reason
        })
      }

      // 注意：Admin管理端点不记录API使用量
    }
  }, async (request: any, reply: any) => {
    try {
      // 获取该租户的 Google 登录用户数
      const googleUsers = await fastify.prisma.socialAccount.count({
        where: {
          provider: 'google',
          user: {
            tenantId: request.tenant.id
          }
        }
      })

      // 获取当前月份
      const currentPeriod = new Date().toISOString().slice(0, 7) // '2025-02'

      // 获取使用量统计
      const loginAttemptsUsage = await fastify.prisma.pluginUsage.findFirst({
        where: {
          tenantId: request.tenant.id,
          pluginSlug: 'google',
          metricName: 'login_attempts',
          period: currentPeriod
        }
      })

      const apiCallsUsage = await fastify.prisma.pluginUsage.findFirst({
        where: {
          tenantId: request.tenant.id,
          pluginSlug: 'google',
          metricName: 'api_calls',
          period: currentPeriod
        }
      })

      return {
        success: true,
        stats: {
          googleUsers,
          loginAttempts: loginAttemptsUsage?.value || 0,
          apiCalls: apiCallsUsage?.value || 0,
          lastUsedAt: loginAttemptsUsage?.updatedAt || apiCallsUsage?.updatedAt
        }
      }
    } catch (error) {
      fastify.log.error('Failed to get stats:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to get statistics'
      })
    }
  })

  // ============================================
  // 订阅CRUD端点（用于Super Admin直接管理）
  // ============================================

  /**
   * 创建订阅
   * POST /subscriptions
   *
   * 用途：Super Admin直接为租户创建订阅（不需要支付流程）
   */
  fastify.post('/subscriptions', {
    schema: {
      hide: true,
      tags: ['plugins', 'google'],
      summary: 'Create subscription',
      body: {
        type: 'object',
        properties: {
          planId: { type: 'string' },
          customerId: { type: 'string' },
          trialDays: { type: 'number' },
          paymentMethodId: { type: 'string' },
          metadata: { type: 'object', additionalProperties: true }
        },
        required: ['planId']
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // API 调用次数限制检查
      const apiCallCheck = await fastify.checkUsageLimit(
        request.tenant.id,
        'google',
        'api_calls'
      )

      if (!apiCallCheck.allowed) {
        return reply.status(429).send({
          error: 'API call limit exceeded',
          current: apiCallCheck.current,
          limit: apiCallCheck.limit,
          percentage: apiCallCheck.percentage,
          upgradeUrl: `/plugins/google/upgrade`
        })
      }

      // 记录 API 调用次数
      await fastify.recordPluginUsage(request.tenant.id, 'google', 'api_calls')

      const subscriptionCheck = await fastify.checkSubscriptionAccess(
        request.tenant.id,
        'google',
        'subscriptions'
      )

      if (!subscriptionCheck.allowed) {
        return reply.status(402).send({
          error: 'Subscription required',
          reason: subscriptionCheck.reason,
          upgradeUrl: subscriptionCheck.upgradeUrl
        })
      }

      await fastify.recordPluginUsage(request.tenant.id, 'google', 'subscriptions')
    }
  }, async (request: any, reply: any) => {
    const { planId, customerId, trialDays, paymentMethodId, metadata } = request.body

    try {
      // 获取租户的 Stripe 配置
      const stripeConfig = await getStripeConfig(request.tenant.id);
      const stripe = createStripeInstance(stripeConfig.secretKey);

      // 获取订阅计划
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: 'google' }
      })

      const subscriptionPlan = await fastify.prisma.subscriptionPlan.findUnique({
        where: {
          pluginId_planId: {
            pluginId: plugin.id,
            planId
          }
        }
      })

      if (!subscriptionPlan) {
        return reply.status(400).send({ error: 'Subscription plan not found' })
      }

      // 创建或获取Stripe客户
      let stripeCustomerId = customerId
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: request.tenant.contactEmail,
          name: request.tenant.companyName,
          metadata: {
            tenantId: request.tenant.id.toString(),
            pluginSlug: 'google'
          }
        })
        stripeCustomerId = customer.id
      }

      // 如果提供了支付方式，附加到客户
      if (paymentMethodId) {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: stripeCustomerId
        })

        await stripe.customers.update(stripeCustomerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId
          }
        })
      }

      // 创建Stripe价格（如果不存在）
      const stripePriceId = `price_${plugin.id}_${planId}`
      let stripePrice
      try {
        stripePrice = await stripe.prices.retrieve(stripePriceId)
      } catch {
        // 价格不存在，创建新的
        const stripeProduct = await stripe.products.create({
          id: `prod_${plugin.id}`,
          name: plugin.name,
          description: plugin.description
        })

        stripePrice = await stripe.prices.create({
          product: stripeProduct.id,
          unit_amount: Math.round(subscriptionPlan.amount * 100),
          currency: subscriptionPlan.currency.toLowerCase(),
          recurring: {
            interval: subscriptionPlan.billingCycle === 'yearly' ? 'year' : 'month'
          }
        })
      }

      // 创建Stripe订阅
      const stripeSubscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: stripePrice.id }],
        trial_period_days: trialDays || subscriptionPlan.trialDays,
        metadata: {
          tenantId: request.tenant.id.toString(),
          pluginSlug: 'google',
          planId,
          ...metadata
        }
      })

      // 创建本地订阅记录
      const localSubscription = await fastify.createSubscription(
        request.tenant.id,
        'google',
        planId,
        {
          stripeSubscriptionId: stripeSubscription.id,
          stripeCustomerId,
          trialDays: trialDays || subscriptionPlan.trialDays,
          initiatedBy: 'admin',
          eventSource: 'stripe',
          metadata: {
            stripeSubscriptionId: stripeSubscription.id,
            stripeCustomerId,
            ...metadata
          }
        }
      )

      return {
        success: true,
        subscription: {
          id: localSubscription.id,
          stripeSubscriptionId: stripeSubscription.id,
          status: stripeSubscription.status,
          planId,
          amount: subscriptionPlan.amount,
          currency: subscriptionPlan.currency,
          currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
          trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null
        }
      }
    } catch (error) {
      fastify.log.error('Subscription creation failed:', error)
      return reply.status(500).send({
        error: 'Failed to create subscription',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  /**
   * 获取订阅详情
   * GET /subscriptions/:id
   *
   * 用途：Super Admin查询订阅详细信息（包含发票和历史记录）
   */
  fastify.get('/subscriptions/:id', {
    schema: {
      hide: true,
      tags: ['plugins', 'google'],
      summary: 'Get subscription details',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // API 调用次数限制检查
      const apiCallCheck = await fastify.checkUsageLimit(
        request.tenant.id,
        'google',
        'api_calls'
      )

      if (!apiCallCheck.allowed) {
        return reply.status(429).send({
          error: 'API call limit exceeded',
          current: apiCallCheck.current,
          limit: apiCallCheck.limit,
          percentage: apiCallCheck.percentage,
          upgradeUrl: `/plugins/google/upgrade`
        })
      }

      // 记录 API 调用次数
      await fastify.recordPluginUsage(request.tenant.id, 'google', 'api_calls')

      const subscriptionCheck = await fastify.checkSubscriptionAccess(
        request.tenant.id,
        'google'
      )

      if (!subscriptionCheck.allowed) {
        return reply.status(402).send({
          error: 'Subscription required',
          reason: subscriptionCheck.reason,
          upgradeUrl: subscriptionCheck.upgradeUrl
        })
      }
    }
  }, async (request: any, reply: any) => {
    const { id } = request.params

    try {
      // 获取租户的 Stripe 配置
      const stripeConfig = await getStripeConfig(request.tenant.id);
      const stripe = createStripeInstance(stripeConfig.secretKey);

      const subscription = await fastify.prisma.subscription.findUnique({
        where: { id },
        include: {
          plugin: true,
          tenant: true,
          invoices: {
            orderBy: { createdAt: 'desc' },
            take: 10
          },
          changes: {
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        }
      })

      if (!subscription || subscription.tenantId !== request.tenant.id) {
        return reply.status(404).send({ error: 'Subscription not found' })
      }

      // 同步Stripe订阅状态
      if (subscription.stripeSubscriptionId) {
        try {
          const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId)

          // 如果状态不同步，更新本地状态
          if (stripeSubscription.status !== subscription.status) {
            await fastify.updateSubscription(subscription.id, {
              status: stripeSubscription.status,
              currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
              currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
              eventSource: 'stripe_sync'
            })
          }
        } catch (error) {
          fastify.log.warn('Failed to sync Stripe subscription:', error)
        }
      }

      return {
        success: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          planId: subscription.planId,
          amount: subscription.amount,
          currency: subscription.currency,
          billingCycle: subscription.billingCycle,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          trialStart: subscription.trialStart,
          trialEnd: subscription.trialEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          canceledAt: subscription.canceledAt,
          autoRenew: subscription.autoRenew,
          plugin: {
            name: subscription.plugin.name,
            slug: subscription.plugin.slug
          },
          recentInvoices: subscription.invoices,
          recentChanges: subscription.changes
        }
      }
    } catch (error) {
      fastify.log.error('Failed to get subscription:', error)
      return reply.status(500).send({ error: 'Failed to get subscription' })
    }
  })

  /**
   * 更新订阅
   * PUT /subscriptions/:id
   *
   * 用途：Super Admin直接修改订阅计划（立即生效）
   */
  fastify.put('/subscriptions/:id', {
    schema: {
      hide: true,
      tags: ['plugins', 'google'],
      summary: 'Update subscription',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          planId: { type: 'string' },
          prorationBehavior: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // API 调用次数限制检查
      const apiCallCheck = await fastify.checkUsageLimit(
        request.tenant.id,
        'google',
        'api_calls'
      )

      if (!apiCallCheck.allowed) {
        return reply.status(429).send({
          error: 'API call limit exceeded',
          current: apiCallCheck.current,
          limit: apiCallCheck.limit,
          percentage: apiCallCheck.percentage,
          upgradeUrl: `/plugins/google/upgrade`
        })
      }

      // 记录 API 调用次数
      await fastify.recordPluginUsage(request.tenant.id, 'google', 'api_calls')

      const subscriptionCheck = await fastify.checkSubscriptionAccess(
        request.tenant.id,
        'google',
        'subscriptions'
      )

      if (!subscriptionCheck.allowed) {
        return reply.status(402).send({
          error: 'Subscription required',
          reason: subscriptionCheck.reason,
          upgradeUrl: subscriptionCheck.upgradeUrl
        })
      }
    }
  }, async (request: any, reply: any) => {
    const { id } = request.params
    const { planId, prorationBehavior = 'create_prorations' } = request.body

    try {
      // 获取租户的 Stripe 配置
      const stripeConfig = await getStripeConfig(request.tenant.id);
      const stripe = createStripeInstance(stripeConfig.secretKey);

      const subscription = await fastify.prisma.subscription.findUnique({
        where: { id },
        include: { plugin: true }
      })

      if (!subscription || subscription.tenantId !== request.tenant.id) {
        return reply.status(404).send({ error: 'Subscription not found' })
      }

      if (!subscription.stripeSubscriptionId) {
        return reply.status(400).send({ error: 'Stripe subscription not found' })
      }

      // 获取新的订阅计划
      const newPlan = await fastify.prisma.subscriptionPlan.findUnique({
        where: {
          pluginId_planId: {
            pluginId: subscription.plugin.id,
            planId
          }
        }
      })

      if (!newPlan) {
        return reply.status(400).send({ error: 'Subscription plan not found' })
      }

      // 创建或获取Stripe价格
      const stripePriceId = `price_${subscription.plugin.id}_${planId}`
      let stripePrice
      try {
        stripePrice = await stripe.prices.retrieve(stripePriceId)
      } catch {
        // 价格不存在，创建新的
        stripePrice = await stripe.prices.create({
          product: `prod_${subscription.plugin.id}`,
          unit_amount: Math.round(newPlan.amount * 100),
          currency: newPlan.currency.toLowerCase(),
          recurring: {
            interval: newPlan.billingCycle === 'yearly' ? 'year' : 'month'
          }
        })
      }

      // 更新Stripe订阅
      const stripeSubscription = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        items: [{
          id: (await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId)).items.data[0].id,
          price: stripePrice.id
        }],
        proration_behavior: prorationBehavior
      })

      // 更新本地订阅
      const updatedSubscription = await fastify.updateSubscription(subscription.id, {
        planId,
        amount: newPlan.amount,
        currency: newPlan.currency,
        billingCycle: newPlan.billingCycle,
        currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
        currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
        reason: `Plan changed from ${subscription.planId} to ${planId}`,
        initiatedBy: 'admin',
        eventSource: 'stripe'
      })

      return {
        success: true,
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          planId: updatedSubscription.planId,
          amount: updatedSubscription.amount,
          currency: updatedSubscription.currency,
          currentPeriodStart: updatedSubscription.currentPeriodStart,
          currentPeriodEnd: updatedSubscription.currentPeriodEnd
        }
      }
    } catch (error) {
      fastify.log.error('Failed to update subscription:', error)
      return reply.status(500).send({
        error: 'Failed to update subscription',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  /**
   * 取消订阅
   * DELETE /subscriptions/:id
   *
   * 用途：Super Admin直接取消订阅（支持立即取消或延期取消）
   */
  fastify.delete('/subscriptions/:id', {
    schema: {
      hide: true,
      tags: ['plugins', 'google'],
      summary: 'Cancel subscription',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          cancelAtPeriodEnd: { type: 'boolean' },
          reason: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // API 调用次数限制检查
      const apiCallCheck = await fastify.checkUsageLimit(
        request.tenant.id,
        'google',
        'api_calls'
      )

      if (!apiCallCheck.allowed) {
        return reply.status(429).send({
          error: 'API call limit exceeded',
          current: apiCallCheck.current,
          limit: apiCallCheck.limit,
          percentage: apiCallCheck.percentage,
          upgradeUrl: `/plugins/google/upgrade`
        })
      }

      // 记录 API 调用次数
      await fastify.recordPluginUsage(request.tenant.id, 'google', 'api_calls')

      const subscriptionCheck = await fastify.checkSubscriptionAccess(
        request.tenant.id,
        'google'
      )

      if (!subscriptionCheck.allowed) {
        return reply.status(402).send({
          error: 'Subscription required',
          reason: subscriptionCheck.reason,
          upgradeUrl: subscriptionCheck.upgradeUrl
        })
      }
    }
  }, async (request: any, reply: any) => {
    const { id } = request.params
    const { cancelAtPeriodEnd = true, reason } = request.body

    try {
      // 获取租户的 Stripe 配置
      const stripeConfig = await getStripeConfig(request.tenant.id);
      const stripe = createStripeInstance(stripeConfig.secretKey);

      const subscription = await fastify.prisma.subscription.findUnique({
        where: { id }
      })

      if (!subscription || subscription.tenantId !== request.tenant.id) {
        return reply.status(404).send({ error: 'Subscription not found' })
      }

      // 取消Stripe订阅
      if (subscription.stripeSubscriptionId) {
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: cancelAtPeriodEnd
        })

        if (!cancelAtPeriodEnd) {
          await stripe.subscriptions.cancel(subscription.stripeSubscriptionId)
        }
      }

      // 更新本地订阅
      const canceledSubscription = await fastify.cancelSubscription(
        subscription.id,
        cancelAtPeriodEnd,
        reason || 'Canceled by admin'
      )

      return {
        success: true,
        subscription: {
          id: canceledSubscription.id,
          status: canceledSubscription.status,
          cancelAtPeriodEnd: canceledSubscription.cancelAtPeriodEnd,
          canceledAt: canceledSubscription.canceledAt,
          currentPeriodEnd: canceledSubscription.currentPeriodEnd
        }
      }
    } catch (error) {
      fastify.log.error('Failed to cancel subscription:', error)
      return reply.status(500).send({
        error: 'Failed to cancel subscription',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // ✅ Google OAuth插件不需要自己的webhook处理器
  // 所有Stripe订阅事件都由Stripe Payment插件统一处理
  // 该插件通过Commercial Support的订阅管理系统接收通知

  fastify.log.info('✅ Google OAuth Plugin initialized successfully')
}

/**
 * 处理 Google 用户登录
 * 查找或创建用户和社交账户
 */
async function handleGoogleUser(
  fastify: FastifyInstance,
  tenantId: number,
  googleUser: any,
  tokens: any
) {
  const googleId = googleUser.sub
  const email = googleUser.email
  const name = googleUser.name
  const picture = googleUser.picture

  // 1. 查找是否已存在该 Google 账号的社交账户
  let socialAccount = await fastify.prisma.socialAccount.findUnique({
    where: {
      provider_providerId: {
        provider: 'google',
        providerId: googleId
      }
    },
    include: {
      user: true
    }
  })

  let user
  let isNewUser = false

  if (socialAccount) {
    // 已存在社交账户，更新 token
    user = socialAccount.user

    await fastify.prisma.socialAccount.update({
      where: { id: socialAccount.id },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || socialAccount.refreshToken,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        updatedAt: new Date()
      }
    })
  } else {
    // 新用户，查找是否已有相同邮箱的用户
    user = await fastify.prisma.user.findFirst({
      where: {
        email,
        tenantId
      }
    })

    if (!user) {
      // 创建新用户
      isNewUser = true
      user = await fastify.prisma.user.create({
        data: {
          email,
          username: email.split('@')[0] + '_' + Math.random().toString(36).substr(2, 6),
          password: '', // Google 登录不需要密码
          role: 'customer',
          tenantId,
          avatar: picture
        }
      })
    }

    // 创建社交账户关联
    socialAccount = await fastify.prisma.socialAccount.create({
      data: {
        userId: user.id,
        provider: 'google',
        providerId: googleId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null
      },
      include: {
        user: true
      }
    })
  }

  // 2. 创建或更新 OAuth2AccessToken 记录
  if (tokens.access_token) {
    await fastify.prisma.oAuth2AccessToken.upsert({
      where: {
        accessToken: tokens.access_token
      },
      update: {
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000),
        refreshExpiresAt: tokens.refresh_token
          ? new Date(Date.now() + 30 * 24 * 3600 * 1000) // 30 天
          : null,
        updatedAt: new Date()
      },
      create: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        userId: user.id,
        clientId: 'google',
        scope: tokens.scope,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000),
        refreshExpiresAt: tokens.refresh_token
          ? new Date(Date.now() + 30 * 24 * 3600 * 1000)
          : null
      }
    })
  }

  return { user, socialAccount, isNewUser }
}

export default googleOAuthPlugin

