import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'LTools - 插件式桌面工具箱',
  description: '一款现代化的跨平台桌面效率工具，采用插件化架构设计，为开发者提供开箱即用的工具集',
  base: '/ltools/',
  ignoreDeadLinks: true,

  head: [
    ['link', { rel: 'icon', href: '/ltools/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#7C3AED' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'zh-CN' }],
    ['meta', { name: 'og:site_name', content: 'LTools' }],
    ['meta', { name: 'og:image', content: '/ltools/images/og-image.png' }],
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: '首页', link: '/' },
      { text: '产品介绍', link: '/guide/introduction' },
      { text: '插件', link: '/plugins/' },
      { text: '下载', link: '/download' },
      { text: '开发文档', link: '/dev/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '开始使用',
          items: [
            { text: '产品介绍', link: '/guide/introduction' },
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '快捷键', link: '/guide/shortcuts' },
            { text: '自动更新', link: '/guide/auto-update' },
          ]
        },
        {
          text: '功能指南',
          items: [
            { text: '全局搜索', link: '/guide/search' },
            { text: '插件管理', link: '/guide/plugin-management' },
            { text: '系统托盘', link: '/guide/system-tray' },
            { text: '数据同步', link: '/guide/sync' },
          ]
        }
      ],
      '/plugins/': [
        {
          text: '内置插件',
          items: [
            { text: '插件概览', link: '/plugins/' },
            { text: '🎵 音乐播放器', link: '/plugins/music-player' },
            { text: '📅 日期时间', link: '/plugins/datetime' },
            { text: '🔢 计算器', link: '/plugins/calculator' },
            { text: '📋 剪贴板管理', link: '/plugins/clipboard' },
            { text: '📸 截图工具', link: '/plugins/screenshot' },
            { text: '📝 JSON 编辑器', link: '/plugins/json-editor' },
            { text: '🔐 密码生成器', link: '/plugins/password' },
            { text: '🔒 密码库', link: '/plugins/vault' },
            { text: '🔖 书签搜索', link: '/plugins/bookmark' },
            { text: '🌐 Hosts 管理', link: '/plugins/hosts' },
            { text: '🚇 隧道管理', link: '/plugins/tunnel' },
            { text: '🌍 IP 信息', link: '/plugins/ipinfo' },
            { text: '📌 便利贴', link: '/plugins/sticky' },
            { text: '🤖 AI 翻译', link: '/plugins/translate' },
            { text: '📄 Markdown', link: '/plugins/markdown' },
            { text: '📱 二维码', link: '/plugins/qrcode' },
            { text: '🖼️ 图床', link: '/plugins/imagebed' },
            { text: '📋 看板', link: '/plugins/kanban' },
            { text: '🚀 应用启动器', link: '/plugins/app-launcher' },
            { text: '💻 系统信息', link: '/plugins/sysinfo' },
            { text: '⚙️ 进程管理', link: '/plugins/process-manager' },
          ]
        }
      ],
      '/dev/': [
        {
          text: '开发指南',
          items: [
            { text: '开发环境搭建', link: '/dev/' },
            { text: '插件开发', link: '/dev/plugin-development' },
            { text: '架构设计', link: '/dev/architecture' },
            { text: 'API 参考', link: '/dev/api-reference' },
          ]
        },
        {
          text: '贡献指南',
          items: [
            { text: '如何贡献', link: '/dev/contributing' },
            { text: '代码规范', link: '/dev/code-style' },
            { text: '发布流程', link: '/dev/releasing' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/lian-yang/ltools' },
    ],

    footer: {
      message: '基于 MIT 许可证发布',
      copyright: 'Copyright © 2025 LTools Contributors'
    },

    editLink: {
      pattern: 'https://github.com/lian-yang/ltools/edit/main/website/docs/:path',
      text: '在 GitHub 上编辑此页'
    },

    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'medium'
      }
    },

    search: {
      provider: 'local'
    }
  }
})
