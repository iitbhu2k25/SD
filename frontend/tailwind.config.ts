/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Ensure this is set to 'class'
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './contexts/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};