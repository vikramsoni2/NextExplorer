import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'en-US',
  title: 'nextExplorer',
  description: 'Modern, self-hosted file explorer',
  themeConfig: {
    logo: '/images/logo.png',
    search: {
      provider: 'local'
    },
    nav: [
      {
        text: 'Quick Start',
        items: [
          { text: 'Home', link: '/' },
          { text: 'Quick Launch Overview', link: '/quick-launch/overview' },
          { text: 'Visual Tour', link: '/quick-launch/visual-tour' }
        ]
      },
      {
        text: 'Guide',
        items: [
          { text: 'Deployment', link: '/installation/deployment' },
          { text: 'Reverse Proxy & Networking', link: '/installation/reverse-proxy' },
          { text: 'Experience', link: '/experience/features' },
          { text: 'User Workflows', link: '/experience/workflows' },
          { text: 'Personal user folders', link: '/configuration/personal-folders' },
          { text: 'Admin & Access', link: '/admin/guide' },
          { text: 'User volumes', link: '/admin/user-volumes' },
          { text: 'OIDC', link: '/integrations/oidc' },
          { text: 'Authelia', link: '/integrations/authelia' },
          { text: 'ONLYOFFICE', link: '/integrations/onlyoffice' }
        ]
      },
      {
        text: 'Settings',
        items: [
          { text: 'Environment Reference', link: '/configuration/environment' },
          { text: 'Runtime Settings', link: '/configuration/settings' }
        ]
      },
      {
        text: 'Help & FAQ',
        items: [
          { text: 'Troubleshooting', link: '/reference/troubleshooting' },
          { text: 'FAQ', link: '/reference/faq' }
        ]
      },
      
      { text: 'Releases', link: '/reference/releases' }
        
    ],
    sidebar: [
      {
        text: 'Quick Launch',
        items: [
          { text: 'Overview', link: '/quick-launch/overview' },
          { text: 'Visual Tour', link: '/quick-launch/visual-tour' }
        ]
      },
      {
        text: 'Installation & Deployment',
        items: [
          { text: 'Deployment', link: '/installation/deployment' },
          { text: 'Reverse Proxy & Networking', link: '/installation/reverse-proxy' }
        ]
      },
      {
        text: 'Configuration & Settings',
        items: [
          { text: 'Environment Reference', link: '/configuration/environment' },
          { text: 'Runtime Settings', link: '/configuration/settings' }
        ]
      },
      {
        text: 'Experience',
        items: [
          { text: 'Features', link: '/experience/features' },
          { text: 'User Workflows', link: '/experience/workflows' },
          { text: 'Personal user folders', link: '/configuration/personal-folders' }
        ]
      },
      {
        text: 'Admin & Access',
        items: [
          { text: 'Administrator Guide', link: '/admin/guide' },
          { text: 'User volumes', link: '/admin/user-volumes' }
        ]
      },
      {
        text: 'Integrations',
        items: [
          { text: 'OIDC', link: '/integrations/oidc' },
          { text: 'Authelia', link: '/integrations/authelia' },
          { text: 'ONLYOFFICE', link: '/integrations/onlyoffice' }
        ]
      },
      {
        text: 'Help & FAQ',
        items: [
          { text: 'Troubleshooting', link: '/reference/troubleshooting' },
          { text: 'FAQ', link: '/reference/faq' }
        ]
      },
      { text: 'Releases', link: '/reference/releases' }
    ],
    outline: [2, 3]
  }

})
