/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        turbo: {
          blue: '#00A3E0',
          'blue-dark': '#0082B3',
          'blue-light': '#33B5E6'
        }
      }
    },
  },
  plugins: [],
}
