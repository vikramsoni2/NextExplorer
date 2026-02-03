/* eslint-env node */
module.exports = {
  root: true,
  env: {
    es2022: true,
  },
  extends: ['eslint:recommended', 'prettier'],
  ignorePatterns: [
    'node_modules/',
    'coverage/',
    'dist/',
    'dist-ssr/',
    'storybook-static/',
    '.vitepress/cache/',
    '.vitepress/dist/',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
  },
};
