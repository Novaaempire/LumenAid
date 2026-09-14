/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        lumen: {
          50: '#eef4ff',
          100: '#dbe7ff',
          500: '#3d6cf5',
          600: '#2b53d6',
          700: '#213fa8',
        },
      },
    },
  },
  plugins: [],
};
