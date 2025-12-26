import { setup } from '@storybook/vue3';

import { createPinia } from 'pinia';
import i18n from '../src/i18n';
import '../src/assets/main.css';

setup((app) => {
  app.use(createPinia());
  app.use(i18n);
});

export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/i,
    },
  },
};

export const globalTypes = {
  theme: {
    name: 'Theme',
    description: 'Global theme for components',
    defaultValue: 'light',
    toolbar: {
      icon: 'circlehollow',
      items: [
        { value: 'light', title: 'Light' },
        { value: 'dark', title: 'Dark' },
      ],
      dynamicTitle: true,
    },
  },
};

export const decorators = [
  (story, context) => {
    const isDark = context.globals.theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);

    // Wrap the story so the *canvas background* changes too
    return {
      components: { Story: story() },
      template: `
        <div class="min-h-screen p-6 text-neutral-900 dark:text-neutral-300 bg-white dark:bg-default">
          <Story />
        </div>
      `,
    };
  },
];
