import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { SUPER_ADMIN_TENANT_ID } from '../src/utils/tenant-utils';

// Load environment variables
config({ path: '../../.env' });

const prisma = new PrismaClient();

// Plugin system initialization function
// Note: Only creates plugins, does not install them to tenants (tenants need to install manually)
async function initializePluginSystem(_tenantId: number) {
  console.log('🔌 Creating core plugins...');

  // 1. Create Stripe Payment Plugin
  // Note: No longer using pricing field, using subscription_plans table instead
  const stripePlugin = await prisma.plugin.upsert({
    where: { slug: 'stripe' },
    update: {
      name: 'Stripe Payment Plugin',
      description: 'Integrate Stripe payment functionality with support for basic payments, subscriptions, and refunds',
      version: '1.0.0',
      status: 'ACTIVE',
    },
    create: {
      slug: 'stripe',
      name: 'Stripe Payment Plugin',
      description: 'Integrate Stripe payment functionality with support for basic payments, subscriptions, and refunds',
      category: 'payment',
      version: '1.0.0',
      status: 'ACTIVE',
    }
  });

  console.log(`✅ Stripe plugin: ${stripePlugin.name} (ID: ${stripePlugin.id})`);
  console.log('   Note: Plugin created but not installed to any tenant');
  console.log('   Tenants need to install plugins through Admin UI');

  // 2. Create Resend Email Plugin
  const resendPlugin = await prisma.plugin.upsert({
    where: { slug: 'resend' },
    update: {
      name: 'Resend Email',
      description: 'Modern email API service with excellent deliverability. Send transactional and marketing emails with ease.',
      version: '1.0.0',
      status: 'ACTIVE',
    },
    create: {
      slug: 'resend',
      name: 'Resend Email',
      description: 'Modern email API service with excellent deliverability. Send transactional and marketing emails with ease.',
      category: 'email',
      version: '1.0.0',
      status: 'ACTIVE',
      developer: 'Jiffoo',
      rating: 4.8,
      installCount: 0
    }
  });

  console.log(`✅ Resend Email plugin: ${resendPlugin.name} (ID: ${resendPlugin.id})`);
  console.log('   Note: Plugin created but not installed to any tenant');

  // 3. Create Google OAuth Plugin
  const googleOAuthPlugin = await prisma.plugin.upsert({
    where: { slug: 'google' },
    update: {
      name: 'Google OAuth',
      description: 'Enable Google Sign-In for your users. Secure OAuth 2.0 authentication with Google accounts.',
      version: '1.0.0',
      status: 'ACTIVE',
    },
    create: {
      slug: 'google',
      name: 'Google OAuth',
      description: 'Enable Google Sign-In for your users. Secure OAuth 2.0 authentication with Google accounts.',
      category: 'authentication',
      version: '1.0.0',
      status: 'ACTIVE',
      developer: 'Jiffoo',
      rating: 4.9,
      installCount: 0
    }
  });

  console.log(`✅ Google OAuth plugin: ${googleOAuthPlugin.name} (ID: ${googleOAuthPlugin.id})`);
  console.log('   Note: Plugin created but not installed to any tenant');

  // 4. Create Affiliate Commission Plugin (One-time purchase)
  const affiliatePlugin = await prisma.plugin.upsert({
    where: { slug: 'affiliate' },
    update: {
      name: 'Affiliate Commission System',
      description: 'Complete affiliate and commission management system with multi-level distribution and automatic settlement. One-time purchase, lifetime access.',
      version: '1.0.0',
      status: 'ACTIVE',
    },
    create: {
      slug: 'affiliate',
      name: 'Affiliate Commission System',
      description: 'Complete affiliate and commission management system with multi-level distribution and automatic settlement. One-time purchase, lifetime access.',
      longDescription: 'The Affiliate Commission System is a powerful one-time purchase plugin that provides a complete affiliate management solution for your business. Features include unlimited invitations, multi-level distribution, automatic settlement, withdrawal management, commission tracking, and promotional analytics. Buy once, use forever, with no monthly fees.',
      category: 'marketing',
      tags: JSON.stringify(['affiliate', 'commission', 'referral', 'marketing', 'distribution', 'mlm']),
      version: '1.0.0',
      status: 'ACTIVE',
      developer: 'Jiffoo',
      rating: 4.7,
      installCount: 0
    }
  });

  console.log(`✅ Affiliate Commission plugin: ${affiliatePlugin.name} (ID: ${affiliatePlugin.id})`);
  console.log('   Note: Buyout model plugin - $299 one-time purchase');

  // 5. Create Default Shop Theme Plugin
  const themePlugin = await prisma.plugin.upsert({
    where: { slug: 'theme' },
    update: {
      name: 'Default Shop Theme',
      description: 'Jiffoo Mall official default front-end theme',
      version: '1.0.0',
      status: 'ACTIVE',
    },
    create: {
      slug: 'theme',
      name: 'Default Shop Theme',
      description: 'Jiffoo Mall official default front-end theme',
      longDescription: 'The official default theme for Jiffoo Mall. Provides a modern, responsive shopping experience with full customization support.',
      category: 'theme',
      tags: JSON.stringify(['theme', 'shop-front', 'themeSlug:default', 'official']),
      version: '1.0.0',
      status: 'ACTIVE',
      developer: 'Jiffoo',
      rating: 5.0,
      installCount: 0
    }
  });

  console.log(`✅ Default Shop Theme plugin: ${themePlugin.name} (ID: ${themePlugin.id})`);
  console.log('   Note: Official theme plugin - automatically installed for all tenants');

  // 6. Create Agent System Plugin (Three-Level Agent)
  const agentPlugin = await prisma.plugin.upsert({
    where: { slug: 'agent' },
    update: {
      name: 'Three-Level Agent System',
      description: 'Complete three-level agent management system with independent agent mall, commission distribution, and domain support.',
      version: '1.0.0',
      status: 'ACTIVE',
    },
    create: {
      slug: 'agent',
      name: 'Three-Level Agent System',
      description: 'Complete three-level agent management system with independent agent mall, commission distribution, and domain support.',
      longDescription: 'The Agent System provides a powerful three-level (L1/L2/L3) agent management solution. Features include agent hierarchy management, independent agent mall with custom themes, automatic commission calculation and distribution, custom domain binding, and comprehensive analytics. Perfect for building a scalable distribution network.',
      category: 'marketing',
      tags: JSON.stringify(['agent', 'distribution', 'commission', 'marketing', 'mlm', 'three-level']),
      version: '1.0.0',
      status: 'ACTIVE',
      developer: 'Jiffoo',
      rating: 4.8,
      installCount: 0
    }
  });

  console.log(`✅ Agent System plugin: ${agentPlugin.name} (ID: ${agentPlugin.id})`);
  console.log('   Note: Three-level agent management system');

  console.log('🎉 Plugin system initialized successfully!');

  return { themePlugin, affiliatePlugin, agentPlugin };
}

// Subscription system initialization function
async function initializeSubscriptionSystem(_tenantId: number, affiliatePlugin: any) {
  console.log('📋 Creating subscription plans...');

  // Get Stripe plugin
  const stripePlugin = await prisma.plugin.findUnique({
    where: { slug: 'stripe' }
  });

  if (!stripePlugin) {
    throw new Error('Stripe plugin not found');
  }

  // Create subscription plan templates
  // Note: subscription_plans table is the single source of truth, no longer syncing to Plugin.pricing
  // Super Admin can add more plans through UI (e.g., yearly plans)
  const subscriptionPlans = [
    // Free Plan
    {
      pluginId: stripePlugin.id,
      planId: 'free',
      name: 'Free Plan',
      description: 'Basic payment features for small merchants',
      amount: 0,
      currency: 'USD',
      billingCycle: 'monthly',
      trialDays: 0,
      stripePriceId: null,     // Free plan doesn't need Stripe Price ID
      features: JSON.stringify(['basic_payments', 'payment_verification', 'webhooks']),
      limits: JSON.stringify({
        transactions: 100,
        api_calls: 1000
      }),
      isActive: true,
      isPublic: true,
      sortOrder: 1
    },
    // Business Plan
    {
      pluginId: stripePlugin.id,
      planId: 'business',
      name: 'Business Plan',
      description: 'Complete payment solution for small and medium businesses',
      amount: 29.00,
      currency: 'USD',
      billingCycle: 'monthly',
      trialDays: 0,
      stripePriceId: 'price_1SFWcnB6vJBDO7CtqxVJVW5n',  // Initial value, can be modified via Super Admin UI
      features: JSON.stringify(['basic_payments', 'payment_verification', 'webhooks', 'subscriptions', 'refunds']),
      limits: JSON.stringify({
        transactions: 1000,
        api_calls: 10000
      }),
      isActive: true,
      isPublic: true,
      sortOrder: 2
    },
    // Enterprise Plan
    {
      pluginId: stripePlugin.id,
      planId: 'enterprise',
      name: 'Enterprise Plan',
      description: 'Advanced payment features for large enterprises',
      amount: 99.00,
      currency: 'USD',
      billingCycle: 'monthly',
      trialDays: 0,
      stripePriceId: 'price_1SFWcoB6vJBDO7CtT6q82JDl',  // Initial value, can be modified via Super Admin UI
      features: JSON.stringify(['basic_payments', 'payment_verification', 'webhooks', 'subscriptions', 'refunds', 'installments', 'advanced_analytics']),
      limits: JSON.stringify({
        transactions: -1, // Unlimited
        api_calls: -1
      }),
      isActive: true,
      isPublic: true,
      sortOrder: 3
    },
  ];

  // Create subscription plans
  for (const planData of subscriptionPlans) {
    const plan = await prisma.subscriptionPlan.upsert({
      where: {
        pluginId_planId: {
          pluginId: planData.pluginId,
          planId: planData.planId
        }
      },
      update: planData,
      create: planData
    });
    console.log(`✅ Subscription plan: ${plan.name} (${plan.planId})`);
  }

  // Note: No longer syncing to Plugin.pricing, using subscription_plans table as single source of truth
  console.log(`✅ Stripe subscription plans created: ${subscriptionPlans.length} plans`);

  // Get Resend Email plugin
  const resendPlugin = await prisma.plugin.findUnique({
    where: { slug: 'resend' }
  });

  if (!resendPlugin) {
    throw new Error('Resend Email plugin not found');
  }

  // Create Resend Email subscription plans (3-tier)
  const emailPlans = [
    // Free Plan
    {
      pluginId: resendPlugin.id,
      planId: 'free',
      name: 'Free Plan',
      description: 'Perfect for testing and small projects',
      amount: 0,
      currency: 'USD',
      billingCycle: 'monthly',
      trialDays: 0,
      stripePriceId: null,     // Free plan doesn't need Stripe Price ID
      features: JSON.stringify([
        'basic_email',           // Basic email sending
        'email_tracking',        // Open/click tracking
        'email_templates'        // Email templates
      ]),
      limits: JSON.stringify({
        emails_sent: 100,        // 100 emails per month
        api_calls: 500           // 500 API calls per month
      }),
      isActive: true,
      isPublic: true,
      sortOrder: 1
    },
    // Business Plan
    {
      pluginId: resendPlugin.id,
      planId: 'business',
      name: 'Business Plan',
      description: 'For growing businesses with higher email volume',
      amount: 29.00,
      currency: 'USD',
      billingCycle: 'monthly',
      trialDays: 0,
      stripePriceId: 'price_1SHjDuB6vJBDO7Cth6PCqiRR',  // Initial value, can be modified via Super Admin UI
      features: JSON.stringify([
        'basic_email',
        'email_tracking',
        'email_templates',
        'attachments',           // Attachment support
        'custom_domain',         // Custom sender domain
        'batch_email',           // Batch sending
        'webhook_events'         // Webhook events
      ]),
      limits: JSON.stringify({
        emails_sent: 10000,
        api_calls: 50000
      }),
      isActive: true,
      isPublic: true,
      sortOrder: 2
    },
    // Enterprise Plan
    {
      pluginId: resendPlugin.id,
      planId: 'enterprise',
      name: 'Enterprise Plan',
      description: 'For mission-critical email infrastructure with unlimited sending',
      amount: 99.00,
      currency: 'USD',
      billingCycle: 'monthly',
      trialDays: 0,
      stripePriceId: 'price_1SHjEBB6vJBDO7Ctqz90mH3Y',  // Initial value, can be modified via Super Admin UI
      features: JSON.stringify([
        'all_features',          // All features
        'dedicated_ip',          // Dedicated IP
        'advanced_analytics',    // Advanced analytics
        'sla_guarantee',         // SLA guarantee
        'priority_support'       // Priority support
      ]),
      limits: JSON.stringify({
        emails_sent: -1,         // Unlimited
        api_calls: -1
      }),
      isActive: true,
      isPublic: true,
      sortOrder: 3
    }
  ];

  // Create email subscription plans
  for (const planData of emailPlans) {
    const plan = await prisma.subscriptionPlan.upsert({
      where: {
        pluginId_planId: {
          pluginId: planData.pluginId,
          planId: planData.planId
        }
      },
      update: planData,
      create: planData
    });
    console.log(`✅ Email subscription plan: ${plan.name} (${plan.planId})`);
  }

  console.log(`✅ Resend Email subscription plans created: ${emailPlans.length} plans`);

  // ==================== Google OAuth Plugin Plans ====================
  console.log('🔐 Creating Google OAuth subscription plans...');

  // Get Google OAuth plugin
  const googleOAuthPlugin = await prisma.plugin.findUnique({
    where: { slug: 'google' }
  });

  if (!googleOAuthPlugin) {
    throw new Error('Google OAuth plugin not found');
  }

  const googleOAuthPlans = [
    // Free Plan
    {
      pluginId: googleOAuthPlugin.id,
      planId: 'free',
      name: 'Free Plan',
      description: 'Basic Google Sign-In for small applications',
      amount: 0,
      currency: 'USD',
      billingCycle: 'monthly',
      trialDays: 0,
      stripePriceId: null,     // Free plan doesn't need Stripe Price ID
      features: JSON.stringify([
        'basic_auth',            // Basic authentication (required for license check)
        'google_signin',         // Google Sign-In
        'user_profile',          // User profile
        'email_verification'     // Email verification
      ]),
      limits: JSON.stringify({
        login_attempts: 100,     // 100 login attempts per month
        api_calls: 500           // 500 API calls per month
      }),
      isActive: true,
      isPublic: true,
      sortOrder: 1
    },
    // Business Plan
    {
      pluginId: googleOAuthPlugin.id,
      planId: 'business',
      name: 'Business Plan',
      description: 'For growing applications with more users',
      amount: 19.00,
      currency: 'USD',
      billingCycle: 'monthly',
      trialDays: 14,
      stripePriceId: 'price_google_oauth_business',  // Initial value, can be modified via Super Admin UI
      features: JSON.stringify([
        'google_signin',
        'user_profile',
        'email_verification',
        'refresh_tokens',        // Token refresh
        'custom_scopes',         // Custom permission scopes
        'webhook_events'         // Webhook events
      ]),
      limits: JSON.stringify({
        login_attempts: 10000,
        api_calls: 50000
      }),
      isActive: true,
      isPublic: true,
      sortOrder: 2
    },
    // Enterprise Plan
    {
      pluginId: googleOAuthPlugin.id,
      planId: 'enterprise',
      name: 'Enterprise Plan',
      description: 'Unlimited Google Sign-In for enterprise applications',
      amount: 49.00,
      currency: 'USD',
      billingCycle: 'monthly',
      trialDays: 14,
      stripePriceId: 'price_google_oauth_enterprise',  // Initial value, can be modified via Super Admin UI
      features: JSON.stringify([
        'all_features',          // All features
        'advanced_analytics',    // Advanced analytics
        'sla_guarantee',         // SLA guarantee
        'priority_support',      // Priority support
        'custom_integration'     // Custom integration
      ]),
      limits: JSON.stringify({
        login_attempts: -1,      // Unlimited
        api_calls: -1
      }),
      isActive: true,
      isPublic: true,
      sortOrder: 3
    }
  ];

  // Create Google OAuth subscription plans
  for (const planData of googleOAuthPlans) {
    const plan = await prisma.subscriptionPlan.upsert({
      where: {
        pluginId_planId: {
          pluginId: planData.pluginId,
          planId: planData.planId
        }
      },
      update: planData,
      create: planData
    });
    console.log(`✅ Google OAuth subscription plan: ${plan.name} (${plan.planId})`);
  }

  console.log(`✅ Google OAuth subscription plans created: ${googleOAuthPlans.length} plans`);
  
  // ==================== Affiliate Commission Plugin License Initialization ====================
  console.log('🎯 Initializing Affiliate Commission plugin licenses...');
  
  // Add one-time purchase licenses for tenants already using affiliate features
  const tenantsWithCommissionConfig = await prisma.tenantCommissionConfig.findMany({
    where: { enabled: true },
    include: { tenant: true }
  });

  if (tenantsWithCommissionConfig.length > 0) {
    console.log(`Found ${tenantsWithCommissionConfig.length} tenants with active commission config`);
    
    for (const config of tenantsWithCommissionConfig) {
      // Create one-time purchase license
      const license = await prisma.pluginLicense.upsert({
        where: {
          tenantId_pluginId: {
            tenantId: config.tenantId,
            pluginId: 'affiliate-commission'
          }
        },
        update: {
          status: 'ACTIVE',
          activatedAt: new Date()
        },
        create: {
          tenantId: config.tenantId,
          pluginId: affiliatePlugin.id,
          status: 'ACTIVE',
          purchaseDate: new Date(),
          activatedAt: new Date(),
          amount: 299.00,
          currency: 'USD'
        }
      });

      // Create plugin installation record
      await prisma.pluginInstallation.upsert({
        where: {
          tenantId_pluginId: {
            tenantId: config.tenantId,
            pluginId: affiliatePlugin.id
          }
        },
        update: {
          status: 'ACTIVE',
          enabled: true
        },
        create: {
          tenantId: config.tenantId,
          pluginId: affiliatePlugin.id,
          status: 'ACTIVE',
          enabled: true,
          installedAt: new Date()
        }
      });

      console.log(`✅ Affiliate license granted to tenant ${config.tenantId} (${config.tenant.companyName})`);
    }
  } else {
    console.log('No tenants with active commission config found');
  }

  console.log('🎉 Subscription system initialized successfully!');
}

// Email templates initialization function
async function initializeEmailTemplates(tenantId: number) {
  console.log('📧 Creating email templates...');

  const emailTemplates = [
    // 1. Registration Verification Email Template
    {
      tenantId,
      slug: 'registration-verification',
      name: 'Registration Verification Email',
      description: 'Email sent to new users with a 6-digit verification code',
      category: 'auth',
      subject: 'Welcome to {{companyName}} - Your Verification Code',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Verification</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; color: #1a1a1a; font-size: 28px; font-weight: 600;">Welcome to {{companyName}}!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                Hi <strong>{{username}}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                Thank you for registering! To complete your registration, please use the verification code below:
              </p>
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 20px 40px; border-radius: 8px; text-align: center; margin: 30px 0;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px;">{{verificationCode}}</span>
              </div>
              <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                This code will expire in <strong>10 minutes</strong>. If you didn't request this code, please ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #999999; font-size: 12px; text-align: center;">
                © {{year}} {{companyName}}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      text: `Welcome to {{companyName}}!

Hi {{username}},

Thank you for registering! To complete your registration, please use the verification code below:

{{verificationCode}}

This code will expire in 10 minutes. If you didn't request this code, please ignore this email.

© {{year}} {{companyName}}. All rights reserved.`,
      variables: JSON.stringify(['companyName', 'username', 'verificationCode', 'year']),
      isActive: true
    },
    // 2. Password Reset Email Template
    {
      tenantId,
      slug: 'password-reset',
      name: 'Password Reset Email',
      description: 'Email sent to users who request a password reset with a 6-digit code',
      category: 'auth',
      subject: 'Reset Your Password - {{companyName}}',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; color: #1a1a1a; font-size: 28px; font-weight: 600;">Reset Your Password</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                Hi <strong>{{username}}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password. Use the code below to reset your password:
              </p>
              <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: #ffffff; padding: 20px 40px; border-radius: 8px; text-align: center; margin: 30px 0;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px;">{{resetCode}}</span>
              </div>
              <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                This code will expire in <strong>10 minutes</strong>. If you didn't request a password reset, please ignore this email or contact support if you have concerns.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #999999; font-size: 12px; text-align: center;">
                © {{year}} {{companyName}}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      text: `Reset Your Password

Hi {{username}},

We received a request to reset your password. Use the code below to reset your password:

{{resetCode}}

This code will expire in 10 minutes. If you didn't request a password reset, please ignore this email or contact support if you have concerns.

© {{year}} {{companyName}}. All rights reserved.`,
      variables: JSON.stringify(['companyName', 'username', 'resetCode', 'year']),
      isActive: true
    }
  ];

  // Create email templates
  for (const templateData of emailTemplates) {
    const template = await prisma.emailTemplate.upsert({
      where: {
        tenantId_slug: {
          tenantId: templateData.tenantId,
          slug: templateData.slug
        }
      },
      update: templateData,
      create: templateData
    });
    console.log(`✅ Email template: ${template.name} (${template.slug})`);
  }

  console.log(`✅ Email templates created: ${emailTemplates.length} templates`);
  console.log('🎉 Email templates initialized successfully!');
}

// 🎨 Initialize default theme for tenant
async function initializeTenantDefaultTheme(tenantId: number) {
  console.log('🎨 Initializing default theme for tenant...');
  
  // Use shared theme initialization utility
  // Skip cache clear in seed context since cache is empty during initialization
  const { initializeDefaultTheme } = await import('../src/utils/theme-utils');
  const success = await initializeDefaultTheme(tenantId, {
    skipCacheClear: true,
    logger: console.log
  });
  
  if (!success) {
    console.warn('⚠️ Theme initialization failed, but continuing with seed...');
  }
  
  console.log(`✅ Tenant.theme field updated with unified JSON structure`);
}

// 🧪 Install plugins and create test subscriptions for testing tenant
async function installPluginsForTestTenant(tenantId: number) {
  console.log('🔌 Installing plugins for test tenant...');

  // Get all plugins
  const stripePlugin = await prisma.plugin.findUnique({ where: { slug: 'stripe' } });
  const resendPlugin = await prisma.plugin.findUnique({ where: { slug: 'resend' } });
  const googleOAuthPlugin = await prisma.plugin.findUnique({ where: { slug: 'google' } });

  if (!stripePlugin || !resendPlugin || !googleOAuthPlugin) {
    throw new Error('Plugins not found. Please run plugin initialization first.');
  }

  // ==================== 1. Install Stripe Plugin ====================
  console.log('💳 Installing Stripe Payment plugin...');

  const stripeInstallation = await prisma.pluginInstallation.upsert({
    where: {
      tenantId_pluginId: {
        tenantId,
        pluginId: stripePlugin.id
      }
    },
    update: {
      status: 'ACTIVE',
      enabled: true
    },
    create: {
      tenantId,
      pluginId: stripePlugin.id,
      status: 'ACTIVE',
      enabled: true,
      configData: JSON.stringify({
        mode: 'PLATFORM',
        apiKey: 'sk_test_...',
        webhookSecret: 'whsec_...'
      })
    }
  });

  console.log(`✅ Stripe plugin installed (ID: ${stripeInstallation.id})`);

  // Create Stripe subscription (Free Plan - for testing upgrade flow)
  const stripeFreePlan = await prisma.subscriptionPlan.findFirst({
    where: {
      pluginId: stripePlugin.id,
      planId: 'free'
    }
  });

  if (stripeFreePlan) {
    // Check if subscription already exists
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        tenantId,
        pluginId: stripePlugin.id,
        status: { in: ['active', 'trialing'] }
      }
    });

    let stripeSubscription;
    if (existingSubscription) {
      stripeSubscription = await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          status: 'active',
          planId: 'free',
          amount: 0
        }
      });
    } else {
      stripeSubscription = await prisma.subscription.create({
        data: {
          tenantId,
          pluginId: stripePlugin.id,
          planId: 'free',
          status: 'active',
          amount: 0,
          currency: 'USD',
          billingCycle: 'monthly',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          // Free plan doesn't have a Stripe subscription ID
          stripeSubscriptionId: null
        }
      });
    }

    console.log(`✅ Stripe subscription created (Plan: ${stripeSubscription.planId}, Status: ${stripeSubscription.status})`);

    // Create Stripe usage data (Free plan starts with 0 usage)
    const currentPeriod = new Date().toISOString().slice(0, 7); // '2025-10' format

    // API Calls usage
    await prisma.pluginUsage.upsert({
      where: {
        tenantId_pluginSlug_metricName_period: {
          tenantId,
          pluginSlug: 'stripe',
          metricName: 'api_calls',
          period: currentPeriod
        }
      },
      update: {
        value: 0
      },
      create: {
        tenantId,
        pluginSlug: 'stripe',
        metricName: 'api_calls',
        value: 0,
        period: currentPeriod
      }
    });

    // Transactions usage
    await prisma.pluginUsage.upsert({
      where: {
        tenantId_pluginSlug_metricName_period: {
          tenantId,
          pluginSlug: 'stripe',
          metricName: 'transactions',
          period: currentPeriod
        }
      },
      update: {
        value: 0
      },
      create: {
        tenantId,
        pluginSlug: 'stripe',
        metricName: 'transactions',
        value: 0,
        period: currentPeriod
      }
    });

    console.log(`✅ Stripe subscription created (Free Plan - 0/100 API Calls, 0/10 Transactions)`);
  }

  // ==================== 2. Install Resend Email Plugin ====================
  console.log('📧 Installing Resend Email plugin...');

  const resendInstallation = await prisma.pluginInstallation.upsert({
    where: {
      tenantId_pluginId: {
        tenantId,
        pluginId: resendPlugin.id
      }
    },
    update: {
      status: 'ACTIVE',
      enabled: true
    },
    create: {
      tenantId,
      pluginId: resendPlugin.id,
      status: 'ACTIVE',
      enabled: true,
      configData: JSON.stringify({
        mode: 'PLATFORM',
        apiKey: 're_...',
        fromEmail: 'noreply@chentsimo.top'
      })
    }
  });

  console.log(`✅ Resend plugin installed (ID: ${resendInstallation.id})`);

  // Create Resend subscription (Free Plan for testing upgrade flow)
  const resendFreePlan = await prisma.subscriptionPlan.findFirst({
    where: {
      pluginId: resendPlugin.id,
      planId: 'free'
    }
  });

  if (resendFreePlan) {
    // Check if subscription already exists
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        tenantId,
        pluginId: resendPlugin.id,
        status: { in: ['active', 'trialing'] }
      }
    });

    let resendSubscription;
    if (existingSubscription) {
      resendSubscription = await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          status: 'active',
          planId: 'free',
          amount: 0
        }
      });
    } else {
      resendSubscription = await prisma.subscription.create({
        data: {
          tenantId,
          pluginId: resendPlugin.id,
          planId: 'free',
          status: 'active',
          amount: 0,
          currency: 'USD',
          billingCycle: 'monthly',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          stripeSubscriptionId: null
        }
      });
    }

    console.log(`✅ Resend subscription created (Plan: ${resendSubscription.planId}, Status: ${resendSubscription.status})`);

    // Create Resend usage data (Free Plan: 50 API calls, 10 emails sent)
    const currentPeriod = new Date().toISOString().slice(0, 7); // '2025-10' format

    // API Calls usage
    await prisma.pluginUsage.upsert({
      where: {
        tenantId_pluginSlug_metricName_period: {
          tenantId,
          pluginSlug: 'resend',
          metricName: 'api_calls',
          period: currentPeriod
        }
      },
      update: {
        value: 50
      },
      create: {
        tenantId,
        pluginSlug: 'resend',
        metricName: 'api_calls',
        value: 50,
        period: currentPeriod
      }
    });

    // Emails Sent usage
    await prisma.pluginUsage.upsert({
      where: {
        tenantId_pluginSlug_metricName_period: {
          tenantId,
          pluginSlug: 'resend',
          metricName: 'emails_sent',
          period: currentPeriod
        }
      },
      update: {
        value: 10
      },
      create: {
        tenantId,
        pluginSlug: 'resend',
        metricName: 'emails_sent',
        value: 10,
        period: currentPeriod
      }
    });

    console.log(`✅ Resend usage data created (API Calls: 50/500, Emails Sent: 10/100)`);
  }

  // ==================== 3. Install Google OAuth Plugin ====================
  console.log('🔐 Installing Google OAuth plugin...');

  const googleInstallation = await prisma.pluginInstallation.upsert({
    where: {
      tenantId_pluginId: {
        tenantId,
        pluginId: googleOAuthPlugin.id
      }
    },
    update: {
      status: 'ACTIVE',
      enabled: true
    },
    create: {
      tenantId,
      pluginId: googleOAuthPlugin.id,
      status: 'ACTIVE',
      enabled: true,
      configData: JSON.stringify({
        mode: 'PLATFORM',
        clientId: 'google_client_id',
        clientSecret: 'google_client_secret'
      })
    }
  });

  console.log(`✅ Google OAuth plugin installed (ID: ${googleInstallation.id})`);

  // Create Google OAuth subscription (Free Plan)
  const googleFreePlan = await prisma.subscriptionPlan.findFirst({
    where: {
      pluginId: googleOAuthPlugin.id,
      planId: 'free'
    }
  });

  if (googleFreePlan) {
    // Check if subscription already exists
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        tenantId,
        pluginId: googleOAuthPlugin.id,
        status: { in: ['active', 'trialing'] }
      }
    });

    let googleSubscription;
    if (existingSubscription) {
      googleSubscription = await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          status: 'active',
          planId: 'free',
          amount: 0
        }
      });
    } else {
      googleSubscription = await prisma.subscription.create({
        data: {
          tenantId,
          pluginId: googleOAuthPlugin.id,
          planId: 'free',
          status: 'active',
          amount: 0,
          currency: 'USD',
          billingCycle: 'monthly',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          stripeSubscriptionId: null // Free plan doesn't need Stripe subscription
        }
      });
    }

    console.log(`✅ Google OAuth subscription created (Plan: ${googleSubscription.planId}, Status: ${googleSubscription.status})`);

    // Create Google OAuth usage data
    const currentPeriod = new Date().toISOString().slice(0, 7); // '2025-10' format

    // API Calls usage
    await prisma.pluginUsage.upsert({
      where: {
        tenantId_pluginSlug_metricName_period: {
          tenantId,
          pluginSlug: 'google',
          metricName: 'api_calls',
          period: currentPeriod
        }
      },
      update: {
        value: 50
      },
      create: {
        tenantId,
        pluginSlug: 'google',
        metricName: 'api_calls',
        value: 50,
        period: currentPeriod
      }
    });

    // Login Attempts usage
    await prisma.pluginUsage.upsert({
      where: {
        tenantId_pluginSlug_metricName_period: {
          tenantId,
          pluginSlug: 'google',
          metricName: 'login_attempts',
          period: currentPeriod
        }
      },
      update: {
        value: 25
      },
      create: {
        tenantId,
        pluginSlug: 'google',
        metricName: 'login_attempts',
        value: 25,
        period: currentPeriod
      }
    });

    console.log(`✅ Google OAuth usage data created (API Calls: 50/500, Login Attempts: 25/100)`);
  }

  console.log('🎉 All plugins installed and configured for test tenant!');
}

async function main() {
  try {
    console.log('🌱 Starting database seeding...');
    console.log(`📌 Using SUPER_ADMIN_TENANT_ID = ${SUPER_ADMIN_TENANT_ID}`);

    // First create super admin tenant (ID=0)
    console.log('🏢 Creating super admin tenant (ID=0)...');
    await prisma.$executeRaw`
      INSERT INTO tenants (id, "companyName", "contactName", "contactEmail", "contactPhone", status, "createdAt", "updatedAt")
      VALUES (0, 'Jiffoo Platform', 'Super Admin', 'superadmin@jiffoo.com', '+86-400-000-0000', 'ACTIVE', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        "companyName" = EXCLUDED."companyName",
        "contactName" = EXCLUDED."contactName",
        "contactEmail" = EXCLUDED."contactEmail",
        status = EXCLUDED.status,
        "updatedAt" = NOW()
    `;
    console.log('✅ Super admin tenant created (ID=0)');

    // Create super admin user
    console.log('👤 Creating super admin user...');
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const admin = await prisma.user.upsert({
      where: {
        user_email_tenant_unique: {
          email: 'admin@jiffoo.com',
          tenantId: SUPER_ADMIN_TENANT_ID  // Using constant: 0
        }
      },
      update: {
        role: 'SUPER_ADMIN',
        password: hashedPassword,
      },
      create: {
        email: 'admin@jiffoo.com',
        username: 'admin',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        tenantId: SUPER_ADMIN_TENANT_ID,  // Using constant: 0
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
      },
    });

    console.log(`✅ Super admin user: ${admin.email} (Role: ${admin.role}, tenantId: ${admin.tenantId})`);

    // Create default tenant (ID will start from 1 automatically)
    console.log('🏢 Creating default tenant...');
    const tenant = await prisma.tenant.upsert({
      where: { contactEmail: 'tenant@jiffoo.com' },
      update: {
        companyName: 'Jiffoo Platform',
        status: 'ACTIVE',
      },
      create: {
        companyName: 'Jiffoo Platform',
        contactName: 'Tenant Admin',
        contactEmail: 'tenant@jiffoo.com',
        contactPhone: '+1-555-0123',
        subdomain: 'demo', // Add default subdomain
        status: 'ACTIVE',
        branding: JSON.stringify({
          primaryColor: '#3B82F6',
          logo: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=200&h=80&fit=crop',
          companyName: 'Jiffoo Platform'
        }),
        settings: JSON.stringify({
          timezone: 'UTC',
          currency: 'USD',
          language: 'en'
        }),
      },
    });

    console.log(`✅ Default tenant: ${tenant.companyName} (ID: ${tenant.id})`);

    // Verify tenant ID is not 0 (security check)
    if (tenant.id === SUPER_ADMIN_TENANT_ID) {
      throw new Error(`❌ Tenant ID cannot be ${SUPER_ADMIN_TENANT_ID} (reserved for super admin)`);
    }

    // Create tenant admin user
    console.log('👤 Creating tenant admin user...');
    const tenantAdmin = await prisma.user.upsert({
      where: {
        user_email_tenant_unique: {
          email: 'tenant@jiffoo.com',
          tenantId: tenant.id
        }
      },
      update: {
        role: 'TENANT_ADMIN',
        password: hashedPassword,
      },
      create: {
        email: 'tenant@jiffoo.com',
        username: 'tenant-admin',
        password: hashedPassword,
        role: 'TENANT_ADMIN',
        tenantId: tenant.id,
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
      },
    });

    console.log(`✅ Tenant admin user: ${tenantAdmin.email} (Role: ${tenantAdmin.role}, tenantId: ${tenantAdmin.tenantId})`);

    // Create a sample regular user
    console.log('👤 Creating sample user...');
    const sampleUser = await prisma.user.upsert({
      where: {
        user_email_tenant_unique: {
          email: 'user@jiffoo.com',
          tenantId: tenant.id
        }
      },
      update: {
        role: 'USER',
        password: hashedPassword,
      },
      create: {
        email: 'user@jiffoo.com',
        username: 'sample-user',
        password: hashedPassword,
        role: 'USER',
        tenantId: tenant.id,
        avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face',
      },
    });

    console.log(`✅ Sample user: ${sampleUser.email} (Role: ${sampleUser.role}, tenantId: ${sampleUser.tenantId})`);

    // Create sample products
    console.log('📦 Creating sample products...');
    const product = await prisma.product.upsert({
      where: {
        id: 'test-product-001'
      },
      update: {
        price: 10.00,
        stock: 100,
      },
      create: {
        id: 'test-product-001',
        name: 'Test Product',
        description: 'A sample product for testing',
        price: 10.00,
        stock: 100,
        category: 'test',
        tenantId: tenant.id,
      },
    });

    console.log(`✅ Sample product: ${product.name} (ID: ${product.id})`);

    console.log('\n🔌 Initializing plugin system...');
    const { themePlugin, affiliatePlugin } = await initializePluginSystem(tenant.id);

    // Initialize default theme for tenant
    console.log('\n🎨 Initializing default theme for tenant...');
    await initializeTenantDefaultTheme(tenant.id);

    // Initialize subscription system (create subscription plans)
    console.log('\n💳 Initializing subscription system...');
    await initializeSubscriptionSystem(tenant.id, affiliatePlugin);

    // Initialize email templates (create email templates)
    console.log('\n📧 Initializing email templates...');
    await initializeEmailTemplates(tenant.id);

    // Install plugins for test tenant
    console.log('\n🧪 Installing plugins for test tenant...');
    await installPluginsForTestTenant(tenant.id);

    console.log('\n🎉 Database seeding completed successfully!');
    console.log(`
📋 Seeding Summary:
┌─────────────────┬─────────────────────┬──────────────┬───────────┐
│ User Type       │ Email               │ Password     │ Tenant ID │
├─────────────────┼─────────────────────┼──────────────┼───────────┤
│ Super Admin     │ admin@jiffoo.com    │ admin123     │ 0         │
│ Tenant Admin    │ tenant@jiffoo.com   │ admin123     │ ${tenant.id}         │
│ Sample User     │ user@jiffoo.com     │ admin123     │ ${tenant.id}         │
└─────────────────┴─────────────────────┴──────────────┴───────────┘

🏢 Tenant Information:
   Name: ${tenant.companyName}
   ID: ${tenant.id}
   Status: ${tenant.status}

🔌 Plugin Information:
   ✅ Stripe Payment Plugin: INSTALLED (Business Plan - $29/mo)
      - Usage: 5000/10000 API calls, 500/1000 transactions

   ✅ Resend Email Plugin: INSTALLED (Free Plan - $0/mo)
      - Usage: 50/500 API calls, 10/100 emails sent

   ✅ Google OAuth Plugin: INSTALLED (Free Plan)
      - Usage: 50/500 API calls

📊 Test Data Summary:
   - 3 plugins installed and active
   - 3 subscriptions created (1 paid + 2 free)
   - Usage data populated for all plugins
   - Ready for subscription upgrade/downgrade testing!

🔑 Login Instructions:
   Super Admin: No x-tenant-id header needed
   Tenant Users: Add header "x-tenant-id: ${tenant.id}"
`);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
