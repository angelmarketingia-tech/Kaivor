/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Daptux brand palette (extracted from the official logo).
        brand: {
          DEFAULT: '#A3CC39', // lime — primary accent
          50: '#F4F9E7',
          100: '#E6F2C5',
          200: '#D2E899',
          300: '#BDDD6B',
          400: '#A3CC39', // core
          500: '#8FB82E',
          600: '#719226',
          700: '#566E20',
          800: '#3C4D18',
          900: '#27330F',
        },
        ink: {
          DEFAULT: '#0B1220', // navy-black — text / dark surfaces
          50: '#F5F7FA',
          100: '#E6EBF2',
          200: '#C8D2E0',
          300: '#9CABC2',
          400: '#6B7C99',
          500: '#475569',
          600: '#2C3852',
          700: '#1A2438',
          800: '#111A2B',
          900: '#0B1220',
          950: '#070C16',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        brand: '0 4px 20px -4px rgba(163, 204, 57, 0.35)',
      },
    },
  },
  plugins: [],
};
