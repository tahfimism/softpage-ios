/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0a0a0a',
        'bg-secondary': '#111111',
        'bg-tertiary': '#1a1a1a',
        'bg-card': '#161616',
        'bg-elevated': '#202020',
        'accent': '#ff6b35',
        'accent-dim': '#cc5429',
        'text-primary': '#f0f0f0',
        'text-secondary': '#a0a0a0',
        'text-muted': '#666666',
        'border': '#2a2a2a',
        'border-light': '#333333',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
