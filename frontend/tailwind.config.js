/** @type {import('tailwindcss').Config} */
module.exports = {
  purge: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class', // or 'media' or 'class'
  theme: {
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
          900:'#151618',
          800: '#232325'
        },
        'accent':'#F4B644',
        'slateblue':'#323443'
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
}

