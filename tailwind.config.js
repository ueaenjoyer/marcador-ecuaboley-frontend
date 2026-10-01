/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#1E40AF',
        secondary: '#FF6B00',
        background: '#F8FAFC',
        surface: '#FFFFFF',
        error: '#DC2626',
        success: '#16A34A',
      },
    },
  },
  plugins: [],
};
