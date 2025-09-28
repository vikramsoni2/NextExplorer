import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export const content = ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'];
export const darkMode = 'class';
export const theme = {
  extend: {
    colors: {
      'nextgray': {
        100: '#F4F4F4',
        200: '#EAEAEA',
        300: '#D6D6D6',
        400: '#CECECE',

        700: '#303032'
      },
      'nextslate': {
        100: '#F4F4F4',
        200: '#E6E6E6',
        400: '#CECECE',
        900: '#1B1F26'
      },
      'nextzinc': {
        900: '#151618',
        800: '#232325'
      },
      'accent': '#F4B644',
      'slateblue': '#323443'
    },
  },
};
export const variants = {
  extend: {},
};
export const plugins = [typography];
