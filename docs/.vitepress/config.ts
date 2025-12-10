import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Jiffoo Mall',
  description: 'Multi-tenant E-commerce Platform Documentation',
  lang: 'zh-CN',
  
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }]
  ],

  themeConfig: {
    logo: '/logo.svg',
    
    nav: [
      { text: '指南', link: '/guide/' },
      { text: '部署', link: '/deployment/' },
      { text: '开发者', link: '/developer/' },
      { text: 'API', link: '/api/' },
      {
        text: '更多',
        items: [
          { text: 'GitHub', link: 'https://github.com/jiffoo/mall' },
          { text: '更新日志', link: '/changelog' }
        ]
      }
    ],

    sidebar: {
      '/guide/': [
        {
          text: '入门',
          items: [
            { text: '快速开始', link: '/user-guide/quick-start' },
            { text: '商城管理', link: '/user-guide/store-management' },
            { text: '插件配置', link: '/user-guide/plugin-configuration' },
            { text: '主题定制', link: '/user-guide/theme-customization' },
            { text: '常见问题', link: '/user-guide/faq' }
          ]
        }
      ],
      '/deployment/': [
        {
          text: '部署指南',
          items: [
            { text: 'Docker 部署', link: '/deployment/docker' },
            { text: '宝塔面板', link: '/deployment/baota' },
            { text: '1Panel', link: '/deployment/1panel' },
            { text: 'Vercel', link: '/deployment/vercel' }
          ]
        }
      ],
      '/developer/': [
        {
          text: '开发者指南',
          items: [
            { text: '插件开发', link: '/developer/plugin-development' },
            { text: '主题开发', link: '/developer/theme-development' },
            { text: 'API 参考', link: '/developer/api-reference' },
            { text: '贡献指南', link: '/developer/contributing' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'API 参考',
          items: [
            { text: '认证', link: '/api/auth' },
            { text: '商品', link: '/api/products' },
            { text: '购物车', link: '/api/cart' },
            { text: '订单', link: '/api/orders' },
            { text: '用户', link: '/api/users' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/jiffoo/mall' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024 Jiffoo'
    },

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/jiffoo/mall/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页'
    },

    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'short'
      }
    }
  }
});

