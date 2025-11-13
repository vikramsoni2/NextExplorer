export default {
  lang: 'en-US',
  title: 'nextExplorer',
  description: 'Modern, self-hosted file explorer',
  // If hosted on GitHub Pages under /nextExplorer/
  base: '/nextExplorer/',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'Releases', link: '/releases' },
      { text: 'Screenshots', link: '/screenshots' }
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Home', link: '/' },
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Features', link: '/features' },
          { text: 'User Guide', link: '/user-guide' },
          { text: 'Admin Guide', link: '/admin-guide' },
          { text: 'Settings', link: '/settings' },
          { text: 'Authentication (OIDC)', link: '/oidc' },
          { text: 'Authelia (OIDC)', link: '/oidc-authelia' },
          { text: 'Reverse Proxy', link: '/reverse-proxy' },
          { text: 'Configuration', link: '/configuration' },
          { text: 'Deployment', link: '/deployment' },
          { text: 'Troubleshooting', link: '/troubleshooting' },
          { text: 'ONLYOFFICE Integration', link: '/onlyoffice' },
          { text: 'Releases', link: '/releases' },
          { text: 'Screenshots', link: '/screenshots' }
        ]
      }
    ],
    outline: [2, 3]
  }
}
